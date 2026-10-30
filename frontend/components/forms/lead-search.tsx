"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useKeepScroll } from "@/lib/keep-scroll";
import { LEAD_STATUS_LABELS, labelFor } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type LeadFilterValues = {
  search?: string;
  status?: string;
};

type Props = {
  active: LeadFilterValues;
  total: number;
  /** Статусы, которые реально встречаются в списке. */
  statuses: string[];
};

/**
 * Поиск и отбор в списке заявок.
 *
 * Заказчик: «я сейчас всё закрыла, зашла в другую вкладку — как мне её найти?
 * Под этим номером ничего нет». На странице не было ни поля поиска, ни отбора:
 * заявку искали глазами по всему списку.
 *
 * Переход делаем роутером с `scroll: false` и запоминаем позицию: обычная
 * GET-форма перезагружает страницу и всегда выбрасывает наверх, а заказчик
 * отдельно жаловался, что «скролл вверх улетает».
 */
export function LeadSearch({ active, total, statuses }: Props) {
  const keepScroll = useKeepScroll("/leads");
  const router = useRouter();
  const [search, setSearch] = useState(active.search ?? "");

  function apply(patch: LeadFilterValues) {
    const merged = { search, status: active.status, ...patch };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    keepScroll();
    const query = params.toString();
    router.push(query ? `/leads?${query}` : "/leads", { scroll: false });
  }

  const hasAny = Boolean(active.search || active.status);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Статус</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => apply({ status: undefined })}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm font-medium transition",
              !active.status
                ? "border-amber-400 bg-amber-400 text-slate-900"
                : "border-slate-300 text-slate-700 hover:bg-slate-50",
            )}
          >
            Любой
          </button>
          {statuses.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => apply({ status: code })}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-medium transition",
                active.status === code
                  ? "border-amber-400 bg-amber-400 text-slate-900"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50",
              )}
            >
              {labelFor(LEAD_STATUS_LABELS, code)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-2" htmlFor="lead-search">
          <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Поиск</span>
          <input
            id="lead-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                apply({});
              }
            }}
            placeholder="Номер заявки, клиент, организация, телефон или текст"
            className="flex h-11 w-full min-w-[240px] rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
          />
        </label>
        <button
          type="button"
          onClick={() => apply({})}
          className="h-11 rounded-2xl bg-amber-400 px-5 text-sm font-medium text-slate-900 transition hover:opacity-90"
        >
          Найти
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-700">
          Найдено заявок: <strong className="text-slate-900">{total}</strong>
        </p>
        {hasAny ? (
          <Link href="/leads" className="text-sm font-medium text-amber-700 hover:underline">
            Сбросить
          </Link>
        ) : null}
      </div>
    </div>
  );
}
