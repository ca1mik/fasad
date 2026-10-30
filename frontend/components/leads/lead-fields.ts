import type { Lead, LeadOrderRef, LeadSummary } from "@/types/api";

/**
 * Чтение полей заявки, которых нет в жёсткой форме.
 *
 * Срок и заказы теперь описаны в общем типе и читаются напрямую. Отдельно
 * остаётся адрес доставки: он лежит внутри `parsed_payload_json` — свободного
 * JSON с разобранными полями заявки, — и типом его не описать.
 */

/** Срок, названный клиенту. Пусто — срок ещё не обещали. */
export function readLeadDueDate(lead: Lead): string {
  return lead.due_date ?? "";
}

/**
 * Адрес доставки этой заявки.
 *
 * Он живёт при заявке, а не в карточке клиента: доставка бывает разовой — на
 * объект, на склад монтажников, — и юридический адрес заказчика от неё
 * меняться не должен.
 */
export function readLeadAddress(payload: Record<string, unknown> | null | undefined): string {
  const value = payload?.address;
  return typeof value === "string" ? value.trim() : "";
}

export type { LeadOrderRef };

/** Заказы заявки: по ним карточка даёт ссылку, а не одно только «заказов: 1». */
export function readLeadOrders(summary: LeadSummary | null | undefined): LeadOrderRef[] {
  return summary?.orders ?? [];
}
