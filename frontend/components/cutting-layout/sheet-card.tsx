"use client";

import { CSSProperties } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  getPatternByCode,
  getPatternSwatchStyle,
  type CuttingPattern,
  type LayoutSheetView,
} from "@/lib/cutting-layout";

import { MetricCard, fallbackPattern, formatArea, formatPercent, formatSize } from "./lib";
import { SheetSvg } from "./sheet-svg";

export function SheetCard({
  sheet,
  patterns,
  collapsed,
  onToggle,
  onExport,
  highlightedSourceId,
  onHover,
  svgRef,
  orderNumber = null,
}: {
  sheet: LayoutSheetView;
  patterns: CuttingPattern[];
  collapsed: boolean;
  onToggle: () => void;
  onExport: () => void;
  highlightedSourceId: string | null;
  onHover: (sourceId: string | null) => void;
  svgRef: (element: SVGSVGElement | null) => void;
  /** Номер заказа или заявки — печатается на каждой детали. */
  orderNumber?: string | null;
}) {
  const material = getPatternByCode(patterns, sheet.pattern) ?? fallbackPattern;
  const sortedPlacements = [...sheet.placements].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );
  const sortedRemainders = [...sheet.remainders]
    .sort((left, right) => right.width * right.height - left.width * left.height)
    .slice(0, 8);

  return (
    <Card className="space-y-5 border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-50 text-slate-700">Карта {sheet.globalIndex}</Badge>
            <Badge className="bg-amber-100 text-slate-700">
              {material.name} · лист {sheet.localIndex}
            </Badge>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {Math.round(sheet.width)} × {Math.round(sheet.height)} мм
            </h3>
            <p className="text-sm text-slate-500">
              Рабочая зона {Math.round(sheet.workWidth)} × {Math.round(sheet.workHeight)} мм ·
              заполнение {formatPercent(sheet.fillPercent)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            SVG
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {collapsed ? (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Развернуть
              </>
            ) : (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Свернуть
              </>
            )}
          </Button>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-5">
          <SheetSvg
            sheet={sheet}
            patterns={patterns}
            highlightedSourceId={highlightedSourceId}
            onHover={onHover}
            svgRef={svgRef}
            orderNumber={orderNumber}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Детали" value={formatArea(sheet.detailArea)} />
            <MetricCard label="Зазоры" value={formatArea(sheet.gapArea)} />
            <MetricCard label="Свободный остаток" value={formatArea(sheet.freeArea)} />
            <MetricCard label="Заполнение" value={formatPercent(sheet.fillPercent)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="rounded-2xl border border-slate-200">
              <Table>
                <THead>
                  <TR>
                    <TH>Деталь</TH>
                    <TH>X</TH>
                    <TH>Y</TH>
                    <TH>Размер</TH>
                    <TH>Зазор</TH>
                    <TH>Материал</TH>
                  </TR>
                </THead>
                <TBody>
                  {sortedPlacements.map((placement) => {
                    const pattern =
                      getPatternByCode(patterns, placement.pattern) ?? fallbackPattern;
                    const swatchStyle = getPatternSwatchStyle(pattern) as CSSProperties;
                    const isHighlighted = highlightedSourceId === placement.sourceId;

                    return (
                      <TR
                        key={placement.unitId}
                        className={isHighlighted ? "bg-amber-100" : undefined}
                        onMouseEnter={() => onHover(placement.sourceId)}
                        onMouseLeave={() => onHover(null)}
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
                        <TD>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-5 w-5 rounded-full border border-slate-200"
                              style={swatchStyle}
                            />
                            {pattern.name}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Остатки листа</p>
                <p className="text-xs text-slate-500">
                  Крупнейшие свободные прямоугольники после раскроя.
                </p>
              </div>
              {sortedRemainders.length ? (
                <div className="space-y-2">
                  {sortedRemainders.map((rect, index) => (
                    <div
                      key={`${sheet.globalIndex}-rem-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>Остаток {index + 1}</span>
                        <span>{formatArea((rect.width * rect.height) / 1_000_000)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {Math.round(rect.width)} × {Math.round(rect.height)} мм · x {Math.round(rect.x)},
                        {" "}y {Math.round(rect.y)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Свободных остатков не осталось.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
