import Link from "next/link";
import { notFound } from "next/navigation";

import { ConversationMarkReadButton } from "@/components/forms/conversation-mark-read-button";
import { ConversationReplyForm } from "@/components/forms/conversation-reply-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, formatFileSize } from "@/lib/format";
import {
  CHANNEL_TYPE_LABELS,
  CONVERSATION_STATUS_LABELS,
  DIRECTION_LABELS,
  INBOUND_MODE_LABELS,
  LEAD_STATUS_LABELS,
  MESSAGE_STATUS_LABELS,
  SOURCE_CHANNEL_LABELS,
  labelFor,
} from "@/lib/labels";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InboxConversationPage({ params }: Props) {
  const { id } = await params;
  const conversation = await api.getConversation(id);

  if (!conversation) {
    notFound();
  }

  const channel = conversation.channel_account;
  const smtpConfig = (channel.config_json?.smtp || {}) as { host?: string };
  const hasRealTransport =
    channel.channel_type === "email" &&
    channel.is_active &&
    Boolean(smtpConfig.host) &&
    channel.configured_secrets.includes("smtp_password");

  return (
    <AppShell currentPath="/inbox">
      <PageHeader
        eyebrow="Переписка"
        title={conversation.subject || conversation.participant_name || "Диалог без темы"}
        description={
          hasRealTransport
            ? "История сообщений, привязка к клиенту и заявке, ответ письмом прямо из системы."
            : "История сообщений, привязка к клиенту и заявке. Транспорт отправки не настроен — ответ сохранится внутри системы."
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <ConversationMarkReadButton
              conversationId={conversation.id}
              disabled={conversation.unread_count === 0}
            />
            {conversation.source_lead ? (
              <Link
                href={`/leads/${conversation.source_lead.id}`}
                className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Открыть заявку
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>
                {labelFor(CHANNEL_TYPE_LABELS, conversation.channel_account.channel_type)}
              </Badge>
              <Badge className="bg-slate-50 text-slate-700">
                {labelFor(CONVERSATION_STATUS_LABELS, conversation.status)}
              </Badge>
              <Badge className="bg-amber-100 text-slate-700">
                Непрочитанных: <span className="num">{conversation.unread_count}</span>
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Контакт</p>
                <p className="mt-2 font-medium text-slate-900">
                  {conversation.participant_name || "Без имени"}
                </p>
                <p className="text-sm text-slate-700">
                  {conversation.participant_email || conversation.participant_phone || conversation.participant_external_id || "Контакт не указан"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Менеджер</p>
                <p className="mt-2 font-medium text-slate-900">
                  {conversation.assigned_manager?.full_name || "Не назначен"}
                </p>
                <p className="text-sm text-slate-700">
                  {conversation.channel_account.name} —{" "}
                  {labelFor(INBOUND_MODE_LABELS, conversation.channel_account.inbound_mode)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Клиент</p>
                <p className="mt-2 font-medium text-slate-900">
                  {conversation.client?.full_name || "Будет создан при приёме заявки"}
                </p>
                <p className="text-sm text-slate-700">
                  {conversation.client?.phone || conversation.client?.email || "Контакт клиента пока пуст"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Заявка</p>
                <p className="mt-2 font-medium text-slate-900">
                  {conversation.source_lead ? (
                    <Link
                      href={`/leads/${conversation.source_lead.id}`}
                      className="text-amber-700 underline-offset-2 hover:underline"
                    >
                      Открыть заявку
                    </Link>
                  ) : (
                    "Не привязана"
                  )}
                </p>
                <p className="text-sm text-slate-700">
                  {conversation.source_lead
                    ? `${labelFor(SOURCE_CHANNEL_LABELS, conversation.source_lead.source_channel)} — ${labelFor(LEAD_STATUS_LABELS, conversation.source_lead.status)}`
                    : "Заявка создаётся автоматически при приёме сообщения"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Последнее сообщение
              </p>
              <p className="mt-2">{conversation.last_message_preview || "Сообщений пока нет"}</p>
              <p className="mt-2 text-xs text-slate-500">
                Обновлено {formatDate(conversation.last_message_at || conversation.created_at)}
              </p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Ответ менеджера</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {hasRealTransport ? "Ответ письмом клиенту" : "Ответ внутри CRM"}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {hasRealTransport
                  ? `Письмо уйдёт с ящика канала «${channel.name}» на адрес ${
                      conversation.participant_email || "клиента"
                    } и сохранится в этой переписке.`
                  : "У канала не настроен транспорт отправки, поэтому ответ сохраняется как исходящее сообщение внутри CRM. Настройте SMTP на странице «Каналы связи»."}
              </p>
            </div>
            <ConversationReplyForm
              conversationId={conversation.id}
              hasRealTransport={hasRealTransport}
            />
          </Card>
        </div>

        <Card className="space-y-4">
          <div>
            <p className="eyebrow">Переписка</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">История сообщений</h2>
          </div>

          {conversation.messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              В этом диалоге пока нет сообщений.
            </p>
          ) : null}

          <div className="space-y-4">
            {conversation.messages.map((message) => {
              const isOutbound = message.direction === "outbound";
              return (
                <div
                  key={message.id}
                  className={
                    isOutbound
                      ? "ml-auto max-w-3xl rounded-2xl border border-amber-400 bg-amber-100 p-5"
                      : "max-w-3xl rounded-2xl border border-slate-200 bg-white p-5"
                  }
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {labelFor(DIRECTION_LABELS, message.direction)}
                    </span>
                    <span>{labelFor(MESSAGE_STATUS_LABELS, message.status)}</span>
                    <span className="num">{formatDate(message.created_at)}</span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
                    {message.body_text}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-slate-700">
                    <p>
                      Автор:{" "}
                      {message.user?.full_name ||
                        message.sender_name ||
                        message.sender_email ||
                        message.sender_phone ||
                        "Автоматический приём"}
                    </p>
                    <p>Канал: {labelFor(SOURCE_CHANNEL_LABELS, message.source_channel)}</p>
                    {message.delivered_at ? (
                      <p>Доставлено: {formatDate(message.delivered_at)}</p>
                    ) : null}
                  </div>

                  {message.delivery_error ? (
                    <div className="mt-4 rounded-2xl bg-red-50 p-3 text-xs text-red-600">
                      <p className="font-medium">Сообщение не отправлено</p>
                      <p className="mt-1 break-words">{message.delivery_error}</p>
                    </div>
                  ) : null}

                  {message.attachments.length ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-medium text-slate-900">Вложения</p>
                      <ul className="mt-2 space-y-1">
                        {message.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            {attachment.file_name}{" "}
                            <span className="text-slate-500">
                              ({attachment.mime_type || "тип неизвестен"},{" "}
                              <span className="num">{formatFileSize(attachment.size_bytes)}</span>)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
