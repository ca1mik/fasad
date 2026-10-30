"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import type { ChannelAccount, EmailChannelConfig, MessagingUserSummary } from "@/types/api";

type Props = {
  managers: MessagingUserSummary[];
  account?: ChannelAccount;
  onDone?: () => void;
};

const SELECT_CLASS =
  "flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400";

function readConfig(account?: ChannelAccount): EmailChannelConfig {
  const raw = (account?.config_json || {}) as Partial<EmailChannelConfig>;
  return {
    imap: {
      host: raw.imap?.host ?? "",
      port: raw.imap?.port ?? 993,
      ssl: raw.imap?.ssl ?? true,
      login: raw.imap?.login ?? "",
      folder: raw.imap?.folder ?? "INBOX",
    },
    smtp: {
      host: raw.smtp?.host ?? "",
      port: raw.smtp?.port ?? 465,
      security: raw.smtp?.security ?? "ssl",
      login: raw.smtp?.login ?? "",
      from_email: raw.smtp?.from_email ?? "",
      from_name: raw.smtp?.from_name ?? "",
    },
    poll_interval_seconds: raw.poll_interval_seconds ?? 120,
    since_days: raw.since_days ?? 3,
    unseen_only: raw.unseen_only ?? true,
    mark_seen: raw.mark_seen ?? true,
  };
}

export function ChannelAccountForm({ managers, account, onDone }: Props) {
  const router = useRouter();
  const isEdit = Boolean(account);

  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [description, setDescription] = useState(account?.description ?? "");
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [managerId, setManagerId] = useState(account?.default_manager_id ?? "");
  const [config, setConfig] = useState<EmailChannelConfig>(() => readConfig(account));
  const [imapPassword, setImapPassword] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasStoredImapPassword = account?.configured_secrets?.includes("imap_password") ?? false;
  const hasStoredSmtpPassword = account?.configured_secrets?.includes("smtp_password") ?? false;

  const setImap = (patch: Partial<EmailChannelConfig["imap"]>) =>
    setConfig((prev) => ({ ...prev, imap: { ...prev.imap, ...patch } }));
  const setSmtp = (patch: Partial<EmailChannelConfig["smtp"]>) =>
    setConfig((prev) => ({ ...prev, smtp: { ...prev.smtp, ...patch } }));

  const mutation = useMutation({
    mutationFn: async () => {
      const secrets: Record<string, string> = {};
      if (imapPassword) secrets.imap_password = imapPassword;
      if (smtpPassword) secrets.smtp_password = smtpPassword;

      const body = {
        name,
        description: description || null,
        is_active: isActive,
        default_manager_id: managerId || null,
        config_json: config,
        ...(Object.keys(secrets).length ? { secrets } : {}),
      };

      if (isEdit && account) {
        return clientRequest(`/messaging/channel-accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }

      return clientRequest("/messaging/channel-accounts", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          code,
          channel_type: "email",
          inbound_mode: "polling",
        }),
      });
    },
    onSuccess: () => {
      setError(null);
      setImapPassword("");
      setSmtpPassword("");
      if (!isEdit) {
        setCode("");
        setName("");
        setDescription("");
      }
      onDone?.();
      router.refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Основное</p>
        {!isEdit ? (
          <Input
            placeholder="Код канала, например email_sales"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        ) : null}
        <Input
          placeholder="Название, например «Почта отдела продаж»"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          placeholder="Описание (необязательно)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <select
          className={SELECT_CLASS}
          value={managerId}
          onChange={(event) => setManagerId(event.target.value)}
        >
          <option value="">Менеджер по умолчанию не назначен</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.full_name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Канал активен — планировщик опрашивает ящик
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Приём почты (IMAP)</p>
        <Input
          placeholder="IMAP-сервер, например imap.yandex.ru"
          value={config.imap.host}
          onChange={(event) => setImap({ host: event.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="Порт"
            value={config.imap.port}
            onChange={(event) => setImap({ port: Number(event.target.value) || 0 })}
          />
          <Input
            placeholder="Папка"
            value={config.imap.folder}
            onChange={(event) => setImap({ folder: event.target.value })}
          />
        </div>
        <Input
          placeholder="Логин (обычно полный адрес почты)"
          value={config.imap.login}
          onChange={(event) => setImap({ login: event.target.value })}
        />
        <Input
          type="password"
          placeholder={
            hasStoredImapPassword
              ? "Пароль сохранён — заполните, чтобы заменить"
              : "Пароль IMAP (для Яндекс/Mail.ru — пароль приложения)"
          }
          value={imapPassword}
          onChange={(event) => setImapPassword(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.imap.ssl}
            onChange={(event) => setImap({ ssl: event.target.checked })}
          />
          Использовать SSL
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Отправка ответов (SMTP)</p>
        <Input
          placeholder="SMTP-сервер, например smtp.yandex.ru"
          value={config.smtp.host}
          onChange={(event) => setSmtp({ host: event.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="Порт"
            value={config.smtp.port}
            onChange={(event) => setSmtp({ port: Number(event.target.value) || 0 })}
          />
          <select
            className={SELECT_CLASS}
            value={config.smtp.security}
            onChange={(event) =>
              setSmtp({ security: event.target.value as EmailChannelConfig["smtp"]["security"] })
            }
          >
            <option value="ssl">SSL / TLS</option>
            <option value="starttls">STARTTLS</option>
            <option value="none">Без шифрования</option>
          </select>
        </div>
        <Input
          placeholder="Логин SMTP"
          value={config.smtp.login}
          onChange={(event) => setSmtp({ login: event.target.value })}
        />
        <Input
          type="password"
          placeholder={
            hasStoredSmtpPassword
              ? "Пароль сохранён — заполните, чтобы заменить"
              : "Пароль SMTP"
          }
          value={smtpPassword}
          onChange={(event) => setSmtpPassword(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Адрес отправителя"
            value={config.smtp.from_email}
            onChange={(event) => setSmtp({ from_email: event.target.value })}
          />
          <Input
            placeholder="Имя отправителя"
            value={config.smtp.from_name}
            onChange={(event) => setSmtp({ from_name: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Опрос ящика</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">Интервал опроса, секунд</span>
            <Input
              type="number"
              min={30}
              value={config.poll_interval_seconds}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  poll_interval_seconds: Number(event.target.value) || 30,
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">Глубина выборки, дней</span>
            <Input
              type="number"
              min={1}
              value={config.since_days}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, since_days: Number(event.target.value) || 1 }))
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.unseen_only}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, unseen_only: event.target.checked }))
            }
          />
          Забирать только непрочитанные письма
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.mark_seen}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, mark_seen: event.target.checked }))
            }
          />
          Помечать письма прочитанными после загрузки
        </label>
        <p className="text-xs text-slate-500">
          Глубина выборки применяется, когда выключен режим «только непрочитанные».
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (!isEdit && (!code.trim() || !name.trim()))}
      >
        {mutation.isPending
          ? "Сохранение..."
          : isEdit
            ? "Сохранить изменения"
            : "Создать email-канал"}
      </Button>
    </div>
  );
}
