import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function StockPage() {
  const [items, movements] = await Promise.all([api.getStockItems(), api.getStockMovements()]);

  return (
    <AppShell currentPath="/stock">
      <PageHeader eyebrow="Склад" title="Склад" description="Остатки материалов и движения reserve/writeoff по заказам." />
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <h3>Остатки на складе</h3>
          <Table className="mt-4">
            <THead><TR><TH>Тип</TH><TH>Количество</TH><TH>В резерве</TH><TH>Ед.</TH></TR></THead>
            <TBody>
              {items.map((item) => (
                <TR key={item.id}>
                  <TD>{item.material_type}</TD>
                  <TD>{item.quantity}</TD>
                  <TD>{item.reserved_quantity}</TD>
                  <TD>{item.unit}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <h3>Движения по складу</h3>
          <Table className="mt-4">
            <THead><TR><TH>Тип</TH><TH>Количество</TH><TH>Комментарий</TH><TH>Создано</TH></TR></THead>
            <TBody>
              {movements.map((item) => (
                <TR key={item.id}>
                  <TD>{item.movement_type}</TD>
                  <TD>{item.quantity} {item.unit}</TD>
                  <TD>{item.comment || "—"}</TD>
                  <TD>{formatDate(item.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </AppShell>
  );
}

