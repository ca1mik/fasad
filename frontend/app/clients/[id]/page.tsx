import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientDetailsForm } from "@/components/forms/client-details-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DownloadButton } from "@/components/ui/download-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

/** Пункт 3 ТЗ: карточка клиента с историей заказов — дата, сумма, состав. */
export default async function ClientCardPage({ params }: Props) {
  const { id } = await params;
  const client = await api.getClient(id);

  if (!client) {
    notFound();
  }

  const { totals } = client;
  const stale = totals.days_since_last_order !== null && totals.days_since_last_order > 90;
  const statement = client.statement;
  const balance = statement?.balance ?? null;
  // Плюс — аванс, минус — долг. Цветом это читается быстрее, чем знаком.
  const balanceValue = Number(balance?.balance ?? 0);
  const balanceTone =
    balanceValue < 0
      ? "bg-rose-50 text-rose-700"
      : balanceValue > 0
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-700";

  return (
    <AppShell currentPath="/clients">
      <PageHeader
        eyebrow="Карточка клиента"
        title={client.full_name}
        description={
          client.organization
            ? `${client.organization} · история заказов и сумма покупок`
            : "История заказов и сумма покупок"
        }
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <DownloadButton
              path={`/clients/${client.id}/statement.xlsx`}
              variant="secondary"
            >
              Выписка в Excel
            </DownloadButton>
            <Link
              href="/clients"
              className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              К списку клиентов
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Заказов" value={String(totals.orders_count)} />
        <StatCard label="Сумма покупок" value={formatMoney(totals.total_amount, totals.currency)} />
        <StatCard
          label="Последний заказ"
          value={totals.last_order_at ? formatDate(totals.last_order_at) : "Заказов ещё не было"}
        />
        <StatCard
          label="Не покупал"
          value={
            totals.days_since_last_order === null
              ? "—"
              : `${totals.days_since_last_order} дн.`
          }
        />
      </section>

      {/* Баланс: то же, что заказчик ведёт руками как «сумма / оплата /
          разница». Стоит выше истории — на него смотрят первым. */}
      {balance ? (
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Взаиморасчёты</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Баланс клиента</h2>
              <p className="mt-1 text-sm text-slate-700">
                Начислено по заказам минус поступившие деньги. Плюс — аванс, минус — долг.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Начислено</p>
              <p className="num mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(balance.charged, balance.currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Оплачено</p>
              <p className="num mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(balance.paid, balance.currency)}
              </p>
            </div>
            <div className={cn("rounded-2xl px-4 py-3", balanceTone)}>
              <p className="text-xs uppercase tracking-[0.12em] opacity-70">{balance.status}</p>
              <p className="num mt-1 text-lg font-semibold">
                {formatMoney(balance.balance, balance.currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Не закрыто</p>
              <p className="num mt-1 text-lg font-semibold text-slate-900">
                {balance.unpaid_orders} из {balance.orders_count}
              </p>
              <p className="num text-xs text-slate-500">
                долг {formatMoney(balance.due_total, balance.currency)}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Реквизиты и заказы идут строками, а не колонками: в таблице заказов
          появились «Начислено», «Оплачено» и «Долг» — в половине ширины они
          уезжали за правый край, а это те самые цифры, ради которых её открывают */}
      <section className="grid gap-6">
        <Card className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Контакты</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Реквизиты</h2>
          </div>

          {/* Правится прямо здесь: телефон с опечаткой или новый адрес не
              должны требовать похода через заявку. */}
          <ClientDetailsForm client={client} />

          {stale ? (
            <div className="rounded-2xl bg-amber-100 p-4 text-sm text-slate-700">
              Клиент не заказывал больше трёх месяцев — повод позвонить.
            </div>
          ) : null}
        </Card>

        {/* Расчёты идут перед заказами: посчитанное и не купленное — это то,
            с чем менеджер работает сегодня, а заказы уже в деле.
            Заказчик: «сдала клиента, 2 заказа посчитала, но их здесь нет». */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Расчёты</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Посчитано клиенту
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                {client.pending_calculations_count
                  ? `Ждут ответа: ${client.pending_calculations_count} на ${formatMoney(
                      client.pending_calculations_amount,
                    )}. В выручку не входят, пока не стали заказом.`
                  : "Все расчёты закрыты заказами или отказом."}
              </p>
            </div>
            <Badge>{client.calculations.length} шт.</Badge>
          </div>

          {client.calculations.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Заявка</TH>
                  <TH>Дата</TH>
                  <TH>Срок</TH>
                  <TH>Деталей</TH>
                  <TH>Площадь</TH>
                  <TH>Посчитано</TH>
                  <TH>Состояние</TH>
                </TR>
              </THead>
              <TBody>
                {client.calculations.map((item) => (
                  <TR key={item.id}>
                    <TD className="num font-medium">
                      <Link
                        href={`/leads/${item.id}`}
                        className="text-amber-700 hover:underline"
                      >
                        {item.lead_number || "без номера"}
                      </Link>
                    </TD>
                    <TD className="num whitespace-nowrap">{formatDate(item.created_at)}</TD>
                    <TD className="num whitespace-nowrap">
                      {item.due_date ? formatDate(item.due_date) : "—"}
                    </TD>
                    <TD className="num">{item.quantity}</TD>
                    <TD className="num whitespace-nowrap">{item.facade_area_sqm} м²</TD>
                    <TD className="num whitespace-nowrap">
                      {item.estimated_amount ? (
                        formatMoney(item.estimated_amount, item.currency)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TD>
                    <TD>
                      {item.order_number ? (
                        <Link
                          href={`/orders/${item.order_id}`}
                          className="text-amber-700 hover:underline"
                        >
                          заказ {item.order_number}
                        </Link>
                      ) : (
                        <Badge className="bg-amber-100 text-slate-700">{item.status_label}</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500">
              Расчётов пока нет. Посчитайте клиенту в заявке — расчёт появится здесь.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">История</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Заказы клиента</h2>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Заказ</TH>
                <TH>Дата</TH>
                <TH>Направление</TH>
                <TH>Состав</TH>
                <TH>Статус</TH>
                <TH>Начислено</TH>
                <TH>Оплачено</TH>
                <TH>Долг</TH>
                <TH>Раскрой</TH>
              </TR>
            </THead>
            <TBody>
              {client.order_history.map((order) => {
                // расчёты по заказу приходят отдельным разрезом — сопоставляем
                // их по id, чтобы в истории было видно и долг, и переплату
                const settled = statement?.orders.find((item) => item.order_id === order.id);
                return (
                <TR key={order.id}>
                  <TD className="num font-medium">
                    <Link href={`/orders/${order.id}`} className="text-amber-700 hover:underline">
                      {order.order_number}
                    </Link>
                  </TD>
                  <TD className="num whitespace-nowrap">{formatDate(order.created_at)}</TD>
                  <TD>
                    {order.direction_name ? (
                      <Badge className="bg-slate-50 text-slate-700">{order.direction_name}</Badge>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    {order.items_summary || "Позиции не добавлены"}
                    {order.items_count ? (
                      <span className="block text-xs text-slate-500">
                        позиций: {order.items_count}
                      </span>
                    ) : null}
                  </TD>
                  <TD>{order.status_name || "—"}</TD>
                  <TD className="num whitespace-nowrap font-medium text-slate-900">
                    {formatMoney(order.final_amount, order.currency)}
                  </TD>
                  <TD className="num whitespace-nowrap">
                    {settled ? formatMoney(settled.paid, settled.currency) : "—"}
                    {settled && settled.payments_count ? (
                      <span className="block text-xs text-slate-500">
                        оплат: {settled.payments_count}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="num whitespace-nowrap">
                    {!settled ? (
                      "—"
                    ) : Number(settled.due) > 0 ? (
                      <span className="font-medium text-rose-700">
                        {formatMoney(settled.due, settled.currency)}
                      </span>
                    ) : Number(settled.overpaid) > 0 ? (
                      <span className="font-medium text-emerald-700">
                        +{formatMoney(settled.overpaid, settled.currency)}
                      </span>
                    ) : (
                      <span className="text-slate-400">закрыт</span>
                    )}
                  </TD>
                  {/* раскрой открывается прямо из истории заказов клиента:
                      менеджеру не нужно идти в заказ, чтобы посчитать материал */}
                  <TD>
                    <Link
                      href={`/film-cutting?orderId=${order.id}`}
                      className="whitespace-nowrap text-sm font-medium text-amber-700 hover:underline"
                    >
                      Раскрой
                    </Link>
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table>

          {!client.order_history.length ? (
            <p className="text-sm text-slate-500">
              У клиента ещё нет заказов. Создайте заказ из заявки — он появится здесь.
            </p>
          ) : null}
        </Card>
      </section>

      {/* Лента поступлений: когда, сколько, откуда пришло и каким стал баланс.
          Именно этого не хватало, чтобы понять, из чего сложился долг. */}
      {statement && statement.ledger.length ? (
        <Card className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                История расчётов
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Начисления и поступления
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-700">
                Свежее сверху. «Баланс после» показывает, каким стал долг или аванс сразу после
                этого события.
              </p>
            </div>
            <DownloadButton path={`/clients/${client.id}/statement.xlsx`} variant="outline">
              Скачать выписку
            </DownloadButton>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Дата</TH>
                <TH>Событие</TH>
                <TH>Заказ</TH>
                <TH>Начислено</TH>
                <TH>Поступило</TH>
                <TH>Откуда</TH>
                <TH>Комментарий</TH>
                <TH>Баланс после</TH>
              </TR>
            </THead>
            <TBody>
              {statement.ledger.map((entry, index) => {
                const after = Number(entry.balance_after);
                return (
                  <TR key={`${entry.kind}-${entry.happened_at}-${index}`}>
                    <TD className="num whitespace-nowrap">{formatDate(entry.happened_at)}</TD>
                    <TD>
                      <Badge
                        className={
                          entry.kind === "payment"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }
                      >
                        {entry.kind_label}
                      </Badge>
                    </TD>
                    <TD className="num">
                      {entry.order_id ? (
                        <Link
                          href={`/orders/${entry.order_id}`}
                          className="text-amber-700 hover:underline"
                        >
                          {entry.order_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="num whitespace-nowrap">
                      {Number(entry.charged) > 0 ? formatMoney(entry.charged) : "—"}
                    </TD>
                    <TD className="num whitespace-nowrap font-medium text-emerald-700">
                      {Number(entry.paid) > 0 ? formatMoney(entry.paid) : "—"}
                    </TD>
                    <TD>{entry.source || "—"}</TD>
                    <TD>{entry.comment || "—"}</TD>
                    <TD
                      className={
                        after < 0
                          ? "num whitespace-nowrap font-medium text-rose-700"
                          : after > 0
                            ? "num whitespace-nowrap font-medium text-emerald-700"
                            : "num whitespace-nowrap text-slate-500"
                      }
                    >
                      {formatMoney(entry.balance_after)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      ) : null}
    </AppShell>
  );
}
