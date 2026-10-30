"use client";

import { CSSProperties, ReactNode, useMemo } from "react";
import { ChevronDown, Download, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  getPatternByCode,
  getPatternSwatchStyle,
  type CuttingPattern,
  type LayoutGroup,
  type LayoutSheetView,
} from "@/lib/cutting-layout";

import { fallbackPattern, formatArea, formatPercent, formatSize, MetricCard } from "./lib";
import { SheetSvg } from "./sheet-svg";

export function SheetWorkspace({
  groups,
  patterns,
  previewSheet,
  activeSheetIndex,
  patternFilter,
  highlightedSourceId,
  showGrid,
  asideContent,
  onPatternFilterChange,
  onActiveSheetChange,
  onHover,
  onSelectPlacement,
  onExportSheet,
  registerSvg,
  orderNumber = null,
}: {
  groups: LayoutGroup[];
  patterns: CuttingPattern[];
  previewSheet: LayoutSheetView | null;
  activeSheetIndex: number | null;
  patternFilter: string;
  highlightedSourceId: string | null;
  showGrid: boolean;
  asideContent?: ReactNode;
  onPatternFilterChange: (value: string) => void;
  onActiveSheetChange: (sheetIndex: number) => void;
  onHover: (sourceId: string | null) => void;
  onSelectPlacement: (sourceId: string) => void;
  onExportSheet: (sheetIndex: number) => void;
  registerSvg: (sheetIndex: number, element: SVGSVGElement | null) => void;
  /** Номер заказа или заявки — печатается на каждой детали карты. */
  orderNumber?: string | null;
}) {
  const filteredGroups = useMemo(
    () => (patternFilter === "all" ? groups : groups.filter((group) => group.pattern === patternFilter)),
    [groups, patternFilter],
  );

  const filteredSheets = useMemo(() => filteredGroups.flatMap((group) => group.sheets), [filteredGroups]);

  const activeSheet =
    filteredSheets.find((sheet) => sheet.globalIndex === activeSheetIndex) ??
    filteredSheets[0] ??
    previewSheet;
  const activePattern = activeSheet
    ? getPatternByCode(patterns, activeSheet.pattern) ?? fallbackPattern
    : fallbackPattern;
  const swatchStyle = getPatternSwatchStyle(activePattern) as CSSProperties;
  const placements = activeSheet
    ? [...activeSheet.placements].sort((left, right) => left.y - right.y || left.x - right.x)
    : [];
  const remainders = activeSheet
    ? [...activeSheet.remainders]
        .sort((left, right) => right.width * right.height - left.width * left.height)
        .slice(0, 10)
    : [];

  return (
    <Card className="space-y-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-slate-700">Карта раскроя</Badge>
            {activeSheet ? (
              <Badge className="bg-slate-50 text-slate-700">Карта {activeSheet.globalIndex}</Badge>
            ) : null}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Полотно и размещение деталей</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Кликни по детали на карте, чтобы увидеть и изменить её размеры, зазоры и материал.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="flex h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
            value={patternFilter}
            onChange={(event) => onPatternFilterChange(event.target.value)}
          >
            <option value="all">Все материалы</option>
            {groups.map((group) => {
              const pattern = getPatternByCode(patterns, group.pattern) ?? fallbackPattern;
              return (
                <option key={group.pattern} value={group.pattern}>
                  {pattern.name}
                </option>
              );
            })}
          </select>
          {activeSheet ? (
            <Button variant="outline" onClick={() => onExportSheet(activeSheet.globalIndex)}>
              <Download className="mr-2 h-4 w-4" />
              SVG активной карты
            </Button>
          ) : null}
        </div>
      </div>

      {activeSheet ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-slate-50 text-slate-700">Карта {activeSheet.globalIndex}</Badge>
                <Badge className="bg-amber-100 text-slate-700">
                  {activePattern.name} · лист {activeSheet.localIndex}
                </Badge>
                <Badge className="bg-slate-50 text-slate-700">
                  Заполнение {formatPercent(activeSheet.fillPercent)}
                </Badge>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white p-4">
                <SheetSvg
                  sheet={activeSheet}
                  patterns={patterns}
                  highlightedSourceId={highlightedSourceId}
                  onHover={onHover}
                  onSelectPlacement={onSelectPlacement}
                  svgRef={(element) => registerSvg(activeSheet.globalIndex, element)}
                  showGrid={showGrid}
                  orderNumber={orderNumber}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="Лист" value={formatSize(activeSheet.width, activeSheet.height)} />
                <MetricCard
                  label="Рабочая зона"
                  value={formatSize(activeSheet.workWidth, activeSheet.workHeight)}
                />
                {/* Докуда реально дошли детали — по этой метке цех отрезает
                    использованную часть листа от целого остатка */}
                <MetricCard
                  label="Длина по деталям"
                  value={`${activeSheet.usedLength} мм`}
                  hint="занято деталями"
                />
                {/* Незанятый край листа. Раскладка забивает все листы, кроме
                    последнего, по максимуму, поэтому широкой эта полоса бывает
                    только на последнем листе — именно её возвращают на склад. */}
                <MetricCard
                  label="Полоса справа"
                  value={`${activeSheet.freeStripWidth} мм`}
                  hint="незанятый край листа"
                />
                <MetricCard label="Свободный остаток" value={formatArea(activeSheet.freeArea)} />
              </div>

              {/* Полосу карт показываем, только когда карты действительно есть:
                  на пустом раскрое рядом с надписью «Карт пока нет» висела
                  карточка «Карта 1», и это читалось как противоречие */}
              <div className={filteredSheets.length ? "space-y-3" : "hidden"}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Все карты</p>
                    <p className="text-xs text-slate-500">
                      Переключайся между листами, если детали разложились на несколько карт.
                    </p>
                  </div>
                  <div className="text-sm text-slate-500">Карт: {filteredSheets.length}</div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  {(filteredSheets.length ? filteredSheets : activeSheet ? [activeSheet] : []).map((sheet) => {
                    const pattern = getPatternByCode(patterns, sheet.pattern) ?? fallbackPattern;
                    const isActive = activeSheet.globalIndex === sheet.globalIndex;

                    return (
                      <button
                        key={sheet.globalIndex}
                        type="button"
                        className={[
                          "w-[240px] shrink-0 rounded-2xl border p-3 text-left transition",
                          isActive
                            ? "border-amber-400 bg-amber-400 text-slate-900"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        ].join(" ")}
                        onClick={() => onActiveSheetChange(sheet.globalIndex)}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Карта {sheet.globalIndex}</p>
                            <p className={isActive ? "text-xs text-slate-900/75" : "text-xs text-slate-500"}>
                              {pattern.name}
                            </p>
                          </div>
                          <span className={isActive ? "num text-xs text-slate-900/75" : "num text-xs text-slate-500"}>
                            {formatPercent(sheet.fillPercent)}
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <SheetSvg
                            sheet={sheet}
                            patterns={patterns}
                            highlightedSourceId={null}
                            onHover={() => undefined}
                            svgRef={() => undefined}
                            compact
                            showGrid={false}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 rounded-2xl border border-slate-200" style={swatchStyle} />
                  <div>
                    <p className="text-sm text-slate-500">Материал активной карты</p>
                    <p className="text-lg font-semibold text-slate-900">{activePattern.name}</p>
                  </div>
                </div>
              </div>

              {asideContent}
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Layers3 className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Координаты размещения</p>
                  <p className="text-xs text-slate-500">
                    Открой, если нужно проверить точные позиции деталей на листе.
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
              <Table>
                <THead>
                  <TR>
                    <TH>Деталь</TH>
                    <TH>X</TH>
                    <TH>Y</TH>
                    <TH>Размер</TH>
                    <TH>Зазор</TH>
                    <TH>Лист</TH>
                    <TH>Материал</TH>
                  </TR>
                </THead>
                <TBody>
                  {placements.length ? (
                    placements.map((placement) => {
                      const pattern = getPatternByCode(patterns, placement.pattern) ?? fallbackPattern;
                      const placementSwatch = getPatternSwatchStyle(pattern) as CSSProperties;
                      const isHighlighted = highlightedSourceId === placement.sourceId;

                      return (
                        <TR
                          key={placement.unitId}
                          className={isHighlighted ? "bg-amber-100" : undefined}
                          onMouseEnter={() => onHover(placement.sourceId)}
                          onMouseLeave={() => onHover(null)}
                          onClick={() => onSelectPlacement(placement.sourceId)}
                        >
                          <TD className="font-medium text-slate-900">
                            <div>{placement.sourceName}</div>
                            <div className="text-xs text-slate-500">
                              {placement.rotated ? "Повернуто" : "Без поворота"}
                            </div>
                          </TD>
                          <TD>{Math.round(placement.x)}</TD>
                          <TD>{Math.round(placement.y)}</TD>
                          <TD>{formatSize(placement.width, placement.height)}</TD>
                          <TD>
                            {placement.gapX}/{placement.gapY} мм
                          </TD>
                          <TD>{placement.preferredSheet ? placement.preferredSheet : "Авто"}</TD>
                          <TD>
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full border border-slate-200" style={placementSwatch} />
                              {pattern.name}
                            </div>
                          </TD>
                        </TR>
                      );
                    })
                  ) : (
                    <TR>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Координаты появятся после размещения деталей на листе.
                      </td>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Остатки листа</p>
                <p className="text-xs text-slate-500">
                  Открой, если нужно посмотреть свободные прямоугольники после раскроя.
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {remainders.length ? (
                remainders.map((rect, index) => (
                  <div
                    key={`${activeSheet.globalIndex}-remainder-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>Остаток {index + 1}</span>
                      <span>{formatArea((rect.width * rect.height) / 1_000_000)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {Math.round(rect.width)} × {Math.round(rect.height)} мм · x {Math.round(rect.x)},
                      y {Math.round(rect.y)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Свободных крупных остатков пока нет.</p>
              )}
            </div>
          </details>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">Пока нет карты раскроя</p>
          <p className="mt-2 text-sm text-slate-500">
            Добавь детали, и система сразу построит листы размещения.
          </p>
        </div>
      )}
    </Card>
  );
}
