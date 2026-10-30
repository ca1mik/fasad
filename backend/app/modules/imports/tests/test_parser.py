"""Разбор выгрузки заказчика.

Строение взято из реального файла «Расчёт заказов» студии фасадов: шапка,
строка заголовков, **два блока позиций рядом**, колонка количества **без
заголовка** между «Ширина» и «М2», внизу итоги и подписи.
"""

from __future__ import annotations

import io
from decimal import Decimal
from pathlib import Path

import pytest

from app.modules.imports.parser import (
    ParsedPart,
    PartsImportError,
    parse_parts_file,
    parse_rows,
)


def blank_rows() -> list[list[object]]:
    """Бланк заказчика в миниатюре: два блока, количество без заголовка."""
    return [
        ["", "", "", "", "Бланк заказа:", "4419п"],
        [],
        ["Дата:", "03.08.2026"],
        ["Заказчик", "Агат-Сервис"],
        ["Дата выдачи ориентировочная_", "", "", "", "Дата выдачи фактическая____"],
        [],
        # колонка D (кол-во) и M (кол-во) — без заголовка, как в оригинале
        [
            "№",
            "Длина",
            "Ширина",
            "",
            "М2",
            "Мм",
            "Фрезеровка",
            "Цвет",
            "",
            "№",
            "Длина",
            "Ширина",
            "",
            "М2",
            "Мм",
            "Фрезеровка",
            "Цвет",
        ],
        [
            "1",
            "391",
            "706",
            "1",
            "0,276",
            "19",
            "фрез",
            "Эмаль RAL 9003 плита 19мм",
            "",
            "1",
            "867",
            "580",
            "1",
            "0,5029",
            "16",
            "",
            "Эмаль RAL 9003 плита 16мм",
        ],
        [
            "2",
            "996",
            "351",
            "2",
            "0,6992",
            "19",
            "фрез рамка под стекло 4мм",
            "Эмаль RAL 9003 плита 19мм",
            "",
            "2",
            "700",
            "420",
            "2",
            "0,588",
            "16",
            "края без обработки",
            "Эмаль RAL 9003 плита 16мм",
        ],
        ["3", "", "", "", "0", "", "", "", "", "3", "", "", "", "", "", "", ""],
        ["", "", "", "5", "1,6744", "", "", "", "", "", "", "", "3", "1,0909", "", "", ""],
        ["", "Размеры проверил_________", "", "", "", "", "", ""],
    ]


def test_parses_two_blocks_and_unlabeled_quantity():
    result = parse_rows(blank_rows())

    assert result.customer == "Агат-Сервис"
    assert result.order_number == "4419п"
    # 1 + 2 из первого блока и 1 + 2 из второго
    assert result.total_quantity == 6
    assert [part.quantity for part in result.parts] == [1, 1, 2, 2]


def test_reads_thickness_milling_and_color():
    result = parse_rows(blank_rows())
    first = result.parts[0]

    assert (first.width, first.height) == (391, 706)
    assert first.thickness == "19"
    assert first.milling == "фрез"
    # в заказ идёт только «RAL 9003», исходная запись лежит рядом
    assert first.color == "RAL 9003"
    assert first.color_source == "Эмаль RAL 9003 плита 19мм"


def test_area_matches_the_formula_from_the_blank():
    """М2 = Длина/1000 × Ширина/1000 × Кол-во — как в их таблице."""
    result = parse_rows(blank_rows())

    # 996 x 351 x 2 = 0.699192
    position = next(part for part in result.parts if part.width == 996)
    assert position.area_sqm == Decimal("0.699192")


def test_totals_row_and_signatures_are_not_parts():
    result = parse_rows(blank_rows())

    # строка итогов содержит только количество и площадь — деталью не является
    assert all(part.width > 0 and part.height > 0 for part in result.parts)
    assert len(result.parts) == 4


def test_column_order_may_differ():
    rows = [
        ["Цвет", "Ширина", "Кол-во", "Длина"],
        ["Эмаль", "396", "3", "716"],
    ]
    result = parse_rows(rows)

    part = result.parts[0]
    assert (part.width, part.height, part.quantity) == (716, 396, 3)
    assert part.color == "Эмаль"


def test_missing_quantity_means_one():
    rows = [["Длина", "Ширина"], ["560", "123"]]
    result = parse_rows(rows)

    assert result.parts[0].quantity == 1


# --- толщина, цвет и фрезеровка -------------------------------------------


def one_part(thickness: object = "", milling: object = "", color: object = "") -> ParsedPart:
    """Одна позиция с заданными «Мм», «Фрезеровка» и «Цвет»."""
    rows: list[list[object]] = [
        ["Длина", "Ширина", "Кол-во", "Мм", "Фрезеровка", "Цвет"],
        ["716", "396", "1", thickness, milling, color],
    ]
    return parse_rows(rows).parts[0]


def test_thickness_is_taken_from_color_when_column_is_empty():
    """Главный случай бланка: колонка «Мм» пустая, толщина внутри цвета."""
    part = one_part(color="Эмаль RAL 9003 плита 19мм")

    assert part.thickness == "19"


def test_thickness_in_color_may_be_written_with_a_space():
    part = one_part(color="Эмаль RAL 9003 плита 16 мм")

    assert part.thickness == "16"


def test_thickness_column_wins_over_the_text_in_color():
    """Если заказчик заполнил «Мм» — верим ей, а не приписке в цвете."""
    part = one_part(thickness="16", color="Эмаль RAL 9003 плита 19мм")

    assert part.thickness == "16"


def test_thickness_from_column_loses_the_excel_tail():
    """xls отдаёт числа дробями: 19.0 — это толщина «19», а не «19.0»."""
    part = one_part(thickness=19.0, color="Эмаль RAL 9003 плита 16мм")

    assert part.thickness == "19"


def test_thickness_is_none_when_it_is_written_nowhere():
    part = one_part(color="Тадж Прага P833UP")

    assert part.thickness is None


def test_thickness_ignores_numbers_that_cannot_be_a_slab():
    """«9003мм» — это номер RAL с прилипшей припиской, а не толщина плиты."""
    part = one_part(color="Эмаль 9003мм")

    assert part.thickness is None


def test_color_with_ral_keeps_only_the_ral_number():
    part = one_part(color="Эмаль  RAL 9003  плита 19мм")

    assert part.color == "RAL 9003"
    assert part.color_source == "Эмаль  RAL 9003  плита 19мм"


def test_color_with_ral_written_together_is_normalized():
    part = one_part(color="Эмаль RAL9003 плита 19мм")

    assert part.color == "RAL 9003"


def test_color_without_ral_is_kept_whole():
    """Название декора уникально целиком — резать его нельзя."""
    part = one_part(color="Тадж Прага P833UP")

    assert part.color == "Тадж Прага P833UP"
    assert part.color_source == "Тадж Прага P833UP"


def test_color_without_ral_keeps_the_supplier_article():
    part = one_part(color="Гринвуд горчица софт ZB827-SFT")

    assert part.color == "Гринвуд горчица софт ZB827-SFT"


def test_empty_color_stays_empty():
    part = one_part(color="   ")

    assert part.color is None
    assert part.color_source is None


def test_milling_case_and_spaces_are_normalized():
    part = one_part(milling="  Фрез   рамка  под стекло 4мм ")

    assert part.milling == "фрез рамка под стекло 4мм"
    # исходная запись остаётся нетронутой
    assert part.milling_source == "Фрез   рамка  под стекло 4мм"


def test_milling_values_are_not_translated():
    """Нормализуется написание, а не смысл: технолог должен узнать своё слово."""
    part = one_part(milling="Края без обработки")

    assert part.milling == "края без обработки"


def test_empty_milling_stays_empty():
    part = one_part(milling="")

    assert part.milling is None
    assert part.milling_source is None


def test_real_blank_of_the_studio_is_parsed_the_same_way():
    """Живой бланк заказчика: числа зафиксированы, менять их нельзя."""
    blank = Path(__file__).resolve().parents[5] / "tz" / "Расчёт заказов — копия (1).xls"
    if not blank.exists():  # pragma: no cover - файла нет в чистом чекауте
        pytest.skip("Бланк заказчика доступен только в рабочей копии")

    result = parse_parts_file(blank.name, blank.read_bytes())

    assert len(result.parts) == 37
    assert result.total_quantity == 42
    assert result.total_area_sqm == Decimal("11.790158")
    # колонка «Мм» в этом бланке пустая — толщина взялась из цвета
    assert {part.thickness for part in result.parts} == {"19", "16"}
    assert {part.color for part in result.parts} == {"RAL 9003"}
    assert "мыло" in {part.milling for part in result.parts}


# --- отказные сценарии -----------------------------------------------------


def test_file_without_size_headers_is_rejected():
    rows = [["Клиент", "Телефон"], ["Иванов", "+7999"]]

    with pytest.raises(PartsImportError) as error:
        parse_rows(rows)

    assert "Длина" in str(error.value)


def test_headers_without_any_numbers_are_rejected():
    rows = [["Длина", "Ширина", "Кол-во"], ["", "", ""], ["нет", "данных", ""]]

    with pytest.raises(PartsImportError) as error:
        parse_rows(rows)

    assert "размерами" in str(error.value)


def test_unknown_extension_is_rejected():
    with pytest.raises(PartsImportError) as error:
        parse_parts_file("список.pdf", b"%PDF-1.4")

    assert "pdf" in str(error.value).lower()


def test_empty_file_is_rejected():
    with pytest.raises(PartsImportError) as error:
        parse_parts_file("пусто.xlsx", b"")

    assert "пустой" in str(error.value).lower()


def test_broken_file_reports_readable_reason():
    with pytest.raises(PartsImportError) as error:
        parse_parts_file("битый.xlsx", b"not really a workbook")

    assert "не читается" in str(error.value).lower()


# --- реальные форматы файлов ----------------------------------------------


def test_parses_csv_with_semicolons_and_cp1251():
    content = "Длина;Ширина;Кол-во\r\n716;396;4\r\n596;396;2\r\n".encode("cp1251")

    result = parse_parts_file("список.csv", content)

    assert result.total_quantity == 6
    assert result.parts[0].width == 716


def test_parses_xlsx_written_by_openpyxl():
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Заказ"
    for row in blank_rows():
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)

    result = parse_parts_file("бланк.xlsx", buffer.getvalue())

    assert result.sheet_name == "Заказ"
    assert result.total_quantity == 6
