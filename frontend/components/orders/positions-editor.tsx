"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { articleLabel } from "@/components/forms/lead-parts-table";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { SearchField, type SearchOption } from "@/components/ui/search-field";
import { formatBlankArea, formatMoney, parseSizeLines } from "@/lib/format";
import { articleKey, cleanColorText, thicknessFromText } from "@/lib/material-text";
import { usedHint, withoutSelf, withTypedValues } from "@/lib/reference-search";
import { cn } from "@/lib/utils";
import type { OrderPosition, PriceBookOptions, PriceItem, ReferenceValues } from "@/types/api";

/**
 * Таблица позиций сметы — общая для карточки заказа и создания доп. заказа.
 *
 * Выделена из `OrderPositionsTable`: заказчик просил, чтобы у допа при
 * создании был «тот же контур, что в рабочем месте» — тот же поиск по
 * прайсу с ценой, те же подсказки по цвету и фрезеровке. Сохранение (когда и
 * куда отправлять строки) остаётся снаружи: у существующего заказа это
 * `PUT /orders/{id}/positions`, у ещё не созданного допа — часть запроса на
 * создание, `POST /orders/{parentId}/additional`.
 */

/** Строка таблицы. Всё текстом: пока менеджер печатает, «1,» ещё не число. */
export type EditableRow = {
  key: string;
  priceItemId: string | null;
  isCustom: boolean;
  /** Артикул нестандартной строки: у справочной он берётся из справочника. */
  article: string;
  /** Тип работ нестандартной строки — по нему строится отчёт по обработке. */
  kind: string;
  name: string;
  quantity: string;
  width: string;
  height: string;
  unitPrice: string;
  thickness: string;
  color: string;
  milling: string;
  comment: string;
};

let rowCounter = 0;

function nextKey() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

/**
 * Число из поля ввода.
 *
 * Менеджер печатает «1,5» — с запятой, как в бланке. `Number("1,5")` даёт NaN,
 * поэтому запятую меняем на точку до разбора.
 */
export function toNumber(value: string) {
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyRow(): EditableRow {
  return {
    key: nextKey(),
    priceItemId: null,
    isCustom: true,
    article: "",
    kind: "",
    name: "",
    // Пусто, а не «1»: заказчик просила не удалять единицу перед вводом.
    quantity: "",
    width: "",
    height: "",
    unitPrice: "",
    thickness: "",
    color: "",
    milling: "",
    comment: "",
  };
}

export function fromPosition(position: OrderPosition): EditableRow {
  return {
    key: position.id,
    priceItemId: position.price_item_id,
    isCustom: position.is_custom,
    // Артикул и тип работ обязаны пережить пересохранение сметы: без них
    // сервер записывал каждой нестандартной строке article=None и kind=other,
    // и заказ задним числом выпадал из отчёта по обработке.
    article: position.article ?? "",
    kind: position.kind ?? "",
    name: position.name,
    quantity: position.quantity,
    width: position.width ?? "",
    height: position.height ?? "",
    unitPrice: position.unit_price,
    // толщина сохраняется отдельной колонкой, но в старых строках её писали
    // внутри цвета — достаём оттуда, прежде чем цвет будет вычищен
    thickness: position.thickness ?? thicknessFromText(position.color) ?? "",
    color: cleanColorText(position.color),
    milling: position.milling ?? "",
    comment: position.comment ?? "",
  };
}

/** Площадь строки в м². Размеры в миллиметрах, как в бланке заказчика. */
export function rowArea(row: EditableRow) {
  const width = toNumber(row.width);
  const height = toNumber(row.height);
  if (!width || !height) {
    return 0;
  }
  return (width * height * toNumber(row.quantity)) / 1_000_000;
}

/**
 * Цена за единицу.
 *
 * Набранная в строке цена главнее прайса: заказчик просил «индивидуальные цены
 * под заказ». Пустое поле у артикула означает «как в прайсе».
 */
export function rowUnitPrice(row: EditableRow, priceItems: PriceItem[]) {
  if (row.unitPrice.trim() !== "") {
    return toNumber(row.unitPrice);
  }
  const item = priceItems.find((candidate) => candidate.id === row.priceItemId);
  return item ? toNumber(item.price) : 0;
}

/** Цена в строке разошлась с прайсовой — значит её поправили под этот заказ. */
export function isPriceOverridden(row: EditableRow, priceItems: PriceItem[]) {
  if (row.isCustom || row.unitPrice.trim() === "") return false;
  const item = priceItems.find((candidate) => candidate.id === row.priceItemId);
  return Boolean(item) && toNumber(row.unitPrice) !== toNumber(item!.price);
}

/**
 * Единица строки: по ней считается сумма.
 *
 * У артикула единица своя, из справочника. У нестандарта её нет, и мы смотрим на
 * размеры: заполнил длину и ширину — значит цена за м², не заполнил — за штуку.
 * Иначе менеджеру пришлось бы объяснять системе очевидное.
 */
export function rowUnit(row: EditableRow, priceItems: PriceItem[]) {
  if (row.isCustom) {
    return toNumber(row.width) && toNumber(row.height) ? "sqm" : "pcs";
  }
  return priceItems.find((candidate) => candidate.id === row.priceItemId)?.unit ?? "sqm";
}

/** Сумма строки: цена за м² умножается на площадь, штучная — на количество. */
export function rowAmount(row: EditableRow, priceItems: PriceItem[]) {
  const price = rowUnitPrice(row, priceItems);
  const base = rowUnit(row, priceItems) === "sqm" ? rowArea(row) : toNumber(row.quantity);
  return price * base;
}

export function isBlank(row: EditableRow) {
  return !row.name.trim();
}

/**
 * У строки не проставлено количество.
 *
 * Поле пустое по умолчанию (заказчик просила не удалять единицу перед вводом),
 * и цена этого не ловит: строка с ценой, но без количества уходит в заказ на
 * ноль штук и на 0 ₽ — что за штучную позицию, что за квадратные метры, ведь
 * площадь тоже умножается на количество. Сохранять не запрещаем — смету
 * заполняют в несколько заходов, — но показываем, где дырка.
 */
export function quantityMissing(row: EditableRow) {
  return toNumber(row.quantity) <= 0;
}

/**
 * У строки без совпадения с прайсом не проставлена цена.
 *
 * Пустое поле нельзя молча считать нулём: менеджер добавил строку, забыл цену —
 * и позиция ушла бы в заказ за 0 ₽, а сумма заказа оказалась бы занижена. Ноль
 * разрешён, но только если его написали руками.
 *
 * Смотрим на `priceItemId`, а не на `isCustom`: цена нужна любой строке без
 * совпадения с прайсом — она либо станет новым артикулом (см. `pickMilling`
 * и `_adopt_new_article` на бэкенде), либо останется нестандартом, но в обоих
 * случаях без цены сохранять нельзя.
 */
export function priceMissing(row: EditableRow) {
  return !row.priceItemId && row.unitPrice.trim() === "";
}

/** Строки, у которых есть название, но не проставлена цена — блокируют сохранение. */
export function unpricedRows(rows: EditableRow[]) {
  return rows.filter((row) => !isBlank(row) && priceMissing(row));
}

/** Строки, у которых есть название, но не проставлено количество — только предупреждение. */
export function unquantifiedRows(rows: EditableRow[]) {
  return rows.filter((row) => !isBlank(row) && quantityMissing(row));
}

/** Можно ли отправлять таблицу на сервер прямо сейчас. */
export function positionsAreSavable(rows: EditableRow[]) {
  return unpricedRows(rows).length === 0;
}

/**
 * Строки таблицы → тело запроса (`OrderPositionWrite[]`), как его принимает
 * бэкенд у `PUT /orders/{id}/positions` и у `POST /orders/{id}/additional`.
 */
export function toPositionsPayload(rows: EditableRow[], priceItems: PriceItem[]) {
  return rows
    .filter((row) => !isBlank(row))
    .map((row) => ({
      price_item_id: row.isCustom ? null : row.priceItemId,
      is_custom: row.isCustom,
      // У справочной строки артикул и тип берёт сервер из справочника;
      // у нестандарта — только отсюда, иначе они теряются при сохранении.
      article: row.article.trim() || null,
      kind: row.kind || "other",
      name: row.name.trim(),
      // Нестандарт продаётся штуками: площадь у гнутья и доборов не считается.
      unit: rowUnit(row, priceItems),
      quantity: String(toNumber(row.quantity)),
      width: row.width ? String(toNumber(row.width)) : null,
      height: row.height ? String(toNumber(row.height)) : null,
      // Цена уходит всегда, когда она заполнена, — и у нестандарта, и у
      // артикула. У артикула это «индивидуальная цена под заказ»: сервер
      // пометит строку как поправленную, а прайс не тронет. Пустое поле уходит
      // как «цены нет», а не как ноль: у артикула сервер подставит прайсовую,
      // у нестандарта — откажет с понятным текстом.
      unit_price: row.unitPrice.trim() !== "" ? String(toNumber(row.unitPrice)) : null,
      thickness: row.thickness ? String(toNumber(row.thickness)) : null,
      color: row.color.trim() || null,
      milling: row.milling.trim() || null,
      comment: row.comment.trim() || null,
    }));
}

type Props = {
  rows: EditableRow[];
  onChange: (rows: EditableRow[]) => void;
  priceItems: PriceItem[];
  currency: string;
  /** Типы работ для нестандартных строк: фрезеровка, шпон, мыло и т.д. */
  kinds?: PriceBookOptions["kinds"];
  /** Цвета, фрезеровки и артикулы, которые студия уже набирала — те же
      подсказки, что и на «Рабочем месте» при приёме заявки. */
  referenceValues?: ReferenceValues;
};

export function PositionsEditor({
  rows,
  onChange,
  priceItems,
  currency,
  kinds = [],
  referenceValues,
}: Props) {
  // «Вставить списком» — тот же приём, что и на «Рабочем месте»: заказчик
  // просил, чтобы смета заказа выглядела и вводилась так же. Строку заносят
  // подряд по несколько десятков, и набирать их по одной в ячейках дольше,
  // чем вставить готовый список из письма клиента.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const parsedBulk = useMemo(() => parseSizeLines(bulkInput), [bulkInput]);

  const activeItems = useMemo(() => priceItems.filter((item) => item.is_active), [priceItems]);

  const colorSearch: SearchOption[] = useMemo(
    () =>
      withTypedValues(
        (referenceValues?.colors ?? []).map((item) => ({ value: item.value, hint: usedHint(item) })),
        rows.map((row) => row.color),
      ),
    [referenceValues, rows],
  );

  /**
   * Подсказки объединённой графы «Фрезеровка»: сначала прайс (с ценой — по
   * нему и считается сумма), потом номера, набранные раньше руками, — что в
   * фрезеровках, что в артикулах. Заказчик: «Фрезеровка — это и есть
   * артикул»: делить эти два справочника подсказок незачем, менеджер ищет
   * одно и то же одним полем.
   */
  const millingSearch: SearchOption[] = useMemo(() => {
    const priced = activeItems.map((item) => ({
      value: articleLabel(item),
      hint: `${item.kind_label} · ${formatMoney(item.price)} за ${item.unit_label}`,
    }));
    const inPriceBook = new Set(activeItems.map((item) => item.article.toLowerCase()));
    const typed = [...(referenceValues?.millings ?? []), ...(referenceValues?.articles ?? [])]
      .filter((item) => !inPriceBook.has(item.value.toLowerCase()))
      .map((item) => ({ value: item.value, hint: usedHint(item) }));
    return withTypedValues(
      [...typed, ...priced],
      rows.filter((row) => row.isCustom).map((row) => row.article),
    );
  }, [activeItems, referenceValues, rows]);

  function update(key: string, patch: Partial<EditableRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  /**
   * Набранный текст приводится к артикулу прайса — как на «Рабочем месте».
   *
   * Совпало — берём цену, тип работ и артикул из прайса, а набранный текст
   * остаётся виден в графе. Не совпало — текст идёт и в артикул, и в
   * фрезеровку как есть, цена вводится своя.
   *
   * `isCustom: false`, а не `true`: заказчик — «цена должна фиксироваться при
   * первом создании нового артикула — сохраняется в справочнике и оттуда
   * тянется». Сервер сам заводит новую номенклатуру из строки с непустыми
   * артикулом, типом и ценой (`_adopt_new_article`), но только если строка не
   * помечена нестандартом. Раньше здесь стояло `isCustom: true`, и в
   * справочник ничего не попадало — на второй строке с тем же текстом цену
   * приходилось вписывать заново.
   */
  function pickMilling(key: string, text: string) {
    const needle = articleKey(text);
    const byNumber = needle ? activeItems.filter((item) => articleKey(item.article) === needle) : [];
    const matched =
      activeItems.find((item) => articleLabel(item).toLowerCase() === text.trim().toLowerCase()) ??
      (byNumber.length === 1 ? byNumber[0] : undefined);

    if (matched) {
      const current = rows.find((row) => row.key === key);
      update(key, {
        priceItemId: matched.id,
        isCustom: false,
        article: matched.article,
        milling: articleLabel(matched),
        kind: matched.kind,
        // Название из справочника — только в пустую строку, как и раньше.
        name: current?.name.trim() ? current.name : matched.name,
        unitPrice: matched.price,
      });
      return;
    }
    update(key, { priceItemId: null, isCustom: false, article: text, milling: text });
  }

  /**
   * Цвет введён окончательно — вычищаем толщину, если графа «Мм» ещё пустая.
   *
   * Тот же приём, что и в таблице заявки: студия пишет в эту ячейку всё сразу
   * («Эмаль RAL 9003 плита 19мм»), а толщина делит карты раскроя и должна
   * жить в своей графе.
   */
  function commitColor(key: string, value: string) {
    const row = rows.find((item) => item.key === key);
    const cleaned = cleanColorText(value);
    const patch: Partial<EditableRow> = { color: cleaned };
    if (row && !row.thickness.trim()) {
      const thickness = thicknessFromText(value);
      if (thickness) patch.thickness = thickness;
    }
    if (cleaned !== value || patch.thickness) {
      update(key, patch);
    }
  }

  const totals = useMemo(() => {
    const valid = rows.filter((row) => !isBlank(row));
    return {
      lines: valid.length,
      area: valid.reduce((sum, row) => sum + rowArea(row), 0),
      amount: valid.reduce((sum, row) => sum + rowAmount(row, priceItems), 0),
    };
  }, [rows, priceItems]);

  const unpriced = useMemo(() => unpricedRows(rows), [rows]);
  const unquantified = useMemo(() => unquantifiedRows(rows), [rows]);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setBulkOpen((current) => !current)}
          className="rounded-full px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
        >
          {bulkOpen ? "Скрыть вставку списком" : "Вставить списком"}
        </button>
        {/* Цены живут в справочнике: менять их здесь нельзя, иначе у каждого
            заказа будет свой прайс. */}
        <Link
          href="/admin/price-book"
          className="rounded-full px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Изменить цены
        </Link>
      </div>

      {bulkOpen ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Вставить размеры списком</p>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-amber-400"
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={"560 123 3\n610 120 5 | Эмаль RAL 9003 | 19 | фрез"}
            spellCheck={false}
          />
          <p className="text-xs text-slate-500">
            Одна строка — длина, ширина и количество. Разделитель: пробел, x или *. После «|» —
            цвет, толщина, фрезеровка.
          </p>
          {parsedBulk.errors.length ? (
            <p className="text-sm text-red-600">
              Не разобрались строки:{" "}
              {parsedBulk.errors.map((item) => `${item.line} («${item.source}»)`).join(", ")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!parsedBulk.lines.length}
            onClick={() => {
              const fresh = parsedBulk.lines.map((line) => {
                const row = emptyRow();
                return {
                  ...row,
                  width: String(line.width),
                  height: String(line.height),
                  quantity: String(line.quantity),
                  thickness: line.thickness ?? "",
                  color: line.material ?? "",
                  // «Фрезеровка» из списка — тем же текстом и в артикул: как в
                  // pickMilling, пока строка не сверена с прайсом руками.
                  milling: line.milling ?? "",
                  article: line.milling ?? "",
                };
              });
              // Нетронутую пустую заготовку (ни названия, ни артикула, ни
              // размеров) список заменяет собой — не оставлять же её первой
              // строкой над тем, что реально вставили.
              const isUntouched = (row: EditableRow) =>
                isBlank(row) && !row.article.trim() && !row.width.trim() && !row.height.trim();
              onChange([...rows.filter((row) => !isUntouched(row)), ...fresh]);
              setBulkInput("");
              setBulkOpen(false);
            }}
          >
            Добавить {parsedBulk.lines.length || ""} строк в таблицу
          </Button>
        </div>
      ) : null}

      {/* прокрутка живёт здесь: таблица сметы шире телефона, и ехать вбок
          должна она, а не страница */}
      <div className="-mx-2 min-w-0 overflow-x-auto px-2">
        {/* Минимум таблицы — сумма минимумов колонок (1422). Меньше суммы
            нельзя — первым делом браузер ужимает именно числовые колонки. */}
        <table className="w-full min-w-[1422px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500 [&>th]:whitespace-nowrap">
              <th className="w-10 min-w-[40px] px-2 py-2 text-center">№</th>
              {/* Одна графа вместо прежних «Артикул» + «Фрезеровка»: поиск по
                  прайсу с ценой, как и в таблице заявки на «Рабочем месте». */}
              <th className="min-w-[190px] px-2 py-2">Фрезеровка</th>
              <th className="min-w-[170px] px-2 py-2">Наименование</th>
              <th className="w-[112px] min-w-[112px] px-2 py-2 text-right">Длина</th>
              <th className="w-[112px] min-w-[112px] px-2 py-2 text-right">Ширина</th>
              <th className="w-[96px] min-w-[96px] px-2 py-2 text-right">Кол-во</th>
              {/* «М2», а не «М²»: ровно так подписана колонка в бумажном
                  бланке и в таблице заявки. */}
              <th className="w-[120px] min-w-[120px] px-2 py-2 text-right">М2</th>
              <th className="w-[96px] min-w-[96px] px-2 py-2 text-right">Мм</th>
              <th className="min-w-[130px] px-2 py-2">Цвет</th>
              <th className="w-[152px] min-w-[152px] px-2 py-2 text-right">Цена</th>
              <th className="w-[164px] min-w-[164px] px-2 py-2 text-right">Сумма</th>
              <th className="w-10 min-w-[40px] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const blank = isBlank(row);
              const overridden = isPriceOverridden(row, priceItems);
              return (
                <tr
                  key={row.key}
                  className={cn("border-b border-slate-100", blank && "bg-amber-50/60")}
                >
                  <td className="px-2 py-1 text-center text-slate-500">{index + 1}</td>
                  <td className="space-y-1 px-2 py-1">
                    <SearchField
                      value={row.article}
                      // Пока печатают — старое совпадение уже не действует,
                      // сбрасываем id; окончательно поле разберёт onCommit.
                      onChange={(value) => update(row.key, { article: value, priceItemId: null })}
                      onCommit={(value) => pickMilling(row.key, value)}
                      options={withoutSelf(millingSearch, row.article)}
                      placeholder="поиск по прайсу или свой текст"
                      emptyHint="В прайсе нет — впишите цену, запомнится под этим номером"
                      ariaLabel={`Фрезеровка, строка ${index + 1}`}
                      className={cn(row.priceItemId && "border-emerald-300 bg-emerald-50")}
                    />
                    {/* Тип работ строки без совпадения с прайсом — нужен и
                        отчёту по обработке, и чтобы сервер завёл новый
                        артикул под правильным типом. У справочной позиции
                        тип уже есть в прайсе.

                        Показываем только когда в строке уже что-то набрано:
                        на совсем пустой новой строке этот селектор появлялся
                        сразу с «Прочее» без единой подсказки, зачем он —
                        менеджер видел лишний контрол раньше, чем начинал
                        печатать. `isBlank` — тот же признак, что решает,
                        уйдёт ли строка в заказ вообще. */}
                    {!row.priceItemId && !isBlank(row) && kinds.length ? (
                      <div>
                        <select
                          value={row.kind || "other"}
                          onChange={(event) => update(row.key, { kind: event.target.value })}
                          className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm"
                          aria-label={`Тип работ, строка ${index + 1}`}
                        >
                          {kinds.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
                          Тип работ — для отчёта по обработке, в прайсе такого артикула нет
                        </p>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={row.name}
                      onChange={(event) => update(row.key, { name: event.target.value })}
                      placeholder="Наименование в заказе"
                      aria-label={`Наименование, строка ${index + 1}`}
                      className="h-9 rounded-xl px-2"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumberInput
                      density="cell"
                      value={row.width}
                      onChange={(event) => update(row.key, { width: event.target.value })}
                      aria-label={`Длина, строка ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumberInput
                      density="cell"
                      value={row.height}
                      onChange={(event) => update(row.key, { height: event.target.value })}
                      aria-label={`Ширина, строка ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumberInput
                      density="cell"
                      measure="qty"
                      value={row.quantity}
                      onChange={(event) => update(row.key, { quantity: event.target.value })}
                      aria-label={`Количество, строка ${index + 1}`}
                      className={cn(
                        !blank && quantityMissing(row) && "border-rose-400 bg-rose-50",
                      )}
                    />
                  </td>
                  <td className="num px-2 py-1 text-right text-slate-600">{formatBlankArea(rowArea(row))}</td>
                  <td className="px-2 py-1">
                    <NumberInput
                      density="cell"
                      value={row.thickness}
                      onChange={(event) => update(row.key, { thickness: event.target.value })}
                      aria-label={`Толщина, строка ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <SearchField
                      value={row.color}
                      onChange={(value) => update(row.key, { color: value })}
                      onCommit={(value) => commitColor(row.key, value)}
                      options={withoutSelf(colorSearch, row.color)}
                      placeholder="RAL 9003, Белый глянец…"
                      ariaLabel={`Цвет, строка ${index + 1}`}
                      title={row.color || undefined}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumberInput
                      density="cell"
                      measure="money"
                      value={row.unitPrice}
                      onChange={(event) => update(row.key, { unitPrice: event.target.value })}
                      placeholder="цена"
                      aria-label={`Цена, строка ${index + 1}`}
                      title={
                        overridden
                          ? "Цена под этот заказ. В справочнике осталась прежняя"
                          : undefined
                      }
                      className={cn(
                        !blank && priceMissing(row) && "border-rose-400 bg-rose-50",
                        overridden && "border-amber-400 bg-amber-50 text-amber-900",
                      )}
                    />
                  </td>
                  <td className="num px-2 py-1 text-right font-medium text-slate-900">
                    {formatMoney(rowAmount(row, priceItems), currency)}
                  </td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      aria-label="Убрать строку"
                      onClick={() =>
                        onChange(
                          rows.length > 1
                            ? rows.filter((item) => item.key !== row.key)
                            : [emptyRow()],
                        )
                      }
                      className="rounded-full px-2 py-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          Строк: <span className="num font-medium text-slate-900">{totals.lines}</span> · Площадь:{" "}
          <span className="num font-medium text-slate-900">{formatBlankArea(totals.area)} м²</span> · Итого:{" "}
          <span className="num font-medium text-slate-900">{formatMoney(totals.amount, currency)}</span>
        </div>
        <Button variant="outline" onClick={() => onChange([...rows, emptyRow()])}>
          Добавить строку
        </Button>
      </div>

      {unpriced.length ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Проставьте цену: {unpriced.map((row) => `«${row.name.trim()}»`).join(", ")}. Нестандарт
          без цены уйдёт в заказ за 0 ₽ — так нельзя. Если позиция и правда бесплатная, напишите 0.
        </p>
      ) : null}
      {unquantified.length ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Не проставлено количество: {unquantified.map((row) => `«${row.name.trim()}»`).join(", ")}.
          Такая строка уйдёт в заказ на 0 шт. и на 0 ₽.
        </p>
      ) : null}
      {rows.some(isBlank) ? (
        <p className="text-xs text-slate-500">Строки без наименования подсвечены и в заказ не пойдут.</p>
      ) : null}
    </div>
  );
}
