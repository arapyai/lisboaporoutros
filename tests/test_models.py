from sqlalchemy import CheckConstraint, UniqueConstraint

from app.models.base import Base
from app.models.sqltypes import GeometryPoint4326


def test_expected_tables_exist() -> None:
    table_names = set(Base.metadata.tables)

    assert table_names == {
        "admin_users",
        "audio_files",
        "audio_generation_job_items",
        "audio_generation_jobs",
        "authors",
        "points",
        "route_items",
        "routes",
        "texts",
        "translations",
        "voices",
    }


def test_translation_uniqueness_and_non_pt_constraint() -> None:
    translations = Base.metadata.tables["translations"]
    unique_constraints = [c for c in translations.constraints if isinstance(c, UniqueConstraint)]
    check_constraints = [c for c in translations.constraints if isinstance(c, CheckConstraint)]

    assert any(
        {"text_id", "lang"} == {column.name for column in constraint.columns}
        for constraint in unique_constraints
    )
    assert any("lang != 'pt'" in str(constraint.sqltext) for constraint in check_constraints)


def test_route_items_allow_point_or_free_waypoint() -> None:
    route_items = Base.metadata.tables["route_items"]
    check_constraints = [c for c in route_items.constraints if isinstance(c, CheckConstraint)]

    assert any(
        "point_id IS NOT NULL" in str(constraint.sqltext) for constraint in check_constraints
    )


def test_geometry_type_emits_postgis_column_spec() -> None:
    assert GeometryPoint4326().get_col_spec() == "GEOMETRY(POINT,4326)"
