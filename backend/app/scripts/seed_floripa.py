"""Load the researched Floripa corpus; no provider calls or automatic audio jobs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.entities import Author, Language, Point, PointType, Route, RouteItem, RouteLeg, Text
from app.models.enums import ContentType
from app.models.point_type_catalog import DEFAULT_POINT_TYPES
from app.services.route_readiness import evaluate_route_readiness, route_routing_payload
from app.services.routing import route_input_hash

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "floripa.json"


def stable_id(kind: str, key: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"https://floripa.literarymap.org/seed/{kind}/{key}")


def load_fixture() -> dict:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    for point in fixture["points"]:
        if not (-27.85 <= point["lat"] <= -27.35 and -48.65 <= point["lng"] <= -48.35):
            raise ValueError(f"Point outside Florianópolis: {point['key']}")
        if not point["sources"] or not point["coordinate_source"]:
            raise ValueError(f"Missing provenance: {point['key']}")
    return fixture


def seed_floripa(db: Session, *, dry_run: bool = True) -> dict[str, int]:
    settings = get_settings()
    if settings.city_name != "Florianópolis" or settings.country_name != "Brasil":
        raise ValueError("Floripa seed requires CITY_NAME=Florianópolis and COUNTRY_NAME=Brasil")
    fixture = load_fixture()
    seed_point_ids = {stable_id("point", item["key"]) for item in fixture["points"]}
    # Refuse a Lisbon database, including when someone accidentally changes its city variables.
    if any(
        not (-27.85 <= point.lat <= -27.35 and -48.65 <= point.lng <= -48.35)
        for point in db.scalars(select(Point)).all()
    ):
        raise ValueError("Database contains points outside Florianópolis; seed refused")
    counts = {"authors": 0, "points": 0, "texts": 0, "routes": 0}
    with db.begin_nested() as transaction:
        first_run = not any(db.get(Point, identifier) for identifier in seed_point_ids)
        if first_run:
            language = db.get(Language, "pt")
            if language is None:
                language = Language(code="pt", name="Português brasileiro")
                db.add(language)
            language.locale, language.country_code = "pt-BR", "BR"
            for other in db.scalars(select(Language)).all():
                other.is_source = False
                other.is_active = other.code == "pt"
            db.flush()
            language.is_active = language.is_source = True
        for item in DEFAULT_POINT_TYPES:
            if db.get(PointType, item["id"]) is None:
                db.add(PointType(**item))
        db.flush()

        def add_missing(model, kind, key, values):
            identifier = stable_id(kind, key)
            entity = db.get(model, identifier)
            if entity is None:
                entity = model(id=identifier, **values)
                db.add(entity)
                count_key = {Author: "authors", Point: "points", Text: "texts", Route: "routes"}[
                    model
                ]
                counts[count_key] += 1
            return entity

        for item in fixture["authors"]:
            add_missing(Author, "author", item["key"], item["data"])
        for item in fixture["points"]:
            add_missing(
                Point,
                "point",
                item["key"],
                {
                    "title_pt": item["title"],
                    "description_pt": item["description"],
                    "address": item["address"],
                    "neighborhood": item["neighborhood"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                },
            )
        db.flush()
        for item in fixture["texts"]:
            add_missing(
                Text,
                "text",
                item["key"],
                {
                    "point_id": stable_id("point", item["point"]),
                    "author_id": stable_id("author", item["author"]),
                    "content_pt": item["content"],
                    "source_work": item["source_work"],
                    "source_year": item["source_year"],
                    "content_type": ContentType(item["content_type"]),
                    "origin": "manual",
                },
            )
        db.flush()
        for item in fixture["routes"]:
            if db.get(Route, stable_id("route", item["key"])) is not None:
                continue  # Preserve the editor's segments, routing and publication status.
            route = add_missing(
                Route,
                "route",
                item["key"],
                {
                    "slug": f"floripa-{item['key']}",
                    "title_pt": item["title"],
                    "description_pt": item["description"],
                    "difficulty": "easy",
                    "is_published": False,
                    "routing_status": "pending",
                },
            )
            for position, key in enumerate(item["texts"], start=1):
                route.items.append(
                    RouteItem(
                        id=stable_id("segment", f"{item['key']}/{position}"),
                        position=position,
                        kind="text",
                        text_id=stable_id("text", key),
                    )
                )
            db.flush()
            db.expire(route, ["items"])
            for position, leg in enumerate(item.get("legs", [])):
                route.legs.append(
                    RouteLeg(
                        position=position,
                        from_segment_id=route.items[position].id,
                        to_segment_id=route.items[position + 1].id,
                        waypoints=[],
                        **leg,
                    )
                )
            db.flush()
            if len(route.legs) == len(route.items) - 1:
                route.routing_hash = route_input_hash(route_routing_payload(route))
                route.routing_status = "ready"
                route.estimated_distance_m = sum(leg.distance_m for leg in route.legs)
                route.estimated_duration_s = sum(leg.duration_s for leg in route.legs)
            # Apply the same readiness checks as an editorial publication, including audio policy.
            if item.get("publish") and not evaluate_route_readiness(route, "pt", "pt"):
                route.is_published = True
        db.flush()
        if dry_run:
            transaction.rollback()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit seed (default: dry-run)")
    args = parser.parse_args()
    with SessionLocal() as db:
        counts = seed_floripa(db, dry_run=not args.apply)
        if args.apply:
            db.commit()
        else:
            db.rollback()
    print(json.dumps({"dry_run": not args.apply, "created": counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
