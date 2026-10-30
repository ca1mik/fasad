import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, labelFor } from "@/lib/labels";

/** Короткая сводка изменения: что поменялось, без простыни JSON в каждой строке. */
function summarize(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "—";
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== null && item !== "" && typeof item !== "object",
  );
  if (!entries.length) {
    return "—";
  }
  return entries
    .slice(0, 4)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(", ");
}

export default async function AdminAuditPage() {
  const events = await api.getAuditLog();

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Журнал действий"
        description="Кто и что менял: клиенты, заявки, заказы, этапы производства, пользователи и права. Подробности каждой записи раскрываются по клику."
      />
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Последние записи</h2>
          <Badge>{events.length} шт.</Badge>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Записей пока нет.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Объект</TH>
                <TH>Действие</TH>
                <TH>Что изменилось</TH>
                <TH>Когда</TH>
              </TR>
            </THead>
            <TBody>
              {events.map((event) => {
                const payload = event.new_value_json ?? event.old_value_json ?? null;
                return (
                  <TR key={event.id}>
                    <TD>
                      <p className="font-medium text-slate-900">
                        {labelFor(AUDIT_ENTITY_LABELS, event.entity_type)}
                      </p>
                      <p className="num mt-1 text-xs text-slate-500">{event.entity_id}</p>
                    </TD>
                    <TD>{labelFor(AUDIT_ACTION_LABELS, event.action)}</TD>
                    <TD className="max-w-[420px]">
                      <p className="break-words text-sm text-slate-700">{summarize(payload)}</p>
                      {payload ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                            Показать полностью
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </TD>
                    <TD className="num whitespace-nowrap">{formatDate(event.created_at)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </AppShell>
  );
}
