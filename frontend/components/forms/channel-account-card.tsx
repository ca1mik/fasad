"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChannelAccountForm } from "@/components/forms/channel-account-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clientRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type {
  ChannelAccount,
  ChannelHealthCheckResult,
  ChannelPollResult,
  Envelope,
  MessagingUserSummary,
} from "@/types/api";

type Props = {
  account: ChannelAccount;
  managers: MessagingUserSummary[];
};

function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <Badge className={ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}>
      {children}
    </Badge>
  );
}

export function ChannelAccountCard({ account, managers }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [health, setHealth] = useState<ChannelHealthCheckResult | null>(null);
  const [poll, setPoll] = useState<ChannelPollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEmail = account.channel_type === "email";

  const healthCheck = useMutation({
    mutationFn: () =>
      clientRequest<Envelope<ChannelHealthCheckResult>>(
        `/messaging/channel-accounts/${account.id}/health-check`,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      setHealth(result.data);
      setPoll(null);
      setError(null);
      router.refresh();
    },
    onError: (mutationError: Error) => {
      setHealth(null);
      setError(mutationError.message);
    },
  });

  const pollNow = useMutation({
    mutationFn: () =>
      clientRequest<Envelope<ChannelPollResult>>(
        `/messaging/channel-accounts/${account.id}/poll`,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      setPoll(result.data);
      setHealth(null);
      setError(null);
      router.refresh();
    },
    onError: (mutationError: Error) => {
      setPoll(null);
      setError(mutationError.message);
    },
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">{account.name}</p>
          <p className="text-xs text-slate-500">
            {account.code} · {account.channel_type} · {account.inbound_mode}
          </p>
          {account.description ? (
            <p className="mt-1 text-sm text-slate-700">{account.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge ok={account.is_active}>
            {account.is_active ? "активен" : "выключен"}
          </StatusBadge>
          {isEmail ? (
            <StatusBadge ok={!account.last_error}>
              {account.last_error ? "ошибка" : "без ошибок"}
            </StatusBadge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Менеджер</p>
          <p className="mt-1">{account.default_manager?.full_name || "Не назначен"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Учётные данные</p>
          <p className="mt-1">
            {account.configured_secrets.length
              ? account.configured_secrets.join(", ")
              : "Не заданы"}
          </p>
        </div>
        {isEmail ? (
          <>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Последний опрос</p>
              <p className="mt-1">
                {account.last_polled_at ? formatDate(account.last_polled_at) : "Ещё не выполнялся"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Следующий опрос</p>
              <p className="mt-1">
                {account.next_poll_at ? formatDate(account.next_poll_at) : "Не запланирован"}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {account.last_error ? (
        <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">
          <p className="font-medium">Последняя ошибка</p>
          <p className="mt-1 break-words">{account.last_error}</p>
          {account.last_error_at ? (
            <p className="mt-1 text-xs text-red-600">{formatDate(account.last_error_at)}</p>
          ) : null}
        </div>
      ) : null}

      {health ? (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">
            Проверка соединения: {health.ok ? "успешно" : "есть проблемы"}
          </p>
          {health.imap ? (
            <p className={health.imap.ok ? "text-emerald-700" : "text-red-600"}>
              IMAP — {health.imap.detail}
            </p>
          ) : null}
          {health.smtp ? (
            <p className={health.smtp.ok ? "text-emerald-700" : "text-red-600"}>
              SMTP — {health.smtp.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      {poll ? (
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Результат опроса</p>
          <p className="mt-1">
            Получено {poll.fetched}, создано заявок {poll.created}, пропущено {poll.skipped}
          </p>
          {poll.error ? <p className="mt-1 text-red-600">{poll.error}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {isEmail ? (
          <>
            <Button onClick={() => healthCheck.mutate()} disabled={healthCheck.isPending}>
              {healthCheck.isPending ? "Проверяем..." : "Проверить соединение"}
            </Button>
            <Button
              className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => pollNow.mutate()}
              disabled={pollNow.isPending}
            >
              {pollNow.isPending ? "Забираем письма..." : "Забрать письма сейчас"}
            </Button>
          </>
        ) : null}
        <Button
          className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Скрыть настройки" : "Настроить"}
        </Button>
      </div>

      {isEditing ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <ChannelAccountForm
            managers={managers}
            account={account}
            onDone={() => setIsEditing(false)}
          />
        </div>
      ) : null}
    </Card>
  );
}
