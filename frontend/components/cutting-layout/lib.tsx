"use client";

import { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPatternByCode, getPatternSwatchStyle, type CuttingPattern } from "@/lib/cutting-layout";

export const algorithmOptions = [
  {
    value: "leftEdge",
    label: "Прижать влево",
    description:
      "Детали идут колонками от левого края. Все листы, кроме последнего, забиваются по максимуму, а весь остаток сгоняется на последний — там справа остаётся одна широкая полоса, её возвращают на склад пригодным куском.",
  },
  {
    value: "optimal",
    label: "Плотная укладка",
    description:
      "Укладывает детали как можно плотнее — максимальный процент заполнения. Остатки получаются мелкими и разбросанными по листу.",
  },
  {
    value: "byLength",
    label: "По высоте",
    description:
      "Заполняет лист сверху вниз. Удобно, когда важно видеть раскладку горизонтальными поясами.",
  },
  {
    value: "byWidth",
    label: "По ширине",
    description:
      "Заполняет лист слева направо. Удобно, когда технологу проще читать раскладку по колонкам.",
  },
] as const;

export const fallbackPattern: CuttingPattern = {
  code: "default_material",
  name: "Материал по умолчанию",
  finish: "default",
  kind: "solid",
  fill: "#dbeafe",
  accent: "#2563eb",
  stroke: "#1d4ed8",
  text: "#1e3a8a",
};

export function formatArea(value: number) {
  return `${value.toFixed(3)} м²`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatSize(width: number, height: number) {
  return `${Math.round(width)} × ${Math.round(height)} мм`;
}

export function formatMillimeters(value: number) {
  return `${Math.round(value)} мм`;
}

export function parsePositive(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Что написано на самой детали в карте раскроя.
 *
 * Деталь уезжает в цех отдельно от карты: её берут из пачки и должны по одной
 * подписи понять, чья она и что с ней делать. Поэтому кроме номера и размеров
 * на крупной детали печатаем заявку, цвет и толщину — то же, что на этикетке.
 *
 * Строк тем меньше, чем меньше деталь: на узкой планке подпись не поместится,
 * и лишние строки залезут на соседей.
 */
export function getPlacementLabel(params: {
  sourceNumber: number;
  sourceName: string;
  width: number;
  height: number;
  rotated: boolean;
  /** Цвет без толщины и артикула — их печатаем отдельными строками. */
  material?: string;
  thickness?: number | null;
  /** Артикул детали: по нему в цеху собирают пачку. */
  article?: string | null;
  /** Номер заказа или заявки, к которым принадлежит деталь. */
  orderNumber?: string | null;
}) {
  const {
    sourceNumber,
    sourceName,
    width,
    height,
    rotated,
    material,
    thickness,
    article,
    orderNumber,
  } = params;
  const minSide = Math.min(width, height);
  const [batchOrder, ...nameParts] = sourceName.split(" · ");
  const inferredOrder = nameParts.length ? batchOrder : null;
  const detailName = nameParts.length ? nameParts.join(" · ") : sourceName;
  const shortName = detailName.length > 18 ? `${detailName.slice(0, 15)}...` : detailName;
  const numberLabel = `#${sourceNumber}`;
  const sizeLabel = `${Math.round(width)}×${Math.round(height)} мм`;
  // Заказ важнее названия детали: по нему деталь возвращают в свою пачку, если
  // её унесли на соседний стол.
  const orderLabel = orderNumber || inferredOrder ? `Заказ ${orderNumber || inferredOrder}` : "";

  if (minSide < 80) {
    return [numberLabel];
  }

  if (minSide < 130) {
    return [numberLabel, `${Math.round(width)}×${Math.round(height)}`];
  }

  if (minSide < 220) {
    return [numberLabel, orderLabel || shortName, sizeLabel].filter(Boolean);
  }

  const shortMaterial =
    material && material.length > 22 ? `${material.slice(0, 19)}...` : material;

  // Порядок сверху вниз: чья деталь, какая по счёту, что за изделие, из чего и
  // какая. Столяр читает подпись именно в таком порядке, когда берёт деталь из
  // пачки.
  return [
    orderLabel,
    numberLabel,
    article ? `Арт. ${article}` : "",
    shortName,
    shortMaterial ?? "",
    sizeLabel,
    thickness ? `${thickness} мм толщина` : "",
    rotated ? "Поворот" : "",
  ].filter(Boolean);
}

export function buildSvgPatternId(code: string) {
  // Коды материалов из выгрузки заказчика — это текст цвета целиком, с
  // пробелами и двоеточием. В `url(#…)` такой id не разрешается, ссылка
  // рвётся, и SVG заливает деталь чёрным. Оставляем только безопасные знаки.
  const safe = code.replace(/[^A-Za-z0-9_-]/g, "_");
  return `pattern-${safe}`;
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    // размер вроде «2750 × 1250 мм» в 24 px не влезал в узкую плитку и уезжал
    // за её правый край — держим значение меньше и разрешаем перенос
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="num mt-2 break-words text-lg font-semibold text-slate-900 sm:text-xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PatternTile({
  pattern,
  selected,
  onClick,
}: {
  pattern: CuttingPattern;
  selected: boolean;
  onClick: () => void;
}) {
  const swatchStyle = getPatternSwatchStyle(pattern) as CSSProperties;

  return (
    <button
      type="button"
      className={[
        "rounded-2xl border p-3 text-left transition",
        selected
          ? "border-amber-400 bg-amber-400 text-slate-900"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
      onClick={onClick}
    >
      <div className="h-12 rounded-2xl border border-slate-200" style={swatchStyle} />
      <div className="mt-3 space-y-1">
        <p className="text-sm font-semibold">{pattern.name}</p>
        <p className={selected ? "text-xs text-slate-900/75" : "text-xs text-slate-500"}>
          {pattern.finish}
        </p>
      </div>
    </button>
  );
}

export function SheetLegend({ patterns }: { patterns: CuttingPattern[] }) {
  // Карты, разделённые по толщине, добавляют в список свои подписи. Когда
  // толщина уже написана в названии материала («Эмаль RAL 9003 плита 19мм»),
  // подпись совпадает с исходной — в легенде встало бы два одинаковых плитки.
  const seen = new Set<string>();
  const uniquePatterns = patterns.filter((pattern) => {
    if (seen.has(pattern.name)) {
      return false;
    }
    seen.add(pattern.name);
    return true;
  });

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <Badge className="bg-slate-50 text-slate-700">Легенда</Badge>
        <h3 className="text-lg font-semibold text-slate-900">Материалы и обозначения</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Элементы карты</p>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <span className="h-4 w-8 rounded-2xl border border-amber-400 bg-sky-100" />
              Деталь
            </div>
            <div className="flex items-center gap-3">
              <span className="h-4 w-8 rounded-2xl border border-amber-400 bg-amber-100" />
              Зазор
            </div>
            <div className="flex items-center gap-3">
              <span className="h-4 w-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50" />
              Остаток
            </div>
            <div className="flex items-center gap-3">
              <span className="h-4 w-8 rounded-2xl border border-slate-300 bg-slate-50" />
              Отступ от края листа
            </div>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-1 xl:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Материалы</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {uniquePatterns.map((pattern) => (
              <div key={pattern.code} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div
                  className="h-10 rounded-2xl border border-slate-200"
                  style={getPatternSwatchStyle(pattern) as CSSProperties}
                />
                <p className="mt-2 text-sm font-medium text-slate-900">{pattern.name}</p>
                <p className="text-xs text-slate-500">{pattern.finish}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function buildLeadText(params: {
  clientName: string;
  phone: string;
  email: string;
  comment: string;
  sheetSummary: {
    sheetWidth: string;
    sheetHeight: string;
    marginX: string;
    marginY: string;
    /** Правый и нижний край. Не переданы — такие же, как левый и верхний. */
    marginRight?: string;
    marginBottom?: string;
    defaultGapX: string;
    defaultGapY: string;
    algorithmLabel: string;
    edgeGapLabel?: string;
    workKindLabel?: string;
  };
  stats: {
    groupCount: number;
    sheetCount: number;
    requestedCount: number;
    placedCount: number;
    unplacedCount: number;
    detailArea: number;
    freeArea: number;
    fillPercent: number;
  };
  parts: Array<{
    partNumber: number;
    name: string;
    width: number;
    height: number;
    quantity: number;
    preferredSheet?: number | null;
    gapX: number | null;
    gapY: number | null;
    rotate: boolean;
    pattern: string;
    thickness?: number | null;
  }>;
  patterns: CuttingPattern[];
}) {
  const { clientName, phone, email, comment, sheetSummary, stats, parts, patterns } = params;

  return [
    "Раскрой листового материала",
    clientName ? `Клиент: ${clientName}` : null,
    phone ? `Телефон: ${phone}` : null,
    email ? `Email: ${email}` : null,
    `Лист: ${sheetSummary.sheetWidth} × ${sheetSummary.sheetHeight} мм`,
    // Края пишем одной строкой, когда они равны, и раздельно, когда нет:
    // цех должен видеть в бумаге ровно то, что стояло на экране.
    sheetSummary.marginRight && sheetSummary.marginRight !== sheetSummary.marginX
      ? `Отступ по горизонтали: слева ${sheetSummary.marginX} мм, справа ${sheetSummary.marginRight} мм`
      : `Отступ по горизонтали: ${sheetSummary.marginX} мм`,
    sheetSummary.marginBottom && sheetSummary.marginBottom !== sheetSummary.marginY
      ? `Отступ по вертикали: сверху ${sheetSummary.marginY} мм, снизу ${sheetSummary.marginBottom} мм`
      : `Отступ по вертикали: ${sheetSummary.marginY} мм`,
    `Общий зазор по горизонтали: ${sheetSummary.defaultGapX} мм`,
    `Общий зазор по вертикали: ${sheetSummary.defaultGapY} мм`,
    `Алгоритм: ${sheetSummary.algorithmLabel}`,
    sheetSummary.edgeGapLabel ? `Зазор у кромки листа: ${sheetSummary.edgeGapLabel}` : null,
    sheetSummary.workKindLabel ? `Тип работы: ${sheetSummary.workKindLabel}` : null,
    `Материалов: ${stats.groupCount}, карт: ${stats.sheetCount}`,
    `Деталей: ${stats.requestedCount}, размещено: ${stats.placedCount}, не размещено: ${stats.unplacedCount}`,
    `Площадь деталей: ${formatArea(stats.detailArea)}`,
    `Свободный остаток: ${formatArea(stats.freeArea)}`,
    `Заполнение: ${formatPercent(stats.fillPercent)}`,
    comment ? `Комментарий менеджера: ${comment}` : null,
    "",
    "Состав раскроя:",
    ...parts.map((part) => {
      const pattern = getPatternByCode(patterns, part.pattern) ?? fallbackPattern;
      const preferredSheet = part.preferredSheet ? ` | лист ${part.preferredSheet}` : "";
      const gapX = part.gapX ?? Number(sheetSummary.defaultGapX);
      const gapY = part.gapY ?? Number(sheetSummary.defaultGapY);
      // толщина в бланке заказчика есть не всегда — пустое поле не печатаем
      const thickness = part.thickness ? ` | толщина ${part.thickness} мм` : "";

      return `${part.partNumber}. ${part.name} | ${formatSize(part.width, part.height)} | кол-во ${part.quantity}${preferredSheet} | материал ${pattern.name}${thickness} | зазор ${gapX}/${gapY} мм | поворот ${part.rotate ? "да" : "нет"}`;
    }),
  ]
    .filter(Boolean)
    .join("\n");
}
