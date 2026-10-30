"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  emptyRow,
  fromPosition,
  positionsAreSavable,
  PositionsEditor,
  toPositionsPayload,
} from "@/components/orders/positions-editor";
import { Button } from "@/components/ui/button";
import { clientRequest } from "@/lib/client-api";
import type { OrderPosition, PriceBookOptions, PriceItem, ReferenceValues } from "@/types/api";

type Props = {
  orderId: string;
  positions: OrderPosition[];
  priceItems: PriceItem[];
  currency: string;
  /** Типы работ для нестандартных строк: фрезеровка, шпон, мыло и т.д. */
  kinds?: PriceBookOptions["kinds"];
  /** Цвета, фрезеровки и артикулы, которые студия уже набирала — те же
      подсказки, что и на «Рабочем месте» при приёме заявки. */
  referenceValues?: ReferenceValues;
};

/**
 * Смета уже существующего заказа: таблица (`PositionsEditor`) + сохранение
 * целиком в `PUT /orders/{id}/positions`.
 */
export function OrderPositionsTable({
  orderId,
  positions,
  priceItems,
  currency,
  kinds = [],
  referenceValues,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    positions.length ? positions.map(fromPosition) : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      clientRequest(`/orders/${orderId}/positions`, {
        method: "PUT",
        body: JSON.stringify({ positions: toPositionsPayload(rows, priceItems) }),
      }),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : "Не удалось сохранить смету",
      );
    },
  });

  return (
    <div className="space-y-4">
      <PositionsEditor
        rows={rows}
        onChange={setRows}
        priceItems={priceItems}
        currency={currency}
        kinds={kinds}
        referenceValues={referenceValues}
      />
      <div className="flex justify-end">
        <Button disabled={save.isPending || !positionsAreSavable(rows)} onClick={() => save.mutate()}>
          {save.isPending ? "Сохраняю…" : "Сохранить смету"}
        </Button>
      </div>
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
