import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkerDetailsPage({ params }: Props) {
  const { id } = await params;
  const worker = await api.getWorker(id);

  if (!worker) {
    notFound();
  }

  return (
    <AppShell currentPath="/workers">
      <PageHeader
        eyebrow={worker.role_code}
        title={worker.full_name}
        description={`Логин: ${worker.login} | Активные этапы: ${worker.active_stage_count} | Отчетов: ${worker.completed_reports_count}`}
        actions={
          <Link href="/workers" className="text-sm font-medium text-amber-700">
            Ко всем работникам
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Активные этапы</p>
          <p className="mt-2 text-3xl font-semibold">{worker.active_stage_count}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Отчеты по деталям</p>
          <p className="mt-2 text-3xl font-semibold">{worker.completed_reports_count}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Сделано</p>
          <p className="mt-2 text-3xl font-semibold">{worker.done_quantity}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Брак</p>
          <p className="mt-2 text-3xl font-semibold">{worker.defect_quantity}</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <h3>Текущие этапы</h3>
          <div className="mt-4 space-y-3">
            {worker.active_stages.length ? (
              worker.active_stages.map((stage) => (
                <div key={stage.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {stage.order?.order_number || "Заказ"} / {stage.workflow_stage.name}
                    </p>
                    <Link href={`/production/stages/${stage.id}`} className="text-sm font-medium text-amber-700">
                      Открыть этап
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Участок: {stage.workflow_stage.work_center?.name || "—"} | Статус: {stage.status}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Создан: {formatDate(stage.created_at)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">У работника сейчас нет активных этапов.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3>Последние отчеты</h3>
          <div className="mt-4 space-y-3">
            {worker.recent_reports.length ? (
              worker.recent_reports.map((report) => (
                <div key={report.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {report.part.part_code} / {report.part.name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{report.report_status}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Выполнено: {report.quantity_done} | Брак: {report.quantity_defect}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{report.comment || "Без комментария"}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(report.created_at)} | Фото: {report.photo_file_name || "нет"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">У работника пока нет отчетов.</p>
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
