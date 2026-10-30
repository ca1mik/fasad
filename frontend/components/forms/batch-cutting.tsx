"use client";

import { Layers, ListChecks, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  algorithmOptions,
  fallbackPattern,
  formatSize,
  MetricCard,
} from "@/components/cutting-layout/lib";
import { SheetWorkspace } from "@/components/cutting-layout/sheet-workspace";
import { SupplySummary } from "@/components/cutting-layout/supply-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  buildImportedPatterns,
  buildLayoutPatterns,
  buildPatterns,
  createDraftPart,
  createPreviewSheet,
  MDF_PATTERN,
  normalizeDrafts,
  packLayoutByPattern,
  resolvePatternCode,
} from "@/lib/cutting-layout";
import { formatArea, formatDate, readLeadParts, type LeadPart } from "@/lib/format";
import { cleanColorText, thicknessFromText } from "@/lib/material-text";
import { MAX_PART_UNITS } from "@/lib/part-quantity";
import { LEAD_STATUS_LABELS, labelFor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { FilmCuttingOptions, Lead, Order, ProductionDirection } from "@/types/api";

type Props = {
  leads: Lead[];
  directions: ProductionDirection[];
  options: FilmCuttingOptions;
  /**
   * Детали заявки-источника для заказов с пустой сметой.
   *
   * Считаются на сервере, см. `app/cutting-batch/page.tsx`: перенос заявки в
   * смету копирует только строки с ценой, поэтому у заказа, посчитанного «на
   * глаз», смета пуста, а размеры остались в заявке.
   */
  orderLeadParts?: Record<string, LeadPart[]>;
  /**
   * Заказы для набора партии.
   *
   * Заказчик про раскрой МДФ: «выбор заказов просто, и пусть будет распил».
   * Заявки для этого не годятся: в цех уходит то, что уже продано, а заявка
   * может так и остаться расчётом.
   */
  orders?: Order[];
};

/** Из чего набирают партию: из расчётов или из проданного. */
type BatchSource = "orders" | "leads";

type SheetForm = {
  sheetWidth: string;
  sheetHeight: string;
  marginX: string;
  marginY: string;
  defaultGapX: string;
  defaultGapY: string;
  algorithm: "leftEdge" | "byLength" | "byWidth" | "optimal";
  allowRotation: boolean;
};

const SHEET_PRESETS = [
  { label: "2750×1250", width: "2750", height: "1250" },
  { label: "2440×1220", width: "2440", height: "1220" },
  { label: "2800×2070", width: "2800", height: "2070" },
];

function parsePositive(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type PeriodCode = "day" | "week" | "month" | "all";

const PERIODS: Array<{ code: PeriodCode; label: string }> = [
  { code: "day", label: "День" },
  { code: "week", label: "Неделя" },
  { code: "month", label: "Месяц" },
  { code: "all", label: "За всё время" },
];

/** Начало суток по местному времени: заявка от 09:02 должна попасть в «сегодня». */
function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Границы периода. Свои даты сильнее кнопки — так же, как в отчётах.
 *
 * «День» — это сегодняшние сутки целиком, а не последние 24 часа: менеджер
 * набирает партию из того, что приняли сегодня, а не из скользящего окна.
 * Конец диапазона — начало следующих суток, чтобы заявка, созданная в 23:50,
 * не выпадала из своего же дня.
 */
function resolvePeriodRange(period: PeriodCode, dateFrom: string, dateTo: string) {
  if (dateFrom || dateTo) {
    return {
      from: dateFrom ? startOfDay(new Date(dateFrom)) : null,
      to: dateTo ? new Date(startOfDay(new Date(dateTo)).getTime() + 86_400_000) : null,
    };
  }
  if (period === "all") {
    return { from: null, to: null };
  }

  const today = startOfDay(new Date());
  const days = period === "day" ? 0 : period === "week" ? 6 : 29;
  return { from: new Date(today.getTime() - days * 86_400_000), to: null };
}

function isWithinRange(value: string | null | undefined, range: { from: Date | null; to: Date | null }) {
  if (!range.from && !range.to) {
    return true;
  }
  if (!value) {
    return false;
  }
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  if (range.from && created < range.from) {
    return false;
  }
  return !(range.to && created >= range.to);
}

/** Деталь заказа для раскроя: из сметы или из заявки-источника. */
type OrderCutPart = {
  name: string;
  width: number;
  height: number;
  quantity: number;
  /** Цвет, уже вычищенный от толщины и основы. */
  color: string;
  thickness: string;
  article: string;
};

/**
 * Детали заказа для партии: сначала смета, а если она пуста — заявка-источник.
 *
 * Смета пуста не потому, что заказ не занесён: перенос заявки копирует в смету
 * только строки с ценой, а менеджер часто заносит размеры и считает позже.
 * Раскрой листа эту заявку уже дотягивает сам, поэтому здесь тот же порядок
 * источников — иначе один и тот же заказ виден на одном экране и не виден на
 * другом.
 *
 * Цвет чистим здесь, в единственной точке чтения деталей заказа: по нему
 * строятся коды материалов, и если чистить в двух местах по-разному, один цвет
 * разъедется на два материала. Толщину, если в строке её нет, достаём из текста
 * цвета — деталь 16 мм нельзя выпилить из плиты 19 мм, и на распиле каждая
 * толщина обязана уйти своей картой.
 */
function readOrderParts(order: Order, leadParts: LeadPart[] | undefined): OrderCutPart[] {
  const fromEstimate = (order.positions ?? [])
    .filter((position) => Number(position.width) > 0 && Number(position.height) > 0)
    .map((position) => ({
      name: position.name,
      width: Number(position.width),
      height: Number(position.height),
      quantity: Math.max(1, Math.round(Number(position.quantity) || 1)),
      color: cleanColorText(position.color),
      thickness: position.thickness
        ? String(Number(position.thickness))
        : (thicknessFromText(position.color) ?? ""),
      article: position.article ?? "",
    }));
  if (fromEstimate.length) {
    return fromEstimate;
  }
  // `readLeadParts` цвет уже вычистил, повторно не трогаем.
  return (leadParts ?? []).map((part) => ({
    name: "Деталь",
    width: part.width,
    height: part.height,
    quantity: part.quantity,
    color: part.material ?? "",
    thickness: part.thickness ?? thicknessFromText(part.materialSource) ?? "",
    article: part.article ?? "",
  }));
}

/**
 * Раскрой по нескольким заявкам.
 *
 * В цехе режут не по одной заявке, а набирают детали из нескольких на общие
 * листы — иначе материал уходит на каждый заказ отдельно. Здесь менеджер
 * отмечает нужные заявки, а детали складываются в одну раскладку. Номер заявки
 * подписан на каждой детали, чтобы после реза разложить по заказам.
 */
export function BatchCutting({
  leads,
  directions,
  options,
  orders = [],
  orderLeadParts = {},
}: Props) {
  const patterns = useMemo(() => {
    const prepared = buildPatterns(options.colors);
    return prepared.length ? prepared : [fallbackPattern];
  }, [options.colors]);
  const defaultPattern = patterns[0]?.code ?? fallbackPattern.code;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // По умолчанию заказы: в цех уходит проданное. Заявки остались как были —
  // ими пользуются, когда партию считают до продажи.
  const [source, setSource] = useState<BatchSource>("orders");
  const [search, setSearch] = useState("");
  const [directionCode, setDirectionCode] = useState("all");
  const [statusCode, setStatusCode] = useState("all");
  const [material, setMaterial] = useState(defaultPattern);
  // период по дате создания заявки: партию собирают из свежих заявок,
  // а в списке копятся все за всё время
  const [period, setPeriod] = useState<PeriodCode>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sheet, setSheet] = useState<SheetForm>({
    sheetWidth: "2750",
    sheetHeight: "1250",
    // Слева 60 — заказчик: «от края левого всегда 60 мм отступ». Зазор идёт за
    // деталью, поэтому у левой кромки его нет и без поля деталь встаёт в 15 мм.
    marginX: "60",
    // Сверху — тот же стандарт 60, а не 15: заказчик отдельно указал на это
    // как на ошибку дефолта (та же правка, что и в cutting-layout-ui.tsx).
    marginY: "60",
    defaultGapX: "60",
    defaultGapY: "60",
    algorithm: "leftEdge",
    allowRotation: true,
  });
  /** Менеджер сам трогал поворот — тогда не переставляем его за него. */
  const [rotationTouched, setRotationTouched] = useState(false);
  const [patternFilter, setPatternFilter] = useState("all");
  const [activeSheetIndex, setActiveSheetIndex] = useState<number | null>(null);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  // SVG-узлы активных листов — для кнопки «Скачать SVG» на карте. Раньше
  // кнопка была подключена как onExportSheet={() => undefined} и молча ничего
  // не делала: элемент, который нужно сериализовать, нигде не сохранялся.
  const sheetRefs = useRef<Record<number, SVGSVGElement | null>>({});

  /** Заявки, у которых есть размеры: без деталей резать нечего. */
  const cuttable = useMemo(
    () =>
      leads
        .map((lead) => ({ lead, parts: readLeadParts(lead.parsed_payload_json) }))
        .filter((item) => item.parts.length > 0),
    [leads],
  );

  const statuses = useMemo(
    () => Array.from(new Set(cuttable.map((item) => item.lead.status))).sort(),
    [cuttable],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const range = resolvePeriodRange(period, dateFrom, dateTo);
    return cuttable.filter(({ lead }) => {
      if (directionCode !== "all" && (lead.direction?.code ?? "none") !== directionCode) {
        return false;
      }
      if (statusCode !== "all" && lead.status !== statusCode) {
        return false;
      }
      if (!isWithinRange(lead.created_at, range)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        lead.lead_number,
        lead.client?.full_name,
        lead.client?.organization,
        lead.client?.phone,
        lead.subject,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [cuttable, directionCode, statusCode, search, period, dateFrom, dateTo]);

  const chosen = useMemo(
    () => cuttable.filter((item) => selected.has(item.lead.id)),
    [cuttable, selected],
  );

  /** Заказы, у которых есть детали с размерами — в смете или в заявке. */
  const cuttableOrders = useMemo(
    () =>
      orders
        .map((order) => ({ order, parts: readOrderParts(order, orderLeadParts[order.id]) }))
        .filter((item) => item.parts.length > 0),
    [orders, orderLeadParts],
  );

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const range = resolvePeriodRange(period, dateFrom, dateTo);
    return cuttableOrders.filter(({ order }) => {
      if (directionCode !== "all" && (order.direction?.code ?? "none") !== directionCode) {
        return false;
      }
      if (!isWithinRange(order.created_at, range)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [order.order_number, order.client?.full_name, order.client?.organization]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [cuttableOrders, directionCode, search, period, dateFrom, dateTo]);

  const chosenOrders = useMemo(
    () => cuttableOrders.filter((item) => selected.has(item.order.id)),
    [cuttableOrders, selected],
  );
  const selectedUnitCount =
    source === "orders"
      ? chosenOrders.reduce(
          (sum, item) => sum + item.parts.reduce((partSum, part) => partSum + part.quantity, 0),
          0,
        )
      : chosen.reduce(
          (sum, item) => sum + item.parts.reduce((partSum, part) => partSum + part.quantity, 0),
          0,
        );
  const tooManySelected = selectedUnitCount > MAX_PART_UNITS;

  /**
   * Детали партии: каждая подписана номером — заказа или заявки.
   *
   * У заказа берём цвет, толщину и артикул из строки сметы. Карты распила
   * делятся только по толщине. Цвет и артикул остаются у каждой детали. На распиле
   * деталь 16 мм нельзя выпилить из плиты 19 мм, поэтому толщина обязана доехать
   * до раскладки, иначе партия соберётся неверно.
   */
  /**
   * Цвета из смет выбранных заказов, как их написал менеджер.
   *
   * В справочнике плёнок этих значений нет — цвет в смете свободный текст.
   * Заводим подписи для деталей, но распил МДФ по цвету не разделяем.
   */
  const orderColors = useMemo(
    () =>
      Array.from(
        new Set(
          chosenOrders.flatMap(({ parts }) => parts.map((part) => part.color).filter(Boolean)),
        ),
      ),
    [chosenOrders],
  );

  const allPatterns = useMemo(
    () => [...patterns, ...buildImportedPatterns(orderColors, patterns)],
    [patterns, orderColors],
  );

  /**
   * Заказы партии, которым запрещён поворот.
   *
   * В партии лежат детали из разных заказов, а настройка поворота одна на всю
   * раскладку. Значит запрета одного заказа достаточно: повернуть его деталь
   * нельзя, даже если остальным можно. Иначе текстурный фасад уедет в брак.
   */
  const lockedRotationOrders = useMemo(
    () =>
      chosenOrders
        .filter(({ order }) => order.has_texture || order.no_rotation)
        .map(({ order }) => order.order_number),
    [chosenOrders],
  );

  // Ставим запрет сами, пока менеджер не тронул переключатель руками.
  const effectiveRotation =
    rotationTouched || !lockedRotationOrders.length ? sheet.allowRotation : false;

  const drafts = useMemo(() => {
    if (tooManySelected) return [];
    if (source === "orders") {
      return chosenOrders.flatMap(({ order, parts }) =>
        parts.flatMap((part) =>
          Array.from({ length: part.quantity }, () =>
            createDraftPart({
              name: `${order.order_number} · ${part.name}`,
              width: String(part.width),
              height: String(part.height),
              quantity: "1",
              // Именно код материала, а не сырой текст цвета: по сырому тексту
              // `getPatternByCode` ничего не находил и подписывал все карты
              // первым материалом справочника — «Белый глянец».
              pattern: part.color ? resolvePatternCode(part.color, patterns, material) : MDF_PATTERN.code,
              thickness: part.thickness,
              article: part.article,
            }),
          ),
        ),
      );
    }
    return chosen.flatMap(({ lead, parts }) =>
      parts.flatMap((part) =>
        Array.from({ length: part.quantity }, () =>
          createDraftPart({
            name: lead.lead_number || "без номера",
            width: String(part.width),
            height: String(part.height),
            quantity: "1",
            pattern: material,
          }),
        ),
      ),
    );
  }, [source, chosen, chosenOrders, material, patterns, tooManySelected]);

  const parsedSheet = useMemo(
    () => ({
      sheetWidth: parsePositive(sheet.sheetWidth, 2750),
      sheetHeight: parsePositive(sheet.sheetHeight, 1250),
      marginX: Number(sheet.marginX) || 0,
      marginY: Number(sheet.marginY) || 0,
      defaultGapX: Number(sheet.defaultGapX) || 0,
      defaultGapY: Number(sheet.defaultGapY) || 0,
      algorithm: sheet.algorithm,
      allowRotation: effectiveRotation,
      workKind: "cutting" as const,
    }),
    [sheet, effectiveRotation],
  );

  const layout = useMemo(
    () => packLayoutByPattern(normalizeDrafts(drafts, material), parsedSheet),
    [drafts, material, parsedSheet],
  );

  const previewSheet = useMemo(
    () => createPreviewSheet(parsedSheet, material),
    [parsedSheet, material],
  );

  /**
   * Подписи карт партии.
   *
   * Цвет заказа берётся из строки сметы свободным текстом («Плёнка Touch 356»),
   * и в справочнике плёнок такого кода нет. Сначала заводим материалы по самим
   * цветам партии, потом дописываем подписи карт, разделённых по толщине.
   *
   * Без этого `getPatternByCode` не находил код и отдавал первый материал
   * списка: все карты, фильтр материалов и заявка поставщику подписывались
   * «Белый глянец», каким бы ни был настоящий материал. Менеджер заказал бы
   * поставщику не то.
   */
  const layoutPatterns = useMemo(
    () => buildLayoutPatterns(layout.groups, allPatterns),
    [layout.groups, allPatterns],
  );

  /** Что не влезло и почему — сгруппировано по размеру и заявке. */
  const unplaced = useMemo(() => {
    const buckets = new Map<
      string,
      { key: string; size: string; leadNumber: string; count: number; reason: string }
    >();
    for (const group of layout.groups) {
      for (const part of group.unplaced) {
        const key = `${part.sourceName}-${part.width}x${part.height}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        const tooWide = part.width > parsedSheet.sheetWidth - parsedSheet.marginX * 2;
        const tooTall = part.height > parsedSheet.sheetHeight - parsedSheet.marginY * 2;
        const reason =
          tooWide && tooTall
            ? "крупнее рабочей зоны листа"
            : tooWide
              ? "шире рабочей зоны листа"
              : tooTall
                ? "выше рабочей зоны листа"
                : "не хватило места с учётом зазоров";
        buckets.set(key, {
          key,
          size: `${part.width}×${part.height} мм`,
          leadNumber: part.sourceName || "без номера",
          count: 1,
          reason,
        });
      }
    }
    return Array.from(buckets.values());
  }, [layout.groups, parsedSheet]);

  /**
   * Сколько всего отмечено — заказов или заявок, смотря какой источник.
   *
   * Раньше и счётчик, и площадь, и сам показ карты считались только по
   * заявкам, а источник по умолчанию — «Заказы». Менеджер отмечал заказы и
   * видел «Заявки не выбраны»: в штатном режиме карта не рисовалась никогда.
   */
  const chosenCount = source === "orders" ? chosenOrders.length : chosen.length;

  // Площадь берём из самих деталей партии: они уже собраны из активного
  // источника, и считать отдельно по заявкам и по заказам не нужно.
  const totalArea = useMemo(
    () =>
      drafts.reduce(
        (sum, draft) =>
          sum + (Number(draft.width) * Number(draft.height)) / 1_000_000,
        0,
      ),
    [drafts],
  );

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const visibleIds =
    source === "orders"
      ? visibleOrders.map(({ order }) => order.id)
      : visible.map(({ lead }) => lead.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  /**
   * Отметить или снять всё, что сейчас в списке.
   *
   * Отметки по заявкам вне фильтра не трогаем: менеджер отобрал эмаль, взял
   * все её заявки, переключил фильтр на плёнку — набранное не должно пропасть.
   */
  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      const ids =
        source === "orders"
          ? visibleOrders.map(({ order }) => order.id)
          : visible.map(({ lead }) => lead.id);
      for (const id of ids) {
        if (allVisibleSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });

  const activeSheet =
    layout.groups
      .flatMap((group) => group.sheets)
      .find((item) => item.globalIndex === activeSheetIndex) ??
    layout.groups[0]?.sheets[0] ??
    null;

  return (
    <div className="space-y-5">
      {tooManySelected ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          Выбрано {selectedUnitCount} деталей. В одной партии можно раскроить не больше {MAX_PART_UNITS}; снимите часть отметок.
        </p>
      ) : null}
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Источник партии. Для распила МДФ берут заказы: в цех уходит
                  проданное, а заявка может остаться расчётом. */}
              {(
                [
                  { code: "orders" as BatchSource, label: "Заказы" },
                  { code: "leads" as BatchSource, label: "Заявки" },
                ]
              ).map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setSource(item.code);
                    setSelected(new Set());
                  }}
                  className={cn(
                    "rounded-2xl px-3 py-1.5 text-sm transition",
                    source === item.code
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <Badge className="bg-slate-50 text-slate-700">
                отмечено: {selected.size} из{" "}
                {source === "orders" ? visibleOrders.length : visible.length}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {source === "orders" ? "Какие заказы режем вместе" : "Какие заявки режем вместе"}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-700">
              {source === "orders"
                ? "Отметьте заказы — детали их сметы лягут на общие листы. Толщина и цвет берутся из строк: на распиле каждая толщина идёт своей картой."
                : "Отметьте заявки — их детали лягут на общие листы. Показаны только заявки, у которых внесены размеры."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={toggleAllVisible}
              disabled={(source === "orders" ? visibleOrders.length : visible.length) === 0}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              {allVisibleSelected
                ? "Снять все показанные"
                : `Выбрать все (${source === "orders" ? visibleOrders.length : visible.length})`}
            </Button>
            {selected.size ? (
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="mr-2 h-4 w-4" />
                Снять отметки
              </Button>
            ) : null}
          </div>
        </div>

        {/* Период по дате создания заявки. Кнопки закрывают повседневное
            («что приняли сегодня»), поля с датами — разбор задним числом. */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Период</span>
            {PERIODS.map((item) => {
              const isActive = !dateFrom && !dateTo && period === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setPeriod(item.code);
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className={cn(
                    "rounded-2xl px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "border border-amber-400 bg-amber-400 text-slate-900"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Дата с</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-[170px]"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Дата по</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-[170px]"
              />
            </label>
            {dateFrom || dateTo ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Сбросить даты
              </Button>
            ) : null}
            <p className="text-xs text-slate-500">
              {dateFrom || dateTo
                ? "Свой диапазон сильнее кнопок периода."
                : "Или задайте свой диапазон — кнопки при этом отключатся."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-sm text-slate-700">
            <span>Поиск</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Номер, клиент, телефон"
                className="pl-9"
              />
            </div>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Направление</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={directionCode}
              onChange={(event) => setDirectionCode(event.target.value)}
            >
              <option value="all">Все направления</option>
              {directions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
              <option value="none">Без направления</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Статус</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={statusCode}
              onChange={(event) => setStatusCode(event.target.value)}
            >
              <option value="all">Любой статус</option>
              {statuses.map((code) => (
                <option key={code} value={code}>
                  {labelFor(LEAD_STATUS_LABELS, code)}
                </option>
              ))}
            </select>
          </label>
          {source === "leads" ? <label className="space-y-2 text-sm text-slate-700">
            <span>Материал партии</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              {patterns.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label> : null}
        </div>

        {/* Список заказов: то, что уже продано и идёт в цех. */}
        {source === "orders" ? (
          <div className="rounded-2xl border border-slate-200">
            <Table>
              <THead>
                <TR>
                  <TH className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allVisibleSelected}
                      ref={(node) => {
                        if (node) {
                          node.indeterminate = someVisibleSelected && !allVisibleSelected;
                        }
                      }}
                      disabled={visibleOrders.length === 0}
                      onChange={toggleAllVisible}
                      aria-label="Отметить все показанные заказы"
                    />
                  </TH>
                  <TH>Заказ</TH>
                  <TH>Клиент</TH>
                  <TH>Направление</TH>
                  <TH>Деталей</TH>
                  <TH>Площадь</TH>
                  <TH>Срок</TH>
                </TR>
              </THead>
              <TBody>
                {visibleOrders.map(({ order, parts }) => {
                  const count = parts.reduce((sum, part) => sum + part.quantity, 0);
                  const area =
                    parts.reduce((sum, part) => sum + part.width * part.height * part.quantity, 0) /
                    1_000_000;
                  const isOn = selected.has(order.id);
                  return (
                    <TR
                      key={order.id}
                      className={cn("cursor-pointer", isOn && "bg-amber-100/50")}
                      onClick={() => toggle(order.id)}
                    >
                      <TD>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isOn}
                          onChange={() => toggle(order.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Взять заказ ${order.order_number} в раскрой`}
                        />
                      </TD>
                      <TD className="num font-medium text-slate-900">{order.order_number}</TD>
                      <TD>
                        {order.client?.full_name || "Клиент"}
                        {order.client?.organization ? (
                          <span className="block text-xs text-slate-500">
                            {order.client.organization}
                          </span>
                        ) : null}
                      </TD>
                      <TD>{order.direction?.name || "—"}</TD>
                      <TD className="num">{count}</TD>
                      <TD className="num whitespace-nowrap">{formatArea(area)}</TD>
                      <TD className="num whitespace-nowrap">
                        {order.due_date ? formatDate(order.due_date) : "—"}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {visibleOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                {cuttableOrders.length === 0
                  ? "Пока нет заказов со сметой. Заполните смету в заказе — он появится здесь."
                  : "По этим условиям заказов нет. Смените фильтры или очистите поиск."}
              </p>
            ) : null}
          </div>
        ) : (
        <div className="rounded-2xl border border-slate-200">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">
                  {/* Отмечает ровно то, что сейчас в списке: с включённым
                      фильтром «выбрать все» не должно тащить в партию заявки,
                      которых менеджер на экране не видит. */}
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }
                    }}
                    disabled={visible.length === 0}
                    onChange={toggleAllVisible}
                    aria-label="Отметить все показанные заявки"
                  />
                </TH>
                <TH>Заявка</TH>
                <TH>Клиент</TH>
                <TH>Направление</TH>
                <TH>Деталей</TH>
                <TH>Площадь</TH>
                <TH>Создана</TH>
              </TR>
            </THead>
            <TBody>
              {visible.map(({ lead, parts }) => {
                const count = parts.reduce((sum, part) => sum + part.quantity, 0);
                const area =
                  parts.reduce(
                    (sum, part) => sum + part.width * part.height * part.quantity,
                    0,
                  ) / 1_000_000;
                const isOn = selected.has(lead.id);
                return (
                  <TR
                    key={lead.id}
                    className={cn("cursor-pointer", isOn && "bg-amber-100/50")}
                    onClick={() => toggle(lead.id)}
                  >
                    <TD>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isOn}
                        onChange={() => toggle(lead.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Взять заявку ${lead.lead_number || ""} в раскрой`}
                      />
                    </TD>
                    <TD className="num font-medium text-slate-900">
                      {lead.lead_number || "без номера"}
                    </TD>
                    <TD>
                      {lead.client?.full_name || "Новый клиент"}
                      {lead.client?.organization ? (
                        <span className="block text-xs text-slate-500">
                          {lead.client.organization}
                        </span>
                      ) : null}
                    </TD>
                    <TD>{lead.direction?.name || "—"}</TD>
                    <TD className="num">{count}</TD>
                    <TD className="num whitespace-nowrap">{formatArea(area)}</TD>
                    <TD className="num whitespace-nowrap">{formatDate(lead.created_at)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {visible.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {cuttable.length === 0
                ? "Пока нет заявок с внесёнными размерами. Внесите размеры в заявке — она появится здесь."
                : "По этим условиям заявок нет. Смените фильтры или очистите поиск."}
            </p>
          ) : null}
        </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-slate-700">Настрой лист</Badge>
            {SHEET_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant={
                  sheet.sheetWidth === preset.width && sheet.sheetHeight === preset.height
                    ? "secondary"
                    : "outline"
                }
                onClick={() =>
                  setSheet((current) => ({
                    ...current,
                    sheetWidth: preset.width,
                    sheetHeight: preset.height,
                  }))
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {(
            [
              ["Ширина", "sheetWidth"],
              ["Высота", "sheetHeight"],
              ["Отступ по бокам", "marginX"],
              ["Отступ сверху", "marginY"],
              ["Зазор по ширине", "defaultGapX"],
              ["Зазор по высоте", "defaultGapY"],
            ] as const
          ).map(([label, key]) => (
            <label key={key} className="space-y-2 text-sm text-slate-700">
              <span>{label}</span>
              <Input
                type="number"
                value={sheet[key]}
                onChange={(event) =>
                  setSheet((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <label className="space-y-2 text-sm text-slate-700">
            <span>Поворот деталей</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={effectiveRotation ? "yes" : "no"}
              onChange={(event) => {
                setRotationTouched(true);
                setSheet((current) => ({
                  ...current,
                  allowRotation: event.target.value === "yes",
                }));
              }}
            >
              <option value="yes">Разрешён</option>
              <option value="no">Запрещён</option>
            </select>
            {/* Партия собирается из разных заказов, и запрет достаточно
                одного: повернуть деталь такого заказа нельзя, даже если
                остальным можно. */}
            {lockedRotationOrders.length ? (
              <span className="block text-xs text-slate-500">
                Запрещён заказами {lockedRotationOrders.join(", ")}
              </span>
            ) : null}
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span>Алгоритм</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={sheet.algorithm}
              onChange={(event) =>
                setSheet((current) => ({
                  ...current,
                  algorithm: event.target.value as SheetForm["algorithm"],
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={source === "orders" ? "Заказов в партии" : "Заявок в партии"}
            value={String(chosenCount)}
          />
          <MetricCard label="Деталей" value={String(layout.stats.requestedCount)} />
          <MetricCard label="Площадь деталей" value={formatArea(totalArea)} />
          <MetricCard
            label="Листов нужно"
            value={String(layout.stats.sheetCount)}
            hint={activeSheet ? `полоса справа ${activeSheet.freeStripWidth} мм` : undefined}
          />
        </div>

        {/* Не просто «не поместилось N», а какие именно размеры: иначе менеджеру
            непонятно, что править — размер листа или саму заявку */}
        {unplaced.length ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <p className="font-medium">
              Не поместилось деталей: {layout.stats.unplacedCount}
            </p>
            <ul className="mt-2 space-y-1">
              {unplaced.map((item) => (
                <li key={item.key}>
                  <span className="num">{item.size}</span> — {item.count} шт.,{" "}
                  {source === "orders" ? "заказ" : "заявка"}{" "}
                  <span className="num">{item.leadNumber}</span>: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {chosenCount === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Layers className="h-7 w-7 text-slate-500" />
            <p className="font-medium text-slate-900">
              {source === "orders" ? "Заказы не выбраны" : "Заявки не выбраны"}
            </p>
            <p className="max-w-md text-sm text-slate-700">
              {source === "orders"
                ? "Отметьте галочками заказы выше — их детали сложатся в одну раскладку, и на карте у каждой детали будет виден номер заказа."
                : "Отметьте галочками заявки выше — их детали сложатся в одну раскладку, и на карте у каждой детали будет виден номер заявки."}
            </p>
          </div>
        </Card>
      ) : (
        <SheetWorkspace
          groups={layout.groups}
          patterns={layoutPatterns}
          previewSheet={layout.sheets.length ? null : previewSheet}
          activeSheetIndex={activeSheetIndex}
          patternFilter={patternFilter}
          highlightedSourceId={hoveredSourceId}
          showGrid={showGrid}
          asideContent={
            <Card className="space-y-3 p-4">
              <Badge className="bg-slate-50 text-slate-700">Партия</Badge>
              <p className="text-sm leading-6 text-slate-700">
                {source === "orders"
                  ? "На каждой детали подписан номер заказа — после реза детали раскладываются по заказам без пересчёта."
                  : "На каждой детали подписан номер заявки — после реза детали раскладываются по заказам без пересчёта."}
              </p>
              {/* Состав партии: раньше здесь были только заявки, и в штатном
                  режиме «Заказы» панель стояла пустой. */}
              <div className="space-y-1">
                {source === "orders"
                  ? chosenOrders.map(({ order, parts }) => (
                      <div
                        key={order.id}
                        className="flex items-baseline justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="num font-medium text-slate-900">
                          {order.order_number}
                        </span>
                        <span className="text-slate-700">
                          {order.client?.full_name || "клиент не указан"}
                        </span>
                        <span className="num text-slate-500">
                          {parts.reduce((sum, part) => sum + part.quantity, 0)}{" "}
                          шт.
                        </span>
                      </div>
                    ))
                  : chosen.map(({ lead, parts }) => (
                      <div
                        key={lead.id}
                        className="flex items-baseline justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="num font-medium text-slate-900">
                          {lead.lead_number || "без номера"}
                        </span>
                        <span className="text-slate-700">
                          {lead.client?.full_name || "клиент не указан"}
                        </span>
                        <span className="num text-slate-500">
                          {parts.reduce((sum, part) => sum + part.quantity, 0)} шт.
                        </span>
                      </div>
                    ))}
              </div>
              <Button
                variant={showGrid ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowGrid((current) => !current)}
              >
                {showGrid ? "Сетка включена" : "Показать сетку"}
              </Button>
              {activeSheet ? (
                <p className="text-xs text-slate-500">
                  Лист {formatSize(activeSheet.width, activeSheet.height)}, заполнение{" "}
                  <span className="num">{activeSheet.fillPercent}%</span>
                </p>
              ) : null}
            </Card>
          }
          onPatternFilterChange={setPatternFilter}
          onActiveSheetChange={setActiveSheetIndex}
          onHover={setHoveredSourceId}
          onSelectPlacement={setHoveredSourceId}
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
      )}

      {/* Заявку поставщику пишут по партии за день, а не по одному заказу —
          здесь сводка нужнее всего. */}
      <SupplySummary groups={layout.groups} patterns={layoutPatterns} />
    </div>
  );
}
