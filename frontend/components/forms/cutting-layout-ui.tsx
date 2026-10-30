"use client";

import { useMutation } from "@tanstack/react-query";
import { FileCheck2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BulkImportCard } from "@/components/cutting-layout/bulk-import-card";
import { DeskSidebar } from "@/components/cutting-layout/desk-sidebar";
import {
  LeadPartsTable,
  createLeadPartRow,
  isRowFilled,
  rowQuantity,
  toNumber,
  type LeadPartRow,
} from "@/components/forms/lead-parts-table";
import { LeadCard } from "@/components/cutting-layout/lead-card";
import {
  algorithmOptions,
  buildLeadText,
  fallbackPattern,
  formatSize,
  parsePositive,
} from "@/components/cutting-layout/lib";
import { SheetWorkspace } from "@/components/cutting-layout/sheet-workspace";
import { StatsOverview } from "@/components/cutting-layout/stats-overview";
import { SupplySummary } from "@/components/cutting-layout/supply-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { readLeadParts } from "@/lib/format";
import { cleanColorText, thicknessFromText } from "@/lib/material-text";
import { MAX_PART_UNITS } from "@/lib/part-quantity";
import type { PartsImport } from "@/components/forms/spreadsheet-drop-zone";
import {
  buildImportedPatterns,
  buildLayoutPatterns,
  buildPatterns,
  createDraftPart,
  createPreviewSheet,
  getPatternByCode,
  FILM_PATTERN,
  MDF_PATTERN,
  marginBottomOf,
  marginRightOf,
  resolvePatternCode,
  normalizeDrafts,
  packLayoutByPattern,
  parseBulkInput,
  type BulkImportError,
  type CuttingPattern,
  type CuttingPartDraft,
  type CuttingWorkKind,
} from "@/lib/cutting-layout";
import type {
  Envelope,
  ExportFile,
  FilmCuttingOptions,
  Lead,
  Order,
  PriceItem,
  ReferenceValues,
} from "@/types/api";

type Props = {
  options: FilmCuttingOptions;
  /** Справочник артикулов для расчёта в таблице бланка. */
  priceItems?: PriceItem[];
  /** Цвета и фрезеровки, которые студия уже писала, — подсказки в таблице. */
  referenceValues?: ReferenceValues;
  orderContext?: Order | null;
  leadContext?: Lead | null;
  /**
   * Детали, присланные снаружи — с формы заявки на той же странице.
   *
   * Подменяются не на каждое нажатие клавиши, а по команде: пока менеджер
   * правит раскладку, набранное в форме не должно затирать её из-под руки.
   * Смена ``seedVersion`` и есть эта команда.
   */
  seedDrafts?: CuttingPartDraft[];
  seedVersion?: number;
  /**
   * Тип работы, с которым открыть раскрой — «Раскрой МДФ» или «Раскрой
   * плёнки» на карточке заказа ведут сюда с уже выбранным типом, чтобы
   * менеджер не переключал его руками каждый раз.
   */
  initialWorkKind?: CuttingWorkKind;
};

// Каждая физическая деталь рисуется на карте. Слишком большое число штук
// способно занять всю память браузера ещё до появления сообщения об ошибке.
const MAX_LAYOUT_UNITS = MAX_PART_UNITS;

type SheetFormState = {
  sheetWidth: string;
  sheetHeight: string;
  /** Отступ слева и сверху. */
  marginX: string;
  marginY: string;
  /** Отступ справа и снизу — по умолчанию такой же, как слева и сверху. */
  marginRight: string;
  marginBottom: string;
  defaultGapX: string;
  defaultGapY: string;
  algorithm: "leftEdge" | "byLength" | "byWidth" | "optimal";
  allowRotation: boolean;
  keepEdgeGap: boolean;
  workKind: CuttingWorkKind;
};

type LeadState = {
  clientName: string;
  phone: string;
  email: string;
  comment: string;
};

type SheetPreset = {
  code: string;
  label: string;
  // пресет задаёт только размеры листа: алгоритм, поворот, зазор у кромки и
  // тип работы менеджер выбирает сам, и смена формата листа их не сбрасывает
  values: Omit<SheetFormState, "algorithm" | "allowRotation" | "keepEdgeGap" | "workKind">;
};

/**
 * Отступ от левого края — 60 мм, а не 15.
 *
 * Заказчик: «от края левого всегда 60 мм отступ». Зазор идёт ЗА деталью,
 * поэтому у левой кромки его нет: первая деталь вставала в 15 мм от края и
 * плёнки на подворот ей не хватало. Правая кромка свои 60 получает хвостовым
 * зазором последней детали (`keepEdgeGap`), верхняя и нижняя — полем листа
 * (см. `TOP_BOTTOM_MARGIN_MM` ниже, тот же стандарт — 60, не 15).
 *
 * Цена решения: рабочая ширина уменьшается на 45 мм (2720 → 2675 на листе
 * 2750). Деталь длиннее 2675 мм на такой лист больше не встанет.
 */
const LEFT_MARGIN_MM = "60";

/**
 * Отступ сверху и снизу — тоже 60 мм по стандарту, а не 15.
 *
 * Заказчик прямо указал на дефолт «Отступ сверху: 15» как на ошибку —
 * отступ по вертикали должен быть тем же стандартом 60 мм, что и левый край
 * выше, а не отдельным меньшим числом. В отличие от левого края, верхний и
 * нижний отступы — это поле листа напрямую (`marginY`/`marginBottom`), без
 * трюка через хвостовой зазор.
 */
const TOP_BOTTOM_MARGIN_MM = "60";

const SHEET_PRESETS: SheetPreset[] = [
  {
    code: "standard-2750x1250",
    label: "2750×1250",
    values: {
      sheetWidth: "2750",
      sheetHeight: "1250",
      marginX: LEFT_MARGIN_MM,
      marginY: TOP_BOTTOM_MARGIN_MM,
      marginRight: "15",
      marginBottom: TOP_BOTTOM_MARGIN_MM,
      defaultGapX: "60",
      defaultGapY: "60",
    },
  },
  {
    code: "ldsp-2440x1220",
    label: "2440×1220",
    values: {
      sheetWidth: "2440",
      sheetHeight: "1220",
      marginX: LEFT_MARGIN_MM,
      marginY: TOP_BOTTOM_MARGIN_MM,
      marginRight: "15",
      marginBottom: TOP_BOTTOM_MARGIN_MM,
      defaultGapX: "60",
      defaultGapY: "60",
    },
  },
  {
    code: "panel-2800x2070",
    label: "2800×2070",
    values: {
      sheetWidth: "2800",
      sheetHeight: "2070",
      marginX: LEFT_MARGIN_MM,
      marginY: TOP_BOTTOM_MARGIN_MM,
      marginRight: "15",
      marginBottom: TOP_BOTTOM_MARGIN_MM,
      defaultGapX: "60",
      defaultGapY: "60",
    },
  },
];

function createInitialSheetState(
  orderContext?: Order | null,
  initialWorkKind?: CuttingWorkKind,
): SheetFormState {
  return {
    ...SHEET_PRESETS[0].values,
    // Прижим влево — то, как раскладывают в цехе: детали идут колонками от
    // левого края, все листы кроме последнего забиваются по максимуму, а
    // остаток сгоняется в широкую полосу на последнем листе.
    algorithm: "leftEdge",
    // Эмаль и однотонные плёнки кладут в любом положении, поэтому по
    // умолчанию поворот разрешён — так на лист влезает заметно больше.
    //
    // Выключается сам, если у заказа стоит «материал с текстурой» (повёрнутая
    // деталь пойдёт текстурой поперёк) или прямой запрет «нельзя поворачивать».
    // Менеджер может переключить вручную, но не должен помнить об этом каждый
    // раз.
    allowRotation: !orderContext?.has_texture && !orderContext?.no_rotation,
    // Заказчик просил оставлять зазор и у кромки листа: пустые места по краю
    // должны отстоять от деталей на тот же зазор, что и соседние детали.
    keepEdgeGap: true,
    // Раскрой в цехе начинается с распила, и там толщина делит карты.
    // Ссылка «Раскрой плёнки» с карточки заказа приходит с готовым выбором —
    // менеджеру не нужно переключать тип работы руками.
    workKind: initialWorkKind ?? "cutting",
  };
}

function createInitialLeadState(orderContext?: Order | null, leadContext?: Lead | null): LeadState {
  const client = orderContext?.client ?? leadContext?.client ?? null;

  return {
    clientName: client?.full_name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    comment: orderContext?.comment ?? "",
  };
}

/** Отступ: ноль допустим, отрицательного не бывает. */
function parseMargin(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createEmptyDraft(defaultPattern: string) {
  return createDraftPart({ pattern: defaultPattern, quantity: "1" });
}

function createUnitDraft(source: Partial<CuttingPartDraft>, fallbackPatternCode: string) {
  return createDraftPart({
    catalogItemCode: source.catalogItemCode ?? "",
    name: source.name ?? "",
    width: source.width ?? "280",
    height: source.height ?? "280",
    quantity: "1",
    preferredSheet: source.preferredSheet ?? "",
    rotate: source.rotate ?? false,
    gapX: source.gapX ?? "",
    gapY: source.gapY ?? "",
    pattern: source.pattern || fallbackPatternCode,
    thickness: source.thickness ?? "",
    // Артикул едет вместе с деталью: на плёнке по нему делятся карты, на
    // распиле он печатается на детали и по нему в цеху собирают пачку. Потерять
    // его здесь — значит в обоих случаях оставить цех без признака пачки.
    article: source.article ?? "",
    milling: source.milling ?? "",
  });
}

/**
 * Подпись строки бланка: по ней детали собираются обратно в позиции.
 *
 * Раскрой хранит каждую деталь отдельной единицей — так её можно повернуть или
 * прижать к своему листу. В бланке те же детали живут строками с количеством.
 * Ключ собран из всего, что в бланке видно: совпало — это одна строка,
 * разошлось хоть в одном поле — строки разные.
 */
function blankRowKey(draft: CuttingPartDraft) {
  return [
    draft.width.trim(),
    draft.height.trim(),
    (draft.thickness ?? "").trim(),
    (draft.milling ?? "").trim(),
    draft.pattern,
    (draft.article ?? "").trim(),
  ].join("|");
}

/** Снизу всегда пустая строка: список набирают подряд, не возвращаясь к кнопке. */
function withTrailingRow(rows: LeadPartRow[]) {
  const last = rows[rows.length - 1];
  return last && !isRowFilled(last) ? rows : [...rows, createLeadPartRow()];
}

/** Детали раскроя → строки бланка. Одинаковые детали сворачиваются в одну строку. */
function draftsToBlankRows(drafts: CuttingPartDraft[], patterns: CuttingPattern[]): LeadPartRow[] {
  const rows = new Map<string, LeadPartRow>();

  for (const draft of drafts) {
    const key = blankRowKey(draft);
    const existing = rows.get(key);
    const units = Math.max(1, Math.floor(Number(draft.quantity) || 1));
    if (existing) {
      existing.quantity = String(rowQuantity(existing) + units);
      continue;
    }
    rows.set(
      key,
      createLeadPartRow({
        // id обязан быть устойчивым: таблица перестраивается на каждое
        // нажатие клавиши, и со случайным id поле теряло бы фокус
        id: `blank-${key}`,
        length: draft.width,
        width: draft.height,
        quantity: String(units),
        thickness: draft.thickness ?? "",
        milling: draft.milling ?? "",
        color: getPatternByCode(patterns, draft.pattern)?.name ?? "",
        articleText: draft.article ?? "",
      }),
    );
  }

  return [...rows.values()];
}

/**
 * Строки бланка → детали раскроя.
 *
 * Настройки конкретной детали — поворот, свой зазор, свой лист — живут ниже, в
 * списке деталей, и правка бланка их не должна сбрасывать. Поэтому для каждой
 * строки достаём уже существующие единицы с тем же ключом и переиспользуем их,
 * а недостающие досоздаём.
 */
function blankRowsToDrafts(
  rows: LeadPartRow[],
  previous: CuttingPartDraft[],
  patterns: CuttingPattern[],
  defaultPattern: string,
): CuttingPartDraft[] {
  const pool = new Map<string, CuttingPartDraft[]>();
  for (const draft of previous) {
    const key = blankRowKey(draft);
    pool.set(key, [...(pool.get(key) ?? []), draft]);
  }

  return rows.filter(isRowFilled).flatMap((row, index) => {
    const seed: Partial<CuttingPartDraft> = {
      name: `Деталь ${index + 1}`,
      width: String(toNumber(row.length)),
      height: String(toNumber(row.width)),
      rotate: false,
      gapX: "",
      gapY: "",
      pattern: row.color.trim()
        ? resolvePatternCode(row.color, patterns, defaultPattern)
        : defaultPattern,
      thickness: row.thickness.trim(),
      milling: row.milling.trim(),
      article: row.articleText.trim(),
    };
    const kept = pool.get(blankRowKey(seed as CuttingPartDraft)) ?? [];
    const total = rowQuantity(row);

    return Array.from({ length: total }, (_unused, unit) =>
      kept[unit] ? { ...kept[unit], name: seed.name ?? kept[unit].name } : createUnitDraft(seed, defaultPattern),
    );
  });
}

function expandDraftToUnits(source: Partial<CuttingPartDraft>, count: number, fallbackPatternCode: string) {
  const total = Math.max(1, Math.floor(count));
  return Array.from({ length: total }, () => createUnitDraft(source, fallbackPatternCode));
}

function createDraftsFromOrderItem(
  item: Order["items"][number],
  defaultPattern: string,
  index: number,
) {
  const total = Math.max(1, item.quantity || 1);
  return expandDraftToUnits(
    {
      name: item.name || `Деталь ${index + 1}`,
      width: String(Math.round(Number(item.width) || 0)),
      height: String(Math.round(Number(item.height) || 0)),
      rotate: false,
      gapX: "",
      gapY: "",
      pattern: defaultPattern,
    },
    total,
    defaultPattern,
  );
}

/**
 * Смета заказа разворачивается в детали раскроя.
 *
 * Заказчик: «в самом открытие заказа добавить таблицу с редактированием и
 * оттуда уже в карту раскроя будет». Артикул едет вместе с деталью: на плёнке
 * он делит карты, на распиле печатается на самой детали — по нему в цеху
 * собирают пачку уже после распила.
 */
function buildDraftsFromOrderPositions(
  orderContext: Order | null | undefined,
  defaultPattern: string,
  patterns: CuttingPattern[],
  workKind: CuttingWorkKind,
) {
  const positions = (orderContext?.positions ?? []).filter(
    (position) =>
      Number(position.width) > 0 && Number(position.height) > 0 &&
      (workKind === "cutting" || position.kind === "film"),
  );

  return positions.flatMap((position, index) =>
    expandDraftToUnits(
      {
        // Номер заказа важнее наименования позиции: по нему деталь находят в
        // цехе. Наименование остаётся в списке деталей и в смете.
        name: orderContext?.order_number || position.name || `Позиция ${index + 1}`,
        width: String(Number(position.width)),
        height: String(Number(position.height)),
        rotate: false,
        gapX: "",
        gapY: "",
        // цвет из сметы чистим так же, как в заявке: иначе одна и та же эмаль,
        // записанная в смете с толщиной, а в заявке без, уехала бы на два листа
        pattern: cleanColorText(position.color)
          ? resolvePatternCode(cleanColorText(position.color), patterns, defaultPattern)
          : workKind === "film" ? FILM_PATTERN.code : MDF_PATTERN.code,
        // толщину, если её не заполнили отдельной колонкой, ещё можно достать
        // из исходной записи цвета — там она часто и написана
        thickness: position.thickness ?? thicknessFromText(position.color) ?? "",
        milling: position.milling ?? "",
        article: position.article ?? "",
      },
      // количество в смете хранится десятичным (может быть «2.5 м²»), а деталей
      // на листе бывает только целое число
      Math.max(1, Math.round(Number(position.quantity) || 1)),
      defaultPattern,
    ),
  );
}

/** Позиции заказа разворачиваются в отдельные физические детали. */
function buildDraftsFromOrder(orderContext: Order | null | undefined, defaultPattern: string) {
  if (!orderContext?.items.length) {
    return [];
  }

  return orderContext.items.flatMap((item, index) =>
    createDraftsFromOrderItem(item, defaultPattern, index),
  );
}

/**
 * Детали заявки разворачиваются в черновики раскроя.
 *
 * Заявка хранит размеры и материал позиции — то, что менеджер занёс из бланка
 * заказчика. Раскрой, открытый по заявке, подхватывает их сразу: набирать
 * список второй раз не нужно.
 */
function buildDraftsFromLead(
  leadContext: Lead | null | undefined,
  defaultPattern: string,
  patterns: CuttingPattern[],
) {
  const parts = readLeadParts(leadContext?.parsed_payload_json);
  // Номер заявки прямо на детали: она уезжает в цех отдельно от карты, и по
  // «Деталь 3» никто не поймёт, чья она. В раскрое партией так и сделано.
  const label = leadContext?.lead_number || "Деталь";
  return parts.flatMap((part, index) =>
    expandDraftToUnits(
      {
        name: leadContext?.lead_number ? label : `${label} ${index + 1}`,
        width: String(part.width),
        height: String(part.height),
        rotate: false,
        gapX: "",
        gapY: "",
        pattern: part.material
          ? resolvePatternCode(part.material, patterns, defaultPattern)
          : defaultPattern,
        // колонка «Мм» в бланке часто пустая, а толщина написана внутри цвета
        // («Эмаль RAL 9003 плита 19мм») — достаём её оттуда числом. Именно
        // числом: раньше в поле уезжал весь текст целиком, и в таблице бланка
        // в колонке «Толщина» стояло название материала.
        thickness: part.thickness ?? thicknessFromText(part.materialSource) ?? "",
        milling: part.milling ?? "",
        // артикул из посчитанной заявки: на плёнке он делит карты, на распиле
        // печатается на детали — без него цех не соберёт пачку
        article: part.article ?? "",
      },
      part.quantity,
      defaultPattern,
    ),
  );
}

function isPresetActive(sheetState: SheetFormState, preset: SheetPreset) {
  return (
    sheetState.sheetWidth === preset.values.sheetWidth &&
    sheetState.sheetHeight === preset.values.sheetHeight &&
    sheetState.marginX === preset.values.marginX &&
    sheetState.marginY === preset.values.marginY &&
    sheetState.defaultGapX === preset.values.defaultGapX &&
    sheetState.defaultGapY === preset.values.defaultGapY
  );
}

/**
 * Отступ по одной оси: одним числом или раздельно по краям.
 *
 * Обычно оба края одинаковы, и держать на экране четыре поля вместо двух —
 * лишний шум. Поэтому по умолчанию поле одно, а «по краям раздельно»
 * раскрывает второе. Свёрнутый вид — это всегда «оба края одинаковы»: при
 * сворачивании второй край приравнивается к первому, чтобы на экране не
 * осталось значения, которого не видно, но которое считается.
 */
function MarginField({
  label,
  startLabel,
  endLabel,
  start,
  end,
  split,
  onSplitChange,
  onStartChange,
  onEndChange,
}: {
  label: string;
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  split: boolean;
  onSplitChange: (value: boolean) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <div className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <button
          type="button"
          className="text-xs font-medium text-amber-700 hover:underline"
          onClick={() => {
            if (split) {
              // сворачиваем: второй край больше не виден, значит он равен первому
              onEndChange(start);
            }
            onSplitChange(!split);
          }}
        >
          {split ? "одинаково" : "по краям"}
        </button>
      </div>
      {split ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-[0.12em] text-slate-500">
              {startLabel}
            </span>
            <Input
              type="number"
              value={start}
              onChange={(event) => onStartChange(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-[0.12em] text-slate-500">
              {endLabel}
            </span>
            <Input type="number" value={end} onChange={(event) => onEndChange(event.target.value)} />
          </label>
        </div>
      ) : (
        <Input
          type="number"
          value={start}
          onChange={(event) => {
            // край один на обе стороны — второй едет следом
            onStartChange(event.target.value);
            onEndChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function CuttingLayoutUI({
  options,
  priceItems = [],
  referenceValues,
  orderContext = null,
  leadContext = null,
  seedDrafts,
  seedVersion = 0,
  initialWorkKind,
}: Props) {
  const router = useRouter();
  // материалы из выгрузки заказчика — их нет в справочнике плёнок,
  // но раскладывать по ним надо отдельными листами
  const [importedPatterns, setImportedPatterns] = useState<CuttingPattern[]>(() =>
    buildImportedPatterns(
      [
        ...readLeadParts(leadContext?.parsed_payload_json).map((part) => part.material ?? ""),
        ...(orderContext?.positions ?? []).map((position) => cleanColorText(position.color)),
      ]
        .filter(Boolean),
    ),
  );
  const patterns = useMemo(() => {
    const prepared = buildPatterns(options.colors);
    const base = prepared.length ? prepared : [fallbackPattern];
    return [...base, ...importedPatterns, MDF_PATTERN, FILM_PATTERN];
  }, [options.colors, importedPatterns]);
  const defaultPatternCode = patterns[0]?.code ?? fallbackPattern.code;
  const initialUnitCount = orderContext?.positions?.some(
    (position) => Number(position.width) > 0 && Number(position.height) > 0 &&
      (initialWorkKind !== "film" || position.kind === "film"),
  )
    ? orderContext.positions.reduce(
        (sum, position) =>
          sum + (Number(position.width) > 0 && Number(position.height) > 0 &&
            (initialWorkKind !== "film" || position.kind === "film")
            ? Math.max(1, Math.round(Number(position.quantity) || 1))
            : 0),
        0,
      )
    : orderContext?.items.length
      ? orderContext.items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0)
      : readLeadParts(leadContext?.parsed_payload_json).reduce((sum, part) => sum + part.quantity, 0);
  const tooManyInitialParts = initialUnitCount > MAX_LAYOUT_UNITS;

  const [sheetState, setSheetState] = useState<SheetFormState>(() =>
    createInitialSheetState(orderContext, initialWorkKind),
  );
  const [leadState, setLeadState] = useState<LeadState>(() =>
    createInitialLeadState(orderContext, leadContext),
  );
  // Раздельные края показываем, только когда они и правда разные: обычно
  // отступ один на обе стороны, и четыре поля вместо двух — лишний шум.
  const [splitMarginX, setSplitMarginX] = useState(false);
  const [splitMarginY, setSplitMarginY] = useState(false);
  const [defaultNewPattern, setDefaultNewPattern] = useState(defaultPatternCode);
  // Пустой раскрой начинается пустым. Раньше он сразу подставлял деталь
  // 280×280, и на чистой карте висел мусор, который менеджер не заказывал.
  const [drafts, setDrafts] = useState<CuttingPartDraft[]>(() => {
    if (tooManyInitialParts) return [];
    // Смета заказа важнее каталожных позиций: её менеджер заполняет сам, и в
    // ней есть цвет, толщина и артикул — всё, по чему раскрой делит карты
    // (на распиле цвет и толщина, на плёнке цвет и артикул).
    const fromPositions = buildDraftsFromOrderPositions(
      orderContext,
      defaultPatternCode,
      patterns,
      initialWorkKind ?? "cutting",
    );
    if (fromPositions.length) {
      return fromPositions;
    }
    if (orderContext && initialWorkKind === "film") {
      return [];
    }
    if (orderContext?.items.length) {
      return buildDraftsFromOrder(orderContext, defaultPatternCode);
    }
    // раскрой открыли по заявке — её детали уже занесены, берём их
    return buildDraftsFromLead(leadContext, defaultPatternCode, patterns);
  });
  /**
   * Строки таблицы бланка.
   *
   * Держим состоянием, а не выводим из деталей на каждый рендер: в таблице
   * всегда есть пустая строка снизу, чтобы менеджер набирал список не
   * отрываясь от клавиатуры, — а пустая строка деталью ещё не является и из
   * деталей не восстановилась бы.
   */
  const [blankRows, setBlankRows] = useState<LeadPartRow[]>(() =>
    withTrailingRow(draftsToBlankRows(drafts, patterns)),
  );
  // детали, которые таблица сама же и породила: на них пересобирать её обратно
  // не нужно — иначе правка ячейки возвращалась бы к прежнему значению
  const draftsFromBlank = useRef<CuttingPartDraft[] | null>(null);

  useEffect(() => {
    if (draftsFromBlank.current === drafts) {
      return;
    }
    setBlankRows(withTrailingRow(draftsToBlankRows(drafts, patterns)));
    setQuantityError(null);
  }, [drafts, patterns]);

  function applyBlankRows(rows: LeadPartRow[]) {
    setBlankRows(rows);
    const invalid = rows.some((row) =>
      toNumber(row.length) > 0 && toNumber(row.width) > 0 &&
      row.quantity.trim() !== "" && !Number.isSafeInteger(toNumber(row.quantity)),
    );
    if (invalid) {
      setQuantityError("Количество деталей в таблице должно быть целым числом");
      return;
    }
    const total = rows.reduce((sum, row) => sum + (isRowFilled(row) ? rowQuantity(row) : 0), 0);
    if (total > MAX_LAYOUT_UNITS) {
      setQuantityError(`В одном раскрое можно разместить не больше ${MAX_LAYOUT_UNITS} деталей`);
      return;
    }
    setQuantityError(null);
    const next = blankRowsToDrafts(rows, drafts, patterns, defaultPatternCode);
    draftsFromBlank.current = next;
    setDrafts(next);
  }

  // пустой список поворачивать нечего, поэтому и «повёрнутым» он не считается
  const allRotated = drafts.length > 0 && drafts.every((draft) => draft.rotate);

  const [bulkInput, setBulkInput] = useState("");
  const [bulkErrors, setBulkErrors] = useState<BulkImportError[]>([]);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [patternFilter, setPatternFilter] = useState("all");
  const [activeSheetIndex, setActiveSheetIndex] = useState<number | null>(null);
  const [createdLead, setCreatedLead] = useState<Lead | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedExport, setSavedExport] = useState<ExportFile | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const sheetRefs = useRef<Record<number, SVGSVGElement | null>>({});

  const normalizedParts = useMemo(
    () => normalizeDrafts(drafts, defaultPatternCode),
    [drafts, defaultPatternCode],
  );
  const hasInvalidQuantity = drafts.some((draft) => {
    const quantity = Number(draft.quantity);
    return draft.quantity.trim() === "" || !Number.isSafeInteger(quantity) || quantity <= 0;
  });

  const parsedSheetState = useMemo(
    () => ({
      sheetWidth: parsePositive(sheetState.sheetWidth, 2750),
      sheetHeight: parsePositive(sheetState.sheetHeight, 1250),
      // Отступ разбираем отдельно от размеров: ноль здесь осмыслен — у листа с
      // ровной кромкой отступать от неё незачем, а parsePositive нулю не верит
      // и подставил бы 15.
      // Слева 60: у левой кромки хвостового зазора нет, и без этого поля
      // деталь встаёт в 15 мм от края.
      marginX: parseMargin(sheetState.marginX, Number(LEFT_MARGIN_MM)),
      marginY: parseMargin(sheetState.marginY, 15),
      // Справа и снизу своё поле, а не зеркало левого: там зазор последней
      // детали уже держит расстояние до кромки.
      marginRight: parseMargin(sheetState.marginRight, 15),
      marginBottom: parseMargin(sheetState.marginBottom, 15),
      defaultGapX: parsePositive(sheetState.defaultGapX, 60),
      defaultGapY: parsePositive(sheetState.defaultGapY, 60),
      algorithm: sheetState.algorithm,
      allowRotation: sheetState.allowRotation,
      keepEdgeGap: sheetState.keepEdgeGap,
      workKind: sheetState.workKind,
    }),
    [sheetState],
  );

  const layout = useMemo(
    () => packLayoutByPattern(normalizedParts, parsedSheetState),
    [normalizedParts, parsedSheetState],
  );

  // Карты распила делятся по толщине, поэтому ключ группы — это не код
  // материала. Дописываем подписи для таких карт, иначе на карте вместо
  // «Эмаль RAL 9003, 19 мм» стоял бы первый попавшийся материал из списка.
  const layoutPatterns = useMemo(
    () => buildLayoutPatterns(layout.groups, patterns),
    [layout.groups, patterns],
  );

  /**
   * Что не влезло и почему — сгруппировано по размеру.
   *
   * Причину называем прямо: чаще всего дело не в размере листа, а в том, что
   * менеджер только что запретил поворот, и деталь перестала помещаться по
   * высоте. Без этой подсказки он ищет ошибку в размерах.
   */
  const unplacedParts = useMemo(() => {
    const buckets = new Map<string, { key: string; size: string; count: number; reason: string }>();
    const workWidth =
      parsedSheetState.sheetWidth - parsedSheetState.marginX - parsedSheetState.marginRight;
    const workHeight =
      parsedSheetState.sheetHeight - parsedSheetState.marginY - parsedSheetState.marginBottom;

    for (const group of layout.groups) {
      for (const part of group.unplaced) {
        const key = `${part.width}x${part.height}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        const fitsAsIs = part.width <= workWidth && part.height <= workHeight;
        const fitsTurned = part.height <= workWidth && part.width <= workHeight;
        const reason = !parsedSheetState.allowRotation && !fitsAsIs && fitsTurned
          ? "встала бы повёрнутой, но поворот запрещён"
          : part.width > workWidth && part.height > workHeight
            ? "крупнее рабочей зоны листа"
            : part.width > workWidth
              ? "шире рабочей зоны листа"
              : part.height > workHeight
                ? "выше рабочей зоны листа"
                : "не хватило места с учётом зазоров";
        buckets.set(key, {
          key,
          size: `${part.width}×${part.height} мм`,
          count: 1,
          reason,
        });
      }
    }
    return Array.from(buckets.values());
  }, [layout.groups, parsedSheetState]);

  const previewSheet = useMemo(
    () => createPreviewSheet(parsedSheetState, defaultNewPattern),
    [defaultNewPattern, parsedSheetState],
  );

  const filteredGroups = useMemo(
    () =>
      patternFilter === "all"
        ? layout.groups
        : layout.groups.filter((group) => group.pattern === patternFilter),
    [layout.groups, patternFilter],
  );

  const filteredSheets = useMemo(() => filteredGroups.flatMap((group) => group.sheets), [filteredGroups]);

  // Детали пришли из формы заявки на этой же странице — раскладываем их.
  // Нулевая версия это начальное состояние, на неё не реагируем: иначе пустая
  // форма стирала бы то, что менеджер уже набрал в самом раскрое.
  const appliedSeed = useRef(0);
  useEffect(() => {
    if (!seedVersion || seedVersion === appliedSeed.current) return;
    appliedSeed.current = seedVersion;
    if ((seedDrafts?.length ?? 0) > MAX_LAYOUT_UNITS) {
      setQuantityError(`В одном раскрое можно разместить не больше ${MAX_LAYOUT_UNITS} деталей`);
      return;
    }
    setDrafts(seedDrafts?.length ? seedDrafts : [createDraftPart()]);
  }, [seedVersion, seedDrafts]);

  const activeRenderableSheets = useMemo(
    () => (filteredSheets.length ? filteredSheets : layout.sheets.length ? layout.sheets : [previewSheet]),
    [filteredSheets, layout.sheets, previewSheet],
  );

  useEffect(() => {
    if (!activeRenderableSheets.length) {
      setActiveSheetIndex(null);
      return;
    }

    if (
      !activeSheetIndex ||
      !activeRenderableSheets.some((sheet) => sheet.globalIndex === activeSheetIndex)
    ) {
      setActiveSheetIndex(activeRenderableSheets[0].globalIndex);
    }
  }, [activeRenderableSheets, activeSheetIndex]);

  const sheetSummary = {
    sheetWidth: sheetState.sheetWidth,
    sheetHeight: sheetState.sheetHeight,
    marginX: sheetState.marginX,
    marginY: sheetState.marginY,
    marginRight: sheetState.marginRight,
    marginBottom: sheetState.marginBottom,
    defaultGapX: sheetState.defaultGapX,
    defaultGapY: sheetState.defaultGapY,
    algorithmLabel:
      algorithmOptions.find((item) => item.value === sheetState.algorithm)?.label ?? sheetState.algorithm,
    edgeGapLabel: sheetState.keepEdgeGap ? "нужен" : "не нужен",
    workKindLabel: sheetState.workKind === "film" ? "плёнка" : "распил",
  };

  const leadMutation = useMutation({
    mutationFn: async () => {
      if (hasInvalidQuantity || quantityError) {
        throw new Error(quantityError ?? "Количество каждой детали должно быть целым числом от 1");
      }
      return clientRequest<Envelope<Lead>>("/leads/intake", {
        method: "POST",
        body: JSON.stringify({
          source_channel: "manual_manager_input",
          subject: leadState.clientName
            ? `Раскрой листа для ${leadState.clientName}`
            : "Раскрой листа из интерфейса менеджера",
          text: buildLeadText({
            clientName: leadState.clientName,
            phone: leadState.phone,
            email: leadState.email,
            comment: leadState.comment,
            sheetSummary,
            stats: layout.stats,
            parts: normalizedParts,
            patterns,
          }),
          sender: {
            full_name: leadState.clientName || null,
            phone: leadState.phone || null,
            email: leadState.email || null,
          },
          // Направление наследуем от того, откуда открыли раскрой.
          //
          // Своего выбора направления на этом экране нет, и заявка отсюда
          // уходила без него совсем: заказ из неё получал номер без буквы, а во
          // всех отборах и отчётах по направлениям такая заявка не находилась.
          // Раскрой почти всегда открывают из заказа или из заявки — там
          // направление уже выбрано руками, выдумывать ничего не нужно.
          direction_code: orderContext?.direction?.code ?? leadContext?.direction?.code ?? null,
          raw_payload: {
            tool: "sheet_cutting_layout",
            order_id: orderContext?.id ?? null,
            lead_id: leadContext?.id ?? null,
            sheet_settings: parsedSheetState,
            stats: layout.stats,
            // название материала, а не код заливки: по нему раскрой, открытый
            // из этой заявки, разложит детали по тем же материалам
            parts: normalizedParts.map((part) => ({
              ...part,
              material: getPatternByCode(patterns, part.pattern)?.name ?? null,
              // толщину заявка хранит текстом — так её читает readLeadParts,
              // и раскрой, открытый из этой заявки, снова разделит карты
              thickness: part.thickness === null ? null : String(part.thickness),
            })),
            sheets: layout.sheets,
            manager_comment: leadState.comment || null,
          },
        }),
      });
    },
    onSuccess: (response) => {
      setCreatedLead(response.data);
      setLeadError(null);
      router.refresh();
    },
    onError: (mutationError: Error) => setLeadError(mutationError.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (hasInvalidQuantity || quantityError) {
        throw new Error(quantityError ?? "Количество каждой детали должно быть целым числом от 1");
      }
      if (!orderContext) {
        throw new Error("Сначала открой раскрой из конкретного заказа");
      }

      const activeSvg =
        activeSheetIndex && sheetRefs.current[activeSheetIndex]
          ? new XMLSerializer().serializeToString(sheetRefs.current[activeSheetIndex]!)
          : null;

      return clientRequest<Envelope<ExportFile>>(`/orders/${orderContext.id}/save-cutting-layout`, {
        method: "POST",
        body: JSON.stringify({
          sheet_settings: parsedSheetState,
          stats: layout.stats,
          parts: normalizedParts,
          sheets: layout.sheets,
          pattern_filter: patternFilter,
          active_sheet_index: activeSheetIndex,
          note: leadState.comment || null,
          sheet_svg: activeSvg,
        }),
      });
    },
    onSuccess: (response) => {
      setSavedExport(response.data);
      setSaveError(null);
      router.refresh();
    },
    onError: (mutationError: Error) => setSaveError(mutationError.message),
  });

  function updateDraft(id: string, patch: Partial<CuttingPartDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  // Здесь был `materializeQuantityInput` — он разворачивал карточку детали в N
  // штук по введённому количеству. Обработчик передавался в список деталей, но
  // тот его не вызывал: поля количества в карточке нет, количество вводят в
  // таблице выше. Убран как недостижимый; если карточке снова понадобится своё
  // количество, вернуть придётся вместе с самим полем.

  /**
   * Детали из выгрузки заказчика.
   *
   * Цвет из бланка становится материалом детали, поэтому каждый цвет ложится
   * на свои листы: покрасить один лист в два цвета нельзя. Толщина в название
   * материала больше не входит — она отдельное поле детали. Так распил делит
   * карты по толщине, а плёнка кладёт детали любой толщины на один лист.
   */
  function importFromFile(result: PartsImport) {
    if (drafts.length + result.total_quantity > MAX_LAYOUT_UNITS) {
      setBulkErrors([{ line: 0, source: "", reason: `В одном раскрое можно разместить не больше ${MAX_LAYOUT_UNITS} деталей` }]);
      return;
    }
    // сервер уже отдаёт разобранный цвет, но в выгрузках встречается и запись
    // без RAL — «ПВХ Белый глянец плита 19мм»; чистим тем же правилом
    const labelOf = (part: PartsImport["parts"][number]) => cleanColorText(part.color);

    registerMaterials(result.parts.map(labelOf).filter(Boolean));

    const units = result.parts.flatMap((part, index) => {
      const label = labelOf(part);
      return expandDraftToUnits(
        {
          name: `Деталь ${index + 1}`,
          width: String(part.width),
          height: String(part.height),
          rotate: false,
          gapX: "",
          gapY: "",
          // без цвета в файле деталь остаётся на выбранном материале
          pattern: label ? resolvePatternCode(label, patterns, defaultNewPattern) : defaultNewPattern,
          // колонка «Мм» в бланке заказчика пустая, толщина написана внутри
          // цвета — поэтому запасной источник толщины это сам текст цвета
          thickness: part.thickness?.trim() || label,
        },
        part.quantity,
        defaultNewPattern,
      );
    });

    setDrafts((current) => [...current, ...units]);
    setBulkErrors([]);
  }

  function registerMaterials(labels: string[]) {
    const built = buildImportedPatterns(labels, patterns);
    if (!built.length) {
      return;
    }
    setImportedPatterns((current) => {
      const known = new Set(current.map((pattern) => pattern.code));
      return [...current, ...built.filter((pattern) => !known.has(pattern.code))];
    });
  }

  function importBulk() {
    const result = parseBulkInput(bulkInput, { pattern: defaultNewPattern, patterns });
    const incomingCount = result.parts.reduce((sum, draft) => sum + Number(draft.quantity), 0);
    if (drafts.length + incomingCount > MAX_LAYOUT_UNITS) {
      setBulkErrors([{ line: 0, source: "", reason: `В одном раскрое можно разместить не больше ${MAX_LAYOUT_UNITS} деталей` }]);
      return;
    }
    registerMaterials(result.materials);
    if (result.parts.length) {
      const expanded = result.parts.flatMap((draft) =>
        expandDraftToUnits(draft, Math.max(1, Number(draft.quantity) || 1), defaultNewPattern),
      );
      setDrafts((current) => [...current, ...expanded]);
      setBulkInput("");
    }
    setBulkErrors(result.errors);
  }

  function applySheetPreset(preset: SheetPreset) {
    setSheetState((current) => ({
      ...current,
      ...preset.values,
    }));
  }

  function addEmptyDraft() {
    setDrafts((current) => [...current, createEmptyDraft(defaultNewPattern)]);
  }

  function duplicateDraft(id: string) {
    setDrafts((current) => {
      const source = current.find((draft) => draft.id === id);
      if (!source) {
        return current;
      }

      return [...current, createUnitDraft(source, defaultPatternCode)];
    });
  }

  const selectedDraft = selectedSourceId ? drafts.find((draft) => draft.id === selectedSourceId) ?? null : null;
  const selectedDraftIndex = selectedDraft ? drafts.findIndex((draft) => draft.id === selectedDraft.id) : -1;
  const selectedPlacement = selectedSourceId
    ? layout.sheets.flatMap((sheet) => sheet.placements).find((placement) => placement.sourceId === selectedSourceId) ?? null
    : null;
  const selectedSheet = selectedSourceId
    ? layout.sheets.find((sheet) => sheet.placements.some((placement) => placement.sourceId === selectedSourceId)) ?? null
    : null;
  const selectedPattern = selectedDraft
    ? getPatternByCode(patterns, selectedDraft.pattern || defaultPatternCode) ?? fallbackPattern
    : fallbackPattern;

  const activeAlgorithmLabel =
    algorithmOptions.find((item) => item.value === sheetState.algorithm)?.label ?? sheetState.algorithm;
  const workWidth = Math.max(
    parsedSheetState.sheetWidth - parsedSheetState.marginX - marginRightOf(parsedSheetState),
    0,
  );
  const workHeight = Math.max(
    parsedSheetState.sheetHeight - parsedSheetState.marginY - marginBottomOf(parsedSheetState),
    0,
  );

  return (
    <>
      <div className="space-y-5">
        {tooManyInitialParts ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            В заказе {initialUnitCount} деталей. Для одного раскроя выберите не больше {MAX_LAYOUT_UNITS} деталей.
          </p>
        ) : null}
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-100 text-slate-700">Настрой лист</Badge>
                {orderContext ? (
                  <Badge className="bg-emerald-50 text-emerald-700">Связано с заказом</Badge>
                ) : (
                  <Badge className="bg-slate-50 text-slate-700">Менеджерский режим</Badge>
                )}
              </div>
              <p className="max-w-4xl text-sm leading-6 text-slate-700">
                Размер листа, отступы от краев и общие зазоры настраиваются одной строкой прямо над
                картой. Параметры отдельной детали открываются нажатием на неё на карте.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SHEET_PRESETS.map((preset) => (
                <Button
                  key={preset.code}
                  variant={isPresetActive(sheetState, preset) ? "secondary" : "outline"}
                  onClick={() => applySheetPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
              {orderContext ? (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Сохранить в заказ
                </Button>
              ) : null}
            </div>
          </div>

          {orderContext ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Этот раскрой открыт из заказа <strong>{orderContext.order_number}</strong>. После
              сохранения результат останется в этом же заказе и будет связан с исходной заявкой.
            </div>
          ) : null}

          {/* восемь равных колонок вместо фиксированных: сумма фиксированных
              ширин не влезала в рабочую область и правый край обрезался */}
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            <label className="space-y-2 text-sm text-slate-700">
              <span>Ширина</span>
              <Input
                type="number"
                value={sheetState.sheetWidth}
                onChange={(event) => setSheetState((current) => ({ ...current, sheetWidth: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Высота</span>
              <Input
                type="number"
                value={sheetState.sheetHeight}
                onChange={(event) => setSheetState((current) => ({ ...current, sheetHeight: event.target.value }))}
              />
            </label>
            <MarginField
              label="Отступ по горизонтали"
              startLabel="Слева"
              endLabel="Справа"
              start={sheetState.marginX}
              end={sheetState.marginRight}
              split={splitMarginX}
              onSplitChange={setSplitMarginX}
              onStartChange={(value) =>
                setSheetState((current) => ({ ...current, marginX: value }))
              }
              onEndChange={(value) =>
                setSheetState((current) => ({ ...current, marginRight: value }))
              }
            />
            <MarginField
              label="Отступ по вертикали"
              startLabel="Сверху"
              endLabel="Снизу"
              start={sheetState.marginY}
              end={sheetState.marginBottom}
              split={splitMarginY}
              onSplitChange={setSplitMarginY}
              onStartChange={(value) =>
                setSheetState((current) => ({ ...current, marginY: value }))
              }
              onEndChange={(value) =>
                setSheetState((current) => ({ ...current, marginBottom: value }))
              }
            />
            <label className="space-y-2 text-sm text-slate-700">
              <span>Зазор по ширине</span>
              <Input
                type="number"
                value={sheetState.defaultGapX}
                onChange={(event) => setSheetState((current) => ({ ...current, defaultGapX: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Зазор по высоте</span>
              <Input
                type="number"
                value={sheetState.defaultGapY}
                onChange={(event) => setSheetState((current) => ({ ...current, defaultGapY: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Алгоритм</span>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                value={sheetState.algorithm}
                onChange={(event) =>
                  setSheetState((current) => ({
                    ...current,
                    algorithm: event.target.value as SheetFormState["algorithm"],
                  }))
                }
              >
                {algorithmOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Поворот деталей</span>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                value={sheetState.allowRotation ? "yes" : "no"}
                onChange={(event) =>
                  setSheetState((current) => ({
                    ...current,
                    allowRotation: event.target.value === "yes",
                  }))
                }
              >
                <option value="yes">Разрешён</option>
                <option value="no">Запрещён</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Зазор у кромки листа</span>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                value={sheetState.keepEdgeGap ? "yes" : "no"}
                onChange={(event) =>
                  setSheetState((current) => ({
                    ...current,
                    keepEdgeGap: event.target.value === "yes",
                  }))
                }
              >
                <option value="yes">Нужен</option>
                <option value="no">Не нужен</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Тип работы</span>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                value={sheetState.workKind}
                disabled={Boolean(orderContext)}
                onChange={(event) =>
                  setSheetState((current) => ({
                    ...current,
                    workKind: event.target.value as CuttingWorkKind,
                  }))
                }
              >
                <option value="cutting">Распил</option>
                <option value="film">Плёнка</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span>Материал деталей</span>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                value={defaultNewPattern}
                onChange={(event) => setDefaultNewPattern(event.target.value)}
              >
                {patterns.map((pattern) => (
                  <option key={pattern.code} value={pattern.code}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(140px,1fr))]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <strong className="text-slate-900">Как это работает:</strong> отступы по краям создают
              пустую зону по периметру листа. Общий зазор работает между всеми деталями. Если у
              конкретной детали указать свой зазор, например 30/60 мм, он заменит общий только для
              этой детали. «Зазор у кромки листа: нужен» — пустые места по краю тоже отделены от
              деталей зазором; «не нужен» — деталь может встать вплотную к кромке, и на лист
              помещается больше. «Тип работы: распил» — детали разной толщины идут разными картами,
              «плёнка» — толщина карты не делит.
            </div>
            <HeaderMetric label="Рабочая зона" value={`${workWidth} × ${workHeight} мм`} />
            <HeaderMetric label="Карт" value={String(layout.stats.sheetCount)} />
            <HeaderMetric label="Деталей" value={String(layout.stats.requestedCount)} />
            <HeaderMetric label="Алгоритм" value={activeAlgorithmLabel} />
          </div>

          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          {savedExport ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Раскрой сохранен. Файл: {savedExport.file_name}.
            </div>
          ) : null}
        </Card>

        <BulkImportCard
          bulkInput={bulkInput}
          errors={bulkErrors}
          partsCount={drafts.length}
          onChange={setBulkInput}
          onImport={importBulk}
          onImportFile={importFromFile}
          onClear={() => {
            setBulkInput("");
            setBulkErrors([]);
          }}
          onAddEmpty={addEmptyDraft}
        />

        {/* Та же таблица, что в заявке. Ввод строками годится, когда размеры
            диктуют по телефону; когда надо поправить одну ячейку в уже
            набранном списке — нужна таблица. */}
        <Card className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-slate-700">Таблица бланка</Badge>
            <Badge className="bg-slate-50 text-slate-700">{blankRows.length} строк</Badge>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Размеры таблицей</h2>
            <p className="text-sm leading-6 text-slate-600">
              Колонки те же, что в бланке заказа. Правка любой ячейки сразу пересобирает карты.
              Параметры размещённой детали можно открыть нажатием на неё на карте.
              Правка таблицы не сбрасывает её поворот, зазор и привязку к листу.
            </p>
          </div>
          <LeadPartsTable
            rows={blankRows}
            onChange={applyBlankRows}
            priceItems={priceItems}
            showCalculator={false}
            colorOptions={referenceValues?.colors ?? []}
            millingOptions={referenceValues?.millings ?? []}
            articleOptions={referenceValues?.articles ?? []}
          />
          {quantityError ? <p className="text-sm text-red-600" role="alert">{quantityError}</p> : null}
        </Card>

        {/* Что не влезло и почему.
            Раньше это была только тихая плитка «Не размещено: 4» среди девяти
            других: менеджер запрещал поворот, все детали исчезали с карты, и
            заметить это было почти нечем. Теперь — заметный блок с размерами и
            причиной, как в раскрое партией. */}
        {unplacedParts.length ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">
              Не поместилось деталей: {layout.stats.unplacedCount}
            </p>
            <ul className="mt-2 space-y-1">
              {unplacedParts.map((item) => (
                <li key={item.key}>
                  <span className="num">{item.size}</span> — {item.count} шт.: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* orderNumber печатается на каждой детали: деталь уезжает в цех
            отдельно от карты, и по одной подписи должно быть понятно, чья она. */}
        <SheetWorkspace
          groups={layout.groups}
          patterns={layoutPatterns}
          previewSheet={layout.sheets.length ? null : previewSheet}
          activeSheetIndex={activeSheetIndex}
          patternFilter={patternFilter}
          highlightedSourceId={hoveredSourceId}
          showGrid={showGrid}
          orderNumber={orderContext?.order_number ?? leadContext?.lead_number ?? null}
          asideContent={
            <DeskSidebar
              showGrid={showGrid}
              sheetWidth={parsedSheetState.sheetWidth}
              sheetHeight={parsedSheetState.sheetHeight}
              algorithmLabel={activeAlgorithmLabel}
              algorithmDescriptions={algorithmOptions.map((item) => ({
                value: item.value,
                label: item.label,
                description: item.description,
              }))}
              activeAlgorithm={sheetState.algorithm}
              defaultGapX={sheetState.defaultGapX}
              defaultGapY={sheetState.defaultGapY}
              totalDrafts={drafts.length}
              onToggleGrid={setShowGrid}
              onApplyGapToAll={() =>
                setDrafts((current) =>
                  current.map((draft) => ({
                    ...draft,
                    gapX: sheetState.defaultGapX,
                    gapY: sheetState.defaultGapY,
                  })),
                )
              }
              onResetCustomGaps={() =>
                setDrafts((current) => current.map((draft) => ({ ...draft, gapX: "", gapY: "" })))
              }
              // Одно нажатие — вся пачка на бок. Смотрим на «повёрнуты ли все»,
              // а не переключаем каждую по отдельности: иначе на смешанном
              // списке кнопка меняла бы детали местами, а не разворачивала их.
              allRotated={allRotated}
              onRotateAll={() =>
                setDrafts((current) => current.map((draft) => ({ ...draft, rotate: !allRotated })))
              }
              onAddEmpty={addEmptyDraft}
            />
          }
          onPatternFilterChange={setPatternFilter}
          onActiveSheetChange={setActiveSheetIndex}
          onHover={setHoveredSourceId}
          onSelectPlacement={setSelectedSourceId}
          onExportSheet={(sheetIndex) => {
            const svgElement = sheetRefs.current[sheetIndex];
            if (!svgElement) {
              return;
            }

            const serializer = new XMLSerializer();
            const svgMarkup = serializer.serializeToString(svgElement);
            const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `cutting-sheet-${sheetIndex}.svg`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          registerSvg={(sheetIndex, element) => {
            sheetRefs.current[sheetIndex] = element;
          }}
        />

        {/* Сколько материала заказать: раньше менеджер считал это по разложенным
            деталям на бумаге. Заказчик: «чтобы она просто перебивала это в
            заявку поставщику». */}
        <SupplySummary groups={layout.groups} patterns={layoutPatterns} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <StatsOverview stats={layout.stats} rowCount={drafts.length} algorithm={sheetState.algorithm} />

          {orderContext ? (
            <Card className="space-y-4">
              <div className="space-y-2">
                <Badge className="bg-slate-50 text-slate-700">Результат</Badge>
                <h2 className="text-lg font-semibold text-slate-900">Сохранение в заказ</h2>
                <p className="text-sm leading-6 text-slate-700">
                  Этот раскрой уже открыт из заказа. Нажми одну кнопку, и результат останется в
                  истории этого заказа.
                </p>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
                <FileCheck2 className="mr-2 h-4 w-4" />
                Сохранить раскрой в заказ
              </Button>
              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
              {savedExport ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  Раскрой сохранен. Файл: {savedExport.file_name}.
                </div>
              ) : null}
            </Card>
          ) : (
            <LeadCard
              leadState={leadState}
              createdLead={createdLead}
              error={leadError}
              isPending={leadMutation.isPending}
              onChange={(key, value) => setLeadState((current) => ({ ...current, [key]: value }))}
              onSubmit={() => leadMutation.mutate()}
            />
          )}
        </div>
      </div>

      {selectedDraft ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSourceId(null)}
        >
          <div
            className="mx-auto mt-[4vh] max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 "
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-100 text-slate-700">Деталь #{selectedDraftIndex + 1}</Badge>
                  <Badge className="bg-slate-50 text-slate-700">{selectedPattern.name}</Badge>
                </div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {selectedDraft.name || `Деталь #${selectedDraftIndex + 1}`}
                </h3>
                <p className="text-sm text-slate-700">
                  {selectedPlacement
                    ? "Эта деталь уже размещена на карте. Здесь можно сразу поправить её параметры."
                    : "Эта деталь пока не размещена на карте. Заполни параметры, и раскладка обновится автоматически."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSourceId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Название детали</span>
                <Input
                  value={selectedDraft.name}
                  onChange={(event) => updateDraft(selectedDraft.id, { name: event.target.value })}
                  placeholder={`Деталь #${selectedDraftIndex + 1}`}
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Длина, мм</span>
                <Input
                  type="number"
                  value={selectedDraft.width}
                  onChange={(event) => updateDraft(selectedDraft.id, { width: event.target.value })}
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Ширина, мм</span>
                <Input
                  type="number"
                  value={selectedDraft.height}
                  onChange={(event) => updateDraft(selectedDraft.id, { height: event.target.value })}
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Зазор по горизонтали, мм</span>
                <Input
                  type="number"
                  value={selectedDraft.gapX}
                  onChange={(event) => updateDraft(selectedDraft.id, { gapX: event.target.value })}
                  placeholder={sheetState.defaultGapX}
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Зазор по вертикали, мм</span>
                <Input
                  type="number"
                  value={selectedDraft.gapY}
                  onChange={(event) => updateDraft(selectedDraft.id, { gapY: event.target.value })}
                  placeholder={sheetState.defaultGapY}
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Лист</span>
                <Input
                  type="number"
                  min="1"
                  value={selectedDraft.preferredSheet}
                  onChange={(event) => updateDraft(selectedDraft.id, { preferredSheet: event.target.value })}
                  placeholder="Авто"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Материал</span>
                <select
                  className="flex h-10 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
                  value={selectedDraft.pattern || defaultPatternCode}
                  onChange={(event) => updateDraft(selectedDraft.id, { pattern: event.target.value })}
                >
                  {patterns.map((pattern) => (
                    <option key={pattern.code} value={pattern.code}>
                      {pattern.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Толщина, мм</span>
                <Input
                  type="number"
                  min="0"
                  value={selectedDraft.thickness ?? ""}
                  onChange={(event) => updateDraft(selectedDraft.id, { thickness: event.target.value })}
                  placeholder="Не указана"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Текущий размер</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {formatSize(Number(selectedDraft.width) || 0, Number(selectedDraft.height) || 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Применяемые зазоры</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedDraft.gapX || sheetState.defaultGapX} / {selectedDraft.gapY || sheetState.defaultGapY} мм
                </p>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-2xl border-slate-300"
                checked={selectedDraft.rotate}
                onChange={(event) => updateDraft(selectedDraft.id, { rotate: event.target.checked })}
              />
              Разрешить поворот детали при раскладке
            </label>

            {selectedPlacement ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Позиция на карте</p>
                <p className="mt-2 text-sm text-slate-700">
                  X: {Math.round(selectedPlacement.x)} мм, Y: {Math.round(selectedPlacement.y)} мм, карта{" "}
                  {selectedSheet?.globalIndex || selectedPlacement.preferredSheet || "авто"}.
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Если оставить зазоры пустыми, для детали возьмётся общий зазор листа. Номер листа можно не указывать,
              тогда система сама выберет подходящую карту.
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => duplicateDraft(selectedDraft.id)}>
                  Дублировать
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    setDrafts((current) => current.filter((draft) => draft.id !== selectedDraft.id));
                    setSelectedSourceId(null);
                  }}
                >
                  Удалить
                </Button>
              </div>
              <Button onClick={() => setSelectedSourceId(null)}>Готово</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSourceId(null)}
        >
          <div
            className="mx-auto mt-[8vh] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 "
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-100 text-slate-700">Деталь #{selectedDraftIndex + 1}</Badge>
                  <Badge className="bg-slate-50 text-slate-700">{selectedPattern.name}</Badge>
                </div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {selectedDraft.name || `Деталь #${selectedDraftIndex + 1}`}
                </h3>
                <p className="text-sm text-slate-700">
                  {selectedPlacement ? "Деталь уже размещена на карте." : "Деталь пока не размещена на карте."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSourceId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Размер</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {formatSize(Number(selectedDraft.width) || 0, Number(selectedDraft.height) || 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Зазоры</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedDraft.gapX || sheetState.defaultGapX} / {selectedDraft.gapY || sheetState.defaultGapY} мм
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Лист</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedPlacement?.preferredSheet || selectedDraft.preferredSheet || "Авто"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Поворот</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedDraft.rotate ? "Разрешен" : "Запрещен"}
                </p>
              </div>
            </div>

            {selectedPlacement ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Позиция на карте</p>
                <p className="mt-2 text-sm text-slate-700">
                  X: {Math.round(selectedPlacement.x)} мм, Y: {Math.round(selectedPlacement.y)} мм, карта{" "}
                  {selectedSheet?.globalIndex || selectedPlacement.preferredSheet || "авто"}.
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedSourceId(null)}>Закрыть</Button>
            </div>
          </div>
        </div>
      */}
    </>
  );
}
