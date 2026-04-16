from sqlalchemy.types import UserDefinedType


class GeometryPoint4326(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **_kw: object) -> str:
        return "GEOMETRY(POINT,4326)"
