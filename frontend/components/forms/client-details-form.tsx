"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Client } from "@/types/api";

type Props = {
  client: Client;
};

/**
 * Реквизиты клиента с правкой прямо в карточке.
 *
 * Раньше карточка была только для чтения: телефон с опечаткой или новый адрес
 * приходилось заносить заново через заявку, а адрес — вообще некуда. Правка
 * идёт по кнопке, а не всегда: карточку чаще читают, чем меняют, и поля ввода
 * на каждый чих мешают глазу.
 */
export function ClientDetailsForm({ client }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: client.full_name,
    organization: client.organization ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    comment: client.comment ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest(`/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          // Пустое поле уходит как «не указано», а не как пустая строка:
          // иначе в карточке вместо «Не указан» появлялась пустота.
          organization: form.organization.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          comment: form.comment.trim() || null,
        }),
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      router.refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  if (!editing) {
    return (
      <div className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Fact label="ФИО" value={client.full_name} strong />
          <Fact label="Организация" value={client.organization} empty="Не указана" />
          <Fact label="Телефон" value={client.phone} empty="Не указан" />
          <Fact label="Почта" value={client.email} empty="Не указана" />
          <Fact label="Адрес" value={client.address} empty="Не указан" />
          {client.comment ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Комментарий</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-700">{client.comment}</dd>
            </div>
          ) : null}
        </dl>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Изменить реквизиты
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="ФИО">
          <Input
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
        </Field>
        <Field label="Организация">
          <Input
            value={form.organization}
            placeholder="если заказ от компании"
            onChange={(event) => setForm((prev) => ({ ...prev, organization: event.target.value }))}
          />
        </Field>
        <Field label="Телефон">
          <Input
            value={form.phone}
            placeholder="+7..."
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </Field>
        <Field label="Почта">
          <Input
            value={form.email}
            placeholder="если есть"
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </Field>
        <Field label="Адрес">
          <Input
            value={form.address}
            placeholder="город, улица, дом — куда везти"
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          />
        </Field>
        <div className="sm:col-span-2 xl:col-span-3">
          <Field label="Комментарий">
            <textarea
              className="min-h-20 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
              value={form.comment}
              placeholder="что важно помнить об этом клиенте"
              onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
            />
          </Field>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.full_name.trim()}
        >
          {mutation.isPending ? "Сохранение..." : "Сохранить"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  empty,
  strong,
}: {
  label: string;
  value?: string | null;
  empty?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className={strong ? "mt-1 font-medium text-slate-900" : "mt-1 text-slate-700"}>
        {value || empty || "—"}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm text-slate-700">
      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
