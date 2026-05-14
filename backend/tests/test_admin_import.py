from app.models.entities import Point
from tests.test_admin_content import auth_header

CSV_CONTENT = (
    b"author_name,title,address,neighborhood,lat,lng,content_pt,source_work,source_year,content_type\n"
    b"Fernando Pessoa,Tabacaria do Rossio,Rossio 59,Baixa,"
    b"38.7134,-9.1392,Nao sou nada.,Tabacaria,1928,poetry\n"
)


def test_csv_preview_reports_create_action(client, db_session) -> None:
    headers = auth_header(client, db_session)

    response = client.post(
        "/api/v1/admin/points/import/preview",
        headers=headers,
        files={"file": ("points.csv", CSV_CONTENT, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["data"][0]["action"] == "create"


def test_csv_confirm_is_idempotent_by_author_and_title(client, db_session) -> None:
    headers = auth_header(client, db_session)

    first = client.post(
        "/api/v1/admin/points/import/confirm",
        headers=headers,
        files={"file": ("points.csv", CSV_CONTENT, "text/csv")},
    )
    second = client.post(
        "/api/v1/admin/points/import/confirm",
        headers=headers,
        files={"file": ("points.csv", CSV_CONTENT, "text/csv")},
    )

    assert first.status_code == 200
    assert first.json()["data"]["created"] == 1
    assert second.json()["data"]["updated"] == 1
    assert len(db_session.query(Point).all()) == 1
