from sqlalchemy import func, select

from app.core.config import get_settings
from app.models.entities import Point, Route
from app.scripts.seed_floripa import seed_floripa
from app.services.route_readiness import evaluate_route_readiness


def test_floripa_seed_on_real_migrations(db_session, monkeypatch):
    monkeypatch.setenv("CITY_NAME", "Florianópolis")
    monkeypatch.setenv("COUNTRY_NAME", "Brasil")
    monkeypatch.setenv("ROUTE_REQUIRE_AUDIO", "false")
    monkeypatch.setenv("ROUTE_REQUIRED_LANGUAGES", '["pt"]')
    get_settings.cache_clear()
    assert seed_floripa(db_session, dry_run=False)["routes"] == 3
    db_session.commit()
    assert db_session.scalar(select(func.count()).select_from(Point)) == 24
    for route in db_session.scalars(select(Route)).all():
        assert route.is_published
        assert not evaluate_route_readiness(route, "pt", "pt")
    assert seed_floripa(db_session, dry_run=False)["points"] == 0
    db_session.commit()
