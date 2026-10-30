import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Карточка. `min-w-0` по умолчанию — не косметика.
 *
 * Карточки почти всегда лежат в сетке. Элемент сетки без `min-w-0` не может
 * стать уже своего содержимого, и одна широкая таблица внутри распирала колонку,
 * а за ней и всю страницу: на узком экране карточка заявки уезжала вбок на
 * 848 px. Таблицы уже лежат в своей прокрутке — но она включается только тогда,
 * когда карточке разрешено сузиться.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel min-w-0 p-6", className)} {...props} />;
}