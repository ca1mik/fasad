import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function WorkersPage() {
  const [workers, myCard] = await Promise.all([api.getWorkers(), api.getMyWorkerCard()]);

  return (
    <AppShell currentPath="/workers">
      <PageHeader
        eyebrow="Производство"
        title="Работники"
        description="Карточки работников производства: текущая нагрузка, последние отчеты и переход к этапам, по которым они отвечают."
        actions={
          myCard ? (
            <Link href={`/workers/${myCard.id}`} className="text-sm font-medium text-amber-700">
              Открыть мою карточку
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Работников в контуре</p>
          <p className="mt-2 text-3xl font-semibold">{workers.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Активные этапы</p>
          <p className="mt-2 text-3xl font-semibold">
            {workers.reduce((sum, worker) => sum + worker.active_stage_count, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Отчётов по деталям</p>
          <p className="mt-2 text-3xl font-semibold">
            {workers.reduce((sum, worker) => sum + worker.completed_reports_count, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Сделано деталей</p>
          <p className="mt-2 text-3xl font-semibold">
            {workers.reduce((sum, worker) => sum + worker.done_quantity, 0)}
          </p>
        </Card>
      </section>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Работник</TH>
              <TH>Роль</TH>
              <TH>Активные этапы</TH>
              <TH>Отчеты</TH>
              <TH>Сделано</TH>
              <TH>Брак</TH>
              <TH>Последний отчет</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {workers.map((worker) => (
              <TR key={worker.id}>
                <TD className="font-medium text-slate-900">{worker.full_name}</TD>
                <TD>{worker.role_name}</TD>
                <TD>{worker.active_stage_count}</TD>
                <TD>{worker.completed_reports_count}</TD>
                <TD>{worker.done_quantity}</TD>
                <TD>{worker.defect_quantity}</TD>
                <TD>{formatDate(worker.last_report_at)}</TD>
                <TD>
                  <Link href={`/workers/${worker.id}`} className="text-sm font-medium text-amber-700">
                    Карточка
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {!workers.length ? <p className="mt-4 text-sm text-slate-500">Работники пока не найдены.</p> : null}
      </Card>
    </AppShell>
  );
}
