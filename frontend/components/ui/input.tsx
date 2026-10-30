import { FocusEvent, forwardRef, InputHTMLAttributes, WheelEvent } from "react";

import { cn } from "@/lib/utils";

/** Общая рамка поля: одна и та же у текстового и у числового ввода. */
const FIELD_BASE =
  "flex w-full rounded-2xl border border-slate-300 bg-white text-sm outline-none transition focus:border-amber-400";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(FIELD_BASE, "h-11 px-4", className)} {...props} />
  ),
);

Input.displayName = "Input";

/**
 * Плотность числового поля.
 *
 * `form` — обычная форма (одна высота с `Input` и с селектами, у них тоже h-11),
 * `cell` — ячейка таблицы сметы и заявки, `compact` — плотная таблица
 * предпросмотра загруженного бланка, где на экран нужно уместить 37 позиций.
 */
const NUMBER_DENSITY = {
  form: "h-11 px-4",
  cell: "h-9 rounded-xl px-2",
  compact: "h-8 rounded-lg px-2 text-xs",
} as const;

/**
 * Минимальная ширина по смыслу числа.
 *
 * Заказчик: числовые колонки в таблицах ужимались, и в поле оставалось два
 * знака. Причина не в вёрстке конкретной таблицы: при обычной раскладке `width`
 * у колонки — только пожелание, и браузер отдаёт место текстовым колонкам за
 * счёт числовых. `min-width` ужать уже нельзя, поэтому он живёт прямо в поле —
 * иначе следующая таблица снова поедет.
 *
 * Размеры считаны по самому длинному значению: количество «999», размер
 * «12 500», деньги «1 234 567,00».
 */
const NUMBER_MEASURE = {
  qty: "min-w-[3.75rem]",
  size: "min-w-[4.75rem]",
  money: "min-w-[6.5rem]",
} as const;

/**
 * Стрелки-счётчик у `type="number"`.
 *
 * Они съедают около 20 пикселей ширины — те самые, которых не хватает в узкой
 * колонке. В миллиметрах и рублях они бесполезны, поэтому прячем.
 *
 * Скрытие стрелок само по себе НЕ отключает колесо мыши: у сфокусированного
 * числового поля прокрутка страницы молча меняет значение. Этим занимается
 * `onWheel` ниже.
 */
const NO_SPINNERS =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";

export type NumberInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Высота и отступы: форма, ячейка таблицы или плотная ячейка предпросмотра. */
  density?: keyof typeof NUMBER_DENSITY;
  /** Что за число — от этого зависит минимальная ширина поля. */
  measure?: keyof typeof NUMBER_MEASURE;
};

/**
 * Числовое поле ввода: одно на все таблицы и формы.
 *
 * Даёт три вещи, которые раньше приходилось дописывать в каждой таблице руками
 * и потому забывались:
 *  - моноширинные цифры и выравнивание вправо, чтобы разряды стояли в столбик;
 *  - минимальную ширину, чтобы число не обрезалось (обрезанное число хуже
 *    отсутствующего: менеджер не видит, что оно обрезано);
 *  - выделение содержимого по фокусу — заказчик: «встаёшь, чтобы забить, а надо
 *    сначала удалять то, что там стоит». Теперь первая же цифра заменяет старое
 *    значение;
 *  - защиту от колеса мыши: у сфокусированного `type="number"` прокрутка
 *    страницы меняет значение. Менеджер набирал размер, крутил список дальше —
 *    и размер уезжал, причём молча, без единого нажатия клавиши.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      density = "form",
      measure = "size",
      inputMode = "decimal",
      onFocus,
      onWheel,
      ...props
    },
    ref,
  ) => (
    <input
      ref={ref}
      inputMode={inputMode}
      onFocus={(event: FocusEvent<HTMLInputElement>) => {
        event.target.select();
        onFocus?.(event);
      }}
      onWheel={(event: WheelEvent<HTMLInputElement>) => {
        // Снимаем фокус, а не гасим событие: страница должна прокручиваться
        // дальше как обычно, просто уже не над «живым» полем.
        if (document.activeElement === event.currentTarget) {
          event.currentTarget.blur();
        }
        onWheel?.(event);
      }}
      className={cn(
        FIELD_BASE,
        NUMBER_DENSITY[density],
        NUMBER_MEASURE[measure],
        NO_SPINNERS,
        "num text-right",
        className,
      )}
      {...props}
    />
  ),
);

NumberInput.displayName = "NumberInput";
