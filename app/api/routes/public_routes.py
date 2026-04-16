from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models.entities import Route, RouteItem
from app.schemas.common import EnvelopeMeta, envelope

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


def serialize_route_item(item: RouteItem) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": str(item.id),
        "position": item.position,
        "transition_text_pt": item.transition_text_pt,
    }
    if item.point is not None:
        payload["point"] = {
            "id": str(item.point.id),
            "title_pt": item.point.title_pt,
            "lat": item.point.lat,
            "lng": item.point.lng,
        }
    else:
        payload["waypoint"] = {"lat": item.waypoint_lat, "lng": item.waypoint_lng}
    return payload


def serialize_route(route: Route) -> dict[str, object]:
    return {
        "id": str(route.id),
        "title_pt": route.title_pt,
        "description_pt": route.description_pt,
        "cover_image_url": route.cover_image_url,
        "difficulty": route.difficulty,
        "is_published": route.is_published,
        "estimated_distance_m": route.estimated_distance_m,
        "estimated_duration_s": route.estimated_duration_s,
    }


@router.get("")
def list_routes(db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    routes = db.scalars(
        select(Route).where(Route.is_published.is_(True)).order_by(Route.title_pt)
    ).all()
    return envelope([serialize_route(route) for route in routes], EnvelopeMeta(total=len(routes)))


@router.get("/{route_id}")
def get_route(route_id: UUID, db: Annotated[Session, Depends(get_db)]) -> dict[str, object]:
    route = db.scalar(
        select(Route)
        .options(selectinload(Route.items).selectinload(RouteItem.point))
        .where(Route.id == route_id, Route.is_published.is_(True))
    )
    if route is None:
        raise HTTPException(status_code=404, detail="Route not found")

    payload = serialize_route(route)
    payload["items"] = [serialize_route_item(item) for item in route.items]
    return envelope(payload, EnvelopeMeta())
