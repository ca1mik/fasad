import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { CHANNEL_TYPE_LABELS, labelFor } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function InboxPage() {
  const conversations = await api.getConversations();

  const unreadCount = conversations.filter((item) => item.unread_count > 0).length;
  const waitingReplyCount = conversations.filter((item) => item.status === "needs_reply").length;
  const waitingClientCount = conversations.filter((item) => item.status === "waiting_client").length;

  return (
    <AppShell currentPath="/inbox">
      <PageHeader
        eyebrow="Коммуникации"
        title="Все обращения в одном окне"
        description="Сюда попадают письма, сообщения из Telegram и WhatsApp, заявки с сайта и заявки, которые менеджер занёс сам. В одной строке видно канал, контакт, связанную заявку и последнее сообщение."
        actions={
          <Button asChild variant="outline">
            <Link href="/manager">Рабочее место менеджера</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Всего диалогов</p>
          <p className="mt-2 text-3xl font-semibold">{conversations.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">С непрочитанным</p>
          <p className="mt-2 text-3xl font-semibold">{unreadCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Нужен ответ / ждем клиента</p>
          <p className="mt-2 text-3xl font-semibold">
            {waitingReplyCount} / {waitingClientCount}
          </p>
        </Card>
      </section>

      <Card>
        <div className="rounded-2xl border border-slate-200">
          <Table>
            <THead>
              <TR>
                <TH>Канал</TH>
                <TH>Контакт</TH>
                <TH>Клиент и заявка</TH>
                <TH>Статус</TH>
                <TH>Непрочитано</TH>
                <TH>Последнее сообщение</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {conversations.map((conversation) => (
                <TR key={conversation.id}>
                  <TD>
                    <div className="space-y-1">
                      <Badge>{labelFor(CHANNEL_TYPE_LABELS, conversation.channel_account.channel_type)}</Badge>
                      <p className="text-xs text-slate-500">{conversation.channel_account.name}</p>
                    </div>
                  </TD>
                  <TD>
                    <p className="font-medium text-slate-900">
                      {conversation.participant_name ||
                        conversation.participant_email ||
                        conversation.participant_phone ||
                        "Контакт без имени"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {conversation.participant_email ||
                        conversation.participant_phone ||
                        conversation.participant_external_id ||
                        "Контакт не заполнен"}
                    </p>
                  </TD>
                  <TD>
                    <p className="text-sm text-slate-900">
                      {conversation.client?.full_name || "Клиент будет создан автоматически"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {conversation.source_lead
                        ? `Заявка ${conversation.source_lead.lead_number || "без номера"}`
                        : "Заявка ещё не связана"}
                    </p>
                  </TD>
                  <TD>
                    <StatusBadge kind="conversation" value={conversation.status} />
                  </TD>
                  <TD>{conversation.unread_count}</TD>
                  <TD>
                    <p className="text-sm text-slate-700">
                      {conversation.last_message_preview || "Сообщений пока нет"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(conversation.last_message_at || conversation.created_at)}
                    </p>
                  </TD>
                  <TD>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/inbox/${conversation.id}`}>Открыть</Link>
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {!conversations.length ? (
          <p className="mt-4 text-sm text-slate-500">
            Пока нет диалогов. Создай lead через каталог, unified intake или Telegram demo.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
