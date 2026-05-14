from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import UserDefinedType


class GeometryPoint4326(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **_kw: object) -> str:
        return "GEOMETRY(POINT,4326)"


@compiles(GeometryPoint4326, "sqlite")
def compile_geometry_sqlite(_type: GeometryPoint4326, _compiler, **_kw: object) -> str:
    return "TEXT"
