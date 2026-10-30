import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function ProductionPage() {
  const [queue, workflows, workers, dashboard] = await Promise.all([
    api.getProductionQueue(),
    api.getProductionWorkflows(),
    api.getWorkers(),
    api.getDashboard(),
  ]);

  const blockedCount = queue.filter((item) => item.status === "blocked").length;
  const inProgressCount = queue.filter((item) => item.status === "in_progress").length;
  const pendingCount = queue.filter((item) => item.status === "pending").length;

  return (
    <AppShell currentPath="/production">
      <PageHeader
        eyebrow="Производство"
        title="Производство"
        description="Очередь этапов, загрузка работников, маршруты заказа и фиксация фактического выполнения по деталям."
        actions={
          <div className="flex items-center gap-4">
            <Link href="/production/queue" className="text-sm font-medium text-amber-700">
              Очередь
            </Link>
            <Link href="/workers" className="text-sm font-medium text-amber-700">
              Работники
            </Link>
          </div>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Активные этапы</p>
          <p className="mt-2 text-3xl font-semibold">{queue.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">В работе</p>
          <p className="mt-2 text-3xl font-semibold">{inProgressCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Ожидают запуска</p>
          <p className="mt-2 text-3xl font-semibold">{pendingCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Блокировки</p>
          <p className="mt-2 text-3xl font-semibold">{blockedCount}</p>
        </Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3>Очередь производства</h3>
              <p className="mt-2 text-sm text-slate-700">
                Этапы, которые сейчас ждут старта, выполняются или заблокированы. Отсюда удобно переходить в карточку этапа
                и смотреть прогресс по деталям.
              </p>
            </div>
            <Link href="/production/queue" className="text-sm font-medium text-amber-700">
              Открыть очередь
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {queue.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                href={`/production/stages/${item.id}`}
                className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {item.order?.order_number || "Заказ"} / {item.workflow_stage.name}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.status}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Участок: {item.workflow_stage.work_center?.name || "Не назначен"} | Исполнитель:{" "}
                  {item.assigned_user?.full_name || "Не назначен"}
                </p>
              </Link>
            ))}
            {!queue.length ? <p className="text-sm text-slate-500">Активных этапов пока нет.</p> : null}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <h3>Работники в производстве</h3>
            <div className="mt-4 space-y-3">
              {workers.slice(0, 5).map((worker) => (
                <Link key={worker.id} href={`/workers/${worker.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{worker.full_name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{worker.role_code}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Активные этапы: {worker.active_stage_count} | Отчёты: {worker.completed_reports_count}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <h3>Маршруты производства</h3>
            <p className="mt-2 text-sm text-slate-700">Базовые workflows, которые можно применять к заказам.</p>
            <div className="mt-4 space-y-4">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{workflow.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {workflow.is_default ? "default" : "custom"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{workflow.description || "Без описания"}</p>
                  <p className="mt-3 text-sm text-slate-500">
                    Этапов: {workflow.stages.length} | Отчётов по деталям: {dashboard.production.completed_reports}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
