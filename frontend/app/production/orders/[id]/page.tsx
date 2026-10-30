import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductionBootstrapButton } from "@/components/forms/production-bootstrap-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductionOrderPage({ params }: Props) {
  const { id } = await params;
  const [order, stages] = await Promise.all([api.getOrder(id), api.getOrderStages(id)]);

  if (!order) {
    notFound();
  }

  const activeStage = stages.find((item) => item.status !== "done") || null;
  const completedCount = stages.filter((item) => item.status === "done").length;

  return (
    <AppShell currentPath="/production">
      <PageHeader
        eyebrow="Заказ в производстве"
        title={order.order_number}
        description={`Клиент: ${order.client?.full_name || "—"} | Коммерческий статус: ${order.status?.name || "—"}`}
        actions={<ProductionBootstrapButton orderId={order.id} disabled={stages.length > 0} />}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Активный этап</p>
          <p className="mt-2 text-2xl font-semibold">{activeStage?.workflow_stage.name || "Не запущен"}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Завершено этапов</p>
          <p className="mt-2 text-2xl font-semibold">{completedCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Всего этапов в истории</p>
          <p className="mt-2 text-2xl font-semibold">{stages.length}</p>
        </Card>
      </section>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3>Маршрут заказа</h3>
            <p className="mt-2 text-sm text-slate-700">
              Здесь фиксируется фактическое прохождение заказа по участкам. Каждый этап открывается отдельно и содержит
              отчеты по деталям.
            </p>
          </div>
          <Link href={`/orders/${order.id}`} className="text-sm font-medium text-amber-700">
            Вернуться к заказу
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          {stages.map((stage) => (
            <div key={stage.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{stage.workflow_stage.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {stage.workflow_stage.work_center?.name || "Без участка"} | Статус: {stage.status}
                  </p>
                </div>
                <Link href={`/production/stages/${stage.id}`} className="text-sm font-medium text-amber-700">
                  Открыть этап
                </Link>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-4">
                <p>Старт: {formatDate(stage.started_at)}</p>
                <p>Завершение: {formatDate(stage.completed_at)}</p>
                <p>Файлов: {stage.evidence.length}</p>
                <p>Исполнитель: {stage.assigned_user?.full_name || "—"}</p>
              </div>
              {stage.blocked_reason ? (
                <p className="mt-3 text-sm text-red-600">Блокировка: {stage.blocked_reason}</p>
              ) : null}
            </div>
          ))}
          {!stages.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Workflow ещё не запущен. Нажмите `Запустить workflow`, чтобы создать первый производственный этап.
            </div>
          ) : null}
        </div>
      </Card>
    </AppShell>
  );
}
