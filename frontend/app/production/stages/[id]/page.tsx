import Link from "next/link";
import { notFound } from "next/navigation";

import { PartReportForm } from "@/components/forms/part-report-form";
import { StageActions } from "@/components/forms/stage-actions";
import { StageEvidenceForm } from "@/components/forms/stage-evidence-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductionStagePage({ params }: Props) {
  const { id } = await params;
  const [stage, partProgress] = await Promise.all([
    api.getProductionStage(id),
    api.getStagePartProgress(id),
  ]);

  if (!stage) {
    notFound();
  }

  const totalRequired = partProgress.reduce((sum, item) => sum + item.required_quantity, 0);
  const totalReported = partProgress.reduce((sum, item) => sum + item.reported_quantity, 0);
  const totalDefect = partProgress.reduce((sum, item) => sum + item.defect_quantity, 0);

  return (
    <AppShell currentPath="/production">
      <PageHeader
        eyebrow={stage.status}
        title={stage.workflow_stage.name}
        description={`Заказ: ${stage.order?.order_number || "—"} | Участок: ${stage.workflow_stage.work_center?.name || "—"}`}
        actions={
          stage.order ? (
            <Link href={`/production/orders/${stage.order.id}`} className="text-sm font-medium text-amber-700">
              К маршруту заказа
            </Link>
          ) : null
        }
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Card>
            <h3>Информация по этапу</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>Код этапа: {stage.workflow_stage.code}</p>
              <p>Статус: {stage.status}</p>
              <p>Исполнитель: {stage.assigned_user?.full_name || "Не назначен"}</p>
              <p>Создан: {formatDate(stage.created_at)}</p>
              <p>Старт: {formatDate(stage.started_at)}</p>
              <p>Завершение: {formatDate(stage.completed_at)}</p>
              <p>Требуется фото: {stage.workflow_stage.requires_photo ? "Да" : "Нет"}</p>
              <p>Требуется комментарий: {stage.workflow_stage.requires_comment ? "Да" : "Нет"}</p>
            </div>
            {stage.comment ? <p className="mt-4 text-sm text-slate-700">Комментарий: {stage.comment}</p> : null}
            {stage.blocked_reason ? (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                Блокировка: {stage.blocked_reason}
              </p>
            ) : null}
          </Card>

          <Card>
            <h3>Отчет работника по деталям</h3>
            <p className="mt-2 text-sm text-slate-700">
              Работник отмечает конкретную деталь на конкретном этапе. Так мы видим не просто статус этапа, а факт выполнения
              по каждой детали заказа.
            </p>
            <div className="mt-4">
              <PartReportForm stageId={stage.id} parts={partProgress} />
            </div>
          </Card>

          <Card>
            <h3>Фото и подтверждения этапа</h3>
            <p className="mt-2 text-sm text-slate-700">
              Общие фотографии этапа: рабочее место, партия деталей, проверка качества, упаковка или блокирующая проблема.
            </p>
            <div className="mt-4">
              <StageEvidenceForm stageId={stage.id} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3>Действия по этапу</h3>
            <p className="mt-2 text-sm text-slate-700">
              Этап можно взять в работу, завершить или заблокировать. Завершение теперь опирается на отчеты по деталям.
            </p>
            <div className="mt-4">
              <StageActions
                stageId={stage.id}
                currentStatus={stage.status}
                requiresComment={stage.workflow_stage.requires_comment}
              />
            </div>
          </Card>

          <Card>
            <h3>Прогресс по деталям</h3>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Требуется: {totalRequired} | Отмечено: {totalReported} | Брак: {totalDefect}
            </div>
            <div className="mt-4 space-y-3">
              {partProgress.length ? (
                partProgress.map((item) => (
                  <div key={item.part.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {item.part.part_code} / {item.part.name}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Осталось {item.remaining_quantity}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Требуется {item.required_quantity}, сделано {item.done_quantity}, брак {item.defect_quantity}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Последний отчет: {formatDate(item.last_report_at)} | {item.last_worker?.full_name || "—"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Для этапа пока нет деталей. Сначала сгенерируйте parts по заказу.</p>
              )}
            </div>
          </Card>

          <Card>
            <h3>Последние отчеты по деталям</h3>
            <div className="mt-4 space-y-3">
              {partProgress.flatMap((item) => item.reports).length ? (
                partProgress
                  .flatMap((item) => item.reports)
                  .sort((left, right) => right.created_at.localeCompare(left.created_at))
                  .slice(0, 12)
                  .map((report) => (
                    <div key={report.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">
                          {report.part.part_code} / {report.worker?.full_name || "Система"}
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
                <p className="text-sm text-slate-500">Отчетов по деталям пока нет.</p>
              )}
            </div>
          </Card>

          <Card>
            <h3>История назначений и доказательств</h3>
            <div className="mt-4 space-y-3">
              {stage.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">
                    {assignment.assigned_user?.full_name || "Без исполнителя"}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{assignment.comment || "Без комментария"}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(assignment.assigned_at)} | {assignment.assigned_by_user?.full_name || "Система"}
                  </p>
                </div>
              ))}
              {stage.evidence.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">{item.file_name}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.comment || "Без комментария"}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(item.created_at)} | {item.uploaded_by_user?.full_name || "Система"}
                  </p>
                </div>
              ))}
              {!stage.assignments.length && !stage.evidence.length ? (
                <p className="text-sm text-slate-500">По этапу пока нет ни назначений, ни общих вложений.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
