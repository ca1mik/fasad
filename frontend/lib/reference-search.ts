import type { SearchOption } from "@/components/ui/search-field";
import type { ReferenceValue } from "@/types/api";

/**
 * Подсказки для полей с автокомплитом («Фрезеровка», «Цвет», «Артикул»).
 *
 * Вынесено из таблицы заявки в общий модуль: смета заказа устроена так же —
 * заказчик просил, чтобы «то, что где-то забилось, осталось в памяти» и там
 * тоже, а не только на «Рабочем месте».
 */

/** «Использовали 12 раз» — по этой подписи видно, что значение живое. */
export function usedHint(item: ReferenceValue) {
  return item.used > 0 ? `использовали ${item.used} раз` : undefined;
}

/**
 * Подсказка колонки: сначала набранное в этой же таблице, потом накопленное
 * по прошлым заявкам и заказам.
 *
 * Заказчик: цвет, введённый в первой строке, не предлагался в пятой, пока
 * заявку не сохранишь. А в одной заявке цвет обычно один на десятки строк —
 * перебивать «Эмаль RAL 9003» сорок раз руками это ровно та работа, ради
 * которой поиск и делали.
 */
export function withTypedValues(saved: SearchOption[], typed: string[]): SearchOption[] {
  const seen = new Set(saved.map((option) => option.value.toLowerCase()));
  const fresh: SearchOption[] = [];
  for (const value of typed) {
    const cleaned = value.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    fresh.push({ value: cleaned, hint: "из этой заявки" });
  }
  return [...fresh, ...saved];
}

/**
 * Список без того, что сейчас в самой ячейке.
 *
 * Иначе строка предлагает менеджеру ровно то, что он в неё же и печатает:
 * набрал «RAL 90» — и первой подсказкой висит «RAL 90».
 */
export function withoutSelf(options: SearchOption[], current: string): SearchOption[] {
  const key = current.trim().toLowerCase();
  if (!key) return options;
  return options.filter((option) => option.value.toLowerCase() !== key);
}
