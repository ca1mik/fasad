"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderBalance, OrderPayment, PaymentMethod } from "@/types/api";

type Props = {
  orderId: string;
  payments: OrderPayment[];
  balance: OrderBalance | null;
  methods: PaymentMethod[];
  currency: string;
};

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось записать оплату";
}

/** Цвет плашки баланса: долг красный, аванс зелёный, ноль серый. */
function balanceTone(value: string) {
  const amount = Number(value);
  if (amount < 0) return "bg-rose-50 text-rose-700";
  if (amount > 0) return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function OrderPayments({ orderId, payments, balance, methods, currency }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.code ?? "cash");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () =>
      clientRequest(`/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: String(Number(amount.replace(",", "."))),
          method,
          comment: comment.trim() || null,
        }),
      }),
    onSuccess: () => {
      setAmount("");
      setComment("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const remove = useMutation({
    mutationFn: async (paymentId: string) =>
      clientRequest(`/orders/${orderId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: () => router.refresh(),
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const parsed = Number(amount.replace(",", "."));
  const canSubmit = Number.isFinite(parsed) && parsed > 0 && !add.isPending;

  return (
    <div className="space-y-5">
      {balance ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">По смете</p>
            <p className="num mt-1 text-lg font-semibold text-slate-900">
              {formatMoney(balance.final_amount, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Оплачено</p>
            <p className="num mt-1 text-lg font-semibold text-slate-900">
              {formatMoney(balance.paid_amount, currency)}
            </p>
          </div>
          <div className={cn("rounded-2xl px-4 py-3", balanceTone(balance.balance))}>
            <p className="text-xs uppercase tracking-[0.12em] opacity-70">{balance.status}</p>
            <p className="num mt-1 text-lg font-semibold">
              {formatMoney(balance.balance, currency)}
            </p>
          </div>
        </div>
      ) : null}

      {balance?.by_method.length ? (
        <p className="text-sm text-slate-600">
          {balance.by_method
            .map((row) => `${row.label}: ${formatMoney(row.amount, currency)}`)
            .join(" · ")}
        </p>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Записать оплату</p>
        <div className="flex flex-wrap gap-2">
          {methods.map((item) => (
            <label
              key={item.code}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                method === item.code
                  ? "border-amber-400 bg-amber-400 text-slate-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="payment-method"
                className="h-4 w-4 accent-slate-900"
                checked={method === item.code}
                onChange={() => setMethod(item.code)}
              />
              {item.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Сумма — деньги: цифры моноширинные и по правому краю, как в
              таблицах сметы и в плашках баланса над формой. */}
          <NumberInput
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Сумма, ₽"
            aria-label="Сумма оплаты"
            measure="money"
            className="w-40"
          />
          <Input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий — например, «аванс 50 %»"
            className="min-w-[220px] flex-1"
          />
          <Button disabled={!canSubmit} onClick={() => add.mutate()}>
            {add.isPending ? "Записываю…" : "Добавить"}
          </Button>
        </div>
      </div>

      {payments.length ? (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="num font-medium text-slate-900">
                  {formatMoney(payment.amount, currency)} · {payment.method_label}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(payment.paid_at)}
                  {payment.comment ? ` · ${payment.comment}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(payment.id)}
                className="rounded-full px-3 py-1 text-sm text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Оплат пока нет.</p>
      )}

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
