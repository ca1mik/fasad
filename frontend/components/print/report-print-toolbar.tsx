"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  backHref: string;
  title: string;
  hint?: string;
};

/**
 * Шапка печатной страницы отчёта.
 *
 * PDF делает сам браузер: в диалоге печати выбирается «Сохранить как PDF».
 * Так кириллица выходит без единой правки шрифтов, а файл получается точно
 * таким, каким его видно на экране. Отдельная библиотека для PDF потребовала
 * бы тащить в репозиторий шрифт с кириллицей ради того же результата.
 */
export function ReportPrintToolbar({ backHref, title, hint }: Props) {
  return (
    <div className="no-print mx-auto mb-6 flex w-full max-w-[1000px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.print()}>Сохранить PDF или напечатать</Button>
        <Button asChild variant="outline">
          <Link href={backHref}>Назад к отчётам</Link>
        </Button>
      </div>
    </div>
  );
}
