from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from io import BytesIO

import xlsxwriter

from app.models.entities import AudioFile, Text


def build_editorial_workbook(texts: Iterable[Text], language_codes: list[str]) -> bytes:
    selected = list(texts)
    output = BytesIO()
    workbook = xlsxwriter.Workbook(
        output,
        {
            "in_memory": True,
            "strings_to_formulas": False,
            "strings_to_urls": False,
        },
    )
    header = workbook.add_format(
        {"bold": True, "bg_color": "#163832", "font_color": "#FFFFFF", "border": 1}
    )
    wrap = workbook.add_format({"text_wrap": True, "valign": "top"})
    link = workbook.add_format({"font_color": "#2D6EA3", "underline": True})

    text_sheet = workbook.add_worksheet("Textos")
    text_headers = [
        "texto_id",
        "autor_id",
        "autor_nome",
        "ponto_id",
        "ponto_nome",
        "tipo_ponto",
        "morada",
        "bairro",
        "latitude",
        "longitude",
        "obra",
        "ano",
        "tipo_conteudo",
        "texto_pt",
        "audio_pt_status",
        "audio_pt_url",
    ]
    _write_header(text_sheet, text_headers, header)

    for row, text in enumerate(selected, start=1):
        audio_files = {item.lang: item for item in text.audio_files}
        source_audio = audio_files.get("pt")
        values: list[object] = [
            str(text.id),
            str(text.author_id),
            text.author.name,
            str(text.point_id),
            text.point.title_pt,
            text.point.point_type.name_pt,
            text.point.address or "",
            text.point.neighborhood or "",
            text.point.lat,
            text.point.lng,
            text.source_work or "",
            text.source_year or "",
            _enum_value(text.content_type),
            text.content_pt,
            _audio_status(source_audio),
            source_audio.public_url or "" if source_audio else "",
        ]
        _write_row(text_sheet, row, values, wrap, link, text_headers)

    text_sheet.freeze_panes(1, 0)
    text_sheet.autofilter(0, 0, max(len(selected), 1), len(text_headers) - 1)
    text_sheet.set_column(0, 1, 38)
    text_sheet.set_column(2, 7, 24)
    text_sheet.set_column(8, 9, 12)
    text_sheet.set_column(10, len(text_headers) - 1, 30)
    _configure_print(text_sheet)

    translation_sheet = workbook.add_worksheet("Traduções")
    translation_headers = [
        "texto_id",
        "idioma",
        "traducao",
        "status",
        "revisor",
        "audio_status",
        "audio_url",
    ]
    _write_header(translation_sheet, translation_headers, header)
    translation_row = 1
    target_languages = [language for language in language_codes if language != "pt"]
    for text in selected:
        translations = {item.lang: item for item in text.translations}
        audio_files = {item.lang: item for item in text.audio_files}
        for language in target_languages:
            translation = translations.get(language)
            audio = audio_files.get(language)
            _write_row(
                translation_sheet,
                translation_row,
                [
                    str(text.id),
                    language,
                    translation.content if translation else "",
                    _enum_value(translation.status) if translation else "missing",
                    translation.reviewed_by or "" if translation else "",
                    _audio_status(audio),
                    audio.public_url or "" if audio else "",
                ],
                wrap,
                link,
                translation_headers,
            )
            translation_row += 1
    translation_sheet.freeze_panes(1, 2)
    translation_sheet.autofilter(
        0,
        0,
        max(translation_row - 1, 1),
        len(translation_headers) - 1,
    )
    translation_sheet.set_column(0, 0, 38)
    translation_sheet.set_column(1, 1, 10)
    translation_sheet.set_column(2, 2, 64)
    translation_sheet.set_column(3, 6, 24)
    _configure_print(translation_sheet)

    points = sorted(
        {text.point.id: text.point for text in selected}.values(),
        key=lambda item: item.title_pt,
    )
    point_sheet = workbook.add_worksheet("Pontos")
    point_headers = ["ponto_id", "nome", "tipo", "morada", "bairro", "latitude", "longitude"]
    _write_header(point_sheet, point_headers, header)
    for row, point in enumerate(points, start=1):
        _write_row(
            point_sheet,
            row,
            [
                str(point.id),
                point.title_pt,
                point.point_type.name_pt,
                point.address or "",
                point.neighborhood or "",
                point.lat,
                point.lng,
            ],
            wrap,
            link,
            point_headers,
        )
    point_sheet.freeze_panes(1, 0)
    point_sheet.set_column(0, 0, 38)
    point_sheet.set_column(1, 4, 28)
    _configure_print(point_sheet)

    authors = sorted(
        {text.author.id: text.author for text in selected}.values(),
        key=lambda item: item.name,
    )
    author_sheet = workbook.add_worksheet("Autores")
    author_headers = ["autor_id", "nome", "bio_pt", "nascimento", "morte", "foto_url"]
    _write_header(author_sheet, author_headers, header)
    for row, author in enumerate(authors, start=1):
        _write_row(
            author_sheet,
            row,
            [
                str(author.id),
                author.name,
                author.bio_pt or "",
                author.birth_year or "",
                author.death_year or "",
                author.photo_url or "",
            ],
            wrap,
            link,
            author_headers,
        )
    author_sheet.freeze_panes(1, 0)
    author_sheet.set_column(0, 0, 38)
    author_sheet.set_column(1, 2, 36)
    author_sheet.set_column(3, 5, 18)
    _configure_print(author_sheet)

    metadata_sheet = workbook.add_worksheet("Metadados")
    _write_header(metadata_sheet, ["campo", "valor"], header)
    metadata = [
        ("gerado_em_utc", datetime.now(UTC).isoformat()),
        ("total_textos", len(selected)),
        ("total_pontos", len(points)),
        ("total_autores", len(authors)),
        ("idiomas", ", ".join(language_codes)),
        (
            "round_trip",
            "Use os IDs para preservar vínculos; este arquivo não importa alterações "
            "automaticamente.",
        ),
    ]
    for row, values in enumerate(metadata, start=1):
        _write_row(metadata_sheet, row, list(values), wrap, link, ["campo", "valor"])
    metadata_sheet.set_column(0, 0, 24)
    metadata_sheet.set_column(1, 1, 90)
    _configure_print(metadata_sheet)

    workbook.close()
    return output.getvalue()


def _write_header(sheet, headers: list[str], header_format) -> None:
    for column, value in enumerate(headers):
        sheet.write_string(0, column, value, header_format)


def _configure_print(sheet) -> None:
    sheet.set_landscape()
    sheet.fit_to_pages(1, 0)
    sheet.repeat_rows(0)
    sheet.set_margins(0.25, 0.25, 0.4, 0.4)


def _write_row(sheet, row: int, values: list[object], wrap, link, headers: list[str]) -> None:
    for column, value in enumerate(values):
        if isinstance(value, bool):
            sheet.write_boolean(row, column, value)
        elif isinstance(value, int | float):
            sheet.write_number(row, column, value)
        else:
            cell_format = link if headers[column].endswith("_url") and value else wrap
            sheet.write_string(row, column, str(value), cell_format)


def _audio_status(audio: AudioFile | None) -> str:
    if audio is None:
        return "missing"
    return "manual" if audio.manually_uploaded else "automatic"


def _enum_value(value: object) -> str:
    return str(getattr(value, "value", value))
