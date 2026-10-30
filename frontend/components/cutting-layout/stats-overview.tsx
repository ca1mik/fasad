"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { MetricCard, algorithmOptions, formatArea, formatPercent } from "./lib";

export function StatsOverview({
  stats,
  rowCount,
  algorithm,
}: {
  stats: {
    sheetCount: number;
    groupCount: number;
    requestedCount: number;
    detailArea: number;
    freeArea: number;
    gapArea: number;
    marginArea: number;
    placedCount: number;
    unplacedCount: number;
    fillPercent: number;
  };
  rowCount: number;
  algorithm: "leftEdge" | "byLength" | "byWidth" | "optimal";
}) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <Badge className="bg-amber-100 text-slate-700">Статистика</Badge>
        <h2 className="text-xl font-semibold text-slate-900">Сводка по текущему раскрою</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Карт" value={String(stats.sheetCount)} />
        <MetricCard label="Материалов" value={String(stats.groupCount)} />
        <MetricCard label="Деталей всего" value={String(stats.requestedCount)} />
        <MetricCard label="Строк в списке" value={String(rowCount)} />
        <MetricCard label="Площадь деталей" value={formatArea(stats.detailArea)} />
        <MetricCard label="Свободный остаток" value={formatArea(stats.freeArea)} />
        <MetricCard label="Площадь зазоров" value={formatArea(stats.gapArea)} />
        <MetricCard label="Отступы по краям" value={formatArea(stats.marginArea)} />
        <MetricCard label="Размещено" value={String(stats.placedCount)} />
        <MetricCard label="Не размещено" value={String(stats.unplacedCount)} />
        <MetricCard label="Заполнение" value={formatPercent(stats.fillPercent)} />
        <MetricCard
          label="Алгоритм"
          value={algorithmOptions.find((item) => item.value === algorithm)?.label ?? "-"}
        />
      </div>
    </Card>
  );
}
