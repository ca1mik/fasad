import Link from "next/link";

import { ClientCreateForm } from "@/components/forms/client-create-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ClientsPage() {
  const clients = await api.getClients();

  return (
    <AppShell currentPath="/clients">
      <PageHeader
        eyebrow="Клиенты"
        title="База клиентов"
        description="Клиенты появляются сами из заявок, а нового можно занести кнопкой. Адрес виден прямо в списке — по нему собирают машину. В карточке — расчёты, заказы, деньги и реквизиты с правкой."
        actions={<ClientCreateForm />}
      />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Клиент</TH>
              <TH>Организация</TH>
              <TH>Телефон</TH>
              <TH>Почта</TH>
              {/* Адрес спрашивают ради «куда везти», а виден он был ровно в
                  одном месте — внутри карточки клиента. Собирая машину, туда
                  приходилось заходить в каждого клиента по очереди. */}
              <TH>Адрес</TH>
              <TH>Баланс</TH>
              <TH>Последний заказ</TH>
              <TH>Добавлен</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {clients.map((client) => (
              <TR key={client.id}>
                <TD className="font-medium text-slate-900">{client.full_name}</TD>
                <TD>{client.organization || "—"}</TD>
                <TD>{client.phone || "—"}</TD>
                {/* Раньше графа была в шапке, а ячейки под ней не было вовсе —
                    всё, что шло дальше («Адрес», «Добавлен»), съезжало на
                    одну колонку влево. */}
                <TD>{client.email || "—"}</TD>
                {/* Адрес не обрезаем многоточием: половина улицы бесполезна,
                    а места в колонке хватает на перенос строки. */}
                <TD className="max-w-[22rem] whitespace-pre-line break-words">
                  {client.address || "—"}
                </TD>
                <TD className="whitespace-nowrap">
                  <span
                    className={cn(
                      client.balance_status === "Долг" ? "font-medium text-rose-700" : "text-slate-700",
                    )}
                  >
                    {client.balance_status ?? "—"}
                  </span>
                </TD>
                <TD className="whitespace-nowrap">
                  {client.last_order_at ? formatDate(client.last_order_at) : "—"}
                </TD>
                <TD className="whitespace-nowrap">{formatDate(client.created_at)}</TD>
                <TD>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-sm font-medium text-amber-700 hover:underline"
                  >
                    Открыть карточку
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>

        {!clients.length ? (
          <p className="mt-4 text-sm text-slate-500">
            Клиентов пока нет. Нажмите «Создать клиента» или занесите заявку — клиент появится
            вместе с ней.
          </p>
        ) : null}
      </Card>
    </AppShell>
  );
}
