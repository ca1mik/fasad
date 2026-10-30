import Link from "next/link";

import { ManualLeadForm } from "@/components/forms/manual-lead-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { SOURCE_CHANNEL_LABELS, labelFor } from "@/lib/labels";

function byDate<T extends { created_at?: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left.created_at || 0).getTime();
    const rightValue = new Date(right.created_at || 0).getTime();
    return rightValue - leftValue;
  });
}

export default async function ManagerPage() {
  const [leads, priceItems, referenceValues, priceBookOptions, nextNumber, paymentMethods] =
    await Promise.all([
      api.getLeads(),
      api.getPriceItems("page=1&size=500&only_active=true"),
      api.getReferenceValues(),
      api.getPriceBookOptions(),
      api.getNextLeadNumber(),
      api.getPaymentMethods(),
    ]);

  // Десять, а не пять: заявку заносят подряд, и своя предыдущая должна остаться
  // видна без перехода в общий список.
  const recentLeads = byDate(leads).slice(0, 10);

  return (
    <AppShell currentPath="/manager">
      <PageHeader
        eyebrow="Рабочее место менеджера"
        title="Принять заявку и сразу передать её в работу"
        description="Страница собрана под реальный сценарий: клиент сидит перед менеджером, менеджер быстро фиксирует заявку, при необходимости сразу открывает раскрой и дальше ведёт заказ по процессу."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/leads">Все заявки</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/film-cutting">Раскрой листа</Link>
            </Button>
          </div>
        }
      />

      {/* Форма на всю ширину: в ней таблица позиций в колонках бумажного
          бланка, и в половине экрана она сжималась в узкую полосу с
          горизонтальной прокруткой — заносить заказ в такой было неудобно. */}
      <ManualLeadForm
        title="Быстро занести заявку"
        description="Сначала зафиксируй клиента, изделие и размеры. Всё остальное можно дополнять уже после первичного разговора."
        priceItems={priceItems}
        referenceValues={referenceValues}
        priceKinds={priceBookOptions?.production_kinds ?? []}
        nextNumberHint={nextNumber?.next_number}
        paymentMethods={paymentMethods}
      />

      {/* На рабочем месте осталась одна таблица — свои заявки.
          Заказчик: «вот это я просила всё убрать, чтобы я могла видеть только
          свои новые заявки, куда что сохраняется, где отображается». Диалоги и
          заказы отсюда убраны: у них свои разделы в меню, а здесь они забивали
          экран и мешали увидеть результат только что занесённой заявки.

          min-w-0 на карточке: внутри таблица со своей прокруткой, а элемент
          сетки по умолчанию растягивается под содержимое — и на телефоне правый
          край карточки уезжал за экран. */}
      <section>
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Мои заявки</h2>
              <p className="mt-1 text-sm text-slate-700">
                Свежие сверху — только что занесённая заявка будет первой.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{recentLeads.length} шт.</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href="/leads">Все заявки</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <Table>
              <THead>
                <TR>
                  <TH>Заявка</TH>
                  <TH>Клиент</TH>
                  <TH>Статус</TH>
                  <TH>Создано</TH>
                </TR>
              </THead>
              <TBody>
                {recentLeads.map((lead) => (
                  <TR key={lead.id}>
                    {/* номер и есть ссылка: колонка с кнопкой «Открыть» не
                        влезала в половину ширины и последние столбцы обрезались */}
                    <TD className="num font-medium">
                      <Link href={`/leads/${lead.id}`} className="text-amber-700 hover:underline">
                        {lead.lead_number || "без номера"}
                      </Link>
                    </TD>
                    <TD className="font-medium text-slate-900">
                      {lead.client?.full_name || "Новый клиент"}
                      <span className="block text-xs text-slate-500">
                        {labelFor(SOURCE_CHANNEL_LABELS, lead.source_channel)}
                      </span>
                    </TD>
                    <TD>
                      <StatusBadge kind="lead" value={lead.status} />
                    </TD>
                    <TD className="num whitespace-nowrap">{formatDate(lead.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </section>

    </AppShell>
  );
}
