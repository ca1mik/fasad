"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/api";

type Props = {
  orderId: string;
  statuses: OrderStatus[];
  currentStatusCode: string | null;
};

/** Разбирает отказ сервера в текст для менеджера. */
function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось выполнить действие";
}

const ORDER_TASKS = [
  { path: "generate-parts", label: "Сгенерировать детали", variant: "secondary" as const },
  { path: "calculate", label: "Рассчитать стоимость", variant: "default" as const },
  { path: "export-cutting", label: "Выгрузить раскрой", variant: "outline" as const },
  { path: "generate-cnc", label: "Сформировать файлы ЧПУ", variant: "outline" as const },
  { path: "reserve-stock", label: "Зарезервировать материал", variant: "outline" as const },
  { path: "writeoff-stock", label: "Списать материал", variant: "outline" as const },
];

export function OrderActions({ orderId, statuses, currentStatusCode }: Props) {
  const router = useRouter();

  const task = useMutation({
    mutationFn: async (path: string) => clientRequest(`/orders/${orderId}/${path}`, { method: "POST" }),
    onSuccess: () => router.refresh(),
  });

  // Отдельная мутация под статус: нажатая кнопка должна показать «Перевожу...»
  // именно на себе, а не гасить весь блок действий.
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const statusChange = useMutation({
    mutationFn: async (statusCode: string) =>
      clientRequest(`/orders/${orderId}/change-status`, {
        method: "POST",
        body: JSON.stringify({ status_code: statusCode }),
      }),
    onSuccess: () => router.refresh(),
    onSettled: () => setPendingStatus(null),
  });

  return (
    <div className="space-y-6">
      {/* Свёрнуто по умолчанию: заказчик — «убрать таблетки сгенерировать
          детали рассчитать стоимость и т.д.». Это не лишние кнопки — раскрой
          и резерв материала сами досчитают детали и подставят актуальную
          смету, если их нажать напрямую (см. подсказку внутри), — но на
          главном экране заказа они только пугали лишним выбором. */}
      <details className="group rounded-2xl border border-slate-200">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-700 marker:content-none">
          <span className="inline-flex items-center gap-2">
            Технические действия
            <span className="text-xs font-normal text-slate-500 group-open:hidden">
              — раскрой, ЧПУ, резерв материала
            </span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-slate-200 px-4 py-4">
          <p className="text-xs text-slate-500">
            Обычно нажимать не нужно: «Выгрузить раскрой» и «Зарезервировать материал» сами
            досчитают детали по смете, если их ещё не было.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ORDER_TASKS.map((item) => (
              <Button
                key={item.path}
                variant={item.variant}
                disabled={task.isPending}
                onClick={() => task.mutate(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </details>
      {task.isError ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorText(task.error)}</p>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold text-slate-900">Статус заказа</h4>
        <p className="mt-1 text-sm text-slate-600">
          Нажми нужный статус. При переводе в «Отгружен» дата отгрузки проставится сама.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statuses.length ? (
            statuses.map((status) => {
              const isCurrent = status.code === currentStatusCode;
              const isPending = pendingStatus === status.code;
              return (
                <button
                  key={status.id}
                  type="button"
                  disabled={isCurrent || statusChange.isPending}
                  onClick={() => {
                    setPendingStatus(status.code);
                    statusChange.mutate(status.code);
                  }}
                  className={cn(
                    "h-10 rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed",
                    isCurrent
                      ? "border-amber-400 bg-amber-400 text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50",
                  )}
                >
                  {isPending ? "Перевожу..." : status.name}
                  {isCurrent ? " — сейчас" : ""}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">Справочник статусов не загрузился.</p>
          )}
        </div>
        {statusChange.isError ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Статус не изменён: {errorText(statusChange.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type TextureProps = {
  orderId: string;
  hasTexture: boolean;
};

/**
 * Галочка «материал с текстурой».
 *
 * Текстурную плёнку нельзя разворачивать при раскрое — рисунок пойдёт поперёк
 * фасада. Поэтому признак ставит менеджер на заказе, а раскрой его читает.
 */
export function OrderTextureToggle({ orderId, hasTexture }: TextureProps) {
  const router = useRouter();
  // Локальное состояние, чтобы галочка отзывалась сразу, не дожидаясь refresh.
  const [checked, setChecked] = useState(hasTexture);

  const mutation = useMutation({
    mutationFn: async (value: boolean) =>
      clientRequest(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ has_texture: value }),
      }),
    onSuccess: () => router.refresh(),
    onError: () => setChecked((previous) => !previous),
  });

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 rounded border-slate-400 accent-amber-500"
          checked={checked}
          disabled={mutation.isPending}
          onChange={(event) => {
            const value = event.target.checked;
            setChecked(value);
            mutation.mutate(value);
          }}
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">
            Материал с текстурой — детали не вращать
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            {checked
              ? "Раскрой уложит детали строго по направлению текстуры."
              : "Текстуры нет: раскрой может разворачивать детали и экономить лист."}
          </span>
        </span>
      </label>
      {mutation.isError ? (
        <p className="mt-3 text-sm text-rose-700">
          Не удалось сохранить: {errorText(mutation.error)}
        </p>
      ) : null}
    </div>
  );
}
