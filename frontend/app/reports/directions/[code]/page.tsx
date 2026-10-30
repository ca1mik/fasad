import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/reports/period-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    period?: string;
    metric?: string;
    date_from?: string;
    date_to?: string;
  }>;
};

function sqm(value: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м²`;
}

/** Детализация отчёта по одному направлению: клиенты и объёмы этого типа. */
export default async function DirectionReportPage({ params, searchParams }: Props) {
  const { code } = await params;
  const {
    period = "month",
    metric = "accepted",
    date_from: dateFrom,
    date_to: dateTo,
  } = await searchParams;

  const range = new URLSearchParams({ period });
  if (dateFrom) range.set("date_from", dateFrom);
  if (dateTo) range.set("date_to", dateTo);
  // Один и тот же хвост запроса на экран и на все выгрузки: иначе файл
  // считается по другому отбору, чем страница, с которой его скачали.
  const scoped = `${range.toString()}&direction_code=${encodeURIComponent(code)}`;

  const [directions, volume, clients] = await Promise.all([
    api.getDirections(),
    api.getVolumeReport(`${range.toString()}&metric=${metric}`),
    api.getClientActivityReport(scoped),
  ]);

  const direction = directions.find((item) => item.code === code);
  if (!direction) {
    notFound();
  }

  const row = volume?.by_direction.find((item) => item.key === code);
  const buyers = (clients?.rows || []).filter((item) => item.orders_count > 0);

  return (
    <AppShell currentPath="/reports">
      <PageHeader
        eyebrow="Отчёт по направлению"
        title={direction.name}
        description={`Номер заказа этого направления оканчивается на «${
          direction.number_suffix || "без буквы"
        }». Ниже — объёмы и клиенты, которые заказывали именно этот тип.`}
        actions={
          <Link
            href={`/reports?period=${period}&metric=${metric}`}
            className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ко всем отчётам
          </Link>
        }
      />

      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Период</p>
        <PeriodFilter
          basePath={`/reports/directions/${code}`}
          active={period}
          dateFrom={dateFrom}
          dateTo={dateTo}
          extraParams={{ metric }}
        />

        {/* Выгрузки прямо отсюда: раньше со страницы направления нельзя было
            забрать ни одного файла — приходилось возвращаться в общий отчёт и
            выставлять тот же отбор заново, рискуя выгрузить не то. */}
        <div className="flex flex-wrap items-start gap-3 border-t border-slate-200 pt-4">
          <span className="self-center text-xs uppercase tracking-[0.12em] text-slate-500">
            Выгрузить
          </span>
          <DownloadButton path={`/reports/volume.xlsx?${scoped}&metric=${metric}`} variant="outline">
            Объёмы, Excel
          </DownloadButton>
          <DownloadButton path={`/reports/orders.xlsx?${scoped}&metric=${metric}`} variant="outline">
            Заказы, Excel
          </DownloadButton>
          <DownloadButton
            path={`/reports/work-kinds.xlsx?${scoped}&metric=${metric}`}
            variant="outline"
          >
            Обработка, Excel
          </DownloadButton>
          <DownloadButton path={`/reports/clients.xlsx?${scoped}`} variant="outline">
            Клиенты, Excel
          </DownloadButton>
          <Button asChild variant="secondary">
            <Link href={`/reports/print?${scoped}&metric=${metric}`}>Печать и PDF</Link>
          </Button>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Заказов" value={String(row?.orders_count ?? 0)} />
        <StatCard label="Сумма" value={formatMoney(row?.amount ?? "0", "RUB")} />
        <StatCard label="Площадь фасадов" value={sqm(row?.facade_area_sqm ?? "0")} />
        <StatCard
          label="Площадь материала"
          value={sqm(row?.material_area_sqm ?? "0")}
          hint={`коэффициент ${direction.material_area_factor ?? "1"}`}
        />
      </section>

      <Card className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Клиенты</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Кто заказывал «{direction.name}»
          </h2>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Клиент</TH>
              <TH>Тип</TH>
              <TH>Заказов</TH>
              <TH>Сумма</TH>
              <TH>Материал</TH>
              <TH>Не заказывал</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {buyers.map((client) => (
              <TR key={client.client_id}>
                <TD className="font-medium text-slate-900">
                  <Link href={`/clients/${client.client_id}`} className="hover:underline">
                    {client.full_name}
                  </Link>
                  {client.organization ? (
                    <span className="block text-xs text-slate-500">{client.organization}</span>
                  ) : null}
                </TD>
                <TD>
                  <Badge className="bg-slate-50 text-slate-700">{client.category_label}</Badge>
                </TD>
                <TD>{client.orders_count}</TD>
                <TD className="whitespace-nowrap">
                  {formatMoney(client.amount, client.currency)}
                </TD>
                <TD className="whitespace-nowrap">{sqm(client.material_area_sqm)}</TD>
                <TD className="whitespace-nowrap">
                  {client.days_since_last_order === null
                    ? "—"
                    : `${client.days_since_last_order} дн.`}
                </TD>
                <TD>
                  <Link
                    href={`/clients/${client.client_id}`}
                    className="text-sm font-medium text-amber-700 hover:underline"
                  >
                    Карточка
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {!buyers.length ? (
          <p className="text-sm text-slate-500">
            За выбранный период по направлению «{direction.name}» заказов не было.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
