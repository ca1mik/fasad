import { Calculator, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadAttachments } from "@/components/leads/lead-attachments";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { readLeadOrders } from "@/components/leads/lead-fields";
import { LeadOrderAction } from "@/components/leads/lead-order-action";
import { LeadPositionsTable } from "@/components/leads/lead-positions-table";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";
import { formatArea, formatDate, formatMoney, readLeadParts } from "@/lib/format";
import { SOURCE_CHANNEL_LABELS, labelFor } from "@/lib/labels";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailsPage({ params }: Props) {
  const { id } = await params;
  // Направления нужны форме правки: выбор из справочника, а не набор кодом.
  const [lead, directions] = await Promise.all([api.getLead(id), api.getDirections()]);

  if (!lead) {
    notFound();
  }

  const summary = lead.summary;
  // Общий разбор позиций — тот же, что у бланка и раскроя. Свой, на четыре
  // колонки, здесь уже был, и из-за него карточка теряла цвет, толщину,
  // фрезеровку и посчитанную цену: они лежали в заявке, но на экран не
  // попадали.
  const parts = readLeadParts(lead.parsed_payload_json);
  const orders = readLeadOrders(summary);
  // сумма: сначала факт по заказам, если заказ уже создан, иначе оценка
  const hasOrders = (summary?.orders_count ?? 0) > 0;
  const amount = hasOrders ? summary?.orders_amount : summary?.estimated_amount;

  return (
    <AppShell currentPath="/leads">
      <PageHeader
        eyebrow={`Заявка ${lead.lead_number || ""}`.trim()}
        title={lead.subject || lead.client?.full_name || "Заявка без темы"}
        description={`Принята ${formatDate(lead.created_at)} — ${labelFor(
          SOURCE_CHANNEL_LABELS,
          lead.source_channel,
        )}. Здесь видно объём, стоимость и переход в раскрой.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/leads/${lead.id}/blank`}>
                <Printer className="mr-2 h-4 w-4" />
                Бланк заказа
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/leads/${lead.id}/cutting`}>
                <Printer className="mr-2 h-4 w-4" />
                Карты раскроя
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/film-cutting?leadId=${lead.id}`}>
                <Calculator className="mr-2 h-4 w-4" />
                Открыть раскрой
              </Link>
            </Button>
            <LeadOrderAction leadId={lead.id} orders={orders} />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Номер заявки" value={lead.lead_number || "—"} />
        <StatCard
          label="Деталей"
          value={String(summary?.quantity ?? 0)}
          hint={parts.length ? `позиций в списке: ${parts.length}` : undefined}
        />
        <StatCard
          label="Площадь фасадов"
          value={formatArea(summary?.facade_area_sqm)}
          hint={
            summary && summary.material_area_sqm !== summary.facade_area_sqm
              ? `материала ${formatArea(summary.material_area_sqm)}`
              : "то, что заказал клиент"
          }
        />
        {/* Заказчик про прежнюю подпись «Предварительно»: «Это что?» — слово
            само по себе не говорило, что это прикидка по таблице расчёта, а не
            сумма к оплате. */}
        <StatCard
          label={hasOrders ? "Сумма заказов" : "Предварительный расчёт"}
          value={amount ? formatMoney(amount, summary?.currency) : "—"}
          hint={
            hasOrders
              ? orders.map((order) => `заказ ${order.order_number}`).join(", ")
              : amount
                ? "прикидка по таблице расчёта, к оплате — сумма заказа"
                : "появится, когда в таблице расчёта будут цены"
          }
        />
      </section>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Заявка</h2>
          <p className="mt-1 text-sm text-slate-700">
            Статус, номер, срок и адрес правятся здесь же. Отказ клиента ставится статусом
            «Отклонена» — иначе расчёт навсегда остаётся в «ждут ответа» в карточке клиента.
          </p>
        </div>
        <LeadEditForm lead={lead} directions={directions} />
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{labelFor(SOURCE_CHANNEL_LABELS, lead.source_channel)}</Badge>
            {lead.direction ? (
              <Badge className="bg-amber-100 text-slate-700">{lead.direction.name}</Badge>
            ) : null}
          </div>

          {parts.length ? (
            <div>
              <p className="eyebrow">Размеры из заявки</p>
              <div className="mt-3">
                <LeadPositionsTable parts={parts} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Размеры из этой заявки разобрать не удалось — они ниже, текстом как пришли.
            </p>
          )}

          <div>
            <p className="eyebrow">Текст как пришёл</p>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-900">
              {lead.raw_text}
            </pre>
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="space-y-3">
            <h3>Клиент</h3>
            {lead.client ? (
              <div className="space-y-1 text-sm">
                <Link
                  href={`/clients/${lead.client.id}`}
                  className="font-medium text-amber-700 hover:underline"
                >
                  {lead.client.full_name}
                </Link>
                {lead.client.organization ? (
                  <p className="text-slate-700">{lead.client.organization}</p>
                ) : null}
                <p className="num text-slate-700">{lead.client.phone || "телефон не указан"}</p>
                <p className="text-slate-700">{lead.client.email || "почта не указана"}</p>
                <p className="text-slate-700">
                  {lead.client.address || "адрес в карточке не указан"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Клиент ещё не привязан.</p>
            )}
          </Card>

          <Card>
            <h3>Вложения</h3>
            <div className="mt-4">
              <LeadAttachments attachments={lead.attachments} />
            </div>
          </Card>

          <Card>
            <h3>Что удалось разобрать</h3>
            <p className="mt-2 text-sm text-slate-500">
              Служебные данные заявки — нужны, если разбор сработал не так, как ожидалось.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-700 hover:text-slate-900">
                Показать
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(lead.parsed_payload_json, null, 2)}
              </pre>
            </details>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
