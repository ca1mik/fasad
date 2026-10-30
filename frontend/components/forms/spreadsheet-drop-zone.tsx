"use client";

import { FileSpreadsheet, Loader2, Trash2, Upload, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatFileSize } from "@/lib/format";
import { positivePartQuantity } from "@/lib/part-quantity";
import { cn } from "@/lib/utils";

const ACCEPTED = ".xls,.xlsx,.csv";
const ACCEPTED_EXTENSIONS = ["xls", "xlsx", "csv"];

type ImportedPart = {
  width: number;
  height: number;
  quantity: number;
  thickness: string | null;
  milling: string | null;
  color: string | null;
};

export type PartsImport = {
  file_name: string;
  sheet_name: string | null;
  customer: string | null;
  order_number: string | null;
  parts: ImportedPart[];
  total_quantity: number;
  total_area_sqm: string;
  size_lines: string;
};

/**
 * Строка таблицы предпросмотра.
 *
 * Числа держим строками: пока менеджер стирает «610», чтобы набрать «620»,
 * поле проходит через пустое значение — с числовым состоянием оно бы прыгало
 * в 0 и мешало печатать.
 */
type EditableRow = {
  id: number;
  width: string;
  height: string;
  quantity: string;
  thickness: string;
  milling: string;
  color: string;
};

type Props = {
  title?: string;
  hint?: string;
  className?: string;
  /** Куда отдать разбор: размеры строками там в том же формате, что набирают руками. */
  onParsed?: (result: PartsImport) => void;
};

/** Текстовая ячейка предпросмотра. Числовые берут общий `NumberInput`. */
const cellInputClass =
  "h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none transition focus:border-amber-400";

/** Запятая в размерах — обычное дело для бланка из Excel, поэтому её не отвергаем. */
function toNumber(value: string) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Количество деталей — только целое.
 *
 * Округляем в одном месте и считаем этим числом всё: итоги, площадь и выгрузку.
 * Иначе описка «1,4» показывала бы на экране площадь на 1.4 детали, а наружу
 * уходила бы одна, а «0,4» и вовсе давало бы позицию с количеством 0.
 */
function rowQuantity(row: EditableRow) {
  return positivePartQuantity(row.quantity);
}

function rowArea(row: EditableRow) {
  return (toNumber(row.width) * toNumber(row.height) * rowQuantity(row)) / 1_000_000;
}

/** Позиция без размеров или без количества до раскроя не доедет — её подсвечиваем. */
function isRowValid(row: EditableRow) {
  return toNumber(row.width) > 0 && toNumber(row.height) > 0 && rowQuantity(row) > 0;
}

/**
 * Окно для файлов Excel: приём перетаскиванием и выбором из проводника.
 *
 * Файл уходит на разбор в `POST /imports/parts` и ничего не сохраняет — менеджер
 * сначала правит таблицу предпросмотра, и только потом подставляет размеры.
 * Заказчик присылает бланк, где позиции идут двумя таблицами рядом на одном
 * листе, а колонка количества без заголовка, поэтому разбор живёт на сервере.
 *
 * Толщина, фрезеровка и цвет в бланке написаны как попало («Эмаль RAL 9003
 * плита 19мм»), а размеры заказчик иногда путает — правка идёт прямо в таблице,
 * до создания заявки. Наружу уходят уже отредактированные данные в том же
 * формате `PartsImport`, что приходит с сервера: вызывающим местам менять
 * ничего не нужно.
 */
export function SpreadsheetDropZone({
  title = "Загрузить список из Excel",
  hint = "Перетащите файл .xlsx, .xls или .csv в это окно",
  className,
  onParsed,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<PartsImport | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const valid = rows.filter(isRowValid);
    return {
      positions: rows.length,
      quantity: valid.reduce((sum, row) => sum + rowQuantity(row), 0),
      areaSqm: valid.reduce((sum, row) => sum + rowArea(row), 0),
      invalid: rows.length - valid.length,
    };
  }, [rows]);

  async function accept(candidate: File | undefined) {
    if (!candidate) {
      return;
    }
    const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setFile(null);
      setParsed(null);
      setRows([]);
      setError(`Нужен файл .xlsx, .xls или .csv, а этот — .${extension || "без расширения"}`);
      return;
    }

    setFile(candidate);
    setParsed(null);
    setRows([]);
    setError(null);
    setIsParsing(true);
    try {
      const body = new FormData();
      body.append("file", candidate);
      const response = await clientRequest<{ data: PartsImport }>("/imports/parts", {
        method: "POST",
        body,
      });
      setParsed(response.data);
      setRows(
        response.data.parts.map((part, index) => ({
          id: index,
          width: String(part.width),
          height: String(part.height),
          quantity: String(part.quantity),
          thickness: part.thickness ?? "",
          milling: part.milling ?? "",
          color: part.color ?? "",
        })),
      );
    } catch (requestError) {
      // причину разбора формулирует сервер — он один видел содержимое файла
      setError(requestError instanceof Error ? requestError.message : "Не удалось разобрать файл");
    } finally {
      setIsParsing(false);
    }
  }

  function updateRow(id: number, field: keyof Omit<EditableRow, "id">, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function clear() {
    setFile(null);
    setParsed(null);
    setRows([]);
    setError(null);
    setIsParsing(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  /** Собираем ответ сервера заново из правок: формат наружу остаётся прежним. */
  function buildResult(source: PartsImport): PartsImport {
    const parts: ImportedPart[] = rows.filter(isRowValid).map((row) => ({
      width: toNumber(row.width),
      height: toNumber(row.height),
      quantity: rowQuantity(row),
      thickness: trimOrNull(row.thickness),
      milling: trimOrNull(row.milling),
      color: trimOrNull(row.color),
    }));

    return {
      ...source,
      parts,
      total_quantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      total_area_sqm: (
        parts.reduce((sum, part) => sum + part.width * part.height * part.quantity, 0) / 1_000_000
      ).toFixed(3),
      // тот же формат, что менеджер набирает руками в поле «Размеры списком»
      size_lines: parts.map((part) => `${part.width} ${part.height} ${part.quantity}`).join("\n"),
    };
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          void accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-6 text-center transition",
          isOver ? "border-amber-400 bg-amber-100/60" : "border-slate-300 bg-slate-50",
        )}
      >
        <FileSpreadsheet className="mx-auto h-7 w-7 text-slate-500" />
        <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(event) => void accept(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={isParsing}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Выбрать файл
        </Button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="num mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} title="Убрать файл">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isParsing ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Разбираем таблицу…
            </p>
          ) : null}

          {parsed ? (
            <div className="space-y-3">
              {parsed.customer || parsed.order_number ? (
                <dl className="grid gap-x-4 gap-y-1 text-xs">
                  {parsed.customer ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Заказчик</dt>
                      <dd className="truncate font-medium text-slate-900">{parsed.customer}</dd>
                    </div>
                  ) : null}
                  {parsed.order_number ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Бланк заказа</dt>
                      <dd className="num font-medium text-slate-900">{parsed.order_number}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <p className="text-xs text-slate-500">
                Проверьте позиции и поправьте прямо в таблице — в заявку уйдёт то, что здесь.
              </p>

              {rows.length ? (
                <>
                  {/* Один контейнер прокрутки на обе оси: на телефоне таблица
                      едет вбок внутри карточки, а длинный бланк на 37 позиций
                      не растягивает страницу */}
                  <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                    {/* Минимум таблицы — сумма ширин колонок (888). Прежние 720
                        были меньше суммы, и браузер добирал недостающее с
                        числовых колонок: в «Длине» вместо «1 200» оставалось
                        «200». Ширина и минимум у колонки идут вместе — `width`
                        при обычной раскладке только пожелание. */}
                    <table className="w-full min-w-[888px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                        <tr className="border-b border-slate-200 [&>th]:whitespace-nowrap">
                          <th className="w-10 min-w-[40px] px-2 py-2 text-center font-semibold">№</th>
                          <th className="w-24 min-w-[96px] px-2 py-2 text-right font-semibold">Длина</th>
                          <th className="w-24 min-w-[96px] px-2 py-2 text-right font-semibold">Ширина</th>
                          <th className="w-20 min-w-[80px] px-2 py-2 text-right font-semibold">Кол-во</th>
                          {/* «М2» — как в бумажном бланке, в таблице заявки и в
                              смете: одна величина подписана везде одинаково */}
                          <th className="w-[88px] min-w-[88px] px-2 py-2 text-right font-semibold">М2</th>
                          <th className="w-24 min-w-[96px] px-2 py-2 font-semibold">Толщина</th>
                          <th className="w-40 min-w-[160px] px-2 py-2 font-semibold">Фрезеровка</th>
                          <th className="w-48 min-w-[192px] px-2 py-2 font-semibold">Цвет</th>
                          <th className="w-10 min-w-[40px] px-2 py-2">
                            <span className="sr-only">Удалить</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, index) => {
                          const invalid = !isRowValid(row);
                          const invalidClass = invalid ? "border-red-400" : undefined;
                          return (
                            <tr key={row.id} className={cn(invalid && "bg-red-50/60")}>
                              <td className="num px-2 py-1.5 text-center text-slate-400">
                                {index + 1}
                              </td>
                              <td className="px-2 py-1.5">
                                <NumberInput
                                  density="compact"
                                  className={invalidClass}
                                  aria-label={`Длина позиции ${index + 1}`}
                                  value={row.width}
                                  onChange={(event) =>
                                    updateRow(row.id, "width", event.target.value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <NumberInput
                                  density="compact"
                                  className={invalidClass}
                                  aria-label={`Ширина позиции ${index + 1}`}
                                  value={row.height}
                                  onChange={(event) =>
                                    updateRow(row.id, "height", event.target.value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <NumberInput
                                  density="compact"
                                  measure="qty"
                                  inputMode="numeric"
                                  className={invalidClass}
                                  aria-label={`Количество позиции ${index + 1}`}
                                  value={row.quantity}
                                  onChange={(event) =>
                                    updateRow(row.id, "quantity", event.target.value)
                                  }
                                />
                              </td>
                              {/* у подсвеченной строки площади нет: она не идёт
                                  в итоги, а «-0.420» из минусового размера
                                  только сбивало бы с толку */}
                              <td className="num px-2 py-1.5 text-right text-slate-500">
                                {invalid ? "—" : rowArea(row).toFixed(3)}
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={cellInputClass}
                                  aria-label={`Толщина позиции ${index + 1}`}
                                  placeholder="19"
                                  value={row.thickness}
                                  onChange={(event) =>
                                    updateRow(row.id, "thickness", event.target.value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={cellInputClass}
                                  aria-label={`Фрезеровка позиции ${index + 1}`}
                                  placeholder="фрез"
                                  value={row.milling}
                                  onChange={(event) =>
                                    updateRow(row.id, "milling", event.target.value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={cellInputClass}
                                  aria-label={`Цвет позиции ${index + 1}`}
                                  placeholder="Эмаль RAL 9003"
                                  value={row.color}
                                  onChange={(event) =>
                                    updateRow(row.id, "color", event.target.value)
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                  title={`Удалить позицию ${index + 1}`}
                                  onClick={() => removeRow(row.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Удалить позицию {index + 1}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <span>
                      Позиций: <span className="num font-medium text-slate-900">{totals.positions}</span>
                    </span>
                    <span>
                      Деталей:{" "}
                      <span className="num font-medium text-slate-900">{totals.quantity}</span> шт.
                    </span>
                    <span>
                      Площадь:{" "}
                      <span className="num font-medium text-slate-900">
                        {totals.areaSqm.toFixed(3)}
                      </span>{" "}
                      м²
                    </span>
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Позиций не осталось — удалили все строки. Загрузите файл заново.
                </p>
              )}

              {totals.invalid ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  Подсвеченные строки ({totals.invalid} шт.) не уйдут в заявку: длина, ширина и
                  количество должно быть целым числом больше нуля, размеры — больше нуля.
                </p>
              ) : null}

              {onParsed ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={!totals.quantity}
                  onClick={() => onParsed(buildResult(parsed))}
                >
                  Подставить размеры ({totals.quantity} шт.)
                </Button>
              ) : (
                <p className="text-xs text-slate-500">
                  Скопируйте размеры в поле «Размеры списком» при создании заявки.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
