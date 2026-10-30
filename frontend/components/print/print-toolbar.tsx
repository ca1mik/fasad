"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

/**
 * Полоса управления над печатным бланком.
 *
 * На бумагу не попадает — скрыта классом `print-hidden`. Нужна только затем,
 * чтобы нажать «Печать» и вернуться назад, не выискивая пункт в меню браузера.
 */
export function PrintToolbar({
  backHref,
  title,
  hint,
  children,
}: {
  backHref: string;
  title: string;
  hint?: string;
  /** Кнопки скачивания — у бланка и у карт они разные. */
  children?: React.ReactNode;
}) {
  return (
    <div className="print-hidden mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2">
      <div className="min-w-0">
        {/* title в атрибуте: заголовок обрезается по ширине, а в нём номер
            заказа — то единственное, ради чего на эту полосу смотрят. */}
        <p title={title} className="truncate text-sm font-semibold text-slate-900">
          {title}
        </p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Link
          href={backHref}
          className="inline-flex h-10 items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center rounded-2xl bg-amber-400 px-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
        >
          <Printer className="mr-2 h-4 w-4" />
          Печать
        </button>
      </div>
    </div>
  );
}
