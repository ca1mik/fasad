import { BatchCutting } from "@/components/forms/batch-cutting";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api";
import { readLeadParts, type LeadPart } from "@/lib/format";
import type { Lead, Order } from "@/types/api";

/**
 * Раскрой по нескольким заявкам.
 *
 * Отдельный экран: в цехе набирают детали из разных заявок на общие листы,
 * поэтому раскрой «по одной заявке» здесь не подходит.
 */
export default async function CuttingBatchPage() {
  const [leads, directions, options, orders] = await Promise.all([
    // 100 — максимум, который принимает API; больше вернёт ошибку валидации
    api.getLeads("page=1&size=100"),
    api.getDirections(),
    api.getFilmCuttingOptions(),
    // Заказы — основной источник партии: в цех уходит проданное. Толщина и цвет
    // берутся из строк сметы, по ним раскрой делит карты.
    api.getOrders("page=1&size=100"),
  ]);
  const orderLeadParts = await readOrderLeadParts(orders, leads);

  return (
    <AppShell
      currentPath="/cutting-batch"
      containerClassName="max-w-[1960px] lg:grid-cols-[280px_minmax(0,1fr)]"
      mainClassName="space-y-4 pb-6"
    >
      <PageHeader
        eyebrow="Раскрой партией"
        title="Раскрой МДФ по нескольким заказам"
        description="Отметьте заказы — детали их сметы лягут на общие листы, а не на отдельный раскрой под каждый. Толщина и цвет берутся из строк сметы: на распиле каждая толщина идёт своей картой. На карте у каждой детали виден номер заказа, поэтому после реза их легко разложить по пачкам."
      />

      <BatchCutting
        leads={leads}
        orders={orders}
        orderLeadParts={orderLeadParts}
        directions={directions}
        options={options}
      />
    </AppShell>
  );
}

/**
 * Детали заявки для заказов, у которых смета пуста.
 *
 * Перенос заявки в смету копирует только строки с ценой, поэтому заказ,
 * посчитанный «на глаз», приезжает сюда без строк — и раньше пропадал из
 * списка партии, хотя размеры у него есть, просто лежат в заявке. Раскрой
 * листа заявку по `source_lead_id` уже дотягивает сам, здесь тот же приём.
 *
 * Доп. заказы пропускаем: доп наследует `source_lead_id` родителя, и его
 * детали удвоили бы партию.
 */
async function readOrderLeadParts(orders: Order[], leads: Lead[]) {
  const needsLead = orders.filter(
    (order) =>
      order.parent_order_id === null &&
      order.source_lead_id &&
      !(order.positions ?? []).some(
        (position) => Number(position.width) > 0 && Number(position.height) > 0,
      ),
  );
  if (!needsLead.length) {
    return {};
  }

  // Список заявок уже загружен — лишний запрос делаем только за тем, чего в нём нет.
  const known = new Map(leads.map((lead) => [lead.id, lead]));
  const missing = Array.from(
    new Set(
      needsLead
        .map((order) => order.source_lead_id as string)
        .filter((leadId) => !known.has(leadId)),
    ),
  );
  for (const lead of await Promise.all(missing.map((leadId) => api.getLead(leadId)))) {
    if (lead) {
      known.set(lead.id, lead);
    }
  }

  const parts: Record<string, LeadPart[]> = {};
  for (const order of needsLead) {
    const lead = known.get(order.source_lead_id as string);
    const leadParts = lead ? readLeadParts(lead.parsed_payload_json) : [];
    if (leadParts.length) {
      parts[order.id] = leadParts;
    }
  }
  return parts;
}
