from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.entities import (
    AdminUser,
    Author,
    Point,
    PointLocationUpdate,
    Route,
    RouteItem,
    Text,
)
from app.models.enums import ContentType


@pytest.fixture
def location_case(db_session):
    admin = AdminUser(email="editor@example.com", password_hash="unused", is_active=True)
    point = Point(title_pt="Chiado", lat=38.71, lng=-9.14, address="Preservar endereço")
    db_session.add_all([admin, point])
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
    payload = {
        "lat": 38.7101,
        "lng": -9.1401,
        "expected_lat": point.lat,
        "expected_lng": point.lng,
        "accuracy_m": 12,
        "measured_at": datetime.now(UTC).isoformat(),
    }
    return admin, point, headers, payload


def test_gps_correction_records_audit_and_preserves_content(client, db_session, location_case):
    admin, point, headers, payload = location_case
    response = client.put(
        f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
    )
    assert response.status_code == 200
    updated = response.json()["data"]
    assert updated["location_update_source"] == "admin_gps_pwa"
    assert updated["location_updated_at"]
    assert updated["address"] == "Preservar endereço"
    assert updated["title_pt"] == "Chiado"
    db_session.refresh(point)
    assert point.geom == "SRID=4326;POINT(-9.1401 38.7101)"
    record = db_session.scalar(select(PointLocationUpdate))
    assert record.admin_id == admin.id
    assert record.previous_lat == 38.71
    assert record.previous_lng == -9.14
    assert record.accuracy_m == 12
    history = client.get(f"/api/v1/admin/points/{point.id}/location-history", headers=headers)
    assert history.json()["data"][0]["admin_email"] == admin.email
    public = client.get(f"/api/v1/points/{point.id}").json()["data"]
    assert public["lat"] == payload["lat"]
    assert public["location_update_source"] == "admin_gps_pwa"
    assert admin.email not in str(public)


@pytest.mark.parametrize(
    "field,value",
    [
        ("lat", 91),
        ("lng", -181),
        ("lat", "NaN"),
        ("accuracy_m", 61),
        ("accuracy_m", 0),
        ("accuracy_m", "Infinity"),
        ("measured_at", "2020-01-01T00:00:00Z"),
        ("measured_at", "2026-09-30T00:00:00"),
    ],
)
def test_invalid_gps_never_changes_point(client, db_session, location_case, field, value):
    _, point, headers, payload = location_case
    payload[field] = value
    assert (
        client.put(
            f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
        ).status_code
        == 422
    )
    db_session.refresh(point)
    assert point.lat == 38.71
    assert db_session.scalar(select(PointLocationUpdate)) is None


def test_future_fix_and_concurrent_update_are_rejected(client, db_session, location_case):
    _, point, headers, payload = location_case
    payload["measured_at"] = (datetime.now(UTC) + timedelta(minutes=1)).isoformat()
    assert (
        client.put(
            f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
        ).status_code
        == 422
    )
    payload["measured_at"] = datetime.now(UTC).isoformat()
    payload["expected_lat"] = 39
    assert (
        client.put(
            f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
        ).status_code
        == 409
    )
    assert db_session.scalar(select(PointLocationUpdate)) is None


def test_location_auth_and_unknown_point(client, db_session, location_case):
    admin, point, headers, payload = location_case
    path = f"/api/v1/admin/points/{point.id}/location"
    assert client.put(path, json=payload).status_code == 401
    assert client.get(f"/api/v1/admin/points/{point.id}/location-history").status_code == 401
    unknown = UUID(int=999)
    assert (
        client.put(
            f"/api/v1/admin/points/{unknown}/location", json=payload, headers=headers
        ).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/admin/points/{unknown}/location-history", headers=headers).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/admin/points/{point.id}/location-history?page=0", headers=headers
        ).status_code
        == 422
    )
    admin.auth_version += 1
    db_session.commit()
    assert client.put(path, json=payload, headers=headers).status_code == 401
    assert db_session.scalar(select(PointLocationUpdate)) is None


def test_noop_and_manual_editor_audit(client, db_session, location_case):
    _, point, headers, payload = location_case
    payload.update(lat=point.lat, lng=point.lng)
    assert (
        client.put(
            f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
        ).status_code
        == 200
    )
    assert db_session.scalar(select(PointLocationUpdate)) is None
    manual = {"title_pt": "Chiado corrigido", "lat": 38.7102, "lng": -9.1402}
    assert (
        client.put(f"/api/v1/admin/points/{point.id}", json=manual, headers=headers).status_code
        == 200
    )
    record = db_session.scalar(select(PointLocationUpdate))
    assert record.source == "admin_editor"
    assert record.accuracy_m is None
    assert (
        client.put(f"/api/v1/admin/points/{point.id}", json=manual, headers=headers).status_code
        == 200
    )
    assert len(db_session.scalars(select(PointLocationUpdate)).all()) == 1


def test_correction_invalidates_affected_route_geometry(client, db_session, location_case):
    _, point, headers, payload = location_case
    author = Author(name="Autor")
    db_session.add(author)
    db_session.flush()
    text = Text(
        point_id=point.id, author_id=author.id, content_pt="Texto", content_type=ContentType.PROSE
    )
    db_session.add(text)
    db_session.flush()
    route = Route(title_pt="Percurso", routing_status="ready", routing_hash="old")
    db_session.add(route)
    db_session.flush()
    db_session.add(RouteItem(route_id=route.id, position=1, kind="text", text_id=text.id))
    db_session.commit()
    assert (
        client.put(
            f"/api/v1/admin/points/{point.id}/location", json=payload, headers=headers
        ).status_code
        == 200
    )
    db_session.refresh(route)
    assert route.routing_status == "stale"
    assert route.routing_hash is None
