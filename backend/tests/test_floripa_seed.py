from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.models.entities import AudioFile, AudioGenerationJob, Language, Point, Route, Text
from app.scripts.seed_floripa import load_fixture, seed_floripa, stable_id
from app.services.csv_import import resolve_coordinates
from app.services.route_readiness import evaluate_route_readiness


@pytest.fixture
def floripa_settings(monkeypatch):
    monkeypatch.setenv("CITY_NAME", "Florianópolis")
    monkeypatch.setenv("COUNTRY_NAME", "Brasil")
    monkeypatch.setenv("ROUTE_REQUIRE_AUDIO", "false")
    monkeypatch.setenv("ROUTE_REQUIRED_LANGUAGES", '["pt"]')
    get_settings.cache_clear()


def test_seed_refuses_lisbon_configuration(db_session):
    with pytest.raises(ValueError, match="CITY_NAME"):
        seed_floripa(db_session, dry_run=False)
    assert db_session.scalar(select(func.count()).select_from(Point)) == 0


def test_seed_refuses_foreign_database_even_with_floripa_config(db_session, floripa_settings):
    db_session.add(Point(title_pt="Lisboa", lat=38.72, lng=-9.14))
    db_session.commit()
    with pytest.raises(ValueError, match="outside Florianópolis"):
        seed_floripa(db_session, dry_run=False)


def test_dry_run_leaves_data_and_language_unchanged(db_session, floripa_settings):
    assert seed_floripa(db_session) == {"authors": 8, "points": 24, "texts": 24, "routes": 3}
    db_session.commit()
    assert db_session.scalar(select(func.count()).select_from(Point)) == 0
    assert db_session.get(Language, "pt").locale == "pt-PT"
    assert db_session.get(Language, "en").is_active


def test_seed_is_idempotent_preserves_edits_and_publishes_without_audio(
    db_session, floripa_settings
):
    counts = seed_floripa(db_session, dry_run=False)
    db_session.commit()
    assert counts == {"authors": 8, "points": 24, "texts": 24, "routes": 3}
    assert db_session.get(Language, "pt").locale == "pt-BR"
    assert [lang.code for lang in db_session.scalars(select(Language)).all() if lang.is_active] == [
        "pt"
    ]
    assert db_session.scalar(select(func.count()).select_from(AudioFile)) == 0
    assert db_session.scalar(select(func.count()).select_from(AudioGenerationJob)) == 0
    routes = db_session.scalars(select(Route)).all()
    assert len(routes) == 3
    for route in routes:
        assert route.is_published
        assert route.estimated_distance_m > 0
        assert not evaluate_route_readiness(route, "pt", "pt")
        assert all(len(leg.geometry["coordinates"]) > 2 for leg in route.legs)
    point = db_session.get(Point, stable_id("point", "palacio"))
    point.description_pt = "Edição humana preservada"
    text = db_session.get(Text, stable_id("text", "palacio"))
    text.content_pt = "Trecho editado"
    routes[0].is_published = False
    db_session.commit()
    assert seed_floripa(db_session, dry_run=False) == dict.fromkeys(counts, 0)
    db_session.commit()
    assert point.description_pt == "Edição humana preservada"
    assert text.content_pt == "Trecho editado"
    assert not routes[0].is_published


def test_reading_policy_keeps_geometry_and_lisbon_audio_requirements(
    db_session, floripa_settings, monkeypatch
):
    seed_floripa(db_session, dry_run=False)
    route = db_session.scalars(select(Route)).first()
    assert not evaluate_route_readiness(route, "pt", "pt")
    monkeypatch.setenv("ROUTE_REQUIRE_AUDIO", "true")
    get_settings.cache_clear()
    assert any(i.code == "missing_text_audio" for i in evaluate_route_readiness(route, "pt", "pt"))
    monkeypatch.setenv("ROUTE_REQUIRE_AUDIO", "false")
    get_settings.cache_clear()
    route.routing_hash = "obsolete"
    assert evaluate_route_readiness(route, "pt", "pt")


def test_fixture_has_traceable_places_and_attribution():
    fixture = load_fixture()
    assert len(fixture["points"]) == 24
    assert len({p["key"] for p in fixture["points"]}) == 24
    assert all(p["sources"] and p["coordinate_source"]["url"] for p in fixture["points"])
    assert all(t["author"] in {"curadoria", "cruz", "varzea"} for t in fixture["texts"])
    assert all(
        t["rights"] == "original_curatorial_note"
        for t in fixture["texts"]
        if t["author"] == "curadoria"
    )


def test_import_geocodes_with_city_configuration(floripa_settings):
    seen = []

    def geocoder(**query):
        seen.append(query)
        return SimpleNamespace(lat=-27.5973, lng=-48.5495)

    errors = []
    assert resolve_coordinates({"address": "Praça XV"}, errors, geocoder=geocoder) == (
        -27.5973,
        -48.5495,
        True,
    )
    assert not errors
    assert seen[0]["city"] == "Florianópolis"
    assert seen[0]["country"] == "Brasil"
