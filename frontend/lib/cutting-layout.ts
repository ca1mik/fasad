import type { FilmCatalogItem, FilmColor } from "@/types/api";

export type CuttingPatternKind = "solid" | "diagonal" | "grid" | "wood" | "dots";

export type CuttingPattern = {
  code: string;
  name: string;
  finish: string;
  kind: CuttingPatternKind;
  fill: string;
  accent: string;
  stroke: string;
  text: string;
};

/** Основа листа в картах распила и плёнки; отделена от отделки на деталях. */
export const MDF_PATTERN: CuttingPattern = {
  code: "mdf_board",
  name: "МДФ",
  finish: "board",
  kind: "solid",
  fill: "#e2e8f0",
  accent: "#64748b",
  stroke: "#475569",
  text: "#0f172a",
};

export const FILM_PATTERN: CuttingPattern = {
  code: "film_roll",
  name: "Плёнка",
  finish: "film",
  kind: "solid",
  fill: "#dbeafe",
  accent: "#2563eb",
  stroke: "#1d4ed8",
  text: "#1e3a8a",
};

/**
 * Что делают с листом.
 *
 * `cutting` — распил: лист режут на детали, и деталь толщиной 16 мм физически
 * нельзя выпилить из плиты 19 мм. Значит каждая толщина идёт своей картой.
 * `film` — оклейка плёнкой: плёнку кладут поверх уже готовых деталей, толщина
 * основания на раскрой плёнки не влияет, и делить по ней карты незачем.
 */
export type CuttingWorkKind = "cutting" | "film";

export type CuttingPartDraft = {
  id: string;
  catalogItemCode: string;
  name: string;
  width: string;
  height: string;
  quantity: string;
  preferredSheet: string;
  rotate: boolean;
  gapX: string;
  gapY: string;
  pattern: string;
  /** Толщина детали как её ввели: «19», «19мм» или пусто. */
  thickness?: string;
  /** Артикул из сметы заказа. Пусто — деталь без артикула, карты по нему не делятся. */
  article?: string;
  /**
   * Фрезеровка из бланка. На раскладку не влияет — карты по ней не делятся, —
   * но правится в таблице бланка рядом с размерами, и терять её при правке
   * нельзя: дальше она уезжает в заказ и в бумагу для цеха.
   */
  milling?: string;
};

export type CuttingPart = {
  id: string;
  partNumber: number;
  catalogItemCode: string | null;
  name: string;
  width: number;
  height: number;
  quantity: number;
  preferredSheet: number | null;
  rotate: boolean;
  gapX: number | null;
  gapY: number | null;
  pattern: string;
  /**
   * Толщина детали, мм. Поле необязательное: раскрой плёнки и старые вызовы
   * толщину не знают, и без неё карты делятся ровно как раньше.
   */
  thickness?: number | null;
  /**
   * Артикул делит карты плёнки. На распиле он остаётся на каждой детали,
   * но детали разных артикулов одной толщины лежат на одном листе МДФ.
   */
  article?: string | null;
};

export type CuttingSheetSettings = {
  sheetWidth: number;
  sheetHeight: number;
  /**
   * Отступ слева и сверху. Историческое имя: до появления раздельных краёв
   * отступ был один на обе стороны, и во всех расчётах это была левая граница.
   */
  marginX: number;
  marginY: number;
  /**
   * Отступ справа и снизу. Не задан — зеркалим левый и верхний.
   *
   * Раздельные края нужны, когда у листа обрезана одна сторона: кромка после
   * распила на пилораме бывает битой только справа, и закладывать такой же
   * отступ слева значит терять полосу материала на каждом листе.
   */
  marginRight?: number;
  marginBottom?: number;
  defaultGapX: number;
  defaultGapY: number;
  algorithm: "leftEdge" | "byLength" | "byWidth" | "optimal";
  /**
   * Можно ли класть деталь повёрнутой на 90°.
   *
   * Для эмали и однотонных плёнок поворот бесплатен и заметно уплотняет лист.
   * Для материалов с направлением (шпон, плёнка под дерево) поворот запрещён:
   * повёрнутая деталь пойдёт текстурой поперёк и уйдёт в брак.
   */
  allowRotation: boolean;
  /**
   * Нужен ли зазор у кромки листа.
   *
   * `true` (по умолчанию, так просил заказчик) — рамка по краю такая же, как
   * между деталями: у кромки остаются пустые прямоугольники в зазор шириной,
   * их видно на карте и по ним удобно резать.
   * `false` — хвост зазора, упирающийся в кромку, обрезается: он граничит с
   * пустотой, соседа там уже не поставить. На настоящем заказе это экономит
   * лист, поэтому вариант оставлен как настройка.
   */
  keepEdgeGap?: boolean;
  /**
   * Тип работы. Влияет только на то, делит ли толщина детали карты.
   * По умолчанию распил — у деталей без толщины поведение от этого не меняется.
   */
  workKind?: CuttingWorkKind;
};

export type LayoutPlacement = {
  unitId: string;
  sourceId: string;
  sourceNumber: number;
  sourceName: string;
  pattern: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gapX: number;
  gapY: number;
  preferredSheet: number | null;
  footprintWidth: number;
  footprintHeight: number;
  rotated: boolean;
  /** Толщина детали, мм — чтобы цех видел её прямо у детали на карте. */
  thickness: number | null;
  /** Артикул детали — печатается на карте: по нему в цеху собирают пачку. */
  article: string | null;
};

export type LayoutSheet = {
  index: number;
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  workWidth: number;
  workHeight: number;
  placements: LayoutPlacement[];
  remainders: FreeRect[];
  detailArea: number;
  gapArea: number;
  freeArea: number;
  fillPercent: number;
  /** Ширина целой свободной полосы справа, мм. Её проще вернуть на склад,
      чем набор мелких обрезков, поэтому цех смотрит именно на неё. */
  freeStripWidth: number;
  /** Длина листа, занятая деталями, мм — от начала рабочей зоны до правого
      края последней детали. Заказчик: «добавить в раскрой саму длину по
      эффективным деталям». */
  usedLength: number;
  /** Те же площади без округления — только для сложения по листам. */
  exactDetailArea: number;
  exactGapArea: number;
  exactFreeArea: number;
};

export type LayoutStats = {
  sheetCount: number;
  placedCount: number;
  unplacedCount: number;
  requestedCount: number;
  detailArea: number;
  freeArea: number;
  gapArea: number;
  marginArea: number;
  fillPercent: number;
};

export type LayoutPackResult = {
  sheets: LayoutSheet[];
  unplaced: ExpandedPart[];
  stats: LayoutStats;
};

export type LayoutSheetView = LayoutSheet & {
  /**
   * Ключ группы, к которой относится лист. Обычно это код материала, а на
   * распиле с известной толщиной — код материала вместе с толщиной.
   */
  pattern: string;
  /** Код материала без толщины — им залиты детали на карте. */
  materialCode: string;
  /** Толщина карты, мм; null — если карта толщиной не делится. */
  thickness: number | null;
  globalIndex: number;
  localIndex: number;
};

export type LayoutGroup = {
  pattern: string;
  materialCode: string;
  thickness: number | null;
  /** Все толщины, попавшие в группу, — их больше одной только на плёнке. */
  thicknesses: number[];
  /** Артикул группы; null — детали без артикула, карты по нему не делились. */
  article: string | null;
  sheets: LayoutSheetView[];
  stats: LayoutStats;
  unplaced: ExpandedPart[];
};

export type CuttingLayoutStats = LayoutStats & {
  groupCount: number;
  patterns: string[];
};

export type CuttingLayoutResult = {
  groups: LayoutGroup[];
  sheets: LayoutSheetView[];
  unplaced: ExpandedPart[];
  stats: CuttingLayoutStats;
};

export type BulkImportError = {
  line: number;
  source: string;
  reason: string;
};

export type BulkImportResult = {
  parts: CuttingPartDraft[];
  errors: BulkImportError[];
  /** Названия материалов, встреченные в строках после «|». */
  materials: string[];
};

type ExpandedPart = {
  unitId: string;
  sourceId: string;
  sourceNumber: number;
  sourceName: string;
  width: number;
  height: number;
  preferredSheet: number | null;
  rotate: boolean;
  gapX: number;
  gapY: number;
  pattern: string;
  thickness: number | null;
  article: string | null;
};

type FreeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PlacementCandidate = {
  freeRectIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  footprintWidth: number;
  footprintHeight: number;
  rotated: boolean;
  score: [number, number, number, number, number, number];
};

const COLOR_PRESETS: Record<string, Omit<CuttingPattern, "code" | "name" | "finish">> = {
  gloss: {
    kind: "diagonal",
    fill: "#fef3c7",
    accent: "#f59e0b",
    stroke: "#b45309",
    text: "#78350f",
  },
  matt: {
    kind: "grid",
    fill: "#e2e8f0",
    accent: "#64748b",
    stroke: "#334155",
    text: "#0f172a",
  },
  wood: {
    kind: "wood",
    fill: "#f5e7d3",
    accent: "#b7791f",
    stroke: "#7c4a03",
    text: "#4a2c02",
  },
  soft: {
    kind: "dots",
    fill: "#dbe4ea",
    accent: "#0f172a",
    stroke: "#0f172a",
    text: "#0f172a",
  },
  default: {
    kind: "solid",
    fill: "#dbeafe",
    accent: "#2563eb",
    stroke: "#1d4ed8",
    text: "#1e3a8a",
  },
};

/**
 * Заливки для материалов из выгрузки.
 *
 * Пресеты справочника сюда не годятся: среди них есть тёмные (частые точки,
 * плотная сетка), и на карте деталь заливается почти чёрным — размеры на ней
 * не прочитать. Здесь только светлые тона, различимые между собой.
 */
const IMPORTED_PALETTE: Omit<CuttingPattern, "code" | "name" | "finish">[] = [
  { kind: "solid", fill: "#fde68a", accent: "#d97706", stroke: "#b45309", text: "#78350f" },
  { kind: "solid", fill: "#bfdbfe", accent: "#2563eb", stroke: "#1d4ed8", text: "#1e3a8a" },
  { kind: "solid", fill: "#bbf7d0", accent: "#16a34a", stroke: "#15803d", text: "#14532d" },
  { kind: "solid", fill: "#fbcfe8", accent: "#db2777", stroke: "#be185d", text: "#831843" },
  { kind: "solid", fill: "#ddd6fe", accent: "#7c3aed", stroke: "#6d28d9", text: "#4c1d95" },
  { kind: "solid", fill: "#fed7aa", accent: "#ea580c", stroke: "#c2410c", text: "#7c2d12" },
  { kind: "solid", fill: "#a5f3fc", accent: "#0891b2", stroke: "#0e7490", text: "#164e63" },
  { kind: "solid", fill: "#e2e8f0", accent: "#475569", stroke: "#334155", text: "#0f172a" },
];

function roundArea(value: number) {
  return Math.round(value * 1000) / 1000;
}

function rectArea(rect: Pick<FreeRect, "width" | "height">) {
  return rect.width * rect.height;
}

function compareScore(
  a: PlacementCandidate["score"],
  b: PlacementCandidate["score"],
): number {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

function isValidRect(rect: FreeRect) {
  return rect.width > 0 && rect.height > 0;
}

/** Отступ справа: не задан — такой же, как слева. */
export function marginRightOf(settings: CuttingSheetSettings) {
  return settings.marginRight ?? settings.marginX;
}

/** Отступ снизу: не задан — такой же, как сверху. */
export function marginBottomOf(settings: CuttingSheetSettings) {
  return settings.marginBottom ?? settings.marginY;
}

function createEmptySheet(settings: CuttingSheetSettings, index: number): LayoutSheet {
  const workWidth = Math.max(
    settings.sheetWidth - settings.marginX - marginRightOf(settings),
    0,
  );
  const workHeight = Math.max(
    settings.sheetHeight - settings.marginY - marginBottomOf(settings),
    0,
  );

  return {
    index,
    width: settings.sheetWidth,
    height: settings.sheetHeight,
    marginX: settings.marginX,
    marginY: settings.marginY,
    workWidth,
    workHeight,
    placements: [],
    remainders:
      workWidth > 0 && workHeight > 0
        ? [
            {
              x: settings.marginX,
              y: settings.marginY,
              width: workWidth,
              height: workHeight,
            },
          ]
        : [],
    detailArea: 0,
    gapArea: 0,
    freeArea: roundArea((workWidth * workHeight) / 1_000_000),
    fillPercent: 0,
    freeStripWidth: workWidth,
    usedLength: 0,
    exactDetailArea: 0,
    exactGapArea: 0,
    exactFreeArea: (workWidth * workHeight) / 1_000_000,
  };
}

export function createPreviewSheet(
  settings: CuttingSheetSettings,
  pattern: string,
): LayoutSheetView {
  const preview = createEmptySheet(settings, 1);
  updateSheetMetrics(preview);

  return {
    ...preview,
    pattern,
    materialCode: pattern,
    thickness: null,
    globalIndex: 1,
    localIndex: 1,
  };
}

/**
 * Разумные пределы толщины плиты: всё вне их — не толщина, а случайное число.
 * Те же, что у разбора бланка на сервере (`imports/parser.py`), чтобы фронт и
 * бэкенд не расходились в том, что считать толщиной.
 */
const MIN_THICKNESS_MM = 1;
const MAX_THICKNESS_MM = 100;

/**
 * Число перед «мм» внутри свободного текста: «плита 19мм», «16 мм», «19,5 мм».
 *
 * Предыдущий знак захватываем и проверяем сами — без этого из «RAL 9003мм»
 * вырезалось бы «003». Взгляд назад (`(?<!…)`) сделал бы то же короче, но его
 * не понимают браузеры до Safari 16.4, а карта раскроя открывается и с планшета
 * в цехе.
 */
const THICKNESS_IN_TEXT = /(^|[^\d.,])(\d{1,3}(?:[.,]\d+)?)\s*мм/gi;

function toThickness(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed >= MIN_THICKNESS_MM && parsed <= MAX_THICKNESS_MM ? parsed : null;
}

/**
 * Толщина детали в миллиметрах из того, что ввёл человек.
 *
 * В бланке заказчика колонка «Мм» часто пустая, а толщина написана внутри
 * цвета: «Эмаль RAL 9003 плита 19мм». Поэтому кроме голого числа понимаем и
 * текст. Иначе распил 16 и 19 мм уехал бы на одну карту, а из плиты 19 мм
 * деталь 16 мм не выпилить.
 *
 * Перебираем все числа с «мм», а не только первое: в текст цвета попадает и
 * фрезеровка («паз 4мм под стекло, плита 19мм»), и по первому числу карты
 * разъехались бы по толщине 4 мм, которой у плиты нет.
 */
export function parseThickness(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? toThickness(String(value)) : null;
  }

  const text = (value ?? "").trim();
  if (!text) {
    return null;
  }

  for (const match of text.matchAll(THICKNESS_IN_TEXT)) {
    const parsed = toThickness(match[2]);
    if (parsed !== null) {
      return parsed;
    }
  }

  // в колонке «Мм» пишут голое число, без единиц измерения
  const bare = text.replace(",", ".");
  return /^\d{1,3}(?:\.\d+)?$/.test(bare) ? toThickness(bare) : null;
}

function getResolvedGap(value: number | null, fallback: number) {
  return value ?? fallback;
}

function pruneFreeRects(rects: FreeRect[]) {
  return rects.filter((rect, rectIndex) => {
    return !rects.some((other, otherIndex) => {
      if (rectIndex === otherIndex) {
        return false;
      }

      return (
        rect.x >= other.x &&
        rect.y >= other.y &&
        rect.x + rect.width <= other.x + other.width &&
        rect.y + rect.height <= other.y + other.height
      );
    });
  });
}

function normalizeFreeRects(rects: FreeRect[]) {
  return pruneFreeRects(rects)
    .filter(isValidRect)
    .sort(
      (left, right) =>
        left.y - right.y ||
        left.x - right.x ||
        rectArea(left) - rectArea(right),
    );
}

/**
 * Порядки укладки, которые перебираются в поиске лучшей раскладки.
 *
 * `algorithm` — порядок, свойственный выбранному алгоритму; остальные пробуются
 * дополнительно. Укладчик кладёт детали жадно, по одной, и результат сильно
 * зависит от того, в каком порядке они идут: заказ, который в одном порядке
 * занимает семь листов, в другом ложится в шесть.
 */
export type PartOrdering = "algorithm" | "area" | "longSide" | "height" | "width" | "perimeter";

const PART_ORDERINGS: PartOrdering[] = [
  "algorithm",
  "area",
  "longSide",
  "height",
  "width",
  "perimeter",
];

function sortExpandedParts(
  parts: ExpandedPart[],
  algorithm: CuttingSheetSettings["algorithm"],
  ordering: PartOrdering = "algorithm",
) {
  return [...parts].sort((left, right) => {
    const byName = left.sourceName.localeCompare(right.sourceName);

    if (ordering === "area") {
      return right.width * right.height - left.width * left.height || byName;
    }
    if (ordering === "longSide") {
      return (
        Math.max(right.width, right.height) - Math.max(left.width, left.height) ||
        Math.min(right.width, right.height) - Math.min(left.width, left.height) ||
        byName
      );
    }
    if (ordering === "height") {
      return right.height - left.height || right.width - left.width || byName;
    }
    if (ordering === "width") {
      return right.width - left.width || right.height - left.height || byName;
    }
    if (ordering === "perimeter") {
      return right.width + right.height - (left.width + left.height) || byName;
    }

    const leftArea = left.width * left.height;
    const rightArea = right.width * right.height;
    const leftLongSide = Math.max(left.width, left.height);
    const rightLongSide = Math.max(right.width, right.height);
    const leftShortSide = Math.min(left.width, left.height);
    const rightShortSide = Math.min(right.width, right.height);

    if (algorithm === "leftEdge") {
      // высокие детали первыми: колонка у левого края набирается на всю
      // высоту, и следующая начинается только когда эта заполнена
      return (
        rightLongSide - leftLongSide ||
        rightShortSide - leftShortSide ||
        rightArea - leftArea ||
        left.sourceName.localeCompare(right.sourceName)
      );
    }

    if (algorithm === "byWidth") {
      return (
        right.width - left.width ||
        rightArea - leftArea ||
        right.height - left.height ||
        left.sourceName.localeCompare(right.sourceName)
      );
    }

    if (algorithm === "byLength") {
      return (
        right.height - left.height ||
        rightArea - leftArea ||
        right.width - left.width ||
        left.sourceName.localeCompare(right.sourceName)
      );
    }

    return (
      rightArea - leftArea ||
      rightLongSide - leftLongSide ||
      rightShortSide - leftShortSide ||
      left.sourceName.localeCompare(right.sourceName)
    );
  });
}

function updateSheetMetrics(sheet: LayoutSheet) {
  const detailArea = sheet.placements.reduce(
    (sum, placement) => sum + (placement.width * placement.height) / 1_000_000,
    0,
  );
  const gapArea = sheet.placements.reduce(
    (sum, placement) =>
      sum +
      (placement.footprintWidth * placement.footprintHeight -
        placement.width * placement.height) /
        1_000_000,
    0,
  );
  const workArea = (sheet.workWidth * sheet.workHeight) / 1_000_000;
  // Куски свободного места пересекаются между собой (каждый описывает
  // настоящий свободный прямоугольник целиком), поэтому складывать их нельзя —
  // получилось бы больше самого листа. Считаем остаток вычитанием занятого.
  const freeArea = Math.max(workArea - detailArea - gapArea, 0);

  // Правый край занятой зоны: всё, что правее, — одна целая полоса,
  // которую цех возвращает на склад как пригодный лист.
  const usedRightEdge = sheet.placements.reduce(
    (rightmost, placement) => Math.max(rightmost, placement.x + placement.footprintWidth),
    0,
  );

  // Точные значения нужны для сумм: складывать округлённые по листам нельзя —
  // погрешность каждого листа копится, и общая площадь деталей начинает
  // прыгать (11.790 / 11.792 м²) в зависимости от того, как легла раскладка.
  sheet.exactDetailArea = detailArea;
  sheet.exactGapArea = gapArea;
  sheet.exactFreeArea = freeArea;
  sheet.detailArea = roundArea(detailArea);
  sheet.gapArea = roundArea(gapArea);
  sheet.freeArea = roundArea(freeArea);
  sheet.fillPercent = workArea > 0 ? roundArea((detailArea / workArea) * 100) : 0;
  sheet.freeStripWidth = sheet.placements.length
    ? Math.max(0, Math.round(sheet.marginX + sheet.workWidth - usedRightEdge))
    : sheet.workWidth;
  // Длина по эффективным деталям: сколько рабочей зоны занято от левого края до
  // правого края последней детали, вместе с её технологическим зазором. Зазор
  // входит намеренно — деталь без него не режется, а сумма с полосой справа
  // тогда точно равна рабочей ширине, и цеху не надо ничего досчитывать.
  sheet.usedLength = sheet.placements.length
    ? Math.max(0, Math.round(usedRightEdge - sheet.marginX))
    : 0;
}

export function createDraftId() {
  return `part-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDraftPart(
  defaults?: Partial<CuttingPartDraft>,
): CuttingPartDraft {
  return {
    id: createDraftId(),
    catalogItemCode: defaults?.catalogItemCode ?? "",
    name: defaults?.name ?? "",
    width: defaults?.width ?? "280",
    height: defaults?.height ?? "280",
    quantity: defaults?.quantity ?? "1",
    preferredSheet: defaults?.preferredSheet ?? "",
    rotate: defaults?.rotate ?? false,
    gapX: defaults?.gapX ?? "",
    gapY: defaults?.gapY ?? "",
    pattern: defaults?.pattern ?? "",
    thickness: defaults?.thickness ?? "",
    article: defaults?.article ?? "",
    milling: defaults?.milling ?? "",
  };
}

export function createDraftPartFromCatalog(
  item: FilmCatalogItem,
  pattern: string,
): CuttingPartDraft {
  return createDraftPart({
    catalogItemCode: item.code,
    name: item.name,
    width: String(item.default_width_mm),
    height: String(item.default_length_mm),
    quantity: String(item.default_quantity),
    rotate: false,
    gapX: "",
    gapY: "",
    pattern,
  });
}

export function normalizeDrafts(
  drafts: CuttingPartDraft[],
  fallbackPattern: string,
): CuttingPart[] {
  return drafts
    .map((draft, index) => {
      const parsedPreferredSheet = Number(draft.preferredSheet);

      return {
        id: draft.id,
        partNumber: index + 1,
        catalogItemCode: draft.catalogItemCode || null,
        name: draft.name.trim() || "Деталь",
        width: Number(draft.width),
        height: Number(draft.height),
        quantity: Number(draft.quantity),
        preferredSheet:
          draft.preferredSheet === "" || !Number.isFinite(parsedPreferredSheet)
            ? null
            : Math.max(1, Math.floor(parsedPreferredSheet)),
        rotate: draft.rotate,
        gapX: draft.gapX === "" ? null : Number(draft.gapX),
        gapY: draft.gapY === "" ? null : Number(draft.gapY),
        pattern: draft.pattern || fallbackPattern,
        thickness: parseThickness(draft.thickness),
        article: draft.article?.trim() || null,
      };
    })
    .filter(
      (part) =>
        Number.isFinite(part.width) &&
        Number.isFinite(part.height) &&
        Number.isFinite(part.quantity) &&
        part.width > 0 &&
        part.height > 0 &&
        Number.isSafeInteger(part.quantity) &&
        part.quantity > 0,
    );
}

export function buildPatterns(colors: FilmColor[]): CuttingPattern[] {
  return colors.map((color) => {
    const preset = COLOR_PRESETS[color.finish] ?? COLOR_PRESETS.default;
    return {
      code: color.code,
      name: color.name,
      finish: color.finish,
      kind: preset.kind,
      fill: preset.fill,
      accent: preset.accent,
      stroke: preset.stroke,
      text: preset.text,
    };
  });
}

/**
 * Материалы, пришедшие из выгрузки заказчика.
 *
 * В бланке цвет — свободный текст («Эмаль RAL 9003 плита 19мм»), в справочнике
 * плёнок такого кода нет. Каждое различающееся значение становится отдельным
 * материалом, а значит и отдельными листами: класть эмаль двух цветов на один
 * лист нельзя, лист красят целиком.
 */
export function buildImportedPatterns(
  colors: string[],
  known: CuttingPattern[] = [],
): CuttingPattern[] {
  // то, что уже есть в справочнике, заводить заново нельзя — в списке
  // материалов появился бы дубль с тем же названием
  const knownNames = new Set(known.map((pattern) => pattern.name.trim().toLowerCase()));
  const seen = new Map<string, string>();

  for (const color of colors) {
    const label = color.trim();
    if (!label || knownNames.has(label.toLowerCase())) {
      continue;
    }
    if (!seen.has(importedPatternCode(label))) {
      seen.set(importedPatternCode(label), label);
    }
  }

  return [...seen.entries()].map(([code, name], index) => ({
    code,
    name,
    finish: "imported",
    ...IMPORTED_PALETTE[index % IMPORTED_PALETTE.length],
  }));
}

/**
 * Код материала по его названию.
 *
 * Сначала ищем в справочнике: «Белый глянец» из строки должен попасть в тот же
 * материал, что и выбранный в списке, а не завести рядом одноимённый. Если
 * такого нет — это цвет из бланка заказчика, у него свой код.
 */
export function resolvePatternCode(
  material: string,
  patterns: CuttingPattern[],
  fallback: string,
): string {
  const wanted = material.trim().toLowerCase();
  if (!wanted) {
    return fallback;
  }
  const known = patterns.find((pattern) => pattern.name.trim().toLowerCase() === wanted);
  return known ? known.code : importedPatternCode(material);
}

/**
 * Код материала по тексту цвета.
 *
 * Код уходит в id SVG-заливки, поэтому кириллицу и пробелы в нём держать
 * нельзя — ссылка `url(#…)` порвётся и деталь зальётся чёрным. Берём короткую
 * устойчивую свёртку текста: разные цвета дают разные коды, один и тот же
 * цвет — всегда один код.
 */
export function importedPatternCode(color: string): string {
  const text = color.trim().toLowerCase().replace(/\s+/g, " ");
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return `file-${hash.toString(36)}`;
}

export function getPatternByCode(patterns: CuttingPattern[], code: string) {
  return patterns.find((pattern) => pattern.code === code) ?? patterns[0];
}

/**
 * Название материала с толщиной.
 *
 * Если толщина уже написана в самом названии («Эмаль RAL 9003 плита 19мм» —
 * так приходит из бланка, где колонка «Мм» пустая), второй раз её не
 * приписываем: подпись превратилась бы в «…19мм, 19 мм».
 */
function withThicknessLabel(name: string, thickness: number | null) {
  if (thickness === null) {
    return name;
  }
  const digits = String(thickness).replace(".", "[.,]");
  if (new RegExp(`(?:^|\\D)${digits}\\s*мм`, "i").test(name)) {
    return name;
  }
  return `${name}, ${thickness} мм`;
}

/**
 * Подписи для карт, разделённых по толщине.
 *
 * Карты распила 16 мм и 19 мм — это один и тот же цвет, и по названию
 * материала их не различить. На каждый ключ группы, которого нет в справочнике,
 * заводим подпись: заливка та же, что у материала, а к названию добавлена
 * толщина. Коды деталей при этом не меняются, поэтому заливка на карте прежняя.
 */
export function buildLayoutPatterns(
  groups: Array<Pick<LayoutGroup, "pattern" | "materialCode" | "thickness" | "article">>,
  patterns: CuttingPattern[],
): CuttingPattern[] {
  const basePatterns = [MDF_PATTERN, FILM_PATTERN, ...patterns.filter(
    (pattern) => pattern.code !== MDF_PATTERN.code && pattern.code !== FILM_PATTERN.code,
  )];
  const known = new Set(basePatterns.map((pattern) => pattern.code));
  const extra: CuttingPattern[] = [];

  for (const group of groups) {
    if (known.has(group.pattern)) {
      continue;
    }
    known.add(group.pattern);
    const base = basePatterns.find((pattern) => pattern.code === group.materialCode) ?? basePatterns[0];
    if (!base) {
      continue;
    }
    const label = withThicknessLabel(base.name, group.thickness);
    extra.push({
      ...base,
      code: group.pattern,
      // Артикул в подписи обязателен: две карты одного цвета и одной толщины
      // различаются только им, и без подписи цех их перепутает.
      name: group.article ? `${label} · ${group.article}` : label,
    });
  }

  return extra.length ? [...basePatterns, ...extra] : basePatterns;
}

export function getPatternSwatchStyle(pattern: CuttingPattern) {
  if (pattern.kind === "diagonal") {
    return {
      backgroundColor: pattern.fill,
      backgroundImage: `repeating-linear-gradient(135deg, ${pattern.accent}, ${pattern.accent} 6px, ${pattern.fill} 6px, ${pattern.fill} 12px)`,
    };
  }

  if (pattern.kind === "grid") {
    return {
      backgroundColor: pattern.fill,
      backgroundImage: `linear-gradient(${pattern.accent} 1px, transparent 1px), linear-gradient(90deg, ${pattern.accent} 1px, transparent 1px)`,
      backgroundSize: "14px 14px",
    };
  }

  if (pattern.kind === "wood") {
    return {
      backgroundColor: pattern.fill,
      backgroundImage: `repeating-linear-gradient(0deg, ${pattern.fill}, ${pattern.fill} 8px, ${pattern.accent} 8px, ${pattern.accent} 10px)`,
    };
  }

  if (pattern.kind === "dots") {
    return {
      backgroundColor: pattern.fill,
      backgroundImage: `radial-gradient(${pattern.accent} 18%, transparent 18%)`,
      backgroundSize: "12px 12px",
    };
  }

  return {
    backgroundColor: pattern.fill,
  };
}

export function expandParts(
  parts: CuttingPart[],
  settings: CuttingSheetSettings,
): ExpandedPart[] {
  const expanded: ExpandedPart[] = [];

  for (const part of parts) {
    const gapX = getResolvedGap(part.gapX, settings.defaultGapX);
    const gapY = getResolvedGap(part.gapY, settings.defaultGapY);

    for (let index = 0; index < part.quantity; index += 1) {
      expanded.push({
        unitId: `${part.id}-${index + 1}`,
        sourceId: part.id,
        sourceNumber: part.partNumber,
        sourceName: part.name,
        width: part.width,
        height: part.height,
        preferredSheet: part.preferredSheet,
        rotate: part.rotate,
        gapX,
        gapY,
        pattern: part.pattern,
        thickness: part.thickness ?? null,
        article: part.article ?? null,
      });
    }
  }

  return expanded;
}

/** Положения, в которых деталь разрешено класть на лист. */
function placementVariants(part: ExpandedPart, allowRotation: boolean) {
  const asIs = { width: part.width, height: part.height, rotated: false };
  const turned = { width: part.height, height: part.width, rotated: true };

  if (!allowRotation) {
    // поворот запрещён: кладём ровно так, как указано у детали
    return [part.rotate ? turned : asIs];
  }

  if (part.width === part.height) {
    return [asIs];
  }

  // Отметка «повернуть» у детали исполняется, а не советуется. Раньше она была
  // лишь предпочтением, и при разрешённом повороте укладчик всё равно клал
  // деталь как ему выгоднее: менеджер жал поворот, а на карте не менялось
  // ничего. Автоповорот остаётся для деталей без отметки.
  if (part.rotate) {
    return [turned];
  }

  return [asIs, turned];
}

/**
 * Границы рабочей зоны листа: правый и нижний край.
 *
 * Нужны, чтобы отличить зазор между соседями от зазора, упирающегося в кромку.
 */
export type WorkBounds = { right: number; bottom: number };

export function pickBestPlacement(
  freeRects: FreeRect[],
  part: ExpandedPart,
  algorithm: CuttingSheetSettings["algorithm"],
  allowRotation = false,
  bounds?: WorkBounds,
): PlacementCandidate | null {
  let best: PlacementCandidate | null = null;
  // без границ ведём себя как раньше — зазор всегда полный
  const workRight = bounds ? bounds.right : Number.POSITIVE_INFINITY;
  const workBottom = bounds ? bounds.bottom : Number.POSITIVE_INFINITY;

  for (let rectIndex = 0; rectIndex < freeRects.length; rectIndex += 1) {
    const rect = freeRects[rectIndex];
    const variants = placementVariants(part, allowRotation);

    for (const variant of variants) {
      // Зазор нужен только между соседними деталями. Тот кусок зазора, что
      // вылезает за правый или нижний край рабочей зоны, граничит с пустотой и
      // просто теряется — обрезаем его по кромке. Занятое место при этом
      // никогда не кончается раньше кромки, значит справа и снизу впритык к
      // детали никого не поставить, и зазор между соседями сохраняется.
      const footprintWidth = Math.min(
        variant.width + part.gapX,
        Math.max(variant.width, workRight - rect.x),
      );
      const footprintHeight = Math.min(
        variant.height + part.gapY,
        Math.max(variant.height, workBottom - rect.y),
      );
      if (footprintWidth > rect.width || footprintHeight > rect.height) {
        continue;
      }

      const remainingWidth = rect.width - footprintWidth;
      const remainingHeight = rect.height - footprintHeight;
      const leftoverArea = rectArea(rect) - footprintWidth * footprintHeight;
      const shortSide = Math.min(remainingWidth, remainingHeight);
      const longSide = Math.max(remainingWidth, remainingHeight);
      // Для «прижать влево» важен не процент заполнения, а то, как далеко
      // вправо уехала занятая зона: чем левее правый край, тем шире целая
      // полоса, которую можно вернуть на склад как пригодный лист.
      const rightEdge = rect.x + footprintWidth;
      const primaryScore =
        algorithm === "leftEdge"
          ? rightEdge
          : algorithm === "byLength"
            ? remainingHeight
            : algorithm === "byWidth"
              ? remainingWidth
              : shortSide;
      const secondaryScore =
        algorithm === "leftEdge"
          ? rect.x
          : algorithm === "byLength"
            ? remainingWidth
            : algorithm === "byWidth"
              ? remainingHeight
              : longSide;

      const candidate: PlacementCandidate = {
        freeRectIndex: rectIndex,
        x: rect.x,
        y: rect.y,
        width: variant.width,
        height: variant.height,
        footprintWidth,
        footprintHeight,
        rotated: variant.rotated,
        score: [
          primaryScore,
          secondaryScore,
          leftoverArea,
          rect.y,
          rect.x,
          // на равном счёте побеждает положение, указанное у детали
          variant.rotated === part.rotate ? 0 : 1,
        ],
      };

      if (!best || compareScore(candidate.score, best.score) < 0) {
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Свободные куски листа после того, как деталь легла на место.
 *
 * Раньше делился только тот кусок, в который попала деталь, и делился надвое
 * «до края» — гильотиной. Свободное место при этом дробилось и больше никогда
 * не срасталось: деталь, которая влезла бы в два соседних обрезка вместе, уже
 * никуда не помещалась и уезжала на новый лист.
 *
 * Теперь каждый кусок, которого деталь коснулась, режется на все прямоугольники
 * вокруг неё — слева, справа, сверху, снизу. Куски получаются пересекающимися,
 * и это правильно: каждый описывает настоящее свободное место целиком, а не его
 * произвольную половину. Вложенные потом отбрасываются.
 *
 * Из-за пересечений сумма их площадей больше настоящей свободной площади —
 * поэтому свободный остаток считается вычитанием, а не суммой этих кусков.
 */
function carveFreeRects(rects: FreeRect[], used: FreeRect): FreeRect[] {
  const result: FreeRect[] = [];

  for (const rect of rects) {
    const overlaps =
      used.x < rect.x + rect.width &&
      used.x + used.width > rect.x &&
      used.y < rect.y + rect.height &&
      used.y + used.height > rect.y;

    if (!overlaps) {
      result.push(rect);
      continue;
    }

    if (used.x > rect.x) {
      result.push({ x: rect.x, y: rect.y, width: used.x - rect.x, height: rect.height });
    }
    if (used.x + used.width < rect.x + rect.width) {
      result.push({
        x: used.x + used.width,
        y: rect.y,
        width: rect.x + rect.width - (used.x + used.width),
        height: rect.height,
      });
    }
    if (used.y > rect.y) {
      result.push({ x: rect.x, y: rect.y, width: rect.width, height: used.y - rect.y });
    }
    if (used.y + used.height < rect.y + rect.height) {
      result.push({
        x: rect.x,
        y: used.y + used.height,
        width: rect.width,
        height: rect.y + rect.height - (used.y + used.height),
      });
    }
  }

  return result.filter(isValidRect);
}

/** Кладёт деталь на лист: занимает место, режет остаток, пересчитывает метрики. */
function applyPlacement(
  sheet: LayoutSheet,
  part: ExpandedPart,
  placement: PlacementCandidate,
) {
  // деталь занимает место вместе со своим зазором
  const occupied: FreeRect = {
    x: placement.x,
    y: placement.y,
    width: placement.footprintWidth,
    height: placement.footprintHeight,
  };
  sheet.remainders = normalizeFreeRects(carveFreeRects(sheet.remainders, occupied));
  sheet.placements.push({
    unitId: part.unitId,
    sourceId: part.sourceId,
    sourceNumber: part.sourceNumber,
    sourceName: part.sourceName,
    pattern: part.pattern,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    gapX: part.gapX,
    gapY: part.gapY,
    preferredSheet: part.preferredSheet,
    footprintWidth: placement.footprintWidth,
    footprintHeight: placement.footprintHeight,
    rotated: placement.rotated,
    thickness: part.thickness,
    article: part.article,
  });
  updateSheetMetrics(sheet);
}

/** Копия листа для пробной перекладки, которую можно откатить. */
function cloneSheet(sheet: LayoutSheet): LayoutSheet {
  return {
    ...sheet,
    placements: sheet.placements.map((placement) => ({ ...placement })),
    remainders: sheet.remainders.map((rect) => ({ ...rect })),
  };
}

/**
 * Уплотнение: перекладываем детали последнего листа на предыдущие.
 *
 * Укладчик жадный — деталь кладётся один раз и больше не переставляется. Из-за
 * этого последний лист часто держит детали, которые физически влезают в дырки на
 * предыдущих листах: на момент укладки этих дырок ещё не было.
 *
 * Сначала здесь было «всё или ничего»: перекладываем последний лист целиком или
 * не трогаем вовсе. На замере это не сработало ни разу — по площади детали
 * помещались в 10 заказах из 12, но геометрически не влезали, потому что
 * свободное место раздроблено на узкие куски. Поэтому перекладываем столько,
 * сколько влезает, а лист убираем только если он опустел полностью.
 *
 * Даже без уменьшения числа листов это ровно то, что просил заказчик: листы с
 * первого по предпоследний забиваются плотнее, а весь остаток стягивается на
 * последний, где и остаётся широкая полоса на склад.
 *
 * Деталь с явным номером листа не трогаем вовсе: менеджер указал лист руками, и
 * молча переложить её на другой хуже, чем сэкономить место.
 *
 * Возвращает true, только если лист удалось убрать совсем — тогда есть смысл
 * попробовать ещё раз, уже со следующим последним листом.
 */
function compactLastSheet(
  sheets: LayoutSheet[],
  sheetParts: ExpandedPart[][],
  settings: CuttingSheetSettings,
  bounds: WorkBounds | undefined,
): boolean {
  if (sheets.length < 2) {
    return false;
  }
  const movers = sheetParts[sheets.length - 1];
  if (!movers.length || movers.some((part) => part.preferredSheet !== null)) {
    return false;
  }

  const trialSheets = sheets.slice(0, -1).map(cloneSheet);
  const trialParts = sheetParts.slice(0, -1).map((list) => [...list]);
  // Крупные первыми: мелочь потом найдёт место и в узких остатках, наоборот — нет.
  const ordered = [...movers].sort(
    (left, right) => right.width * right.height - left.width * left.height,
  );
  const stayed: ExpandedPart[] = [];

  for (const part of ordered) {
    let bestIndex = -1;
    let best: PlacementCandidate | null = null;

    for (let index = 0; index < trialSheets.length; index += 1) {
      const candidate = pickBestPlacement(
        trialSheets[index].remainders,
        part,
        settings.algorithm,
        settings.allowRotation,
        bounds,
      );
      if (candidate && (!best || compareScore(candidate.score, best.score) < 0)) {
        best = candidate;
        bestIndex = index;
      }
    }

    if (best) {
      applyPlacement(trialSheets[bestIndex], part, best);
      trialParts[bestIndex].push(part);
    } else {
      stayed.push(part);
    }
  }

  // ничего не переехало — оставляем раскладку как была
  if (stayed.length === movers.length) {
    return false;
  }

  if (!stayed.length) {
    sheets.length = 0;
    sheets.push(...trialSheets);
    sheetParts.length = 0;
    sheetParts.push(...trialParts);
    return true;
  }

  // Часть деталей осталась — пересобираем из них последний лист заново, чтобы
  // они легли компактно, а не сохраняли дырки от уехавших соседей.
  const rebuilt = createEmptySheet(settings, trialSheets.length + 1);
  for (const part of stayed) {
    const candidate = pickBestPlacement(
      rebuilt.remainders,
      part,
      settings.algorithm,
      settings.allowRotation,
      bounds,
    );
    // Деталь уже лежала на таком же листе одна, так что сюда попасть не должны.
    // Если всё же не легла — безопаснее не трогать исходную раскладку вовсе.
    if (!candidate) {
      return false;
    }
    applyPlacement(rebuilt, part, candidate);
  }

  sheets.length = 0;
  sheets.push(...trialSheets, rebuilt);
  sheetParts.length = 0;
  sheetParts.push(...trialParts, stayed);
  return false;
}

/**
 * Как выбирается лист, на который ляжет очередная деталь.
 *
 * `spread` — как было: перебираем все листы и берём лучший счёт места. Счёт
 * ничего не знает о том, на каком листе оно найдено, а у пустого листа место
 * всегда «лучше» (левее, крупнее), поэтому детали расползаются и последние
 * листы остаются полупустыми.
 *
 * `fillFirst` — добиваем листы по порядку: деталь идёт на первый лист, где для
 * неё вообще нашлось место. Обрезки копятся на последнем листе одной крупной
 * полосой, а не крошатся по всем.
 *
 * `fullestFirst` — то же по смыслу, но лист выбирается по занятости: сначала
 * самый забитый из тех, куда деталь влезает. Расходится с `fillFirst` только
 * на деталях с явно указанным номером листа.
 */
export type SheetSelection = "spread" | "fillFirst" | "fullestFirst";

export function packLayout(
  parts: CuttingPart[],
  settings: CuttingSheetSettings,
  ordering: PartOrdering = "algorithm",
  selection: SheetSelection = "spread",
): LayoutPackResult {
  const workWidth = settings.sheetWidth - settings.marginX - marginRightOf(settings);
  const workHeight = settings.sheetHeight - settings.marginY - marginBottomOf(settings);
  const requestedCount = parts.reduce((sum, part) => sum + part.quantity, 0);
  const expandedParts = sortExpandedParts(
    expandParts(parts, settings),
    settings.algorithm,
    ordering,
  );

  if (workWidth <= 0 || workHeight <= 0) {
    return {
      sheets: [],
      unplaced: expandedParts,
      stats: {
        sheetCount: 0,
        placedCount: 0,
        unplacedCount: expandedParts.length,
        requestedCount,
        detailArea: 0,
        freeArea: 0,
        gapArea: 0,
        marginArea: 0,
        fillPercent: 0,
      },
    };
  }

  // Кромки рабочей зоны — по ним обрезается хвостовой зазор. Если заказчик
  // просит зазор и у кромки, границ не передаём вовсе: тогда деталь у правой и
  // нижней кромки сохраняет свой зазор, а не прижимается к краю.
  //
  // Важно: зазор идёт ЗА деталью. У левой и верхней кромки его нет — там между
  // деталью и краем листа остаётся только поле листа (marginX/marginY, по
  // умолчанию 15 мм). Полной рамки в 60 мм по всем четырём сторонам сейчас не
  // получается; нужен ли такой отступ у плёнки — вопрос к заказчику, потому что
  // от него зависит расход материала.
  const edgeBounds: WorkBounds = {
    right: settings.marginX + workWidth,
    bottom: settings.marginY + workHeight,
  };
  const bounds: WorkBounds | undefined = (settings.keepEdgeGap ?? true) ? undefined : edgeBounds;
  const sheets: LayoutSheet[] = [];
  // Что легло на каждый лист — нужно для роспуска последнего листа: перекладывать
  // приходится сами детали, а в placements лежит уже готовая геометрия.
  const sheetParts: ExpandedPart[][] = [];
  const unplaced: ExpandedPart[] = [];

  for (const part of expandedParts) {
    let bestSheetIndex = -1;
    let bestPlacement: PlacementCandidate | null = null;
    const preferredSheetIndex =
      part.preferredSheet !== null && Number.isSafeInteger(part.preferredSheet) && part.preferredSheet > 0
        // Листы без деталей в интерфейсе всё равно отбрасываются. Создавать
        // тысячи пустых листов для произвольного номера бессмысленно и может
        // повесить браузер: новый лист всегда становится следующим видимым.
        ? Math.min(Math.max(0, part.preferredSheet - 1), sheets.length)
        : null;

    if (preferredSheetIndex !== null) {
      if (sheets.length <= preferredSheetIndex) {
        sheets.push(createEmptySheet(settings, sheets.length + 1));
        sheetParts.push([]);
      }

      const preferredCandidate = pickBestPlacement(
        sheets[preferredSheetIndex].remainders,
        part,
        settings.algorithm,
        settings.allowRotation,
        bounds,
      );

      if (preferredCandidate) {
        bestPlacement = preferredCandidate;
        bestSheetIndex = preferredSheetIndex;
      }
    }

    // деталь с явным номером листа уже легла — другие листы не рассматриваем
    const keepPreferred = selection !== "spread" && bestPlacement !== null;
    const sheetOrder = keepPreferred ? [] : sheets.map((_, sheetIndex) => sheetIndex);
    if (selection === "fullestFirst") {
      sheetOrder.sort((left, right) => sheets[left].exactFreeArea - sheets[right].exactFreeArea);
    }

    for (const sheetIndex of sheetOrder) {
      if (sheetIndex === preferredSheetIndex) {
        continue;
      }
      const candidate = pickBestPlacement(
        sheets[sheetIndex].remainders,
        part,
        settings.algorithm,
        settings.allowRotation,
        bounds,
      );
      if (!candidate) {
        continue;
      }

      if (selection !== "spread") {
        // первый подошедший лист и есть ответ: следующие свободнее, но класть
        // туда деталь незачем — их место нужно целым
        if (!bestPlacement) {
          bestPlacement = candidate;
          bestSheetIndex = sheetIndex;
        }
        break;
      }

      if (!bestPlacement || compareScore(candidate.score, bestPlacement.score) < 0) {
        bestPlacement = candidate;
        bestSheetIndex = sheetIndex;
      }
    }

    // Зазор у кромки — пожелание к тому, как выглядит карта, а не физическое
    // ограничение. Деталь 2700×1200 влезает в рабочую зону 2720×1220, но вместе
    // с зазором 60 мм — уже нет, и места ей не находится нигде. Терять такую
    // деталь нельзя: на карте её просто не будет, и цех недосчитается фасада.
    // Поэтому, когда деталь не встала никуда, зазор у кромки для неё обрезаем.
    // Сначала пробуем лист, который указал менеджер, — его выбор важнее.
    if (!bestPlacement && !bounds && preferredSheetIndex !== null) {
      const trimmed = pickBestPlacement(
        sheets[preferredSheetIndex].remainders,
        part,
        settings.algorithm,
        settings.allowRotation,
        edgeBounds,
      );
      if (trimmed) {
        bestPlacement = trimmed;
        bestSheetIndex = preferredSheetIndex;
      }
    }

    if (!bestPlacement) {
      const emptySheet = createEmptySheet(settings, sheets.length + 1);
      const candidate =
        pickBestPlacement(
          emptySheet.remainders,
          part,
          settings.algorithm,
          settings.allowRotation,
          bounds,
        ) ??
        (bounds
          ? null
          : pickBestPlacement(
              emptySheet.remainders,
              part,
              settings.algorithm,
              settings.allowRotation,
              edgeBounds,
            ));

      if (!candidate) {
        unplaced.push(part);
        continue;
      }

      sheets.push(emptySheet);
      sheetParts.push([]);
      bestPlacement = candidate;
      bestSheetIndex = sheets.length - 1;
    }

    applyPlacement(sheets[bestSheetIndex], part, bestPlacement);
    sheetParts[bestSheetIndex].push(part);
  }

  // Уплотняем: тянем детали с последнего листа на предыдущие. Цикл крутится,
  // только пока листы удаётся убирать совсем (см. compactLastSheet).
  while (compactLastSheet(sheets, sheetParts, settings, bounds)) {
    // тело пустое: вся работа внутри
  }

  if (!sheets.length) {
    sheets.push(createEmptySheet(settings, 1));
    updateSheetMetrics(sheets[0]);
  }

  const detailArea = sheets.reduce((sum, sheet) => sum + sheet.exactDetailArea, 0);
  const freeArea = sheets.reduce((sum, sheet) => sum + sheet.exactFreeArea, 0);
  const gapArea = sheets.reduce((sum, sheet) => sum + sheet.exactGapArea, 0);
  const marginArea = sheets.reduce(
    (sum, sheet) =>
      sum + (sheet.width * sheet.height - sheet.workWidth * sheet.workHeight) / 1_000_000,
    0,
  );
  const workingArea = sheets.reduce(
    (sum, sheet) => sum + (sheet.workWidth * sheet.workHeight) / 1_000_000,
    0,
  );

  return {
    sheets,
    unplaced,
    stats: {
      sheetCount: sheets.length,
      placedCount: expandedParts.length - unplaced.length,
      unplacedCount: unplaced.length,
      requestedCount,
      detailArea: roundArea(detailArea),
      freeArea: roundArea(freeArea),
      gapArea: roundArea(gapArea),
      marginArea: roundArea(marginArea),
      fillPercent: workingArea > 0 ? roundArea((detailArea / workingArea) * 100) : 0,
    },
  };
}

/**
 * Раскладка материала с выбором лучшего варианта поворота.
 *
 * Поворот нельзя включить просто так: укладчик выбирает положение жадно, по
 * одной детали, и повёрнутая деталь иногда занимает место, которое дальше
 * пригодилось бы целиком. На настоящем заказе при зазоре 30 мм это стоило
 * лишнего листа — 7 вместо 6. Поэтому считаем оба варианта и берём тот, где
 * листов меньше; при равенстве — где плотнее.
 */
/**
 * Пустая площадь на всех листах, КРОМЕ последнего, в мм² (целое — чтобы на
 * сравнении не всплывала погрешность дробных м²).
 *
 * Правило заказчика: листы с первого по предпоследний должны быть забиты по
 * максимуму, а весь остаток обязан скопиться на последнем. Тогда последний лист
 * — единственный неполный, и справа на нём остаётся одна широкая полоса,
 * которую возвращают на склад пригодным куском.
 *
 * Здесь были две неудачные редакции подряд, обе отбрасывали половину смысла:
 * сначала «самая широкая полоса хоть на одном листе» — она раздувала полосу, но
 * не заставляла забивать остальные листы; потом «минимум остатка справа
 * суммарно» — этот, наоборот, размазывал незанятый край тонким слоем по всем
 * листам, и вместо одного возвратного куска получался набор узких огрызков.
 * Считать надо именно пустоту на листах 1..n-1: она и забивает их плотно, и
 * автоматически сгоняет весь остаток на последний.
 */
function emptyAreaBeforeLastSheet(result: LayoutPackResult) {
  return result.sheets
    .slice(0, -1)
    .reduce((sum, sheet) => sum + Math.round(sheet.exactFreeArea * 1_000_000), 0);
}

/** Ширина свободной полосы справа на последнем листе, мм. */
function lastSheetStripWidth(result: LayoutPackResult) {
  const last = result.sheets[result.sheets.length - 1];
  return last ? last.freeStripWidth : 0;
}

function isBetterLayout(candidate: LayoutPackResult, current: LayoutPackResult) {
  return (
    candidate.stats.unplacedCount - current.stats.unplacedCount ||
    candidate.stats.sheetCount - current.stats.sheetCount ||
    // листы 1..n-1 — чем плотнее, тем лучше
    emptyAreaBeforeLastSheet(candidate) - emptyAreaBeforeLastSheet(current) ||
    // последний лист — чем шире полоса справа, тем лучше
    lastSheetStripWidth(current) - lastSheetStripWidth(candidate) ||
    current.stats.fillPercent - candidate.stats.fillPercent
  ) < 0;
}

/**
 * Сколько порядков перебирать.
 *
 * Каждый порядок — отдельная полная раскладка, и на большом раскрое перебор
 * становится заметен: 300 деталей при полном наборе считаются около секунды.
 * На таких объёмах лишние порядки почти ничего и не выигрывают — деталей
 * много, лист набивается плотно при любом разумном порядке. Поэтому чем
 * крупнее раскрой, тем короче перебор.
 */
function orderingsFor(unitCount: number): PartOrdering[] {
  if (unitCount > 400) {
    return ["algorithm", "area"];
  }
  if (unitCount > 150) {
    return ["algorithm", "area", "longSide"];
  }
  return PART_ORDERINGS;
}

/**
 * Какие стратегии выбора листа перебирать.
 *
 * `fullestFirst` и `fillFirst` расходятся только на деталях с явным номером
 * листа, поэтому на крупных раскроях хватает одной — время дороже.
 */
function selectionsFor(unitCount: number): SheetSelection[] {
  if (unitCount > 150) {
    return ["spread", "fillFirst"];
  }
  return ["spread", "fillFirst", "fullestFirst"];
}

function packBestLayout(
  parts: CuttingPart[],
  settings: CuttingSheetSettings,
): LayoutPackResult {
  const rotations = settings.allowRotation ? [false, true] : [false];
  const unitCount = parts.reduce((sum, part) => sum + part.quantity, 0);
  let best: LayoutPackResult | null = null;

  for (const ordering of orderingsFor(unitCount)) {
    for (const selection of selectionsFor(unitCount)) {
      for (const allowRotation of rotations) {
        const candidate = packLayout(parts, { ...settings, allowRotation }, ordering, selection);
        if (!best || isBetterLayout(candidate, best)) {
          best = candidate;
        }
      }
    }
  }

  return best ?? packLayout(parts, settings);
}

/**
 * Ключ, по которому детали расходятся на разные карты.
 *
 * Материал делит карты всегда: покрасить один лист в два цвета нельзя. Дальше
 * тип работы решает всё, и делители у него РАЗНЫЕ — это не симметрия, а физика.
 *
 * Распил МДФ — делит только толщина. Деталь 16 мм из плиты 19 мм не выпилить,
 * поэтому каждая толщина обязана идти своей картой. Артикул на распиле не делит:
 * детали разных артикулов одной толщины спокойно лежат на одном листе, а по
 * пачкам их разбирают уже после распила — артикул напечатан на самой детали.
 *
 * Плёнка — наоборот, делит только артикул. Плёнку кладут поверх уже готовых
 * деталей, и толщина основания на её раскрой не влияет никак: 11, 12, 14, 15 и
 * 16 мм с одним артикулом лягут на одну карту плёнки. Та же партия на распиле
 * разъедется на пять карт по толщинам — артикул при этом у них общий.
 *
 * Раньше артикул делил карты в обоих режимах. На распиле это дробило раскрой в
 * труху: «White Gloss 19 мм · ART-777» и «White Gloss 19 мм · ART-999» уходили
 * на два разных листа, каждый заполнен на четверть.
 */
export function layoutGroupKey(
  _materialCode: string,
  thickness: number | null,
  workKind: CuttingWorkKind,
  article: string | null = null,
): string {
  if (workKind === "cutting") {
    return thickness === null ? MDF_PATTERN.code : `${MDF_PATTERN.code}::t${thickness}`;
  }
  return article ? `${FILM_PATTERN.code}::a${article}` : FILM_PATTERN.code;
}

type PatternBucket = {
  materialCode: string;
  thickness: number | null;
  thicknesses: Set<number>;
  article: string | null;
  parts: CuttingPart[];
};

export function packLayoutByPattern(
  parts: CuttingPart[],
  settings: CuttingSheetSettings,
): CuttingLayoutResult {
  const workKind = settings.workKind ?? "cutting";
  const patternGroups = new Map<string, PatternBucket>();

  for (const part of parts) {
    const thickness = part.thickness ?? null;
    const article = part.article?.trim() || null;
    const key = layoutGroupKey(part.pattern, thickness, workKind, article);
    const bucket = patternGroups.get(key) ?? {
      materialCode: workKind === "cutting" ? MDF_PATTERN.code : FILM_PATTERN.code,
      // на плёнке карта толщиной не делится, поэтому единой толщины у неё нет
      thickness: workKind === "cutting" ? thickness : null,
      thicknesses: new Set<number>(),
      // ...а на распиле не делится артикулом, поэтому единого артикула нет у неё.
      // Записать сюда артикул первой попавшейся детали значило бы подписать им
      // всю карту, на которой лежат ещё три других.
      article: workKind === "cutting" ? null : article,
      parts: [],
    };
    bucket.parts.push(part);
    if (thickness !== null) {
      bucket.thicknesses.add(thickness);
    }
    patternGroups.set(key, bucket);
  }

  const orderedPatterns = [...patternGroups.keys()].sort();
  const groups: LayoutGroup[] = [];
  const sheets: LayoutSheetView[] = [];
  const unplaced: ExpandedPart[] = [];
  let globalSheetIndex = 1;

  for (const pattern of orderedPatterns) {
    const bucket = patternGroups.get(pattern);
    const result = packBestLayout(bucket?.parts ?? [], settings);
    const materialCode = bucket?.materialCode ?? pattern;
    const thickness = bucket?.thickness ?? null;
    // Карты без единой детали в полосу карт не попадают.
    //
    // Пустые листы берутся из двух мест: `packLayout` всегда возвращает хотя бы
    // один лист (даже когда ни одна деталь не легла), и он же добивает массив
    // пустыми листами, когда у детали проставлен явный номер листа. В обоих
    // случаях цех получал карту, на которой ничего нет, с заполнением 0.0% —
    // и не мог понять, деталь потерялась или лист правда пустой. Причина при
    // этом уже написана отдельно, в блоке «Не поместилось деталей», и молчащая
    // пустая карта только сбивала с толку.
    const packedSheets = result.sheets.filter((sheet) => sheet.placements.length > 0);
    const viewSheets = packedSheets.map((sheet, index) => ({
      ...sheet,
      pattern,
      materialCode,
      thickness,
      globalIndex: globalSheetIndex + index,
      // Нумеруем листы заново: после отбрасывания пустых прежние номера
      // разошлись бы с тем, что видно в полосе карт («лист 3» из двух).
      localIndex: index + 1,
    }));

    groups.push({
      pattern,
      materialCode,
      thickness,
      thicknesses: [...(bucket?.thicknesses ?? [])].sort((left, right) => left - right),
      article: bucket?.article ?? null,
      sheets: viewSheets,
      // sheetCount обязан совпадать с числом показанных карт: по нему считают
      // закупку листов, и пустые листы раздували её на ровном месте.
      stats: { ...result.stats, sheetCount: viewSheets.length },
      unplaced: result.unplaced,
    });
    sheets.push(...viewSheets);
    unplaced.push(...result.unplaced);
    globalSheetIndex += viewSheets.length;
  }

  const requestedCount = parts.reduce((sum, part) => sum + part.quantity, 0);
  const detailArea = sheets.reduce((sum, sheet) => sum + sheet.exactDetailArea, 0);
  const freeArea = sheets.reduce((sum, sheet) => sum + sheet.exactFreeArea, 0);
  const gapArea = sheets.reduce((sum, sheet) => sum + sheet.exactGapArea, 0);
  const marginArea = sheets.reduce(
    (sum, sheet) =>
      sum + (sheet.width * sheet.height - sheet.workWidth * sheet.workHeight) / 1_000_000,
    0,
  );
  const workingArea = sheets.reduce(
    (sum, sheet) => sum + (sheet.workWidth * sheet.workHeight) / 1_000_000,
    0,
  );

  return {
    groups,
    sheets,
    unplaced,
    stats: {
      sheetCount: sheets.length,
      placedCount: requestedCount - unplaced.length,
      unplacedCount: unplaced.length,
      requestedCount,
      detailArea: roundArea(detailArea),
      freeArea: roundArea(freeArea),
      gapArea: roundArea(gapArea),
      marginArea: roundArea(marginArea),
      fillPercent: workingArea > 0 ? roundArea((detailArea / workingArea) * 100) : 0,
      groupCount: groups.length,
      patterns: orderedPatterns,
    },
  };
}

/**
 * Разбирает поле «Размеры»: «560 123 3», «560x123x3», «1246*436*2».
 *
 * После «|» идут поля бланка заказа: «391 706 1 | Эмаль RAL 9003 плита 19мм |
 * 19 | Арт 109». Раскрою нужны первые два — материал и толщина: по материалу
 * детали расходятся по листам, по толщине на распиле делятся карты. Если
 * колонка толщины пустая (в бланке заказчика это обычное дело), берём толщину
 * из текста материала. Фрезеровка едет дальше в печать бланка.
 * Неизвестные материалы возвращаются в `materials`, чтобы раскрой завёл их
 * рядом со справочными.
 */
export function parseBulkInput(
  input: string,
  defaults: {
    pattern: string;
    patterns?: CuttingPattern[];
  },
): BulkImportResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parts: CuttingPartDraft[] = [];
  const errors: BulkImportError[] = [];
  const materials: string[] = [];

  lines.forEach((line, index) => {
    // материал отделяем первым: в названии бывает «х» («орех»), а её ниже
    // заменяет разделитель размеров — название бы порвалось
    const [sizePart, ...rest] = line.split("|");
    const material = (rest[0] ?? "").trim();
    const thickness = parseThickness(rest[1]) ?? parseThickness(material);
    const normalized = sizePart.replace(/[xXхХ*]/g, " ").replace(/\s+/g, " ").trim();
    const pieces = normalized.split(" ").filter(Boolean);

    if (pieces.length < 2 || pieces.length > 3) {
      errors.push({
        line: index + 1,
        source: line,
        reason: "Ожидается формат: ширина x высота x количество",
      });
      return;
    }

    const width = Number(pieces[0]);
    const height = Number(pieces[1]);
    const quantity = pieces[2] ? Number(pieces[2]) : 1;

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isSafeInteger(quantity) ||
      width <= 0 ||
      height <= 0 ||
      quantity <= 0
    ) {
      errors.push({
        line: index + 1,
        source: line,
        reason: "Размеры должны быть положительными числами, количество — целым положительным числом",
      });
      return;
    }

    if (material) {
      materials.push(material);
    }
    parts.push(
      createDraftPart({
        name: `Деталь ${index + 1}`,
        width: String(width),
        height: String(height),
        quantity: String(quantity),
        rotate: false,
        gapX: "",
        gapY: "",
        pattern: material
          ? resolvePatternCode(material, defaults.patterns ?? [], defaults.pattern)
          : defaults.pattern,
        thickness: thickness === null ? "" : String(thickness),
      }),
    );
  });

  return { parts, errors, materials };
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

