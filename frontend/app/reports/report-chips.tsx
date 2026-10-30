"use client";

import { useRouter } from "next/navigation";

import { useKeepScroll } from "@/lib/keep-scroll";
import { cn } from "@/lib/utils";

export type ChipItem = {
  /** Значение параметра; пустая строка — «сбросить отбор». */
  value: string;
  label: string;
  hint?: string;
  /**
   * Готовый адрес перехода.
   *
   * Именно адрес, а не функция, которая его соберёт: страница отчётов —
   * серверный компонент, а функцию в клиентский компонент из него передать
   * нельзя. Раньше сюда приходил `hrefFor`, и страница падала с 500 при
   * отрисовке на сервере — типы этого не ловят, ошибка только во время работы.
   */
  href: string;
};

type Props = {
  /** Путь страницы: по нему запоминается позиция прокрутки. */
  basePath: string;
  items: ChipItem[];
  active: string;
  ariaLabel: string;
};

/**
 * Ряд плашек-фильтров отчёта, не сбивающий прокрутку.
 *
 * Заказчик: «я скролю, выбираю вкладку, и скролл вверх улетает». Одного
 * `scroll={false}` мало — страница собирается на сервере, высота на миг
 * схлопывается, и браузер сам сбрасывает позицию. Поэтому позиция
 * запоминается в момент нажатия и возвращается, когда новая таблица уже на
 * месте (тот же приём, что в фильтрах заказов).
 */
export function ReportChips({ basePath, items, active, ariaLabel }: Props) {
  // Одна пара «запомнить/вернуть» на один ключ. Раньше запоминали по basePath,
  // а возвращали по адресу страницы — стоило им разойтись, и позиция
  // сохранялась в один ключ, а искалась в другом.
  const keepScroll = useKeepScroll(basePath);
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = active === item.value;
        return (
          <button
            key={item.value || "all"}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => {
              keepScroll();
              router.push(item.href, { scroll: false });
            }}
            className={cn(
              "inline-flex flex-col rounded-2xl px-4 py-2 text-left text-sm font-medium transition",
              selected
                ? "border border-amber-400 bg-amber-400 text-slate-900"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50",
            )}
          >
            <span>{item.label}</span>
            {item.hint ? (
              <span className={cn("text-xs", selected ? "text-slate-900/75" : "text-slate-500")}>
                {item.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
