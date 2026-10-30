import {
  ChartNoAxesCombined,
  CircleDollarSign,
  Factory,
  Layers3,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default async function DashboardPage() {
  const summary = await api.getDashboard();

  return (
    <AppShell currentPath="/dashboard">
      <PageHeader
        eyebrow="Операционный обзор"
        title="Сводка по системе"
        description="Здесь видны новые заявки, заказы, загрузка цеха, отчеты работников и укрупненная картина по складу."
      />

      {/* Шесть плиток в ряд помещаются только на широком экране: на ноутбуке
          каждой доставалось 138 пикселей, и сумма выручки в них не влезала. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Заказы"
          value={summary.total_orders}
          href="/orders"
          icon={<ChartNoAxesCombined className="h-5 w-5 text-amber-700" />}
        />
        <StatCard
          label="Новые заявки"
          value={summary.new_leads}
          // Раньше вело на /leads без отбора: число на плитке — это заявки со
          // статусом «new», а ссылка открывала вообще все статусы разом.
          href="/leads?status=new"
          icon={<ScrollText className="h-5 w-5 text-amber-700" />}
        />
        {/* Выручки нет в ответе — значит роль её не видит (работник цеха).
            Плитку не рисуем вовсе: «—» вместо суммы читалось бы как «выручки
            нет», а не «это не ваша цифра». */}
        {summary.mock_revenue !== null && summary.mock_revenue !== undefined ? (
          <StatCard
            label="Выручка"
            value={formatMoney(summary.mock_revenue)}
            href="/reports"
            icon={<CircleDollarSign className="h-5 w-5 text-amber-700" />}
          />
        ) : null}
        <StatCard
          label="Группы склада"
          value={summary.stock_by_material_type.length}
          href="/stock"
          icon={<Layers3 className="h-5 w-5 text-amber-700" />}
        />
        <StatCard
          label="Активные этапы"
          value={summary.production.active_stages}
          href="/production"
          icon={<Factory className="h-5 w-5 text-amber-700" />}
        />
        <StatCard
          label="Блокировки"
          value={summary.production.blocked_stages}
          href="/production"
          icon={<TriangleAlert className="h-5 w-5 text-amber-700" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <h3>Заказы по статусам</h3>
          <p className="mt-2 text-sm text-slate-600">
            Нажмите на строку — откроются заказы этого статуса.
          </p>
          <div className="mt-4 space-y-3">
            {summary.orders_by_status.map((item) => (
              <Link
                key={item.code}
                href={`/orders?status_code=${encodeURIComponent(item.code)}`}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-amber-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.code}</p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">{item.count}</p>
              </Link>
            ))}
            {!summary.orders_by_status.length ? (
              <p className="text-sm text-slate-500">Заказов пока нет.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3>Производство</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">В работе</p>
              <p className="mt-2 text-2xl font-semibold">{summary.production.in_progress_stages}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Отчетов по деталям</p>
              <p className="mt-2 text-2xl font-semibold">{summary.production.completed_reports}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Сделано деталей</p>
              <p className="mt-2 text-2xl font-semibold">{summary.production.done_quantity}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Брак</p>
              <p className="mt-2 text-2xl font-semibold">{summary.production.defect_quantity}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {summary.production.reports_by_work_center.map((item) => (
              <Link
                key={item.code}
                href="/production"
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-amber-50"
              >
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-lg font-semibold">{item.count}</p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <h3>Топ работников по отчетам</h3>
          <div className="mt-4 space-y-3">
            {summary.production.top_workers.map((item) => {
              const body = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{item.worker_name}</p>
                    <p className="text-sm text-slate-500">Отчетов: {item.reports_count}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Сделано: {item.done_quantity} | Брак: {item.defect_quantity}
                  </p>
                </>
              );
              const key = item.worker_id || item.worker_name;
              // Карточка работника есть только у заведённых в справочнике:
              // отчёт может быть подписан именем без учётной записи.
              return item.worker_id ? (
                <Link
                  key={key}
                  href={`/workers/${item.worker_id}`}
                  className="block rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-amber-50"
                >
                  {body}
                </Link>
              ) : (
                <div key={key} className="rounded-2xl bg-slate-50 px-4 py-3">
                  {body}
                </div>
              );
            })}
            {!summary.production.top_workers.length ? (
              <p className="text-sm text-slate-500">
                Статистика по работникам появится после первых отчетов по деталям.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3>Остатки по типам материалов</h3>
          <div className="mt-4 space-y-3">
            {summary.stock_by_material_type.map((item) => (
              <Link
                key={item.material_type}
                href="/stock"
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-amber-50"
              >
                <p className="font-medium text-slate-900">{item.material_type}</p>
                <p className="text-lg font-semibold">{item.count}</p>
              </Link>
            ))}
            {!summary.stock_by_material_type.length ? (
              <p className="text-sm text-slate-500">Остатков пока нет.</p>
            ) : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
