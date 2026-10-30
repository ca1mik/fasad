"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { ProductionDirection } from "@/types/api";

type Props = {
  directions: ProductionDirection[];
};

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Не удалось сохранить направление";
}

/**
 * Направления и буква, которую они дают номеру заказа.
 *
 * Разбор жалобы «буквы не проставляются» показал: сам механизм работает
 * верно (буква берётся из `number_suffix` направления), но поправить сам
 * `number_suffix` можно было только через Swagger или прямо в базе — страницы
 * в интерфейсе не было вовсе. Здесь — она.
 */
export function DirectionsManager({ directions }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", name: "", number_suffix: "" });

  const create = useMutation({
    mutationFn: async () =>
      clientRequest("/directions", {
        method: "POST",
        body: JSON.stringify({
          code: draft.code.trim(),
          name: draft.name.trim(),
          number_suffix: draft.number_suffix.trim().toUpperCase(),
        }),
      }),
    onSuccess: () => {
      setDraft({ code: "", name: "", number_suffix: "" });
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) =>
      clientRequest(`/directions/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (mutationError: unknown) => setError(errorText(mutationError)),
  });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Название</th>
              <th className="w-32 px-3 py-2">Буква номера</th>
              <th className="w-24 px-3 py-2 text-center">Активно</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {directions.map((direction) => (
              <tr key={direction.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-slate-600">{direction.code}</td>
                <td className="px-3 py-2 text-slate-900">{direction.name}</td>
                <td className="px-3 py-2">
                  <Input
                    defaultValue={direction.number_suffix}
                    placeholder="пусто — без буквы"
                    className="num h-9 w-24"
                    onBlur={(event) => {
                      const value = event.target.value.trim().toUpperCase();
                      if (value !== direction.number_suffix) {
                        update.mutate({ id: direction.id, body: { number_suffix: value } });
                      }
                    }}
                    aria-label={`Буква номера, ${direction.name}`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-500"
                    checked={direction.is_active ?? true}
                    onChange={(event) =>
                      update.mutate({ id: direction.id, body: { is_active: event.target.checked } })
                    }
                    aria-label={`Активно, ${direction.name}`}
                  />
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">
                  {update.isPending ? "Сохраняю…" : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-4">
        <p className="text-sm font-medium text-slate-900">Новое направление</p>
        <div className="flex flex-wrap gap-3">
          <Input
            value={draft.code}
            onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
            placeholder="код, например lacquer"
            className="w-44"
          />
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Название, например «Лак»"
            className="min-w-[200px] flex-1"
          />
          <Input
            value={draft.number_suffix}
            onChange={(event) =>
              setDraft((current) => ({ ...current, number_suffix: event.target.value }))
            }
            placeholder="буква, например Л"
            className="num w-32"
          />
          <Button
            disabled={create.isPending || !draft.code.trim() || !draft.name.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Добавляю…" : "Добавить"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className={cn("rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700")}>{error}</p>
      ) : null}
    </div>
  );
}
