import Link from "next/link";

import { LeadIntakeWorkspace } from "@/components/forms/lead-intake-workspace";
import { LeadSearch } from "@/components/forms/lead-search";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { labelFor, LEAD_STATUS_ORDER, SOURCE_CHANNEL_LABELS } from "@/lib/labels";

type Props = {
  searchParams: Promise<{ search?: string; status?: string }>;
};

export default async function LeadsPage({ searchParams }: Props) {
  const filters = await searchParams;
  // Отбор уходит на сервер: искать по первым 50 загруженным записям бесполезно,
  // заявку как раз и не находят потому, что она не в этой полусотне.
  const query = new URLSearchParams({ page: "1", size: "100" });
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);

  const [
    leadsPage,
    cuttingOptions,
    priceItems,
    referenceValues,
    priceBookOptions,
    nextNumber,
    paymentMethods,
  ] = await Promise.all([
    api.getLeadsPage(query.toString()),
    api.getFilmCuttingOptions(),
    api.getPriceItems("page=1&size=500&only_active=true"),
    api.getReferenceValues(),
    // Типы работ («Эмаль», «Плёнка ПВХ», «Шпон»): под выбранным типом заводится
    // новая номенклатура, которую менеджер набирает прямо в заявке.
    api.getPriceBookOptions(),
    api.getNextLeadNumber(),
    api.getPaymentMethods(),
  ]);
  const leads = leadsPage.data;
  // Реальное количество совпадений в базе, а не длина уже обрезанной страницы
  // (сервер не отдаёт больше 100 штук за раз, см. query.set("size", "100") выше).
  const total = leadsPage.total;
  const truncated = total > leads.length;

  return (
    <AppShell
      currentPath="/leads"
      containerClassName="max-w-[1960px] lg:grid-cols-[280px_minmax(0,1fr)]"
    >
      <PageHeader
        eyebrow="Приём заявок"
        title="Заявки"
        description="Занесите заявку и сразу разложите детали по листу — раскрой открыт на этой же странице, уходить никуда не нужно."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/manager">Рабочее место менеджера</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/film-cutting">Раскрой отдельной вкладкой</Link>
            </Button>
          </div>
        }
      />

      <LeadIntakeWorkspace
        options={cuttingOptions}
        priceItems={priceItems}
        referenceValues={referenceValues}
        priceKinds={priceBookOptions?.production_kinds ?? []}
        nextNumberHint={nextNumber?.next_number}
        paymentMethods={paymentMethods}
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Список заявок</h2>
            <p className="mt-1 text-sm text-slate-700">
              Все каналы приводятся к одному формату, чтобы менеджер работал в одном интерфейсе.
            </p>
          </div>
          <Badge>{total} шт.</Badge>
        </div>

        <LeadSearch
          active={{ search: filters.search, status: filters.status }}
          total={total}
          statuses={LEAD_STATUS_ORDER}
        />

        {truncated ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Показаны первые {leads.length} из {total} — сузьте поиск или отбор по статусу, чтобы
            увидеть остальные.
          </p>
        ) : null}

        <Table>
          <THead>
            <TR>
              <TH>Заявка</TH>
              <TH>Канал</TH>
              <TH>Клиент</TH>
              <TH>Направление</TH>
              <TH>Статус</TH>
              <TH>Создано</TH>
            </TR>
          </THead>
          <TBody>
            {leads.map((lead) => (
              <TR key={lead.id}>
                {/* номер и есть ссылка: колонка с кнопкой «Открыть» лишняя,
                    а номер менеджер называет клиенту по телефону */}
                <TD className="num font-medium">
                  <Link href={`/leads/${lead.id}`} className="text-amber-700 hover:underline">
                    {lead.lead_number || "без номера"}
                  </Link>
                </TD>
                <TD>
                  <Badge className="bg-slate-50 text-slate-700">
                    {labelFor(SOURCE_CHANNEL_LABELS, lead.source_channel)}
                  </Badge>
                </TD>
                <TD className="font-medium text-slate-900">
                  {lead.client_id ? (
                    <Link href={`/clients/${lead.client_id}`} className="hover:underline">
                      {lead.client?.full_name || "Новый клиент"}
                    </Link>
                  ) : (
                    lead.client?.full_name || "Новый клиент"
                  )}
                  {lead.client?.organization ? (
                    <span className="block text-xs text-slate-500">
                      {lead.client.organization}
                    </span>
                  ) : null}
                </TD>
                <TD>{lead.direction?.name || "—"}</TD>
                <TD>
                  <StatusBadge kind="lead" value={lead.status} />
                </TD>
                <TD className="num whitespace-nowrap">{formatDate(lead.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {!leads.length ? (
          <p className="text-sm text-slate-500">
            Заявок пока нет. Они появятся автоматически из почты или после ручного занесения выше.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
