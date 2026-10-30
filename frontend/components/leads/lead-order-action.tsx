import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { LeadCreateOrderButton } from "@/components/forms/lead-create-order-button";
import { type LeadOrderRef } from "@/components/leads/lead-fields";
import { Button } from "@/components/ui/button";

type Props = {
  leadId: string;
  orders: LeadOrderRef[];
};

/**
 * Что делать с заявкой дальше: завести заказ или перейти в уже заведённый.
 *
 * Заказ по заявке один. Раньше кнопка «Создать заказ» стояла на карточке
 * всегда, а повторное нажатие молча возвращало старый заказ — с виду всё
 * получилось, на деле не создалось ничего, и менеджер шёл искать «новый» заказ
 * в списке. Поэтому у заявки с заказом кнопки нет вовсе: вместо неё ссылка на
 * тот самый заказ, по номеру, который менеджер называет клиенту.
 *
 * Второй заказ по той же заявке — это доп. заказ, и заводится он из карточки
 * заказа, где видно, к чему он дополнение.
 */
export function LeadOrderAction({ leadId, orders }: Props) {
  if (!orders.length) {
    return <LeadCreateOrderButton leadId={leadId} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {orders.map((order) => (
        <Button key={order.id} asChild variant="secondary">
          <Link href={`/orders/${order.id}`}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Заказ {order.order_number}
          </Link>
        </Button>
      ))}
    </div>
  );
}
