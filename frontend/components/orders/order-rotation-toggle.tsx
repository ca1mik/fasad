"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clientRequest } from "@/lib/client-api";

type Props = {
  orderId: string;
  noRotation: boolean;
  /** Текстура сама по себе запрещает поворот — показываем это честно. */
  hasTexture: boolean;
};

/**
 * Прямой запрет поворота детали в раскрое.
 *
 * Заказчик: «сделай сразу в самом заказе „нельзя поворачивать"». Признак
 * «материал с текстурой» это делал побочно, но причина не всегда в текстуре:
 * бывает направление шлифовки, рисунок фрезы, требование клиента класть все
 * фасады в одну сторону. Отмечать такое текстурой значило бы врать в данных —
 * в отчётах и на карте текстура означает текстуру.
 *
 * Раскрой не вращает деталь, если стоит любой из двух признаков.
 */
export function OrderRotationToggle({ orderId, noRotation, hasTexture }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(noRotation);

  const mutation = useMutation({
    mutationFn: async (value: boolean) =>
      clientRequest(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ no_rotation: value }),
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
          <span className="block text-sm font-medium text-slate-900">Нельзя поворачивать</span>
          <span className="mt-1 block text-sm text-slate-600">
            {checked
              ? "Раскрой уложит детали строго как заданы — длина вдоль листа."
              : hasTexture
                ? "Поворот и так выключен признаком «материал с текстурой»."
                : "Раскрой может разворачивать детали и экономить лист."}
          </span>
        </span>
      </label>
      {mutation.isError ? (
        <p className="mt-3 text-sm text-rose-700">Не удалось сохранить запрет поворота</p>
      ) : null}
    </div>
  );
}
