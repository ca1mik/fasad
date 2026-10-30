import Link from "next/link";
import { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  /** Куда «проваливается» плитка: список, из которого посчитано число. */
  href?: string;
};

/**
 * Размер числа по его длине.
 *
 * «256 669,76 ₽» в тот же кегль, что «16», не влезает: плитке в ряду из шести
 * достаётся около 130 пикселей, а сумме нужно 184 — и рубль обрезался. Уменьшать
 * все числа ради одной суммы не нужно, поэтому кегль зависит от длины: короткие
 * счётчики остаются крупными.
 *
 * Ступени дробные намеренно. Раньше их было три, и «15 471,86 ₽» (11 знаков)
 * попадало в ту же ступень, что «1 250 ₽», — в плитку не влезало и переносилось
 * второй строкой, где оставался огрызок «6 ₽».
 *
 * Считаем по худшему случаю: ряд из шести плиток, около 130 пикселей под само
 * число. Ступени подобраны с запасом, а не впритык: перенос теперь запрещён, и
 * промах в меньшую сторону означал бы уже не вторую строку, а вылезание числа
 * за край плитки — это заметно хуже. Счётчики из одной-двух цифр («16», «8»)
 * остаются в самом крупном кегле.
 */
function valueSize(value: string) {
  const length = value.length;
  if (length > 13) return "text-sm";
  if (length > 10) return "text-base";
  if (length > 8) return "text-lg";
  if (length > 6) return "text-xl";
  if (length > 4) return "text-2xl";
  return "text-3xl";
}

export function StatCard({ label, value, hint, icon, href }: Props) {
  const text = String(value);

  const card = (
    // Три этажа фиксированного порядка: подпись, число, пояснение.
    //
    // Под подпись зарезервированы две строки, а пояснение прижато к низу —
    // тогда числа во всём ряду стоят на одной линии. Без этого «24,95 м²» с
    // пояснением снизу и «15» без него оказывались на разной высоте, и ряд
    // выглядел разъехавшимся, хотя плитки одной высоты.
    <Card
      className={cn(
        "flex h-full flex-col",
        href &&
          "transition group-hover:border-amber-300 group-hover:shadow-md group-focus-visible:border-amber-400",
      )}
    >
      <div className="flex min-h-[2.75rem] items-start justify-between gap-2">
        <p className="text-sm font-medium uppercase leading-tight tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <span className="shrink-0">{icon}</span>
      </div>
      <p
        className={cn(
          "num mt-3 min-w-0 font-semibold text-slate-900",
          // Ни переноса, ни обрезки: сумма всегда стоит одной строкой.
          //
          // Раньше здесь был break-words — «чтобы менеджер увидел сумму целиком,
          // пусть и в две строки». На деле вторая строка выглядела как отдельное
          // число: «15 471,8» и под ним «6 ₽». Теперь строка одна, а влезает она
          // за счёт кегля (см. valueSize). Полное значение всё равно остаётся в
          // подсказке title — на случай совсем уж длинной суммы.
          "whitespace-nowrap",
          valueSize(text),
        )}
        title={text}
      >
        {text}
      </p>
      {hint ? <p className="mt-auto pt-2 text-sm text-slate-500">{hint}</p> : null}
      {href ? (
        <p className="mt-auto pt-2 text-sm font-medium text-amber-700 group-hover:underline">
          Посмотреть →
        </p>
      ) : null}
    </Card>
  );

  // Заказчик о сводке: «вкладки не активные, чтобы провалиться посмотреть» —
  // число без перехода к списку заставляло искать те же записи руками.
  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="group block h-full rounded-3xl focus:outline-none">
      {card}
    </Link>
  );
}
