"use client";

import { type FocusEvent, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { SearchField, type SearchOption } from "@/components/ui/search-field";
import { formatBlankArea, formatMoney } from "@/lib/format";
import { articleKey, cleanColorText, thicknessFromText } from "@/lib/material-text";
import { positivePartQuantity } from "@/lib/part-quantity";
import { usedHint, withoutSelf, withTypedValues } from "@/lib/reference-search";
import { cn } from "@/lib/utils";
import type { PriceItem, ReferenceValue } from "@/types/api";

/**
 * Строка таблицы заявки — ровно те колонки, что в бумажном бланке студии,
 * плюс расчёт справа.
 *
 * Числа держим строками: пока менеджер стирает «610», чтобы набрать «620»,
 * поле проходит через пустое значение — с числовым состоянием оно прыгало бы
 * в ноль и мешало печатать.
 */
export type LeadPartRow = {
  id: string;
  length: string;
  width: string;
  quantity: string;
  thickness: string;
  milling: string;
  color: string;
  /** Артикул из справочника; пусто — позиция без расчёта. */
  priceItemId: string;
  /** Что набрано в поле поиска артикула. Пока строка не совпала с прайсом,
      позиция считается по своей цене. */
  articleText: string;
  /** Своя цена, когда позиции нет в справочнике. */
  customPrice: string;
};

const AREA_UNIT = "sqm";

let rowCounter = 0;

export function createLeadPartRow(defaults: Partial<LeadPartRow> = {}): LeadPartRow {
  rowCounter += 1;
  return {
    id: `lead-part-${rowCounter}`,
    length: "",
    width: "",
    // Пусто, а не «1»: заказчик просил забивать количество самим. С единицей
    // менеджер сначала стирал её, а забыв стереть — продавал одну деталь вместо
    // пяти.
    quantity: "",
    thickness: "",
    milling: "",
    color: "",
    priceItemId: "",
    articleText: "",
    customPrice: "",
    ...defaults,
  };
}

/** Подпись артикула в поле поиска: по ней менеджер его и узнаёт. */
export function articleLabel(item: PriceItem) {
  return `${item.article} · ${item.name}`;
}

/**
 * Выделяет содержимое поля при попадании в него.
 *
 * Заказчик: «встаёшь чтобы забить — надо сначала удалять единицу, потом вбивать
 * нужное». В количестве по умолчанию стоит 1, и это правильно: у большинства
 * строк деталь одна. Но набор поверх готового значения не должен требовать
 * стирания — набранная цифра заменяет старую сразу.
 */
function selectAll(event: FocusEvent<HTMLInputElement>) {
  event.target.select();
}

/** Число из поля: менеджер печатает «1,5» с запятой, как в бланке. */
export function toNumber(value: string) {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Количество деталей — только целое: половины детали на листе не бывает. */
export function rowQuantity(row: LeadPartRow) {
  return positivePartQuantity(row.quantity);
}

/** Площадь строки в м². Размеры в миллиметрах. */
export function rowArea(row: LeadPartRow) {
  return (toNumber(row.length) * toNumber(row.width) * rowQuantity(row)) / 1_000_000;
}

/** Строка заполнена настолько, что её можно считать позицией заявки. */
export function isRowFilled(row: LeadPartRow) {
  return toNumber(row.length) > 0 && toNumber(row.width) > 0 && rowQuantity(row) > 0;
}

/**
 * Правка одной ячейки таблицы: новые строки и, если надо, пустая строка снизу.
 *
 * Пустая строка снизу появляется в один-единственный момент: последняя строка
 * таблицы только что СТАЛА заполненной. Так менеджер набирает заказ на 40
 * позиций подряд, не возвращаясь мышью к кнопке под таблицей.
 *
 * Смотрим именно на переход, а не на состояние. «Последняя строка заполнена» —
 * это штатное состояние после вставки списком, после загрузки бланка и после
 * удаления строки; пока правило смотрело на состояние, любая правка в такой
 * строке плодила ещё одну пустую. Заказчик: «начинаю вносить редактирование —
 * снова вылезает лишняя строка, приходится удалять каждый раз».
 *
 * Вынесено из компонента отдельной функцией, потому что это единственное место
 * во всей таблице, где правило можно проверить без браузера.
 */
export function applyRowPatch(
  rows: LeadPartRow[],
  id: string,
  patch: Partial<LeadPartRow>,
): LeadPartRow[] {
  const before = rows.find((row) => row.id === id);
  const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
  const last = next[next.length - 1];
  const editedLast = Boolean(last) && last.id === id;
  const becameFilled = before !== undefined && !isRowFilled(before) && isRowFilled(last);
  return editedLast && becameFilled ? [...next, createLeadPartRow()] : next;
}

export function findPriceItem(row: LeadPartRow, priceItems: PriceItem[]) {
  return row.priceItemId ? priceItems.find((item) => item.id === row.priceItemId) : undefined;
}

/**
 * Цена за единицу.
 *
 * Заказчик: «пусть с базы подтягиваются, но при этом менеджер может сама
 * корректировать их... по типу индивидуальных цен под заказ». Поэтому набранная
 * в строке цена главнее прайса: она и есть цена этой продажи. Пустое поле —
 * берём прайс. Ноль означает «ещё не посчитали», а не «бесплатно».
 */
export function rowUnitPrice(row: LeadPartRow, priceItems: PriceItem[]) {
  if (row.customPrice.trim()) return toNumber(row.customPrice);
  const item = findPriceItem(row, priceItems);
  return item ? toNumber(item.price) : 0;
}

/** Цена в строке отличается от прайсовой — значит её поправили под заказ. */
export function isPriceOverridden(row: LeadPartRow, priceItems: PriceItem[]) {
  const item = findPriceItem(row, priceItems);
  if (!item || !row.customPrice.trim()) return false;
  return toNumber(row.customPrice) !== toNumber(item.price);
}

/**
 * Сумма строки.
 *
 * У артикула единица своя, из справочника. Без артикула смотрим на размеры:
 * они заполнены всегда, значит своя цена считается за м² — так менеджер и
 * называет её клиенту («столько-то за квадрат»).
 */
export function rowAmount(row: LeadPartRow, priceItems: PriceItem[]) {
  const item = findPriceItem(row, priceItems);
  const unit = item ? item.unit : AREA_UNIT;
  const base = unit === AREA_UNIT ? rowArea(row) : rowQuantity(row);
  return rowUnitPrice(row, priceItems) * base;
}

export function rowUnit(row: LeadPartRow, priceItems: PriceItem[]) {
  return findPriceItem(row, priceItems)?.unit ?? AREA_UNIT;
}

/** Итоги таблицы: то же, что печатается внизу бумажного бланка, плюс деньги. */
export function leadPartsTotals(rows: LeadPartRow[], priceItems: PriceItem[]) {
  const filled = rows.filter(isRowFilled);
  const byThickness = new Map<string, { quantity: number; areaSqm: number }>();

  for (const row of filled) {
    const thickness = row.thickness.trim();
    if (!thickness) continue;
    const bucket = byThickness.get(thickness) ?? { quantity: 0, areaSqm: 0 };
    bucket.quantity += rowQuantity(row);
    bucket.areaSqm += rowArea(row);
    byThickness.set(thickness, bucket);
  }

  return {
    lines: filled.length,
    quantity: filled.reduce((sum, row) => sum + rowQuantity(row), 0),
    areaSqm: filled.reduce((sum, row) => sum + rowArea(row), 0),
    amount: filled.reduce((sum, row) => sum + rowAmount(row, priceItems), 0),
    priced: filled.filter((row) => rowUnitPrice(row, priceItems) > 0).length,
    byThickness: [...byThickness.entries()]
      .map(([thickness, totals]) => ({ thickness, ...totals }))
      .sort((left, right) => Number(left.thickness) - Number(right.thickness)),
  };
}

// Все поля на этом классе числовые. Моноширинные цифры по правому краю: без
// них разряды не встают в столбик, и лишний ноль в размере («6100» вместо
// «610») на сорока строках глазом не поймать — а он уедет в раскрой.
const CELL =
  "num h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-right text-sm outline-none transition focus:border-amber-400";

type Props = {
  rows: LeadPartRow[];
  onChange: (rows: LeadPartRow[]) => void;
  priceItems: PriceItem[];
  /** Показывать колонки расчёта. На чистом приёме заявки цена не всегда нужна. */
  showCalculator?: boolean;
  /** Цвета, которые студия уже писала, — для поиска в колонке «Цвет». */
  colorOptions?: ReferenceValue[];
  /** То же для колонки «Фрезеровка». */
  millingOptions?: ReferenceValue[];
  /** Номера артикулов, которые студия уже набирала руками. */
  articleOptions?: ReferenceValue[];
};

// usedHint / withTypedValues / withoutSelf переехали в @/lib/reference-search:
// смета заказа устроена так же и просит те же подсказки, дублировать три
// маленькие чистые функции ради одного импорта было незачем.

export function LeadPartsTable({
  rows,
  onChange,
  priceItems,
  showCalculator = true,
  colorOptions = [],
  millingOptions = [],
  articleOptions = [],
}: Props) {
  const activeItems = useMemo(
    () => priceItems.filter((item) => item.is_active),
    [priceItems],
  );
  const totals = useMemo(() => leadPartsTotals(rows, priceItems), [rows, priceItems]);

  const colorSearch: SearchOption[] = useMemo(
    () =>
      withTypedValues(
        colorOptions.map((item) => ({ value: item.value, hint: usedHint(item) })),
        rows.map((row) => row.color),
      ),
    [colorOptions, rows],
  );
  /**
   * Подсказки объединённой графы «Фрезеровка»: сначала прайс (с ценой — по
   * нему подставляется и сумма), потом номера, набранные раньше руками — что
   * в фрезеровках, что в артикулах. Заказчик: «Фрезеровка — это и есть
   * артикул»: делить эти два справочника подсказок незачем, менеджер ищет
   * одно и то же одним полем. Раньше графы «Артикул» и «Фрезеровка» были
   * разными — с разными подсказками и без связи друг с другом, кроме
   * одностороннего переноса номера при потере фокуса.
   */
  const millingSearch: SearchOption[] = useMemo(() => {
    const priced = activeItems.map((item) => ({
      value: articleLabel(item),
      hint: `${item.kind_label} · ${formatMoney(item.price)} за ${item.unit_label}`,
    }));
    const inPriceBook = new Set(activeItems.map((item) => item.article.toLowerCase()));
    const typed = [...millingOptions, ...articleOptions]
      .filter((item) => !inPriceBook.has(item.value.toLowerCase()))
      .map((item) => ({ value: item.value, hint: usedHint(item) }));
    return withTypedValues(
      [...typed, ...priced],
      rows.filter((row) => !row.priceItemId).map((row) => row.articleText),
    );
  }, [activeItems, articleOptions, millingOptions, rows]);

  /**
   * Набранная строка приводится к артикулу справочника.
   *
   * Совпало — берём цену из прайса, а «Фрезеровка» дублирует найденную
   * подпись (нужна и в бланке, и на карте раскроя как текст). Не совпало —
   * это позиция без артикула, и цена вводится своя: заставлять менеджера
   * выбирать из списка нельзя, у студии постоянно появляется то, чего в
   * прайсе ещё нет — тогда «Фрезеровка» остаётся ровно тем текстом, что
   * набрали.
   */
  function applyArticle(id: string, text: string) {
    // Совпадение ищем и по подписи из списка, и по одному номеру: менеджер
    // набирает «113», а в подсказке стоит «113 · Фрезеровка», и раньше голый
    // номер не находил ничего — на каждой строке висело «В прайсе нет».
    //
    // Один и тот же номер живёт в разных типах работ (127-й есть и в плёнке, и
    // в эмали), поэтому по номеру подставляем цену только когда он ровно один.
    // Иначе молча взяли бы чужую цену.
    const needle = articleKey(text);
    const byNumber = needle ? activeItems.filter((item) => articleKey(item.article) === needle) : [];
    const matched =
      activeItems.find(
        (item) => articleLabel(item).toLowerCase() === text.trim().toLowerCase(),
      ) ?? (byNumber.length === 1 ? byNumber[0] : undefined);
    const patch: Partial<LeadPartRow> = {
      articleText: text,
      priceItemId: matched?.id ?? "",
      milling: matched ? articleLabel(matched) : text,
    };
    // Цену из прайса подставляем в само поле, а не показываем «поверх»: иначе
    // менеджер не может её поправить, а заказчик просил именно это. Уже
    // набранную цену не затираем — она могла быть согласована с клиентом.
    if (matched) {
      const row = rows.find((item) => item.id === id);
      if (row && !row.customPrice.trim()) patch.customPrice = String(matched.price);
    }
    update(id, patch);
  }

  /**
   * Цвет введён окончательно — оставляем в нём только цвет.
   *
   * Студия пишет в эту ячейку всё сразу: «Эмаль RAL 9003 плита 19мм». Вид
   * работ приходит артикулом, толщина живёт в своей графе и делит карты
   * раскроя, а цветом остаётся цвет. Толщину, если графа пустая, забираем из
   * набранного текста — иначе она потерялась бы вместе с вырезанным куском.
   */
  function commitColor(id: string, value: string) {
    const row = rows.find((item) => item.id === id);
    const cleaned = cleanColorText(value);
    const patch: Partial<LeadPartRow> = { color: cleaned };

    if (row && !row.thickness.trim()) {
      const thickness = thicknessFromText(value);
      if (thickness) {
        patch.thickness = thickness;
      }
    }
    if (cleaned !== value || patch.thickness) {
      update(id, patch);
    }
  }

  function update(id: string, patch: Partial<LeadPartRow>) {
    onChange(applyRowPatch(rows, id, patch));
  }

  function removeRow(id: string) {
    const left = rows.filter((row) => row.id !== id);
    onChange(left.length ? left : [createLeadPartRow()]);
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* Прокрутка живёт здесь: таблица шире телефона, и ехать вбок должна
          она, а не страница. Длинную таблицу дополнительно ограничиваем по
          высоте — иначе на сороковой строке подписи колонок уже уехали, а
          «Длина» и «Ширина» это два одинаковых четырёхзначных поля рядом. */}
      <div
        className={cn(
          "-mx-2 min-w-0 px-2",
          rows.length > 12 ? "max-h-[70vh] overflow-auto" : "overflow-x-auto",
        )}
      >
        <table
          className={cn(
            "w-full border-collapse text-sm",
            showCalculator ? "min-w-[1120px]" : "min-w-[780px]",
          )}
        >
          {/* sticky на thead, а не на th: при border-collapse так надёжнее, и
              этот же приём уже работает в превью загруженного бланка */}
          <thead className="sticky top-0 z-20 bg-white">
            {/* Подписи не переносятся: «Кол-во» в две строки поднимало шапку и
                таблица выглядела сдавленной */}
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500 [&>th]:whitespace-nowrap">
              {/* Ширины считаны по самому длинному значению колонки, а не на
                  глаз: размер до пяти знаков («12 500»), площадь с пятью
                  знаками после запятой («1,13414»), деньги с разрядами и
                  рублём («1 234 567,00 ₽»). Обрезанное число хуже
                  отсутствующего: менеджер не видит, что оно обрезано.

                  Ширина и минимум вместе: при обычной табличной раскладке
                  `width` — только пожелание, и браузер ужимал числовые колонки в
                  пользу «Фрезеровки» и «Цвета». Из-за этого в «Мм» вместо
                  «19,23» оставалось «,23». `min-width` ужать уже нельзя. */}
              <th className="w-10 min-w-[40px] px-2 py-2.5 text-center">№</th>
              <th className="w-[112px] min-w-[112px] px-2 py-2.5 text-right">Длина</th>
              <th className="w-[112px] min-w-[112px] px-2 py-2.5 text-right">Ширина</th>
              <th className="w-[96px] min-w-[96px] px-2 py-2.5 text-right">Кол-во</th>
              <th className="w-[120px] min-w-[120px] px-2 py-2.5 text-right">М2</th>
              <th className="w-[96px] min-w-[96px] px-2 py-2.5 text-right">Мм</th>
              {/* Раньше здесь были две графы — «Фрезеровка» (текст) и,
                  дальше через границу расчёта, «Артикул» (поиск по прайсу).
                  Заказчик: «Фрезеровка — это и есть артикул, цена к ней».
                  Одна графа: без калькулятора (нет ни одного активного
                  артикула в прайсе) — обычный текст с подсказками, с
                  калькулятором — тот же текст, но с поиском по прайсу и
                  ценой. */}
              <th className="min-w-[210px] px-2 py-2.5">Фрезеровка</th>
              <th className="min-w-[190px] px-2 py-2.5">Цвет</th>
              {showCalculator ? (
                <>
                  <th className="w-[152px] min-w-[152px] border-l border-slate-200 px-2 py-2.5 pl-3 text-right">
                    Цена
                  </th>
                  <th className="w-[164px] min-w-[164px] px-2 py-2.5 text-right">Сумма</th>
                </>
              ) : null}
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const filled = isRowFilled(row);
              const item = findPriceItem(row, priceItems);
              const overridden = isPriceOverridden(row, priceItems);
              return (
                <tr
                  key={row.id}
                  className={cn("border-b border-slate-100", !filled && "bg-amber-50/60")}
                >
                  <td className="px-2 py-1.5 text-center text-slate-500">{index + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      className={CELL}
                      inputMode="decimal"
                      value={row.length}
                      onFocus={selectAll}
                      onChange={(event) => update(row.id, { length: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={CELL}
                      inputMode="decimal"
                      value={row.width}
                      onFocus={selectAll}
                      onChange={(event) => update(row.id, { width: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={CELL}
                      inputMode="decimal"
                      value={row.quantity}
                      onFocus={selectAll}
                      onChange={(event) => update(row.id, { quantity: event.target.value })}
                    />
                  </td>
                  {/* площадь как в бланке — пять знаков через запятую */}
                  <td className="num px-2 py-1.5 text-right text-slate-600">
                    {filled ? formatBlankArea(rowArea(row)) : "0"}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={CELL}
                      inputMode="decimal"
                      value={row.thickness}
                      onFocus={selectAll}
                      onChange={(event) => update(row.id, { thickness: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {/* Одна графа вместо прежних «Фрезеровка» + «Артикул»:
                        без калькулятора — обычный текст с подсказками, с
                        калькулятором — то же поле ищет по прайсу и
                        подставляет цену, как на карточке заказа. */}
                    <SearchField
                      value={row.articleText}
                      onChange={(value) => applyArticle(row.id, value)}
                      options={withoutSelf(millingSearch, row.articleText)}
                      placeholder="фрез, мыло…"
                      // Само запоминание в справочнике происходит позже, при
                      // создании заказа из этой заявки (LeadEstimateTransfer):
                      // подсказка честно не обещает этого раньше срока.
                      emptyHint={
                        showCalculator
                          ? "В прайсе нет — своя цена, попадёт в справочник вместе с заказом"
                          : undefined
                      }
                      ariaLabel={`Фрезеровка, строка ${index + 1}`}
                      className={cn(item && "border-emerald-300 bg-emerald-50")}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <SearchField
                      value={row.color}
                      onChange={(value) => update(row.id, { color: value })}
                      // Цвет приводим к одному цвету, когда ячейку покидают:
                      // из «Эмаль RAL 9003 плита 19мм» остаётся «RAL 9003», а
                      // толщина уходит в свою графу, если она там пустая.
                      onCommit={(value) => commitColor(row.id, value)}
                      options={withoutSelf(colorSearch, row.color)}
                      placeholder="RAL 9003, Белый глянец…"
                      ariaLabel={`Цвет, строка ${index + 1}`}
                      title={row.color || undefined}
                    />
                  </td>
                  {showCalculator ? (
                    <>
                      <td className="border-l border-slate-200 px-2 py-1.5 pl-3">
                        {/* Цена правится всегда: из прайса она подставляется,
                            но остаётся индивидуальной ценой этой продажи.
                            Поправленную подсвечиваем — иначе скидку не видно. */}
                        <input
                          className={cn(
                            CELL,
                            "text-right",
                            overridden && "border-amber-400 bg-amber-50 text-amber-900",
                          )}
                          inputMode="decimal"
                          placeholder="цена"
                          onFocus={selectAll}
                          title={
                            overridden && item
                              ? `Цена под заказ. В прайсе ${item.price} за ${item.unit_label}`
                              : item
                                ? `Цена из прайса, за ${item.unit_label}`
                                : undefined
                          }
                          value={row.customPrice}
                          onChange={(event) =>
                            update(row.id, { customPrice: event.target.value })
                          }
                        />
                      </td>
                      <td className="num px-2 py-1.5 text-right font-medium text-slate-900">
                        {/* Ноль в этой колонке читался бы как «бесплатно».
                            Позиция без цены — это «ещё не посчитали». */}
                        {filled && rowUnitPrice(row, priceItems) > 0 ? (
                          formatMoney(rowAmount(row, priceItems))
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      // из клавиатурного маршрута убрано: Tab по строке должен
                      // вести к следующей позиции, а Пробел на этой кнопке
                      // молча удалял строку
                      tabIndex={-1}
                      aria-label="Убрать строку"
                      onClick={() => removeRow(row.id)}
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            Позиций: <span className="num font-medium text-slate-900">{totals.lines}</span> ·
            деталей: <span className="num font-medium text-slate-900">{totals.quantity}</span> ·
            площадь:{" "}
            <span className="num font-medium text-slate-900">
              {formatBlankArea(totals.areaSqm)} м²
            </span>
            {showCalculator ? (
              <>
                {" "}
                · Итого:{" "}
                <span className="num font-medium text-slate-900">
                  {formatMoney(totals.amount)}
                </span>
              </>
            ) : null}
          </p>
          {/* та самая табличка «16- / 19-» справа от итогов бумажного бланка */}
          {totals.byThickness.length ? (
            <p className="text-xs text-slate-500">
              По толщинам:{" "}
              {totals.byThickness
                .map(
                  (bucket) =>
                    `${bucket.thickness} мм — ${bucket.quantity} дет., ${formatBlankArea(bucket.areaSqm)} м²`,
                )
                .join(" · ")}
            </p>
          ) : null}
          {showCalculator && totals.lines && totals.priced < totals.lines ? (
            <p className="text-xs text-slate-500">
              Без цены: {totals.lines - totals.priced} из {totals.lines}. Заявку можно сохранить и
              так — посчитаете позже.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...rows, createLeadPartRow()])}
        >
          Добавить строку
        </Button>
      </div>

      {rows.some((row) => !isRowFilled(row)) ? (
        <p className="text-xs text-slate-500">
          Строки без длины, ширины или количества подсвечены и в заявку не пойдут.
        </p>
      ) : null}
    </div>
  );
}
