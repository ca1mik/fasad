"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Envelope, Order } from "@/types/api";

type Props = {
  leadId: string;
};

export function LeadCreateOrderButton({ leadId }: Props) {
  const router = useRouter();
  // Своя нумерация студии: «44 03 п». Пусто — номер поставит система.
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest<Envelope<Order>>(`/leads/${leadId}/create-order`, {
        method: "POST",
        body: JSON.stringify({ order_number: orderNumber.trim() || null }),
      }),
    // Уводим в саму карточку заказа, а не в список: менеджер только что его
    // создал и должен увидеть, что получилось. Из списка заказ ещё надо найти —
    // на этом и спотыкались: «создала заказ, зашла в заказы, его нет».
    onSuccess: (response) => {
      setError(null);
      router.refresh();
      router.push(`/orders/${response.data.id}`);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-[190px]"
          value={orderNumber}
          onChange={(event) => {
            setOrderNumber(event.target.value);
            setError(null);
          }}
          placeholder="номер заказа"
        />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Создание..." : "Создать заказ"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
