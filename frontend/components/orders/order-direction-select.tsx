"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { clientRequest } from "@/lib/client-api";
import type { ProductionDirection } from "@/types/api";

type Props = {
  orderId: string;
  directionId: string | null;
  directions: ProductionDirection[];
  /** Номер заказа: буква в нём уже проставлена и от смены направления не меняется. */
  orderNumber: string;
};

/**
 * Направление заказа — эмаль, плёнка, шпон.
 *
 * Поставить его было негде: направление выбиралось один раз при создании
 * заказа, а в карточке не показывалось вовсе. Из-за этого все отборы по
 * направлениям стояли пустыми — заказы просто не были размечены, и вопрос
 * «сколько у нас сейчас шпона» упирался в ручной пересчёт.
 *
 * Номер заказа при смене направления не перевыпускается намеренно: он уже
 * назван клиенту и написан на пачке в цеху, а буква в нём — след того, чем
 * заказ был при заведении. Переименовать заказ значит потерять его в бумагах.
 */
export function OrderDirectionSelect({ orderId, directionId, directions, orderNumber }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(directionId ?? "");

  const mutation = useMutation({
    mutationFn: async (value: string) =>
      clientRequest(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction_id: value }),
      }),
    onSuccess: () => router.refresh(),
    onError: () => setSelected(directionId ?? ""),
  });

  const current = directions.find((direction) => direction.id === selected);

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <label className="block text-sm font-medium text-slate-900" htmlFor="order-direction">
        Направление
      </label>
      <select
        id="order-direction"
        value={selected}
        disabled={mutation.isPending}
        onChange={(event) => {
          const value = event.target.value;
          setSelected(value);
          mutation.mutate(value);
        }}
        className="mt-2 h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-amber-400 disabled:opacity-60"
      >
        {/* «Не указано» — только показ текущего состояния, выбрать его нельзя:
            сервер трактует пустое поле как «не трогать», и снятие направления
            прошло бы молча, ничего не изменив. Врать кнопкой хуже, чем не
            давать её вовсе. */}
        <option value="" disabled>
          Не указано
        </option>
        {directions.map((direction) => (
          <option key={direction.id} value={direction.id}>
            {direction.name}
            {direction.number_suffix ? ` (-${direction.number_suffix})` : ""}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm text-slate-600">
        {mutation.isPending
          ? "Сохраняю…"
          : current
            ? `Заказ ${orderNumber} считается по направлению «${current.name}». Номер остаётся прежним.`
            : "Без направления заказ не попадёт ни в один отбор по направлениям."}
      </p>
      {mutation.isError ? (
        <p className="mt-2 text-sm text-rose-700">Не удалось сохранить направление</p>
      ) : null}
    </div>
  );
}
