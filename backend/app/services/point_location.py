from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.entities import AdminUser, Point, PointLocationUpdate, Route, RouteItem, Text
from app.models.enums import RouteRoutingStatus


def update_point_location(
    db: Session,
    point: Point,
    admin: AdminUser,
    lat: float,
    lng: float,
    *,
    source: str,
    accuracy_m: float | None = None,
    measured_at: datetime | None = None,
) -> None:
    if (point.lat, point.lng) == (lat, lng):
        return
    now = datetime.now(UTC)
    db.add(
        PointLocationUpdate(
            point_id=point.id,
            admin_id=admin.id,
            admin_email=admin.email,
            source=source,
            previous_lat=point.lat,
            previous_lng=point.lng,
            lat=lat,
            lng=lng,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
            created_at=now,
        )
    )
    point.lat, point.lng = lat, lng
    point.geom = f"SRID=4326;POINT({lng} {lat})"
    point.location_updated_at = now
    point.location_update_source = source
    route_ids = (
        select(RouteItem.route_id)
        .outerjoin(Text, RouteItem.text_id == Text.id)
        .where(or_(RouteItem.point_id == point.id, Text.point_id == point.id))
    )
    for route in db.scalars(select(Route).where(Route.id.in_(route_ids))):
        route.routing_status = RouteRoutingStatus.STALE.value
        route.routing_hash = None
        route.routing_error = None


def location_metadata(point: Point) -> dict[str, object]:
    return {
        "location_updated_at": point.location_updated_at,
        "location_update_source": point.location_update_source,
    }
