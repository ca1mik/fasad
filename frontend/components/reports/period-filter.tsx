"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeepScroll } from "@/lib/keep-scroll";
import { cn } from "@/lib/utils";

const PERIODS = [
  { code: "week", label: "Неделя" },
  { code: "month", label: "Месяц" },
  { code: "quarter", label: "Квартал" },
  { code: "year", label: "Год" },
  { code: "all", label: "За всё время" },
];

type Props = {
  basePath: string;
  active: string;
  dateFrom?: string;
  dateTo?: string;
  extraParams?: Record<string, string | undefined>;
};

/**
 * Период отчёта: готовые кнопки и свой диапазон дат.
 *
 * Свои даты сильнее кнопки — на бэкенде ``resolve_period`` при заданных
 * ``date_from``/``date_to`` игнорирует код периода.
 */
export function PeriodFilter({ basePath, active, dateFrom, dateTo, extraParams }: Props) {
  // Прокрутка остаётся там, где нажали период: отчёт смотрят, переключая срок,
  // и каждый раз доскролливать до таблицы заново незачем. Ключ один и тот же
  // на запоминание и возврат — разойтись им уже нечем.
  const keepScroll = useKeepScroll(basePath);

  const entries = Object.entries(extraParams || {}).filter(([, value]) => Boolean(value));
  const hasCustomRange = Boolean(dateFrom || dateTo);

  const build = (code: string) => {
    const params = new URLSearchParams();
    params.set("period", code);
    for (const [key, value] of entries) {
      params.set(key, value as string);
    }
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Период отчёта">
        {PERIODS.map((item) => {
          const isActive = !hasCustomRange && active === item.code;
          return (
            <Link
              key={item.code}
              href={build(item.code)}
              scroll={false}
              onClick={keepScroll}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border border-amber-400 bg-amber-400 text-slate-900"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4"
      >
        <input type="hidden" name="period" value={active} />
        {entries.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value as string} />
        ))}

        <label className="space-y-2 text-sm text-slate-700" htmlFor="period-date-from">
          <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Дата с</span>
          <Input
            id="period-date-from"
            type="date"
            name="date_from"
            defaultValue={dateFrom || ""}
            className="w-[170px]"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700" htmlFor="period-date-to">
          <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Дата по</span>
          <Input
            id="period-date-to"
            type="date"
            name="date_to"
            defaultValue={dateTo || ""}
            className="w-[170px]"
          />
        </label>

        <Button type="submit" variant="secondary">
          Показать за этот срок
        </Button>

        {hasCustomRange ? (
          <Button asChild variant="ghost">
            <Link href={build(active)} scroll={false}>
              Сбросить даты
            </Link>
          </Button>
        ) : null}
      </form>
    </div>
  );
}
