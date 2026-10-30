import Link from "next/link";

import { FilmCuttingPlanner } from "@/components/forms/film-cutting-planner";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Props = {
  searchParams: Promise<{
    orderId?: string | string[];
    leadId?: string | string[];
    type?: string | string[];
  }>;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FilmCuttingPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = getSingleValue(params.orderId);
  // раскрой можно открыть и от заявки, до того как появился заказ:
  // менеджер считает материал прямо на встрече с клиентом
  const leadId = getSingleValue(params.leadId);
  // Ссылки «Раскрой МДФ» / «Раскрой плёнки» на карточке заказа приходят с
  // готовым выбором типа работы — иначе он всегда открывался на «Распил».
  const typeParam = getSingleValue(params.type);
  const initialWorkKind = typeParam === "film" ? "film" : typeParam === "cutting" ? "cutting" : undefined;
  const [options, orderContext, directLead, priceItems, referenceValues] = await Promise.all([
    api.getFilmCuttingOptions(),
    orderId ? api.getOrder(orderId) : Promise.resolve(null),
    leadId ? api.getLead(leadId) : Promise.resolve(null),
    // справочники для таблицы бланка: артикулы для расчёта, цвета и
    // фрезеровки — подсказками, чтобы одно и то же не писали по-разному
    api.getPriceItems(),
    api.getReferenceValues(),
  ]);
  const leadContext =
    directLead ??
    (orderContext?.source_lead_id ? await api.getLead(orderContext.source_lead_id) : null);

  return (
    <AppShell
      currentPath="/film-cutting"
      containerClassName="max-w-[1960px] lg:grid-cols-[280px_minmax(0,1fr)]"
      mainClassName="space-y-4 pb-6"
    >
      <section className="panel flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:p-5">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-slate-700">
              {orderContext ? "Раскрой по заказу" : directLead ? "Раскрой по заявке" : "Раскрой листа"}
            </Badge>
            {orderContext ? (
              <Badge className="bg-slate-50 text-slate-700">Заказ {orderContext.order_number}</Badge>
            ) : null}
            {!orderContext && directLead?.lead_number ? (
              <Badge className="bg-slate-50 text-slate-700">Заявка {directLead.lead_number}</Badge>
            ) : null}
            {/* Заказчик: «раскрой заказа — это не раскрой заказа, а МДФ; если
                плёнка — то и раскрой плёнки, и распил МДФ». Явная подпись
                типа, с которым открыт инструмент, чтобы не путать. */}
            {initialWorkKind ? (
              <Badge className="bg-slate-50 text-slate-700">
                {initialWorkKind === "film" ? "Раскрой плёнки" : "Раскрой МДФ (распил)"}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {orderContext
                ? `Раскрой ${initialWorkKind === "film" ? "плёнки" : "МДФ"} для заказа ${orderContext.order_number}`
                : directLead
                  ? `Раскрой по заявке ${directLead.lead_number || ""}`.trim()
                  : "Онлайн-раскрой листа"}
            </h1>
            <p className="max-w-4xl text-sm leading-6 text-slate-700">
              {orderContext
                ? "Этот раскрой уже связан с заказом. Менеджер может разложить детали по листам и сохранить результат прямо в историю этого заказа."
                : directLead
                  ? `Раскрой открыт из заявки${directLead.client ? ` клиента ${directLead.client.full_name}` : ""}. Внесите размеры списком, а после согласования создайте заказ из карточки заявки.`
                  : "Прямой рабочий экран для менеджера: ввести детали, разложить их по листам, проверить остатки и при необходимости сразу сохранить результат в CRM."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {orderContext ? (
            <Button asChild variant="outline">
              <Link href={`/orders/${orderContext.id}`}>Вернуться в заказ</Link>
            </Button>
          ) : directLead ? (
            <Button asChild variant="outline">
              <Link href={`/leads/${directLead.id}`}>Вернуться в заявку</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/manager">Рабочее место менеджера</Link>
            </Button>
          )}
        </div>
      </section>

      <FilmCuttingPlanner
        options={options}
        priceItems={priceItems}
        referenceValues={referenceValues}
        orderContext={orderContext}
        leadContext={leadContext}
        initialWorkKind={initialWorkKind}
      />
    </AppShell>
  );
}
