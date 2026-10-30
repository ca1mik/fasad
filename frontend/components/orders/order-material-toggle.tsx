"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clientRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";

type Props = {
  orderId: string;
  materialOrderedAt: string | null;
};

/**
 * Отметка «материал заказан».
 *
 * Заказчик вёл это заливкой ячейки в экселе: «заказали плёнку на этот заказ —
 * выделили цветом, все понимают, больше не трогаем». Заливку нельзя ни
 * отфильтровать, ни спросить «на что ещё не заказано» — а перед звонком
 * поставщику спрашивают именно это.
 */
export function OrderMaterialToggle({ orderId, materialOrderedAt }: Props) {
  const router = useRouter();
  // Локальное состояние, чтобы галочка отзывалась сразу, не дожидаясь refresh.
  const [checked, setChecked] = useState(Boolean(materialOrderedAt));

  const mutation = useMutation({
    mutationFn: async (value: boolean) =>
      clientRequest(`/orders/${orderId}/material-ordered`, {
        method: "POST",
        body: JSON.stringify({ material_ordered: value }),
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
          <span className="block text-sm font-medium text-slate-900">Материал заказан</span>
          <span className="mt-1 block text-sm text-slate-600">
            {checked
              ? `Заказан ${formatDate(materialOrderedAt) || "— дата проставлена"}. Этот заказ поставщику больше не отправляем.`
              : "Отметьте, когда плёнку или плиту заказали поставщику."}
          </span>
        </span>
      </label>
      {mutation.isError ? (
        <p className="mt-3 text-sm text-rose-700">Не удалось сохранить отметку</p>
      ) : null}
    </div>
  );
}
