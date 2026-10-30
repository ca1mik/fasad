"use client";

import { LayoutGrid, Plus } from "lucide-react";

import {
  SpreadsheetDropZone,
  type PartsImport,
} from "@/components/forms/spreadsheet-drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BulkImportError } from "@/lib/cutting-layout";

/**
 * Ввод деталей — первое, что видит менеджер в раскрое.
 *
 * Раньше поле массового ввода лежало под всеми картами, поэтому размеры
 * набивали по одной детали. Теперь список строками стоит над картой: набрал
 * «560 123 3» — сразу видно раскладку.
 */
export function BulkImportCard({
  bulkInput,
  errors,
  partsCount,
  onChange,
  onImport,
  onImportFile,
  onClear,
  onAddEmpty,
}: {
  bulkInput: string;
  errors: BulkImportError[];
  partsCount: number;
  onChange: (value: string) => void;
  onImport: () => void;
  onImportFile: (result: PartsImport) => void;
  onClear: () => void;
  onAddEmpty: () => void;
}) {
  return (
    <Card className="space-y-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-slate-700">Внести детали</Badge>
            <Badge className="bg-slate-50 text-slate-700">{partsCount} шт. в раскрое</Badge>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Список размеров строками</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-700">
            Одна строка — одна позиция: длина, ширина и количество. Количество разворачивается в
            отдельные детали. Размеры можно поправить в таблице ниже, а размещённую деталь — нажатием на карту.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="space-y-2 text-sm text-slate-700" htmlFor="bulk-parts-input">
            <span className="font-medium text-slate-900">Размеры</span>
            <textarea
              id="bulk-parts-input"
              className="min-h-44 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-amber-400"
              value={bulkInput}
              onChange={(event) => onChange(event.target.value)}
              placeholder={"560 123 3\n610 120 5\n1246x436x2"}
              spellCheck={false}
            />
          </label>

          <p className="text-xs text-slate-500">
            Разделитель любой: пробел, <code>x</code> или <code>*</code>. Если количество не указано,
            берётся 1.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onImport}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Добавить в раскрой
            </Button>
            <Button variant="outline" onClick={onAddEmpty}>
              <Plus className="mr-2 h-4 w-4" />
              Пустая деталь
            </Button>
            <Button variant="ghost" onClick={onClear}>
              Очистить поле
            </Button>
          </div>

          {errors.length ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-600">Не удалось разобрать часть строк</p>
              <div className="mt-2 space-y-1 text-sm text-red-600">
                {errors.map((item) => (
                  <div key={`${item.line}-${item.source}`}>
                    {item.line > 0 ? `Строка ${item.line}: ${item.source} — ` : ""}{item.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <SpreadsheetDropZone
          title="Или загрузите файл Excel"
          hint="Перетащите .xlsx, .xls или .csv со списком деталей"
          onParsed={onImportFile}
        />
      </div>
    </Card>
  );
}
