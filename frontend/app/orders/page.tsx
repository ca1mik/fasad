import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DueSortLink } from "@/components/orders/due-sort-link";
import { OrderFilters } from "@/components/orders/order-filters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDateOnly,
  formatDueCountdown,
  formatMoney,
  isDueSoon,
  isOverdue,
} from "@/lib/format";
import type { Order } from "@/types/api";

type Props = {
  searchParams: Promise<{
    direction_code?: string;
    number_shape?: string;
    status_code?: string;
    exclude_status_code?: string;
    material_ordered?: string;
    search?: string;
    sort_by?: string;
    sort_dir?: string;
  }>;
};

/** Строка таблицы: сам заказ и то, доп он или основной. */
type OrderRow = { order: Order; isAdditional: boolean };

/**
 * Ставит допы сразу под их основным заказом.
 *
 * Сортировка по дате раскидывала родителя и доп по разным местам списка:
 * доп заводят через неделю после основного, между ними успевает встать десяток
 * чужих заказов. Связаны они были только текстом «доп. к 1024», без ссылки, и
 * менеджер искал второй заказ глазами по всей странице.
 *
 * Доп, чей родитель не попал в выдачу (отфильтрован или на другой странице),
 * остаётся обычной строкой — иначе он просто исчез бы из списка.
 */
function groupAdditionalUnderParent(orders: Order[]): OrderRow[] {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const rows: OrderRow[] = [];

  for (const order of orders) {
    if (order.parent_order_id && byId.has(order.parent_order_id)) {
      continue;
    }
    rows.push({ order, isAdditional: Boolean(order.parent_order_id) });
    for (const link of order.additional_orders ?? []) {
      const child = byId.get(link.id);
      if (child) {
        rows.push({ order: child, isAdditional: true });
      }
    }
  }

  return rows;
}

export default async function OrdersPage({ searchParams }: Props) {
  const filters = await searchParams;

  const query = new URLSearchParams({ page: "1", size: "100" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  const [ordersPage, directions, statuses] = await Promise.all([
    api.getOrdersPage(query.toString()),
    api.getDirections(),
    api.getOrderStatuses(),
  ]);
  const loaded = ordersPage.data;
  // Реальное количество совпадений в базе, а не длина уже обрезанной страницы
  // (сервер не отдаёт больше 100 штук за раз, см. query.set("size", "100")
  // выше). Раньше здесь считали loaded.length — старые заказы (а отменённые,
  // как правило, старые) молча выпадали из выдачи без всякого предупреждения.
  const total = ordersPage.total;
  const truncated = total > loaded.length;

  // Отбор «материал заказан / не заказан» считает сервер: фильтровать здесь
  // значило бы отбирать в пределах загруженной сотни, а нужный заказ может быть
  // и не в ней — именно так фильтр по номеру и не находил заявку.
  const rows = groupAdditionalUnderParent(loaded);

  // Клик по заголовку «Срок»: сортировка по возрастанию/убыванию, остальные
  // фильтры и поиск остаются как были.
  const dueSortActive = filters.sort_by === "due_date";
  const nextDueSortDir = dueSortActive && filters.sort_dir === "asc" ? "desc" : "asc";
  const dueSortHref = (() => {
    const params = new URLSearchParams(query);
    params.set("sort_by", "due_date");
    params.set("sort_dir", nextDueSortDir);
    params.delete("page");
    params.delete("size");
    return `/orders?${params.toString()}`;
  })();

  return (
    <AppShell currentPath="/orders">
      <PageHeader
        eyebrow="Заказы"
        title="Заказы клиентов"
        description="Фильтруйте по типу заказа, направлению, статусу и отметке «материал заказан». Тип определяется формой номера: просто номер, номер и буква, номер и две буквы. Доп. заказы стоят сразу под своим основным."
        actions={
          <Button asChild variant="outline">
            <Link href="/manager">Рабочее место менеджера</Link>
          </Button>
        }
      />

      <Card>
        <OrderFilters
          directions={directions}
          statuses={statuses}
          active={filters}
          total={total}
        />
      </Card>

      {truncated ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Показаны первые {loaded.length} из {total} — среди непоказанных могут быть, например,
          старые отменённые заказы. Сузьте отбор по статусу или направлению, чтобы увидеть остальные.
        </p>
      ) : null}

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Заказ</TH>
              <TH>Направление</TH>
              <TH>Клиент</TH>
              <TH>Статус</TH>
              <TH>Оплата</TH>
              <TH>Сумма</TH>
              <TH>
                {/* Клик — по возрастанию/убыванию срока, стрелка показывает
                    текущее направление. Заказчик: «сделай фильтр, чтобы
                    сортировало от большего к меньшему и наоборот». */}
                <DueSortLink href={dueSortHref}>
                  Срок
                  {dueSortActive ? (
                    <span aria-hidden>{filters.sort_dir === "desc" ? "↓" : "↑"}</span>
                  ) : (
                    <span aria-hidden className="text-slate-300">
                      ↕
                    </span>
                  )}
                </DueSortLink>
              </TH>
              <TH>Создан</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map(({ order, isAdditional }) => (
              <TR key={order.id}>
                <TD className="font-medium text-slate-900">
                  {/* Доп сдвинут вправо и подписан ссылкой на родителя: так в
                      списке видно, что это пристройка к соседней строке сверху,
                      а не отдельный заказ, свалившийся сюда по дате. */}
                  <div className={isAdditional ? "pl-5" : undefined}>
                    <Link href={`/orders/${order.id}`} className="hover:underline">
                      {isAdditional ? "└ " : ""}
                      {order.order_number}
                    </Link>
                    {order.additional_orders_count ? (
                      <span className="block text-xs font-normal text-slate-500">
                        {order.additional_orders_count} доп.{" "}
                        {order.additional_orders_count === 1 ? "заказ" : "заказа"}
                      </span>
                    ) : null}
                    {order.parent_order_number ? (
                      <Link
                        href={`/orders/${order.parent_order_id}`}
                        className="block text-xs font-normal text-amber-700 hover:underline"
                      >
                        доп. к {order.parent_order_number}
                      </Link>
                    ) : null}
                    {/* Заменяет заливку ячейки в экселе. Показываем всегда
                        одно из трёх состояний: «не заказан» — это как раз тот
                        список, с которым утром звонят поставщику, и его
                        отсутствие читалось как «данных нет», а не как «надо
                        заказать». «Заказан» после отгрузки сменяется на
                        «отгружен» — иначе бейдж молча врёт, что материал ещё
                        только едет, хотя он уже на складе/у сборщика. */}
                    <span
                      className={
                        order.shipped_at
                          ? "mt-1 inline-block rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-normal text-sky-700"
                          : order.material_ordered
                            ? "mt-1 inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700"
                            : "mt-1 inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-700"
                      }
                    >
                      {order.shipped_at
                        ? "материал отгружен"
                        : order.material_ordered
                          ? "материал заказан"
                          : "материал не заказан"}
                    </span>
                  </div>
                </TD>
                <TD>{order.direction?.name || "—"}</TD>
                <TD>
                  <div>
                    {order.client_id ? (
                      <Link
                        href={`/clients/${order.client_id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {order.client?.full_name || "—"}
                      </Link>
                    ) : (
                      <p>{order.client?.full_name || "—"}</p>
                    )}
                    {order.client?.organization ? (
                      <p className="text-xs text-slate-500">{order.client.organization}</p>
                    ) : null}
                  </div>
                </TD>
                <TD>{order.status?.name || "—"}</TD>
                <TD className="whitespace-nowrap">
                  <span
                    className={cn(
                      order.balance?.status === "Долг" ? "font-medium text-rose-700" : "text-slate-700",
                    )}
                  >
                    {order.balance?.status ?? "—"}
                  </span>
                </TD>
                <TD className="whitespace-nowrap">
                  {formatMoney(order.final_amount, order.currency)}
                </TD>
                {/* Срок с отсчётом: дата сама по себе требует счёта по
                    календарю, а в списке нужно видеть, что горит. Просрочен —
                    красным; вот-вот станет просроченным (заказчик: «2-3 дня»)
                    — тем же красным, но не жирным, чтобы не путать с уже
                    случившейся просрочкой. */}
                <TD className="whitespace-nowrap">
                  {order.due_date ? (
                    <span
                      className={cn(
                        isOverdue(order.due_date) && "font-semibold text-rose-700",
                        !isOverdue(order.due_date) && isDueSoon(order.due_date) && "text-rose-700",
                      )}
                    >
                      {formatDateOnly(order.due_date)}
                      <span className="block text-xs text-slate-500">
                        {formatDueCountdown(order.due_date)}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="whitespace-nowrap">{formatDate(order.created_at)}</TD>
                <TD>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/film-cutting?orderId=${order.id}`}>Раскрой</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/orders/${order.id}`}>Открыть</Link>
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {!rows.length ? (
          <p className="mt-4 text-sm text-slate-500">
            По выбранным фильтрам заказов нет. Сбросьте фильтры или измените условия поиска.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
