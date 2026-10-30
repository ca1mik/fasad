"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  emptyRow,
  positionsAreSavable,
  PositionsEditor,
  toPositionsPayload,
} from "@/components/orders/positions-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Envelope, Order, PriceBookOptions, PriceItem, ReferenceValues } from "@/types/api";

type Props = {
  orderId: string;
  orderNumber: string;
  currency: string;
  priceItems: PriceItem[];
  kinds?: PriceBookOptions["kinds"];
  referenceValues?: ReferenceValues;
};

/**
 * Доп. заказ к основному.
 *
 * Заказчик: клиент довёз замер, добавил фасады взамен испорченных, попросил
 * доборы. Это не правка старого заказа — по допу свои деньги и своя отгрузка, —
 * но и не заказ с улицы: в списке он висит под основным.
 *
 * Смету можно занести сразу тем же контуром, что и на «Рабочем месте» — по
 * ссылке «Занести детали сейчас» разворачивается таблица позиций
 * (`PositionsEditor`), и она уходит одним запросом вместе с созданием допа.
 * Не разворачивать её тоже можно: доп заведётся пустым, как и раньше, а смету
 * дозаполнят уже на его карточке.
 */
export function OrderAdditionalButton({
  orderId,
  orderNumber,
  currency,
  priceItems,
  kinds = [],
  referenceValues,
}: Props) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [withPositions, setWithPositions] = useState(false);
  const [rows, setRows] = useState(() => [emptyRow()]);

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest<Envelope<Order>>(`/orders/${orderId}/additional`, {
        method: "POST",
        body: JSON.stringify({
          order_number: number.trim() || null,
          positions: withPositions ? toPositionsPayload(rows, priceItems) : [],
        }),
      }),
    onSuccess: (response) => {
      setError(null);
      router.refresh();
      router.push(`/orders/${response.data.id}`);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const blocked = withPositions && !positionsAreSavable(rows);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-[190px]"
          value={number}
          onChange={(event) => {
            setNumber(event.target.value);
            setError(null);
          }}
          placeholder={`${orderNumber}/1`}
        />
        <Button
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || blocked}
        >
          {mutation.isPending ? "Создание..." : "Создать доп. заказ"}
        </Button>
        {!withPositions ? (
          <button
            type="button"
            onClick={() => setWithPositions(true)}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Занести детали сейчас
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Пусто — номер продолжит основной: {orderNumber}/1, /2
          {withPositions ? null : ". Смету можно занести сразу или дозаполнить на карточке допа"}
        </p>
      )}

      {withPositions ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">Смета допа</p>
            <button
              type="button"
              onClick={() => setWithPositions(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Свернуть — заведу пустым
            </button>
          </div>
          <PositionsEditor
            rows={rows}
            onChange={setRows}
            priceItems={priceItems}
            currency={currency}
            kinds={kinds}
            referenceValues={referenceValues}
          />
        </div>
      ) : null}
    </div>
  );
}
