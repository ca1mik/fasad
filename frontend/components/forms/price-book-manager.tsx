"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PriceBookOptions, PriceItem, PriceItemDetail } from "@/types/api";

type Props = {
  items: PriceItem[];
  options: PriceBookOptions | null;
};

const FALLBACK_KINDS = [{ code: "other", label: "Прочее" }];
const FALLBACK_UNITS = [{ code: "sqm", label: "м²" }];

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось сохранить артикул";
}

export function PriceBookManager({ items, options }: Props) {
  const router = useRouter();
  const kinds = options?.kinds.length ? options.kinds : FALLBACK_KINDS;
  const units = options?.units.length ? options.units : FALLBACK_UNITS;

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceItemDetail | null>(null);

  const [draft, setDraft] = useState({
    article: "",
    name: "",
    kind: kinds[0]?.code ?? "other",
    unit: units[0]?.code ?? "sqm",
    price: "",
  });

  // Правка цены живёт отдельно от карточки: менеджер открывает одну строку,
  // печатает новую цену и причину — остальные строки в это время не трогаются.
  const [editing, setEditing] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceComment, setPriceComment] = useState("");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        item.article.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)
      );
    });
  }, [items, search, kindFilter]);

  const create = useMutation({
    mutationFn: async () =>
      clientRequest("/price-book", {
        method: "POST",
        body: JSON.stringify({
          article: draft.article.trim(),
          name: draft.name.trim(),
          kind: draft.kind,
          unit: draft.unit,
          price: String(Number(draft.price.replace(",", ".")) || 0),
        }),
      }),
    onSuccess: () => {
      setDraft((current) => ({ ...current, article: "", name: "", price: "" }));
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) =>
      clientRequest(`/price-book/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setEditing(null);
      setNewPrice("");
      setPriceComment("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const loadHistory = useMutation({
    mutationFn: async (id: string) =>
      clientRequest<{ data: PriceItemDetail }>(`/price-book/${id}`),
    onSuccess: (response) => setHistory(response.data),
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const canCreate =
    draft.article.trim().length > 0 && draft.name.trim().length > 0 && !create.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Новый артикул</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={draft.article}
            onChange={(event) => setDraft({ ...draft, article: event.target.value })}
            placeholder="Артикул, например ФР-01"
          />
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Название"
          />
          <select
            value={draft.kind}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value })}
            className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm"
          >
            {kinds.map((kind) => (
              <option key={kind.code} value={kind.code}>
                {kind.label}
              </option>
            ))}
          </select>
          <select
            value={draft.unit}
            onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
            className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm"
          >
            {units.map((unit) => (
              <option key={unit.code} value={unit.code}>
                Цена за {unit.label}
              </option>
            ))}
          </select>
          <NumberInput
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            placeholder="Цена, ₽"
            aria-label="Цена нового артикула"
            measure="money"
          />
        </div>
        <Button disabled={!canCreate} onClick={() => create.mutate()}>
          {create.isPending ? "Добавляю…" : "Добавить в справочник"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по артикулу или названию"
          className="min-w-[220px] flex-1"
        />
        <select
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value)}
          className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm"
        >
          <option value="">Все типы работ</option>
          {kinds.map((kind) => (
            <option key={kind.code} value={kind.code}>
              {kind.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {visible.length ? (
          visible.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border px-4 py-3",
                item.is_active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    <span className="num">{item.article}</span> · {item.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <Badge>{item.kind_label}</Badge>
                    <span className="num">
                      {formatMoney(item.price)} за {item.unit_label}
                    </span>
                    {item.is_active ? null : <span className="text-rose-600">отключён</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(editing === item.id ? null : item.id);
                      setNewPrice(item.price);
                      setPriceComment("");
                    }}
                    className="rounded-full px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                  >
                    Изменить цену
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = openHistory === item.id ? null : item.id;
                      setOpenHistory(next);
                      setHistory(null);
                      if (next) {
                        loadHistory.mutate(item.id);
                      }
                    }}
                    className="rounded-full px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
                  >
                    История цены
                  </button>
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ id: item.id, body: { is_active: !item.is_active } })
                    }
                    className="rounded-full px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
                  >
                    {item.is_active ? "Отключить" : "Включить"}
                  </button>
                </div>
              </div>

              {editing === item.id ? (
                <div className="mt-3 flex flex-wrap gap-3 rounded-2xl bg-slate-50 p-3">
                  {/* Поле открывается уже со старой ценой: выделение по фокусу
                      из `NumberInput` даёт набрать новую сразу, не стирая
                      прежнюю по цифре. */}
                  <NumberInput
                    value={newPrice}
                    onChange={(event) => setNewPrice(event.target.value)}
                    placeholder="Новая цена"
                    aria-label="Новая цена артикула"
                    measure="money"
                    className="w-40"
                  />
                  <Input
                    value={priceComment}
                    onChange={(event) => setPriceComment(event.target.value)}
                    placeholder="Почему меняем — попадёт в историю"
                    className="min-w-[220px] flex-1"
                  />
                  <Button
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: item.id,
                        body: {
                          price: String(Number(newPrice.replace(",", ".")) || 0),
                          price_comment: priceComment.trim() || null,
                        },
                      })
                    }
                  >
                    Сохранить
                  </Button>
                  <p className="w-full text-xs text-slate-500">
                    Новая цена действует только на будущие заказы. Уже созданные останутся со своей.
                  </p>
                </div>
              ) : null}

              {openHistory === item.id ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
                  {history && history.id === item.id ? (
                    history.price_changes.map((change) => (
                      <p key={change.id} className="text-slate-700">
                        <span className="num">{formatDate(change.changed_at)}</span>:{" "}
                        <span className="num">{formatMoney(change.old_price)}</span> →{" "}
                        <span className="num font-medium">{formatMoney(change.new_price)}</span>
                        {change.comment ? ` — ${change.comment}` : ""}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-500">Загружаю…</p>
                  )}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            {items.length ? "Ничего не нашлось по фильтрам." : "Справочник пока пуст."}
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
