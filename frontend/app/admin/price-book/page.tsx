import { PriceBookManager } from "@/components/forms/price-book-manager";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function PriceBookPage() {
  const [items, options] = await Promise.all([
    api.getPriceItems("page=1&size=200"),
    api.getPriceBookOptions(),
  ]);

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Справочник цен"
        description={`Артикулов в справочнике: ${items.length}. Цена отсюда подставляется в смету заказа.`}
      />

      <Card>
        <h3 className="text-lg font-semibold text-slate-900">Как это работает</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            Артикулы заводятся здесь руками. Из заказов сюда ничего не попадает: разовая
            договорённость не должна становиться прайсом для всех.
          </p>
          <p>
            В заказе менеджер выбирает артикул из этого списка — цена подставляется сама. Чего тут
            нет, проводится как «нестандарт» со своей ценой.
          </p>
          <p>
            <span className="font-medium text-slate-900">Изменение цены не трогает старые заказы.</span>{" "}
            В каждом заказе лежит своя копия цены на момент продажи, поэтому прошлые месяцы задним
            числом не меняются.
          </p>
        </div>
      </Card>

      <Card>
        <PriceBookManager items={items} options={options} />
      </Card>
    </AppShell>
  );
}
