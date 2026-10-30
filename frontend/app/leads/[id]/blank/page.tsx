import { notFound } from "next/navigation";

import { readLeadAddress, readLeadDueDate } from "@/components/leads/lead-fields";
import { DownloadBlank } from "@/components/print/download-blank";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { OrderBlank } from "@/components/print/order-blank";
import { api } from "@/lib/api";
import { readLeadParts } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Бланк заказа на печать — тот же лист, что студия печатает сейчас.
 *
 * Страница без общей оболочки приложения: на бумаге не нужны ни меню, ни
 * шапка. Всё, что видно на экране кроме самого бланка, помечено `print-hidden`
 * и в печать не идёт.
 */
export default async function LeadBlankPage({ params }: Props) {
  const { id } = await params;
  const lead = await api.getLead(id);

  if (!lead) {
    notFound();
  }

  const parts = readLeadParts(lead.parsed_payload_json);
  const payload = (lead.parsed_payload_json?.raw_payload ?? {}) as Record<string, unknown>;
  const blankNumber = typeof payload.blank_number === "string" ? payload.blank_number : null;
  // Заявка после приёма не меняется, а комментарий заказа менеджер может
  // поправить и позже — если заказ уже создан, показываем актуальный
  // комментарий заказа, а не замороженный текст заявки (та же логика, что и
  // в файловом бланке, leads/router.py::download_lead_blank).
  const linkedOrder = lead.summary?.orders?.[0];
  const comment = linkedOrder ? linkedOrder.comment : lead.raw_text;

  return (
    <div className="print-sheet min-h-screen bg-slate-100 py-6">
      <PrintToolbar
        backHref={`/leads/${lead.id}`}
        title={`Бланк заказа ${lead.lead_number || ""}`.trim()}
        hint={
          parts.length
            ? `Позиций: ${parts.length}`
            : "В заявке нет размеров — бланк напечатается пустым"
        }
      >
        <DownloadBlank
          leadId={lead.id}
          fileName={`Бланк заказа ${lead.lead_number || ""}`.trim()}
        />
      </PrintToolbar>

      <div className="print-page">
        <OrderBlank
          blankNumber={blankNumber}
          leadNumber={lead.lead_number}
          customer={lead.client?.full_name}
          // Адрес спрашивают ради «куда везти», и до этого он был виден только
          // в карточке клиента — бумага, которая едет с заказом, его не знала.
          //
          // Сначала адрес самой заявки: доставка бывает разовой, на объект или
          // на склад монтажников. Нет своего — берём адрес карточки, он и есть
          // «куда обычно возим». То же правило, что в файле бланка.
          address={readLeadAddress(lead.parsed_payload_json) || lead.client?.address}
          createdAt={lead.created_at}
          // Срок уже назвали клиенту при расчёте — на бумаге он и нужен, иначе
          // в цехе спрашивают дату у менеджера.
          dueDate={readLeadDueDate(lead)}
          comment={comment}
          parts={parts}
        />
      </div>
    </div>
  );
}
