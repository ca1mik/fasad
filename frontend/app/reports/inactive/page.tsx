import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

import { InactiveClients } from "./inactive-clients";

type Props = {
  searchParams: Promise<{
    days?: string;
    /** Отбор направления приходит со страницы отчётов и здесь не теряется. */
    direction_code?: string;
  }>;
};

/** Порог в днях: любое число от 1 до 10 лет, мусор из адресной строки — 90. */
function parseDays(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 90;
  return Math.min(3650, Math.max(1, Math.round(value)));
}

/** Отчёт ТЗ «кто давно не покупал» — готовый список на обзвон. */
export default async function InactiveClientsPage({ searchParams }: Props) {
  const { days: rawDays, direction_code: directionCode } = await searchParams;
  const days = parseDays(rawDays);

  // Давность считается по всей истории покупок, поэтому период здесь всегда
  // «за всё время»: клиент молчит независимо от того, какой срок выбран рядом.
  const query = [
    "period=all",
    `inactive_days=${days}`,
    ...(directionCode ? [`direction_code=${encodeURIComponent(directionCode)}`] : []),
  ].join("&");

  const [report, directions] = await Promise.all([
    api.getClientActivityReport(query),
    api.getDirections(),
  ]);

  const directionName = !directionCode
    ? null
    : directionCode === "none"
      ? "Без направления"
      : directions.find((item) => item.code === directionCode)?.name || directionCode;

  const rows = report?.rows || [];

  return (
    <AppShell currentPath="/reports">
      <PageHeader
        eyebrow="Отчёты"
        title="Кто давно не покупал"
        description="Список на обзвон: клиенты, которые не заказывали дольше выбранного срока. Отсортированы по сумме прошлых покупок — сверху те, кого терять дороже всего. Отметьте галочками нужных и выгрузите в Excel."
        actions={
          <Link
            href="/reports"
            className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Все отчёты
          </Link>
        }
      />

      <InactiveClients
        rows={rows}
        days={days}
        directionCode={directionCode}
        directionName={directionName}
      />

      {rows.length ? (
        <Card>
          <p className="text-sm text-slate-700">
            Найдено {rows.length}. Общая сумма их прошлых покупок —{" "}
            {formatMoney(report?.total.amount ?? "0", "RUB")}.
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
