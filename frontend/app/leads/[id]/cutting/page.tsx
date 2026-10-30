import { notFound } from "next/navigation";

import { CuttingMap } from "@/components/print/cutting-map";
import { DownloadMaps } from "@/components/print/download-maps";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { api } from "@/lib/api";
import { fallbackPattern } from "@/components/cutting-layout/lib";
import { readLeadAddress, readLeadDueDate } from "@/components/leads/lead-fields";
import {
  buildImportedPatterns,
  buildLayoutPatterns,
  buildPatterns,
  FILM_PATTERN,
  getPatternByCode,
  MDF_PATTERN,
  packLayoutByPattern,
  resolvePatternCode,
  type CuttingPart,
  type CuttingSheetSettings,
  type CuttingWorkKind,
} from "@/lib/cutting-layout";
import type { OrderPosition } from "@/types/api";
import { formatDateOnly, readLeadParts } from "@/lib/format";
import { cleanColorText, thicknessFromText } from "@/lib/material-text";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ orderId?: string; type?: string }>;
};

/**
 * Настройки листа по умолчанию — те же, что открываются в раскрое.
 *
 * Печать с карточки заявки нужна, чтобы отдать бумагу в цех сразу, не заходя в
 * раскрой. Если лист или зазоры отличаются от стандартных, менеджер идёт в
 * раскрой, правит их там и печатает уже оттуда.
 */
const DEFAULT_SHEET: CuttingSheetSettings = {
  sheetWidth: 2750,
  sheetHeight: 1250,
  marginX: 15,
  // Стандарт по вертикали — 60, не 15 (та же правка, что и в
  // cutting-layout-ui.tsx/batch-cutting.tsx — заказчик указал на дефолт 15
  // как на ошибку). marginBottom не задан — зеркалит marginY, тоже станет 60.
  marginY: 60,
  defaultGapX: 60,
  defaultGapY: 60,
  algorithm: "leftEdge",
  allowRotation: true,
};

/**
 * Позиции заказа с размерами, отфильтрованные по типу работы.
 *
 * Заказчик: «нужна карта раскроя МДФ и карта раскроя плёнки, если это
 * плёнка» — раньше «Карты раскроя» печатала все детали заявки одной кучей
 * через workKind="cutting" (распил по толщине) всегда, даже когда среди
 * деталей была плёнка. Плёночную позицию также выпиливают из МДФ, поэтому
 * она входит в обе карты: в распил по толщине и в плёнку по артикулу.
 * Источник — смета ЗАКАЗА (OrderPosition.kind).
 */
function orderPartsFor(positions: OrderPosition[], workKind: CuttingWorkKind) {
  return workKind === "film"
    ? positions.filter((position) => position.kind === "film")
    : positions;
}

export default async function LeadCuttingPrintPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { orderId, type } = await searchParams;
  const workKind: CuttingWorkKind = type === "film" ? "film" : "cutting";

  const [lead, options, order] = await Promise.all([
    api.getLead(id),
    api.getFilmCuttingOptions(),
    orderId ? api.getOrder(orderId) : Promise.resolve(null),
  ]);

  if (!lead) {
    notFound();
  }

  const orderPositions = order ? orderPartsFor(order.positions, workKind) : null;
  const leadParts = orderPositions === null ? readLeadParts(lead.parsed_payload_json) : [];

  const materialsForPatterns = orderPositions
    ? orderPositions.map((position) => cleanColorText(position.color))
    : leadParts.map((part) => part.material ?? "");
  const catalog = buildPatterns(options?.colors ?? []);
  const base = catalog.length ? catalog : [fallbackPattern];
  const patterns = [...base, ...buildImportedPatterns(materialsForPatterns.filter(Boolean), base)];
  const defaultPattern = patterns[0]?.code ?? fallbackPattern.code;

  const parts: CuttingPart[] = orderPositions
    ? orderPositions
        .filter((position) => position.width && position.height)
        .map((position, index) => ({
          id: position.id,
          partNumber: index + 1,
          catalogItemCode: null,
          name: position.name,
          width: Number(position.width),
          height: Number(position.height),
          quantity: Number(position.quantity) || 1,
          preferredSheet: null,
          rotate: false,
          gapX: null,
          gapY: null,
          pattern: cleanColorText(position.color)
            ? resolvePatternCode(cleanColorText(position.color), patterns, defaultPattern)
            : workKind === "film" ? FILM_PATTERN.code : MDF_PATTERN.code,
          thickness: position.thickness
            ? Number(position.thickness) || null
            : Number(thicknessFromText(position.color)) || null,
          article: position.article ?? null,
        }))
    : leadParts.map((part, index) => ({
        id: `lead-${index}`,
        partNumber: index + 1,
        catalogItemCode: null,
        name: `Деталь ${index + 1}`,
        width: part.width,
        height: part.height,
        quantity: part.quantity,
        preferredSheet: null,
        rotate: false,
        gapX: null,
        gapY: null,
        pattern: part.material
          ? resolvePatternCode(part.material, patterns, defaultPattern)
          : defaultPattern,
        // Толщина обязательна: на распиле она делит карты, и без неё печать
        // выдавала одну карту там, где на экране раскроя их две — плита 16 и 19 мм
        // физически не режется вместе.
        thickness: part.thickness ? Number(part.thickness) || null : null,
        // Артикул терялся здесь: readLeadParts его читает (part.article), но эта
        // страница его не передавала дальше в CuttingPart — карта печаталась с
        // пустой строкой «Артикул», хотя он был указан в заявке.
        article: part.article ?? null,
      }));

  const layout = packLayoutByPattern(parts, {
    ...DEFAULT_SHEET,
    // У распила (МДФ/эмаль/шпон) толщина делит карты — у плёнки нет: рулон
    // режется по цвету, а не по толщине подложки.
    workKind: orderPositions ? workKind : "cutting",
  });
  const layoutPatterns = buildLayoutPatterns(layout.groups, patterns);
  const createdAt = formatDateOnly(lead.created_at);
  const customer = lead.client?.full_name ?? null;
  // Адрес и срок готовности: CuttingMap их поддерживает, но эта страница их
  // не считала и не передавала — карта раскроя ехала в цех без «куда везти»
  // и с вечно пустой «Дата готовности», хотя оба поля есть в заявке (то же
  // правило, что и в бланке заказа — leads/[id]/blank/page.tsx).
  const address = readLeadAddress(lead.parsed_payload_json) || lead.client?.address || null;
  // CuttingMap печатает dueDate как есть, без своего форматирования (та же
  // конвенция, что и createdAt чуть выше) — форматируем здесь.
  const rawDueDate = readLeadDueDate(lead);
  const dueDate = rawDueDate ? formatDateOnly(rawDueDate) : null;

  // Заголовок/подпись «МДФ» или «плёнки» — только когда карта реально по
  // заказу (order задан); печать «по заявке» (leads/[id]/page.tsx, без
  // orderId) остаётся как была — там смысла МДФ/плёнка ещё нет, заявку в
  // заказ не развели.
  const kindLabel = order ? (workKind === "film" ? "плёнки" : "МДФ") : null;
  const titleBase = order
    ? `Карты раскроя ${kindLabel} заказа ${order.order_number}`
    : `Карты раскроя ${lead.lead_number || ""}`.trim();
  const emptyHint = order
    ? workKind === "film"
      ? "В заказе нет плёночных позиций с размерами — печатать нечего"
      : "В заказе нет позиций с размерами — печатать нечего"
    : "В заявке нет размеров — печатать нечего";

  return (
    <div className="print-sheet min-h-screen bg-slate-100 py-6">
      <PrintToolbar
        backHref={order ? `/orders/${order.id}` : `/leads/${lead.id}`}
        title={titleBase}
        hint={
          layout.sheets.length
            ? `Листов: ${layout.sheets.length}, материалов: ${layout.groups.length}`
            : emptyHint
        }
      >
        <DownloadMaps baseName={titleBase} />
      </PrintToolbar>

      {layout.groups.map((group) =>
        group.sheets.map((sheet) => (
          <div className="print-page" key={`${group.pattern}-${sheet.globalIndex}`}>
            <CuttingMap
              sheet={sheet}
              index={sheet.localIndex}
              total={group.sheets.length}
              materialName={getPatternByCode(layoutPatterns, group.pattern)?.name ?? group.pattern}
              orderNumber={order?.order_number ?? lead.lead_number}
              customer={customer}
              address={address}
              createdAt={createdAt}
              dueDate={dueDate}
            />
          </div>
        )),
      )}

      {layout.unplaced.length ? (
        <div className="print-page">
          <p style={{ margin: 0, fontSize: "12px" }}>
            Не поместилось на лист: {layout.unplaced.length} шт. Проверьте размеры — деталь крупнее
            рабочей зоны листа {DEFAULT_SHEET.sheetWidth} × {DEFAULT_SHEET.sheetHeight} мм.
          </p>
        </div>
      ) : null}
    </div>
  );
}
