"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatDateOnly, toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  dueDate: string | null;
  /**
   * Отсчёт, посчитанный на сервере.
   *
   * Считать его здесь нельзя: часовой пояс браузера разошёлся бы с разметкой,
   * которую отдал сервер, и React ругался бы на несовпадение при гидратации.
   */
  countdown: string;
  /** Срок прошёл — показываем красным: иначе просрочку замечают по звонку клиента. */
  overdue: boolean;
};

/**
 * Срок сдачи заказа.
 *
 * Заказчик: «чтобы например этот заказ 14 дней — вписали, и отсчёт пошёл».
 * Механизм срока в системе был: типовые 14 дней по типу работ, поле у заявки и
 * у заказа, перенос из заявки в заказ. Не было ровно двух вещей — поставить
 * или сдвинуть срок по заказу (единственное поле даты во всём интерфейсе жило
 * в карточке заявки) и увидеть, сколько осталось.
 *
 * Два способа ввода намеренно: дни — как заказчик и говорит («этот заказ 14
 * дней»), дата — когда клиент назвал конкретный день.
 */
export function OrderDueDate({ orderId, dueDate, countdown, overdue }: Props) {
  const router = useRouter();
  const [days, setDays] = useState("");

  const save = useMutation({
    mutationFn: async (value: string | null) =>
      clientRequest(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ due_date: value }),
      }),
    onSuccess: () => {
      setDays("");
      router.refresh();
    },
  });

  const applyDays = () => {
    const count = Number(days.replace(",", "."));
    if (!Number.isFinite(count) || count < 0) {
      return;
    }
    const target = new Date();
    target.setDate(target.getDate() + Math.round(count));
    save.mutate(toDateInputValue(target));
  };

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">Срок</p>
      <p className={cn("mt-1 text-sm", overdue ? "font-medium text-rose-700" : "text-slate-600")}>
        {dueDate ? `${formatDateOnly(dueDate)} · ${countdown}` : "Не назначен"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          className="w-20"
          inputMode="numeric"
          value={days}
          placeholder="14"
          aria-label="Срок в днях от сегодня"
          disabled={save.isPending}
          onChange={(event) => setDays(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyDays();
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!days.trim() || save.isPending}
          onClick={applyDays}
        >
          дней от сегодня
        </Button>
        <Input
          type="date"
          className="w-40"
          value={dueDate ?? ""}
          aria-label="Срок датой"
          disabled={save.isPending}
          onChange={(event) => save.mutate(event.target.value || null)}
        />
      </div>

      {save.isError ? <p className="mt-2 text-sm text-rose-700">Не удалось сохранить срок</p> : null}
    </div>
  );
}
