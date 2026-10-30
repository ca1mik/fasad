"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { rememberScroll } from "@/lib/keep-scroll";

type Props = {
  href: string;
  children: ReactNode;
};

/**
 * Заголовок «Срок» — клик сортирует список, а не улетает наверх страницы.
 *
 * Заказчик: «когда прожимал срок, оно улетало на верх страницы снова, а
 * должно просто фильтровать» — та же беда, что уже решена для чипов фильтра
 * (`useKeepScroll`), но сама ссылка жила в серверном компоненте страницы и
 * не могла подключить хук. `OrderFilters` уже держит восстановление позиции
 * для этой страницы (оно общее, привязано к пути, а не к конкретной ссылке)
 * — здесь нужно только запомнить текущую прокрутку перед переходом.
 */
export function DueSortLink({ href, children }: Props) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => rememberScroll(pathname)}
      className="inline-flex items-center gap-1 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
