import { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Таблица всегда в прокручиваемой обёртке.
 *
 * В `globals.css` у body стоит `overflow-x: clip`, поэтому таблица без обёртки
 * на телефоне не прокручивается жестом — последние колонки просто недоступны.
 *
 * Минимальная ширина держится только на узких экранах (`md:min-w-0`): иначе на
 * десктопе под каждой таблицей висела полоса прокрутки, даже когда содержимое
 * спокойно влезало.
 */
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table
        className={cn("w-full min-w-[560px] text-left text-sm md:min-w-0", className)}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-slate-200 text-slate-500", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("align-top", className)} {...props} />;
}

export function TH({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em]", className)}
      {...props}
    />
  );
}

/**
 * Ячейка таблицы.
 *
 * Числовая ячейка — это `<TD className="num text-right">`: так написано во всех
 * два десятка таблиц приложения. Отдельная обёртка `TDNum` здесь была, но её
 * никто не вызывал — половинчатая абстракция только сбивает с толку, поэтому
 * убрана. Если заводить её снова — то одним заходом по всем таблицам.
 */
export function TD({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-3.5 text-slate-700", className)} {...props} />;
}

export function TFoot({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("border-t border-slate-200 font-medium text-slate-900", className)}
      {...props}
    />
  );
}
