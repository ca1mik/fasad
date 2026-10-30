import type { LayoutSheetView } from "@/lib/cutting-layout";

/**
 * Карта раскроя — страница A4 целиком одним SVG.
 *
 * Вёрстка снята с распечаток SketchCut PRO, к которым привык цех: шапка
 * «Заказ / Материал / Дата / Дата готовности / Толщина», таблица «Детали»
 * справа, карта листа и строка итогов под ней.
 *
 * Почему SVG, а не вёрстка HTML: этот же файл уходит на скачивание — как SVG
 * и как PDF (растром на страницу). Одна разметка на просмотр, печать и файл
 * означает, что бумага, экран и скачанное совпадают буквально. Кириллица при
 * этом рисуется системным шрифтом и не требует вшивать в PDF свой.
 */

type Props = {
  sheet: LayoutSheetView;
  /** Номер листа среди листов этого материала и сколько их всего. */
  index: number;
  total: number;
  materialName: string;
  orderNumber?: string | null;
  /**
   * Направление или тип работ — «какой он заказ».
   *
   * Заказчик дословно: «чтобы и номер заказа был, и какой он». По одному
   * номеру в цеху не видно, эмаль это, плёнка или шпон, а режут их по-разному.
   */
  directionName?: string | null;
  customer?: string | null;
  /** Адрес доставки: карта раскроя едет с заказом, и «куда везти» нужно здесь. */
  address?: string | null;
  createdAt?: string | null;
  /** Срок сдачи. Раньше строка «Дата готовности» печаталась всегда пустой. */
  dueDate?: string | null;
};

/** Страница A4 в миллиметрах — в них же рисуем всё, кроме самой карты. */
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Высота шапки со списком деталей. */
const HEAD_HEIGHT = 48;

/** Шаг строк шапки. Строк стало восемь — прежние 6 мм в шапку не влезали. */
const HEAD_LINE_STEP = 5;

const TEXT = "#111827";
const LINE = "#111827";

/**
 * Сколько строк помещается в таблице «Детали».
 *
 * Ниже начинается карта листа, и лишние строки залезали бы прямо на неё. Что
 * не поместилось — сворачивается в строку «и ещё N»: полный перечень деталей
 * есть в бланке заказа, а карта нужна, чтобы резать.
 */
const MAX_TABLE_ROWS = 8;

/** Размеры деталей пишем в миллиметрах — целыми, как в их бланке. */
function mm(value: number) {
  return String(Math.round(value));
}

function formatSheetArea(value: number) {
  return value.toFixed(3);
}

function formatPercent(value: number) {
  return value.toFixed(2).replace(".", ",");
}

/** Длинное название материала обрезаем — в шапке под него одна строка. */
function clamp(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** Толщина без хвоста «.0»: цех пишет «19», а не «19.0». */
function thicknessText(value: number) {
  return String(Number(value.toFixed(2)));
}

/** Различающиеся значения по деталям листа, в порядке первой встречи. */
function distinct<T>(values: (T | null | undefined)[]): T[] {
  const seen: T[] = [];
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

export function buildMapFileName(sheet: LayoutSheetView, orderNumber?: string | null) {
  return `Карта раскроя ${orderNumber || ""} лист ${sheet.globalIndex}`.replace(/\s+/g, " ").trim();
}

export function CuttingMap({
  sheet,
  index,
  total,
  materialName,
  orderNumber,
  directionName,
  customer,
  address,
  createdAt,
  dueDate,
}: Props) {
  // подписи внутри карты задаём в единицах листа: карта вписана во вложенный
  // svg со своим viewBox и масштабируется вместе с ними
  const label = Math.max(sheet.width, sheet.height) / 90;

  // Толщина и артикул листа — из самих деталей, а не из подписи материала.
  // На распиле толщина у карты одна (карты по ней делятся), на плёнке толщины
  // могут смешаться — тогда в шапке честно стоит «16 / 19 мм».
  const thicknesses = distinct(sheet.placements.map((placement) => placement.thickness)).sort(
    (left, right) => left - right,
  );
  const articles = distinct(sheet.placements.map((placement) => placement.article));
  const sheetThickness =
    thicknesses.length > 0
      ? `${thicknesses.map(thicknessText).join(" / ")} мм`
      : sheet.thickness !== null
        ? `${thicknessText(sheet.thickness)} мм`
        : "";

  // список позиций этого листа — таблица «Детали» в шапке SketchCut.
  // Ключ группировки включает толщину и артикул: две детали одного размера, но
  // из плиты 16 и 19 мм, — это разные пачки, и складывать их в одну строку
  // значит соврать цеху в количестве.
  const bySize = new Map<
    string,
    { width: number; height: number; quantity: number; thickness: number | null }
  >();
  for (const placement of sheet.placements) {
    const key = `${placement.width}x${placement.height}|${placement.thickness ?? ""}|${
      placement.article ?? ""
    }`;
    const known = bySize.get(key);
    if (known) {
      known.quantity += 1;
    } else {
      bySize.set(key, {
        width: placement.width,
        height: placement.height,
        quantity: 1,
        thickness: placement.thickness,
      });
    }
  }
  const sizeRows = [...bySize.values()];
  const visibleRows = sizeRows.slice(0, MAX_TABLE_ROWS);
  const hiddenRows = sizeRows.length - visibleRows.length;

  const headLines: [string, string][] = [
    // Номер и тип заказа — первой строкой: по ним пачку находят в цехе.
    ["Заказ:", [orderNumber, directionName].filter(Boolean).join(" · ") || "—"],
    ["Заказчик:", clamp(customer || "—", 40)],
    ["Адрес:", clamp(address || "", 40)],
    ["Материал:", clamp(materialName, 40)],
    ["Артикул:", clamp(articles.join(", "), 40)],
    ["Толщина:", sheetThickness],
    ["Дата:", createdAt || ""],
    ["Дата готовности:", dueDate || ""],
  ];

  // таблица деталей: ширины колонок в мм
  const tableColumns = [7, 15, 15, 12, 12, 30, 9];
  const tableHeaders = ["#", "Длина", "Ширина", "Кол-во", "Толщ.", "Цвет", "до"];
  const tableWidth = tableColumns.reduce((sum, value) => sum + value, 0);
  const tableX = MARGIN + CONTENT_WIDTH - tableWidth;
  const tableY = MARGIN + 8;
  const rowHeight = 4.5;

  // карта: вписываем в оставшуюся ширину, высота — по пропорции листа
  const mapY = MARGIN + HEAD_HEIGHT;
  const mapHeight = (CONTENT_WIDTH * sheet.height) / sheet.width;

  return (
    <svg
      className="map-page"
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Карта раскроя, лист ${index} из ${total}, материал ${materialName}`}
    >
      <defs>
        <pattern
          id={`hatch-${sheet.globalIndex}`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="100%" height="100%" fill="#ffffff" />
          <line x1="0" y1="0" x2="0" y2="24" stroke={LINE} strokeWidth="1.5" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />

      <g fontFamily="Arial, Helvetica, sans-serif" fill={TEXT}>
        {/* --- шапка --- */}
        {headLines.map(([caption, value], lineIndex) => {
          const y = MARGIN + 5 + lineIndex * HEAD_LINE_STEP;
          return (
            <g key={caption}>
              <text x={MARGIN} y={y} fontSize="3">
                {caption}
              </text>
              <text x={MARGIN + 26} y={y} fontSize="3" fontWeight="700">
                {value}
              </text>
              <line
                x1={MARGIN + 26}
                y1={y + 1.2}
                x2={MARGIN + 26 + 60}
                y2={y + 1.2}
                stroke={LINE}
                strokeWidth="0.2"
              />
            </g>
          );
        })}

        <text
          x={MARGIN + CONTENT_WIDTH}
          y={MARGIN + 3}
          fontSize="3.2"
          fontWeight="700"
          textAnchor="end"
        >
          Фасадное производство
        </text>
        <text x={MARGIN + CONTENT_WIDTH} y={tableY - 1.5} fontSize="3" textAnchor="end">
          Детали
        </text>

        {/* --- таблица деталей --- */}
        {tableHeaders.map((caption, columnIndex) => {
          const x = tableX + tableColumns.slice(0, columnIndex).reduce((s, v) => s + v, 0);
          return (
            <g key={caption}>
              <rect
                x={x}
                y={tableY}
                width={tableColumns[columnIndex]}
                height={rowHeight}
                fill="none"
                stroke={LINE}
                strokeWidth="0.2"
              />
              <text
                x={x + tableColumns[columnIndex] / 2}
                y={tableY + rowHeight - 1.5}
                fontSize="2.4"
                textAnchor="middle"
              >
                {caption}
              </text>
            </g>
          );
        })}
        {visibleRows.map((row, rowIndex) => {
          const y = tableY + rowHeight * (rowIndex + 1);
          const cells = [
            String(rowIndex + 1),
            mm(row.width),
            mm(row.height),
            String(row.quantity),
            row.thickness === null ? "" : thicknessText(row.thickness),
            clamp(materialName, 20),
            // колонку «до» в цехе заполняют от руки
            "",
          ];
          return (
            <g key={`${row.width}x${row.height}-${row.thickness ?? ""}-${rowIndex}`}>
              {cells.map((value, columnIndex) => {
                const x = tableX + tableColumns.slice(0, columnIndex).reduce((s, v) => s + v, 0);
                return (
                  <g key={columnIndex}>
                    <rect
                      x={x}
                      y={y}
                      width={tableColumns[columnIndex]}
                      height={rowHeight}
                      fill="none"
                      stroke={LINE}
                      strokeWidth="0.2"
                    />
                    <text
                      x={x + tableColumns[columnIndex] / 2}
                      y={y + rowHeight - 1.5}
                      fontSize="2.4"
                      textAnchor="middle"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {hiddenRows > 0 ? (
          <text
            x={MARGIN + CONTENT_WIDTH}
            y={tableY + rowHeight * (visibleRows.length + 1) + 2.5}
            fontSize="2.4"
            textAnchor="end"
          >
            и ещё {hiddenRows} размеров — полный список в бланке заказа
          </text>
        ) : null}

        {/* --- карта листа --- */}
        <svg
          x={MARGIN}
          y={mapY}
          width={CONTENT_WIDTH}
          height={mapHeight}
          viewBox={`0 0 ${sheet.width} ${sheet.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect
            x="0"
            y="0"
            width={sheet.width}
            height={sheet.height}
            fill="#d4d4d8"
            stroke={LINE}
            strokeWidth="3"
          />
          <rect
            x={sheet.marginX}
            y={sheet.marginY}
            width={sheet.workWidth}
            height={sheet.workHeight}
            fill="#ffffff"
            stroke={LINE}
            strokeWidth="2"
          />

          {sheet.remainders.map((rect, rectIndex) => (
            <g key={`rest-${rectIndex}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={`url(#hatch-${sheet.globalIndex})`}
                stroke={LINE}
                strokeWidth="1.5"
              />
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + label * 1.4}
                fontSize={label}
                textAnchor="middle"
                fill={TEXT}
              >
                {mm(rect.width)}
              </text>
            </g>
          ))}

          {sheet.placements.map((placement) => {
            // Подпись под деталью: номер детали из бланка, толщина и артикул.
            // Раньше здесь стоял порядковый номер размещения на листе — по нему
            // деталь невозможно было найти в бланке, а именно этим цех и
            // сверяется, когда пачка уехала со стола.
            const marks = [
              `#${placement.sourceNumber}`,
              placement.thickness === null ? "" : thicknessText(placement.thickness),
              placement.article ?? "",
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <g key={placement.unitId}>
                <rect
                  x={placement.x}
                  y={placement.y}
                  width={placement.width}
                  height={placement.height}
                  fill="#ffffff"
                  stroke={LINE}
                  strokeWidth="2"
                />
                {/* длина — сверху по центру, как в SketchCut */}
                <text
                  x={placement.x + placement.width / 2}
                  y={placement.y + label * 1.4}
                  fontSize={label}
                  textAnchor="middle"
                  fill={TEXT}
                >
                  {mm(placement.width)}
                </text>
                {/* ширина — вдоль правого края, повёрнутая */}
                <text
                  x={placement.x + placement.width - label * 0.5}
                  y={placement.y + placement.height / 2}
                  fontSize={label}
                  textAnchor="middle"
                  fill={TEXT}
                  transform={`rotate(90 ${placement.x + placement.width - label * 0.5} ${
                    placement.y + placement.height / 2
                  })`}
                >
                  {mm(placement.height)}
                </text>
                {/* Номер заказа на самой детали: детали разных заказов лежат на
                    одном столе, и по одной подписи «#5» их не разобрать.
                    Печатаем только там, где деталь достаточно высокая, — на
                    узкой полосе вторая строка налезла бы на первую. */}
                {orderNumber && placement.height > label * 4 ? (
                  <text
                    x={placement.x + label * 0.4}
                    y={placement.y + placement.height - label * 1.6}
                    fontSize={label * 0.6}
                    fill={TEXT}
                  >
                    {orderNumber}
                  </text>
                ) : null}
                <text
                  x={placement.x + label * 0.4}
                  y={placement.y + placement.height - label * 0.5}
                  fontSize={label * 0.75}
                  fill={TEXT}
                >
                  {marks}
                </text>
              </g>
            );
          })}
        </svg>

        {/* --- строка итогов --- */}
        <text x={MARGIN} y={mapY + mapHeight + 6} fontSize="3">
          {mm(sheet.width)} X {mm(sheet.height)} - {index} ({total}) | Кол-во - 1 | Количество
          деталей: {sheet.placements.length} | Площадь деталей: - {formatSheetArea(sheet.detailArea)}{" "}
          м.кв. | {formatPercent(sheet.fillPercent)} %
        </text>
        {/* Вторая строка — то, что режет цех: докуда дошли детали и сколько
            целой полосы остаётся справа на склад */}
        <text x={MARGIN} y={mapY + mapHeight + 10} fontSize="3">
          Длина по деталям: {sheet.usedLength} мм | Полоса справа: {sheet.freeStripWidth} мм
        </text>
      </g>
    </svg>
  );
}
