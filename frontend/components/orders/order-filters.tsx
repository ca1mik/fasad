"use client";

import Link from "next/link";

import { useKeepScroll } from "@/lib/keep-scroll";
import { cn } from "@/lib/utils";
import type { OrderStatus, ProductionDirection } from "@/types/api";

/** Формы номера заказа, как их различает заказчик. */
export const NUMBER_SHAPES = [
  { code: "plain", label: "Просто номер", hint: "0001" },
  { code: "letter", label: "Номер и буква", hint: "0002-П" },
  { code: "double", label: "Номер и две буквы", hint: "0003-ОШ" },
];

/**
 * Отбор по отметке «материал заказан».
 *
 * Заказчик спрашивает это каждое утро перед звонком поставщику: «на что
 * материал ещё не заказан». Отметка в системе была, а отобрать по ней список
 * было нечем — приходилось открывать каждый заказ по очереди.
 */
export const MATERIAL_STATES = [
  { code: "false", label: "Материал не заказан", hint: "звонить поставщику" },
  { code: "true", label: "Материал заказан", hint: "поставщику не звоним" },
];

export type OrderFilterValues = {
  direction_code?: string;
  number_shape?: string;
  status_code?: string;
  /** Все, кроме этого статуса — «обычные» без отменённых. */
  exclude_status_code?: string;
  /** «true» / «false» строкой: значение живёт в адресе страницы. */
  material_ordered?: string;
  search?: string;
};

/** Код статуса «Отменён» из сида (backend/scripts/seed.py) — им же
 * заведены три быстрых состояния фильтра ниже. */
const CANCELLED_STATUS_CODE = "cancelled";

type Props = {
  directions: ProductionDirection[];
  statuses: OrderStatus[];
  active: OrderFilterValues;
  total: number;
};

function buildHref(
  active: OrderFilterValues,
  patch: Partial<OrderFilterValues>,
): string {
  const merged = { ...active, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

function Chip({
  href,
  selected,
  children,
  hint,
  onKeep,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
  hint?: string;
  /** Запоминает позицию прокрутки. Приходит сверху: хук живёт в самом фильтре. */
  onKeep: () => void;
}) {
  return (
    <Link
      href={href}
      // scroll={false} плюс запоминание позиции: одного флага не хватает, потому
      // что страница собирается на сервере и высота на миг схлопывается.
      // Заказчик: «выбираю вкладку, и скролл вверх улетает».
      scroll={false}
      onClick={onKeep}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "inline-flex flex-col rounded-2xl px-4 py-2 text-sm font-medium transition",
        selected
          ? "border border-amber-400 bg-amber-400 text-slate-900"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50",
      )}
    >
      <span>{children}</span>
      {hint ? (
        <span
          className={cn(
            "text-xs",
            selected ? "text-slate-900/75" : "text-slate-500",
          )}
        >
          {hint}
        </span>
      ) : null}
    </Link>
  );
}

export function OrderFilters({ directions, statuses, active, total }: Props) {
  // Возвращает прокрутку туда, где менеджер нажал фильтр.
  const keepScroll = useKeepScroll("/orders");

  const hasAny = Boolean(
    active.direction_code ||
    active.number_shape ||
    active.status_code ||
    active.material_ordered ||
    active.search,
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Тип по форме номера
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, { number_shape: undefined })}
            selected={!active.number_shape}
          >
            Любой
          </Chip>
          {NUMBER_SHAPES.map((shape) => (
            <Chip
              onKeep={keepScroll}
              key={shape.code}
              href={buildHref(active, { number_shape: shape.code })}
              selected={active.number_shape === shape.code}
              hint={shape.hint}
            >
              {shape.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Направление
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, { direction_code: undefined })}
            selected={!active.direction_code}
          >
            Все
          </Chip>
          {directions.map((direction) => (
            <Chip
              onKeep={keepScroll}
              key={direction.code}
              href={buildHref(active, { direction_code: direction.code })}
              selected={active.direction_code === direction.code}
              hint={
                direction.number_suffix
                  ? `-${direction.number_suffix}`
                  : "без буквы"
              }
            >
              {direction.name}
            </Chip>
          ))}
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, { direction_code: "none" })}
            selected={active.direction_code === "none"}
          >
            Не указано
          </Chip>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Статус
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, { status_code: undefined, exclude_status_code: undefined })}
            selected={!active.status_code && !active.exclude_status_code}
          >
            Любой
          </Chip>
          {/* «Обычные» = все, кроме отменённых — заказчик просил ровно три
              состояния: все / обычные / отменённые. «Отменённые» отдельной
              кнопкой не заводим — этот статус уже есть в списке ниже, а две
              кнопки на одно и то же только путали бы. */}
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, {
              status_code: undefined,
              exclude_status_code: CANCELLED_STATUS_CODE,
            })}
            selected={active.exclude_status_code === CANCELLED_STATUS_CODE}
          >
            Обычные
          </Chip>
          {statuses.map((status) => (
            <Chip
              onKeep={keepScroll}
              key={status.code}
              href={buildHref(active, {
                status_code: status.code,
                exclude_status_code: undefined,
              })}
              selected={!active.exclude_status_code && active.status_code === status.code}
            >
              {status.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Материал
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            onKeep={keepScroll}
            href={buildHref(active, { material_ordered: undefined })}
            selected={!active.material_ordered}
          >
            Любой
          </Chip>
          {MATERIAL_STATES.map((state) => (
            <Chip
              onKeep={keepScroll}
              key={state.code}
              href={buildHref(active, { material_ordered: state.code })}
              selected={active.material_ordered === state.code}
              hint={state.hint}
            >
              {state.label}
            </Chip>
          ))}
        </div>
      </div>

      <form
        action="/orders"
        method="get"
        className="flex flex-wrap items-end gap-3"
      >
        {active.direction_code ? (
          <input
            type="hidden"
            name="direction_code"
            value={active.direction_code}
          />
        ) : null}
        {active.number_shape ? (
          <input
            type="hidden"
            name="number_shape"
            value={active.number_shape}
          />
        ) : null}
        {active.status_code ? (
          <input type="hidden" name="status_code" value={active.status_code} />
        ) : null}
        {active.material_ordered ? (
          <input
            type="hidden"
            name="material_ordered"
            value={active.material_ordered}
          />
        ) : null}
        <label className="flex-1 space-y-2" htmlFor="order-search">
          <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">
            Поиск
          </span>
          <input
            id="order-search"
            name="search"
            defaultValue={active.search || ""}
            placeholder="Номер заказа, клиент, организация или комментарий"
            className="flex h-11 w-full min-w-[240px] rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-2xl bg-amber-400 px-5 text-sm font-medium text-slate-900 transition hover:opacity-90"
        >
          Найти
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-700">
          Найдено заказов: <strong className="text-slate-900">{total}</strong>
        </p>
        {hasAny ? (
          <Link
            href="/orders"
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            Сбросить фильтры
          </Link>
        ) : null}
      </div>
    </div>
  );
}
