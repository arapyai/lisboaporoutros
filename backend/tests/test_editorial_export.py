from io import BytesIO
from uuid import UUID
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from app.core.security import hash_password
from app.models.entities import AdminUser, AudioFile, Translation
from app.models.enums import TranslationStatus


def auth_header(client, db_session) -> dict[str, str]:
    admin = AdminUser(
        email="editorial@example.com",
        password_hash=hash_password("secret"),
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"email": "editorial@example.com", "password": "secret"},
    )
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_text(client, headers, *, content: str) -> str:
    author = client.post(
        "/api/v1/admin/authors",
        json={"name": f"Autor {content}", "bio_pt": "Biografia"},
        headers=headers,
    ).json()["data"]
    point = client.post(
        "/api/v1/admin/points",
        json={
            "title_pt": f"Ponto {content}",
            "address": "Rua de teste",
            "neighborhood": "Bairro",
            "lat": 38.71,
            "lng": -9.14,
        },
        headers=headers,
    ).json()["data"]
    response = client.post(
        "/api/v1/admin/texts",
        json={
            "point_id": point["id"],
            "author_id": author["id"],
            "content_pt": content,
            "source_work": "Obra",
            "source_year": 2026,
            "content_type": "prose",
        },
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def test_editorial_export_contains_selected_text_relations_and_languages(
    client, db_session
) -> None:
    headers = auth_header(client, db_session)
    text_id = create_text(client, headers, content="Texto incluído")
    create_text(client, headers, content="Texto excluído")
    db_session.add(
        Translation(
            text_id=UUID(text_id),
            lang="en",
            content="Included translation",
            status=TranslationStatus.APPROVED,
            reviewed_by="revisora@example.com",
        )
    )
    db_session.add(
        AudioFile(
            text_id=UUID(text_id),
            lang="pt",
            public_url="https://media.example/texto.mp3",
            manually_uploaded=True,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/admin/editorial-export",
        json={"text_ids": [text_id]},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "lisboa-pacote-editorial.xlsx" in response.headers["content-disposition"]
    with ZipFile(BytesIO(response.content)) as archive:
        names = archive.namelist()
        assert "xl/worksheets/sheet1.xml" in names
        assert len([name for name in names if name.startswith("xl/worksheets/sheet")]) == 4
        xml = "\n".join(
            archive.read(name).decode("utf-8", errors="ignore")
            for name in names
            if name.endswith(".xml")
        )
    assert "Texto incluído" in xml
    assert "Included translation" in xml
    assert "revisora@example.com" in xml
    assert "https://media.example/texto.mp3" in xml
    assert "Texto excluído" not in xml
    rows, sheet = workbook_rows(response.content)
    row = rows[0]
    assert row["texto_id"] == text_id
    assert row["texto_pt"] == "Texto incluído"
    assert row["texto_en"] == "Included translation"
    assert row["traducao_en_status"] == "approved"
    assert row["traducao_en_revisor"] == "revisora@example.com"
    assert row["texto_es"] == ""
    assert row["traducao_es_status"] == "missing"
    assert row["audio_pt_status"] == "manual"
    assert row["audio_pt_url"] == "https://media.example/texto.mp3"
    assert row["latitude"] == "38.71"
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    assert sheet.find("s:sheetViews/s:sheetView/s:pane", ns).get("topLeftCell") == "C2"
    assert sheet.find("s:autoFilter", ns) is not None


def workbook_rows(content: bytes):
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with ZipFile(BytesIO(content)) as archive:
        shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = ["".join(item.itertext()) for item in shared]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        assert [item.get("name") for item in workbook.find("s:sheets", ns)] == [
            "Textos",
            "Pontos",
            "Autores",
            "Metadados",
        ]
    values = []
    for row in sheet.findall("s:sheetData/s:row", ns):
        cells = []
        for cell in row.findall("s:c", ns):
            value = cell.find("s:v", ns)
            cells.append(strings[int(value.text)] if cell.get("t") == "s" else value.text)
        values.append(cells)
    return [dict(zip(values[0], row, strict=True)) for row in values[1:]], sheet


def test_export_keeps_multiple_texts_and_translations_on_their_own_rows(client, db_session):
    headers = auth_header(client, db_session)
    ids = [create_text(client, headers, content=f"Original {index}") for index in range(2)]
    for index, text_id in enumerate(ids):
        db_session.add(
            Translation(
                text_id=UUID(text_id),
                lang="en",
                content=f"English {index}",
                status=TranslationStatus.PENDING,
            )
        )
    db_session.commit()
    response = client.post(
        "/api/v1/admin/editorial-export", json={"text_ids": ids}, headers=headers
    )
    assert response.status_code == 200
    rows, _ = workbook_rows(response.content)
    assert len(rows) == 2
    by_id = {row["texto_id"]: row for row in rows}
    for index, text_id in enumerate(ids):
        assert by_id[text_id]["texto_pt"] == f"Original {index}"
        assert by_id[text_id]["texto_en"] == f"English {index}"
        assert by_id[text_id]["traducao_en_status"] == "pending"


def test_editorial_export_does_not_turn_content_into_formulas(client, db_session) -> None:
    headers = auth_header(client, db_session)
    text_id = create_text(client, headers, content='=HYPERLINK("https://example.com")')
    db_session.add(
        Translation(
            text_id=UUID(text_id),
            lang="en",
            content="=SUM(1,2)\nLiteral translation",
            status=TranslationStatus.PENDING,
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/admin/editorial-export",
        json={"text_ids": [text_id]},
        headers=headers,
    )

    with ZipFile(BytesIO(response.content)) as archive:
        worksheet_xml = archive.read("xl/worksheets/sheet1.xml").decode("utf-8")
        shared_strings = archive.read("xl/sharedStrings.xml").decode("utf-8")
    assert "<f>" not in worksheet_xml
    assert "HYPERLINK" in shared_strings
    rows, _ = workbook_rows(response.content)
    assert rows[0]["texto_en"] == "=SUM(1,2)\nLiteral translation"


def test_editorial_export_requires_authentication(client) -> None:
    response = client.post("/api/v1/admin/editorial-export", json={"text_ids": []})
    assert response.status_code == 401
