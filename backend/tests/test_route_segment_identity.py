from uuid import UUID

from app.models.entities import RouteSegmentAudioFile, RouteSegmentTranslation
from tests.test_route_bridges import auth_header, create_bridge


def test_edit_and_reorder_preserve_bridge_review_and_manual_audio(client, db_session):
    headers = auth_header(client, db_session)
    route_id, segment_id = create_bridge(client, headers)
    translation = client.put(
        f"/api/v1/admin/routes/{route_id}/segments/{segment_id}/translations/en",
        json={"content": "Human review", "status": "approved"},
        headers=headers,
    ).json()["data"]
    db_session.add(
        RouteSegmentAudioFile(
            segment_id=UUID(segment_id),
            lang="pt",
            manually_uploaded=True,
            public_url="/audio/manual.mp3",
        )
    )
    db_session.commit()
    response = client.put(
        f"/api/v1/admin/routes/{route_id}",
        headers=headers,
        json={
            "title_pt": "Updated narrative",
            "segments": [
                {"position": 0, "kind": "bridge", "bridge_content_pt": "New introduction"},
                {
                    "id": segment_id,
                    "position": 1,
                    "kind": "bridge",
                    "bridge_content_pt": "Edited PT",
                },
            ],
        },
    )
    assert response.status_code == 200
    retained = response.json()["data"]["segments"][1]
    assert retained["id"] == segment_id
    assert retained["translations"][0]["id"] == translation["id"]
    stored_translation = db_session.get(RouteSegmentTranslation, UUID(translation["id"]))
    assert stored_translation.reviewed_by == translation["reviewed_by"]
    assert retained["translations"][0]["status"] == "approved"
    assert retained["audio_files"][0]["manually_uploaded"] is True
    assert retained["audio_files"][0]["public_url"] == "/audio/manual.mp3"


def test_route_rejects_foreign_segment_without_mutating_title(client, db_session):
    headers = auth_header(client, db_session)
    route_id, _ = create_bridge(client, headers)
    _, foreign_id = create_bridge(client, headers)
    response = client.put(
        f"/api/v1/admin/routes/{route_id}",
        headers=headers,
        json={
            "title_pt": "Must not persist",
            "segments": [
                {"id": foreign_id, "position": 0, "kind": "bridge", "bridge_content_pt": "Foreign"},
            ],
        },
    )
    assert response.status_code == 422
    listed = client.get("/api/v1/admin/routes", headers=headers).json()["data"]
    assert (
        next(route for route in listed if route["id"] == route_id)["title_pt"]
        == "Percurso curatorial"
    )


def test_legacy_edit_cannot_silently_delete_manual_audio(client, db_session):
    headers = auth_header(client, db_session)
    route_id, segment_id = create_bridge(client, headers)
    db_session.add(
        RouteSegmentAudioFile(
            segment_id=UUID(segment_id),
            lang="pt",
            manually_uploaded=True,
            public_url="/audio/manual.mp3",
        )
    )
    db_session.commit()
    response = client.put(
        f"/api/v1/admin/routes/{route_id}",
        headers=headers,
        json={
            "title_pt": "Must not persist",
            "segments": [
                {"position": 0, "kind": "bridge", "bridge_content_pt": "Changed without ID"},
            ],
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "route_segment_identity_required"
    assert (
        db_session.query(RouteSegmentAudioFile).filter_by(segment_id=UUID(segment_id)).count() == 1
    )


def test_reorder_and_remove_use_explicit_identity_without_position_collisions(client, db_session):
    headers = auth_header(client, db_session)
    route = client.post(
        "/api/v1/admin/routes",
        headers=headers,
        json={
            "title_pt": "Duplicate bridges",
            "segments": [
                {"position": 0, "kind": "bridge", "bridge_content_pt": "Same"},
                {"position": 1, "kind": "bridge", "bridge_content_pt": "Same"},
            ],
        },
    ).json()["data"]
    first, second = route["segments"]
    payload = {
        "title_pt": "Duplicate bridges",
        "segments": [
            {"id": second["id"], "position": 0, "kind": "bridge", "bridge_content_pt": "Same"},
            {"id": first["id"], "position": 1, "kind": "bridge", "bridge_content_pt": "Same"},
        ],
    }
    response = client.put(f"/api/v1/admin/routes/{route['id']}", headers=headers, json=payload)
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["data"]["segments"]] == [
        second["id"],
        first["id"],
    ]
    duplicate = {
        **payload,
        "segments": [payload["segments"][0], {**payload["segments"][1], "id": second["id"]}],
    }
    assert (
        client.put(
            f"/api/v1/admin/routes/{route['id']}", headers=headers, json=duplicate
        ).status_code
        == 422
    )
    response = client.put(
        f"/api/v1/admin/routes/{route['id']}",
        headers=headers,
        json={
            **payload,
            "segments": [payload["segments"][1]],
        },
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["data"]["segments"]] == [first["id"]]


def test_identity_mode_can_replace_all_segments_explicitly(client, db_session):
    headers = auth_header(client, db_session)
    route_id, old_id = create_bridge(client, headers)
    response = client.put(
        f"/api/v1/admin/routes/{route_id}",
        headers=headers,
        json={
            "title_pt": "Replacement",
            "segment_identity_mode": "preserve",
            "segments": [
                {"position": 0, "kind": "bridge", "bridge_content_pt": "Começamos junto ao Tejo."},
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["segments"][0]["id"] != old_id
