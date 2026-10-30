"use client";

import { Grid3x3, Layers3, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AlgorithmInfo = {
  value: "leftEdge" | "byLength" | "byWidth" | "optimal";
  label: string;
  description: string;
};

export function DeskSidebar({
  showGrid,
  sheetWidth,
  sheetHeight,
  algorithmLabel,
  algorithmDescriptions,
  activeAlgorithm,
  defaultGapX,
  defaultGapY,
  totalDrafts,
  onToggleGrid,
  onApplyGapToAll,
  onResetCustomGaps,
  onRotateAll,
  allRotated,
  onAddEmpty,
}: {
  showGrid: boolean;
  sheetWidth: number;
  sheetHeight: number;
  algorithmLabel: string;
  algorithmDescriptions: AlgorithmInfo[];
  activeAlgorithm: AlgorithmInfo["value"];
  defaultGapX: string;
  defaultGapY: string;
  totalDrafts: number;
  onToggleGrid: (value: boolean) => void;
  onApplyGapToAll: () => void;
  onResetCustomGaps: () => void;
  /** Развернуть все детали на 90° разом — и вернуть обратно тем же нажатием. */
  onRotateAll: () => void;
  /** Все детали уже развёрнуты: кнопка подсвечена и вернёт их в исходное. */
  allRotated: boolean;
  onAddEmpty: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Badge className="bg-slate-50 text-slate-700">Быстрые функции</Badge>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {totalDrafts} деталей
            </div>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Полотно</span>
              <span className="font-semibold text-slate-900">
                {Math.round(sheetWidth)} × {Math.round(sheetHeight)} мм
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Алгоритм</span>
              <span className="font-semibold text-slate-900">{algorithmLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Общий зазор</span>
              <span className="font-semibold text-slate-900">
                {defaultGapX} / {defaultGapY} мм
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant={showGrid ? "secondary" : "outline"} onClick={() => onToggleGrid(true)}>
            <Grid3x3 className="mr-2 h-4 w-4" />
            Сетка
          </Button>
          <Button variant={showGrid ? "outline" : "secondary"} onClick={() => onToggleGrid(false)}>
            <Layers3 className="mr-2 h-4 w-4" />
            Без сетки
          </Button>
          <Button variant="outline" onClick={onApplyGapToAll}>
            Применить зазор ко всем
          </Button>
          <Button variant="ghost" onClick={onResetCustomGaps}>
            Сбросить индивидуальные зазоры
          </Button>
        </div>

        {/* Разворот всей пачки: у фасадов одного заказа направление обычно
            общее, и щёлкать поворот у каждой детали в списке — это сорок
            нажатий на заказ. */}
        <Button
          variant={allRotated ? "secondary" : "outline"}
          className="w-full"
          onClick={onRotateAll}
          disabled={totalDrafts === 0}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          {allRotated ? "Вернуть все детали" : "Повернуть все детали"}
        </Button>

        <Button variant="ghost" className="w-full" onClick={onAddEmpty}>
          Добавить пустую деталь
        </Button>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <Badge className="bg-amber-100 text-slate-700">Алгоритм раскладки</Badge>
          <h3 className="text-lg font-semibold text-slate-900">Как работает выбор алгоритма</h3>
          <p className="text-sm leading-6 text-slate-700">
            Это влияет только на порядок и способ укладки деталей внутри свободных зон листа.
          </p>
        </div>

        <div className="space-y-3">
          {algorithmDescriptions.map((item) => {
            const isActive = item.value === activeAlgorithm;
            return (
              <div
                key={item.value}
                className={[
                  "rounded-2xl border p-4",
                  isActive
                    ? "border-amber-400 bg-amber-100"
                    : "border-slate-200 bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  {isActive ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-slate-900">
                      Сейчас выбран
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
