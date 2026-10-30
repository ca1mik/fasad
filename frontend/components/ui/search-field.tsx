"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type SearchOption = {
  value: string;
  /** Что писать под строкой: сколько раз встречалось, цена, тип работы. */
  hint?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  className?: string;
  /** Строка подсказки, когда поиск ничего не нашёл. */
  emptyHint?: string;
  ariaLabel?: string;
  /** Полное значение по наведению: длинный цвет в ячейку не влезает. */
  title?: string;
  /**
   * Значение введено окончательно: курсор ушёл из поля или выбрана подсказка.
   *
   * Нужен там, где набранное надо привести к принятому виду. Делать это на
   * каждую букву нельзя: правило вырезало бы куски прямо под руками, пока
   * менеджер ещё печатает.
   */
  onCommit?: (value: string) => void;
};

const MAX_SUGGESTIONS = 12;
const LIST_MAX_HEIGHT = 240;

/** Куда поставить выпадающий список: под полем или над ним. */
type ListBox = { left: number; top: number; width: number; openUp: boolean };

/**
 * Поле с поиском по уже накопленной базе.
 *
 * Заказчик: «надо по поиску сделать поиск из базы уже созданной». Значения
 * студии — «Эмаль RAL 9003 плита 19мм», «фрез рамка под стекло» — в справочнике
 * не заведены, они копятся сами. Поэтому это не выпадающий список, а именно
 * поиск: своё значение всегда можно дописать руками, и оно попадёт в базу
 * подсказок следующей заявке.
 */
export function SearchField({
  value,
  onChange,
  options,
  placeholder,
  className,
  emptyHint = "Совпадений нет — можно вписать своё",
  ariaLabel,
  title,
  onCommit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [box, setBox] = useState<ListBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Список и поле связываются по id: без него роль combobox неполна и
  // экранный диктор не понимает, чем управляет поле. Именно `useId`, а не свой
  // счётчик: счётчик на сервере и в браузере считает по-разному, и разметка
  // расходится при гидрации.
  const listId = useId();

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const pool = needle
      ? options.filter((option) => option.value.toLowerCase().includes(needle))
      : options;
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [options, value]);

  /**
   * Список рисуется порталом в body.
   *
   * Ячейка таблицы лежит в контейнере с горизонтальной прокруткой, а он по
   * правилам CSS режет и по вертикали. Список у нижних строк обрезался ровно
   * там, где менеджер и работает — в конце таблицы.
   */
  function measure() {
    const node = inputRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const openUp = below < LIST_MAX_HEIGHT && rect.top > below;
    setBox({
      left: rect.left,
      top: openUp ? rect.top : rect.bottom,
      width: rect.width,
      openUp,
    });
  }

  useEffect(() => {
    if (!open) return undefined;
    measure();
    const update = () => measure();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, matches.length]);

  /**
   * Открытым остаётся ровно один список — тот, где сейчас курсор.
   *
   * Одного `onBlur` мало: фокус переносят и программно, и такой перенос не
   * всегда доходит до обработчика. Тогда за одну строку копилось три открытых
   * подсказки, и они закрывали строки, которые менеджер сейчас заполняет.
   * `focusin` всплывает до документа при любом способе перевода фокуса.
   */
  useEffect(() => {
    if (!open) return undefined;
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target !== inputRef.current) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [open]);

  function close() {
    setOpen(false);
    setHighlight(-1);
  }

  function pick(option: SearchOption) {
    onChange(option.value);
    onCommit?.(option.value);
    close();
  }

  /** Курсор ушёл из поля: закрываем список и отдаём набранное наружу. */
  function commit() {
    close();
    onCommit?.(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    // Стрелка вниз — способ вызвать подсказки, не набирая ни буквы.
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
      setHighlight(0);
      return;
    }
    if (!open || !matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === "Enter" && matches[highlight]) {
      // Enter берёт подсвеченную строку. Пока подсветку требовалось поставить
      // стрелкой вручную, список показывал совпадения, а Enter не делал ничего
      // — со стороны это выглядело как «выбрать нельзя».
      event.preventDefault();
      pick(matches[highlight]);
    }
  }

  const list =
    open && box ? (
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        style={{
          position: "fixed",
          left: box.left,
          width: Math.max(box.width, 240),
          ...(box.openUp
            ? { bottom: window.innerHeight - box.top + 4 }
            : { top: box.top + 4 }),
          maxHeight: LIST_MAX_HEIGHT,
        }}
        className="z-50 overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
        // клик по пункту не должен уводить фокус из поля: иначе onBlur закроет
        // список раньше, чем сработает выбор
        onMouseDown={(event) => event.preventDefault()}
      >
        {matches.length ? (
          matches.map((option, index) => (
            <li key={option.value} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-sm transition",
                  index === highlight ? "bg-amber-50" : "hover:bg-slate-50",
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(option)}
              >
                <span className="block text-slate-900">{option.value}</span>
                {option.hint ? (
                  <span className="block text-xs text-slate-500">{option.hint}</span>
                ) : null}
              </button>
            </li>
          ))
        ) : (
          <li className="px-3 py-1.5 text-xs text-slate-500">{emptyHint}</li>
        )}
      </ul>
    ) : null;

  return (
    <>
      <input
        ref={inputRef}
        className={cn(
          "h-9 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-amber-400",
          className,
        )}
        value={value}
        placeholder={placeholder}
        title={title}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        // Набирают — значит ищут: первая строка сразу подсвечена, и Enter её
        // берёт. Подсветка видна, поэтому подстановка не бывает неожиданной.
        // При простом возврате в заполненное поле (onFocus) подсветки нет —
        // там Enter ничего не трогает, чтобы не переписать готовое значение.
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        // На фокус список не открываем: менеджер проходит строку табом, и три
        // подсказки подряд закрывали бы половину таблицы. Открывается, когда
        // есть что искать, или по стрелке вниз.
        onFocus={() => {
          if (value.trim()) {
            setOpen(true);
          }
        }}
        // Ушли табом — список закрывается. Иначе за одну строку их копится три.
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </>
  );
}
