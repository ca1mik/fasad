import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function ProductionQueuePage() {
  const queue = await api.getProductionQueue();

  return (
    <AppShell currentPath="/production">
      <PageHeader
        eyebrow="Производство"
        title="Очередь производства"
        description="Очередь участков по активным этапам. Отсюда открываем карточку этапа, смотрим прогресс деталей и фиксируем выполнение."
      />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Заказ</TH>
              <TH>Этап</TH>
              <TH>Участок</TH>
              <TH>Статус</TH>
              <TH>Исполнитель</TH>
              <TH>Создан</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {queue.map((item) => (
              <TR key={item.id}>
                <TD className="font-medium text-slate-900">{item.order?.order_number || "—"}</TD>
                <TD>{item.workflow_stage.name}</TD>
                <TD>{item.workflow_stage.work_center?.name || "—"}</TD>
                <TD>
                  <StatusBadge kind="stage" value={item.status} />
                </TD>
                <TD>{item.assigned_user?.full_name || "—"}</TD>
                <TD>{formatDate(item.created_at)}</TD>
                <TD>
                  <Link href={`/production/stages/${item.id}`} className="text-sm font-medium text-amber-700">
                    Открыть
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!queue.length ? <p className="mt-4 text-sm text-slate-500">Очередь пока пуста.</p> : null}
      </Card>
    </AppShell>
  );
}
