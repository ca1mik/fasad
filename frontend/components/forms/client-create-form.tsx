"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { Client, Envelope } from "@/types/api";

/**
 * Создание клиента прямо в базе клиентов.
 *
 * Раньше клиент появлялся только из заявки: чтобы просто занести нового
 * заказчика с реквизитами, приходилось притворяться, что принимаешь заявку.
 * Заказчик попросил кнопку — вот она.
 */
export function ClientCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    organization: "",
    phone: "",
    email: "",
    address: "",
    comment: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest<Envelope<Client>>("/clients", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          // Пустое поле уходит как «не указано», а не пустой строкой: в карточке
          // тогда честное «Не указан», а не пустое место.
          organization: form.organization.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          comment: form.comment.trim() || null,
        }),
      }),
    onSuccess: (response) => {
      setError(null);
      setOpen(false);
      setForm({
        full_name: "",
        organization: "",
        phone: "",
        email: "",
        address: "",
        comment: "",
      });
      router.refresh();
      router.push(`/clients/${response.data.id}`);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Создать клиента</Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Input
          value={form.full_name}
          onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          placeholder="ФИО или название — обязательно"
        />
        <Input
          value={form.organization}
          onChange={(event) => setForm((prev) => ({ ...prev, organization: event.target.value }))}
          placeholder="организация, если от компании"
        />
        <Input
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          placeholder="+7..."
        />
        <Input
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="почта, если есть"
        />
        <Input
          value={form.address}
          onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          placeholder="адрес — куда везти"
        />
        <Input
          value={form.comment}
          onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
          placeholder="что важно помнить"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || form.full_name.trim().length < 2}
        >
          {mutation.isPending ? "Создание..." : "Создать"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
