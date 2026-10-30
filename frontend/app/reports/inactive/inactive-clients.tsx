"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { NumberInput } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { useKeepScroll } from "@/lib/keep-scroll";
import type { ClientActivityRow } from "@/types/api";

/** Готовые пороги — то, что спрашивают чаще всего. Рядом всегда есть поле «своё». */
const THRESHOLDS = [30, 60, 90, 180, 365];

type Props = {
  rows: ClientActivityRow[];
  /** Текущий порог в днях. */
  days: number;
  /** Отбор направления, если пришёл со страницы отчётов. */
  directionCode?: string;
  directionName?: string | null;
};

/**
 * Список на обзвон: порог тишины, галочки по клиентам и выгрузки.
 *
 * Заказчик: «я всех клиентов галочкой выбираю и вижу, когда последняя покупка
 * была». Галочек не было вовсе, а порог задавался пятью зашитыми кнопками —
 * спросить «а кто молчит 45 дней» было нечем. Выгрузки с этой страницы тоже не
 * было: список видно на экране, а отдать его в работу не в чем.
 */
export function InactiveClients({ rows, days, directionCode, directionName }: Props) {
  // Возвращает прокрутку туда, где нажали порог: список длинный, и после
  // каждого переключения доскроливать заново незачем.
  const keepScroll = useKeepScroll("/reports/inactive");
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>([]);
  const [customDays, setCustomDays] = useState(String(days));

  const visible = useMemo(() => rows.map((row) => row.client_id), [rows]);

  // Отмеченные, но только из тех, кто сейчас на экране.
  //
  // Галочки живут в состоянии страницы и переживают смену порога: отметил
  // троих на «90 дней», переключил на «365» — и в файл уехали бы клиенты,
  // которых в этом отборе уже нет. Список на обзвон с чужими клиентами хуже,
  // чем его отсутствие.
  const chosen = useMemo(() => selected.filter((id) => visible.includes(id)), [selected, visible]);
  const allChecked = visible.length > 0 && chosen.length === visible.length;

  const go = (value: number) => {
    const params = new URLSearchParams({ days: String(value) });
    if (directionCode) params.set("direction_code", directionCode);
    keepScroll();
    router.push(`/reports/inactive?${params.toString()}`, { scroll: false });
  };

  const toggle = (clientId: string) => {
    setSelected((current) =>
      current.includes(clientId)
        ? current.filter((item) => item !== clientId)
        : [...current, clientId],
    );
  };

  // Галочки уходят в файл как повторяющийся параметр — так же, как их читает
  // бэкенд. Ничего не отмечено — выгружаем весь список, который на экране:
  // порог `inactive_days` уходит в файл всегда, и сервер отбирает по нему.
  const exportQuery = [
    "period=all",
    `inactive_days=${days}`,
    ...(directionCode ? [`direction_code=${encodeURIComponent(directionCode)}`] : []),
    ...chosen.map((id) => `client_ids=${id}`),
  ].join("&");

  const chosenSum = rows
    .filter((row) => !chosen.length || chosen.includes(row.client_id))
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <>
      <Card className="space-y-4">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Не заказывал дольше</p>
        <div className="flex flex-wrap gap-2">
          {THRESHOLDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => go(value)}
              aria-current={value === days ? "true" : undefined}
              className={
                value === days
                  ? "rounded-2xl border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900"
                  : "rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              }
            >
              {value} дней
            </button>
          ))}
        </div>

        {/* Своё число дней. Пять кнопок закрывают привычные сроки, но вопрос
            «а кто молчит 45 дней» задать было нечем. */}
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <label className="space-y-2 text-sm text-slate-700" htmlFor="inactive-days">
            <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">
              Своё число дней
            </span>
            <NumberInput
              id="inactive-days"
              type="number"
              measure="qty"
              min={1}
              max={3650}
              value={customDays}
              onChange={(event) => setCustomDays(event.target.value)}
              className="w-[150px]"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!Number.isFinite(Number(customDays)) || Number(customDays) < 1}
            onClick={() => go(Math.min(3650, Math.max(1, Math.round(Number(customDays)))))}
          >
            Показать
          </Button>
          {directionName ? (
            <p className="text-sm text-slate-600">
              Только клиенты направления «{directionName}».
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            {chosen.length
              ? `Отмечено ${chosen.length} из ${rows.length}. Сумма их прошлых покупок — ${formatMoney(chosenSum.toFixed(2), "RUB")}.`
              : `Ничего не отмечено — выгрузится весь список (${rows.length}).`}
          </p>
          <div className="flex flex-wrap gap-3">
            <DownloadButton path={`/reports/clients.xlsx?${exportQuery}`} variant="outline">
              Клиенты, Excel
            </DownloadButton>
            <DownloadButton path={`/reports/orders.xlsx?${exportQuery}`} variant="outline">
              Их заказы, Excel
            </DownloadButton>
            {chosen.length ? (
              <Button type="button" variant="ghost" onClick={() => setSelected([])}>
                Снять галочки
              </Button>
            ) : null}
          </div>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>
                <label className="flex items-center gap-2 text-xs font-normal text-slate-500">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? [] : visible)}
                    className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                    aria-label="Отметить всех"
                  />
                  Все
                </label>
              </TH>
              <TH>Клиент</TH>
              <TH>Телефон</TH>
              <TH>Тип</TH>
              <TH>Заказов всего</TH>
              <TH>Последняя покупка</TH>
              <TH>Дней тишины</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.client_id}>
                <TD>
                  <input
                    type="checkbox"
                    checked={chosen.includes(row.client_id)}
                    onChange={() => toggle(row.client_id)}
                    className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                    aria-label={`Отметить: ${row.full_name}`}
                  />
                </TD>
                <TD className="font-medium text-slate-900">
                  <Link href={`/clients/${row.client_id}`} className="hover:underline">
                    {row.full_name}
                  </Link>
                  {row.organization ? (
                    <span className="block text-xs text-slate-500">{row.organization}</span>
                  ) : null}
                </TD>
                <TD className="whitespace-nowrap">{row.phone || "—"}</TD>
                <TD>
                  <Badge
                    className={
                      row.category === "lost"
                        ? "bg-red-50 text-red-600"
                        : "bg-orange-100 text-orange-800"
                    }
                  >
                    {row.category_label}
                  </Badge>
                </TD>
                <TD>{row.orders_count}</TD>
                <TD className="whitespace-nowrap">
                  {row.last_order_at ? formatDate(row.last_order_at) : "—"}
                </TD>
                <TD className="whitespace-nowrap font-medium text-slate-900">
                  {row.days_since_last_order ?? "—"}
                </TD>
                <TD>
                  <Link
                    href={`/clients/${row.client_id}`}
                    className="text-sm font-medium text-amber-700 hover:underline"
                  >
                    Карточка
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {!rows.length ? (
          <p className="text-sm text-slate-500">
            Все клиенты заказывали за последние {days} дней. Хороший знак — обзванивать некого.
          </p>
        ) : null}
      </Card>
    </>
  );
}
