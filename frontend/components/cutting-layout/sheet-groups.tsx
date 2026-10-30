"use client";

import { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPatternByCode,
  getPatternSwatchStyle,
  type CuttingPattern,
  type LayoutGroup,
} from "@/lib/cutting-layout";

import { fallbackPattern, formatArea, formatPercent } from "./lib";
import { SheetCard } from "./sheet-card";

export function SheetGroups({
  groups,
  allSheets,
  patterns,
  hoveredSourceId,
  collapsedSheets,
  filter,
  onHover,
  onFilterChange,
  onToggleAll,
  onToggleSheet,
  onExportSheet,
  registerSvg,
}: {
  groups: LayoutGroup[];
  allSheets: Array<{ globalIndex: number; pattern: string }>;
  patterns: CuttingPattern[];
  hoveredSourceId: string | null;
  collapsedSheets: number[];
  filter: string;
  onHover: (sourceId: string | null) => void;
  onFilterChange: (value: string) => void;
  onToggleAll: () => void;
  onToggleSheet: (sheetIndex: number) => void;
  onExportSheet: (sheetIndex: number) => void;
  registerSvg: (sheetIndex: number, element: SVGSVGElement | null) => void;
}) {
  const visibleSheetIndexes = groups.flatMap((group) =>
    group.sheets.map((sheet) => sheet.globalIndex),
  );
  const allExpanded =
    visibleSheetIndexes.length > 0 &&
    visibleSheetIndexes.every((sheetIndex) => !collapsedSheets.includes(sheetIndex));

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge className="bg-amber-100 text-slate-700">Карты раскроя</Badge>
          <h2 className="text-xl font-semibold text-slate-900">SVG preview по материалам</h2>
          <p className="text-sm leading-6 text-slate-700">
            Детали разных материалов не смешиваются в одном листе. Можно отфильтровать карту,
            экспортировать SVG и смотреть координаты размещения по каждой карте.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="flex h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
          >
            <option value="all">Показать все карты</option>
            {allSheets.map((sheet) => (
              <option key={sheet.globalIndex} value={String(sheet.globalIndex)}>
                Карта {sheet.globalIndex} · {getPatternByCode(patterns, sheet.pattern)?.name ?? sheet.pattern}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={onToggleAll}>
            {allExpanded ? "Свернуть все карты" : "Развернуть все карты"}
          </Button>
        </div>
      </div>

      {groups.length ? (
        <div className="space-y-6">
          {groups.map((group) => {
            const pattern = getPatternByCode(patterns, group.pattern) ?? fallbackPattern;
            return (
              <section key={group.pattern} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-11 w-11 rounded-2xl border border-slate-200"
                      style={getPatternSwatchStyle(pattern) as CSSProperties}
                    />
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{pattern.name}</p>
                      <p className="text-sm text-slate-500">
                        {group.stats.sheetCount} карт · {group.stats.requestedCount} деталей · свободный
                        остаток {formatArea(group.stats.freeArea)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700">
                    Заполнение группы:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatPercent(group.stats.fillPercent)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {group.sheets.map((sheet) => (
                    <SheetCard
                      key={sheet.globalIndex}
                      sheet={sheet}
                      patterns={patterns}
                      collapsed={collapsedSheets.includes(sheet.globalIndex)}
                      onToggle={() => onToggleSheet(sheet.globalIndex)}
                      onExport={() => onExportSheet(sheet.globalIndex)}
                      highlightedSourceId={hoveredSourceId}
                      onHover={onHover}
                      svgRef={(element) => registerSvg(sheet.globalIndex, element)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          Добавь хотя бы одну деталь, чтобы увидеть карты раскроя.
        </div>
      )}
    </Card>
  );
}
