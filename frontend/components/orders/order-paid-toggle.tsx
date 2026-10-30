"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import type { OrderBalance, PaymentMethod } from "@/types/api";

type Props = {
  orderId: string;
  balance: OrderBalance | null;
  methods: PaymentMethod[];
  currency: string;
};

/**
 * Отметка оплаты рядом с «Заказ отгружен».
 *
 * Заказчик: галочку «оплачен», способ и сумму поступления хочет видеть там же,
 * где отмечает отгрузку, — это то, что менеджер проставляет по ходу работы.
 * Способ — выпадающим списком, как и просили.
 *
 * Состояние берём у бэкенда (`balance.status`), а не считаем заново. Считали
 * заново — и при пустой смете любой аванс зажигал галочку «оплачен», хотя тот
 * же экран рядом показывал «Аванс»: два противоречащих индикатора.
 *
 * Второго источника правды нет: отметка заводит обычный платёж в тот же список.
 * Удаление денег осталось в блоке «Деньги по заказу», чтобы случайный клик по
 * галочке не стёр проведённое поступление.
 */
export function OrderPaidToggle({ orderId, balance, methods, currency }: Props) {
  const router = useRouter();
  const paidAmount = balance?.paid_amount ?? "0";
  // Долг приходит отрицательным числом — сколько ещё ждём от клиента.
  const due = Number(balance?.balance ?? 0);
  const outstanding = due < 0 ? Math.abs(due) : 0;
  const isPaid = balance?.status === "Оплачен полностью";
  const hasPayments = Number(paidAmount) > 0;

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.code ?? "cash");
  const [error, setError] = useState<string | null>(null);

  /** Форма всегда открывается с актуальным остатком, а не с тем, что был при
      первой отрисовке: иначе после обновления страницы кнопка «Записать»
      проводила уже погашенную сумму второй раз. */
  function openForm() {
    setAmount(outstanding ? String(outstanding) : "");
    setError(null);
    setOpen(true);
  }

  const add = useMutation({
    mutationFn: async () =>
      clientRequest(`/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: String(Number(amount.replace(",", "."))),
          method,
          comment: null,
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      setAmount("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) =>
      setError(
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : "Не удалось записать оплату",
      ),
  });

  const parsed = Number(amount.replace(",", "."));
  const canSubmit = Number.isFinite(parsed) && parsed > 0 && !add.isPending;
  const overpay = outstanding > 0 && Number.isFinite(parsed) && parsed > outstanding;
  const byMethod = balance?.by_method.length
    ? balance.by_method.map((row) => row.label).join(", ")
    : null;

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={`paid-${orderId}`}
          className="mt-1 h-5 w-5 rounded border-slate-400 accent-amber-500"
          checked={isPaid}
          disabled={isPaid}
          onChange={() => (open ? setOpen(false) : openForm())}
        />
        <div className="min-w-0">
          <label
            htmlFor={`paid-${orderId}`}
            className={isPaid ? "block text-sm font-medium text-slate-900" : "block cursor-pointer text-sm font-medium text-slate-900"}
          >
            Заказ оплачен
          </label>
          <p className="mt-1 text-sm text-slate-600">
            {balance?.status === "Нет расчёта"
              ? "Пока ни сметы, ни денег. Поставьте галочку, когда придёт оплата."
              : `${balance?.status ?? "Оплата"}: поступило ${formatMoney(paidAmount, currency)}${
                  byMethod ? ` · ${byMethod}` : ""
                }${outstanding ? `, осталось ${formatMoney(String(outstanding), currency)}` : ""}.`}
          </p>
          {/* Галочка заперта, когда долг закрыт, — но доплату внести бывает
              нужно (доп. работы, доплата за материал). Даём отдельный вход,
              а не разрешаем снимать галочку: снятие означало бы удаление денег. */}
          {isPaid && !open ? (
            <button
              type="button"
              onClick={openForm}
              className="mt-1 text-sm font-medium text-amber-700 hover:underline"
            >
              Внести ещё одно поступление
            </button>
          ) : null}
          {hasPayments && !isPaid && !open ? (
            <button
              type="button"
              onClick={openForm}
              className="mt-1 text-sm font-medium text-amber-700 hover:underline"
            >
              Записать поступление
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600" htmlFor={`paid-method-${orderId}`}>
              Способ
            </label>
            <select
              id={`paid-method-${orderId}`}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="h-11 min-w-[168px] rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              {methods.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Сумма, ₽"
              inputMode="decimal"
              className="num w-40 text-right"
            />
            <Button size="sm" disabled={!canSubmit} onClick={() => add.mutate()}>
              {add.isPending ? "Записываю…" : "Записать"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
          {overpay ? (
            <p className="text-sm text-amber-700">
              Больше остатка {formatMoney(String(outstanding), currency)} — по заказу выйдет
              переплата.
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
