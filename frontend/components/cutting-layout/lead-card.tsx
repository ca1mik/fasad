"use client";

import { Scissors } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/types/api";

type LeadState = {
  clientName: string;
  phone: string;
  email: string;
  comment: string;
};

export function LeadCard({
  leadState,
  createdLead,
  error,
  isPending,
  onChange,
  onSubmit,
}: {
  leadState: LeadState;
  createdLead: Lead | null;
  error: string | null;
  isPending: boolean;
  onChange: <Key extends keyof LeadState>(key: Key, value: LeadState[Key]) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <Badge className="bg-slate-50 text-slate-700">CRM</Badge>
        <h2 className="text-lg font-semibold text-slate-900">Создать заявку из раскроя</h2>
        <p className="text-sm leading-6 text-slate-700">
          Если менеджер считает раскрой прямо на встрече с клиентом, этот результат можно сразу
          сохранить как заявку. В карточку уйдут размеры листа, список деталей, зазоры, материалы
          и итоговая сводка.
        </p>
      </div>

      <div className="grid gap-4">
        <label className="space-y-2 text-sm text-slate-700">
          <span>Клиент</span>
          <Input
            value={leadState.clientName}
            onChange={(event) => onChange("clientName", event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Телефон</span>
          <Input value={leadState.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Email</span>
          <Input value={leadState.email} onChange={(event) => onChange("email", event.target.value)} />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Комментарий менеджера</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
            value={leadState.comment}
            onChange={(event) => onChange("comment", event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button onClick={onSubmit} disabled={isPending}>
        <Scissors className="mr-2 h-4 w-4" />
        Создать заявку
      </Button>

      {createdLead ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Заявка создана. ID: {createdLead.id}. Канал: {createdLead.source_channel}.
        </div>
      ) : null}
    </Card>
  );
}
