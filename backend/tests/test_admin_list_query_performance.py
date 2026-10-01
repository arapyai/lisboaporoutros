import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.api.routes.admin_content import list_admin_routes, list_admin_texts
from app.api.routes.admin_routes import list_route_readiness
from app.models.entities import Author, Point, PointTranslation, PointType, Route, RouteItem, Text
from app.models.enums import ContentType


@pytest.mark.parametrize("size", [1, 16])
@pytest.mark.parametrize("resource,budget", [("texts", 7), ("routes", 13), ("readiness", 11)])
def test_list_query_count_does_not_grow_per_point(db_session, size, resource, budget):
    point_type = db_session.scalar(select(PointType).limit(1))
    type_id = point_type.id
    for index in range(size):
        author = Author(name=f"Author {index}")
        point = Point(title_pt=f"Point {index}", lat=38.7, lng=-9.1, point_type=point_type)
        point.translations = [PointTranslation(lang="en", title=f"English point {index}")]
        text = Text(
            author=author, point=point, content_pt=f"Text {index}", content_type=ContentType.PROSE
        )
        route = Route(
            title_pt=f"Route {index}", items=[RouteItem(position=1, kind="text", text=text)]
        )
        db_session.add(route)
    db_session.commit()

    count = 0

    def count_query(*args):
        nonlocal count
        count += 1

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", count_query)
    try:
        # A fresh session is essential: fixture identity caches would hide lazy queries.
        with Session(engine) as session:
            function = {
                "texts": list_admin_texts,
                "routes": list_admin_routes,
                "readiness": list_route_readiness,
            }[resource]
            result = function(None, session)
            assert len(result["data"]) == size
            assert count <= budget
            for item in result["data"]:
                if resource == "readiness":
                    assert len(item["segments"]) == 1
                    assert {entry["lang"] for entry in item["readiness"]} == {"pt", "en"}
                    assert all(not entry["ready"] for entry in item["readiness"])
                    continue
                text = item if resource == "texts" else item["segments"][0]["text"]
                assert text["point"]["point_type"]["id"] == str(type_id)
                assert text["point"]["translations"][0]["title"].startswith("English point")
                assert text["content_pt"].startswith("Text ")
                assert text["author"]["name"].startswith("Author ")
    finally:
        event.remove(engine, "before_cursor_execute", count_query)
