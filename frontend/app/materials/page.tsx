import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";

export default async function MaterialsPage() {
  const [materials, edgeMaterials, hardware] = await Promise.all([
    api.getMaterials(),
    api.getEdgeMaterials(),
    api.getHardware(),
  ]);

  return (
    <AppShell currentPath="/materials">
      <PageHeader eyebrow="Справочники" title="Материалы" description="Материалы, кромка и фурнитура, используемые pricing и production-подготовкой." />
      <section className="grid gap-4 2xl:grid-cols-3">
        <Card>
          <h3>Материалы</h3>
          <Table className="mt-4">
            <THead><TR><TH>Код</TH><TH>Название</TH><TH>Цена</TH></TR></THead>
            <TBody>
              {materials.map((item) => (
                <TR key={item.id}>
                  <TD>{item.code}</TD>
                  <TD>{item.name}</TD>
                  <TD>{item.price}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <h3>Кромочный материал</h3>
          <Table className="mt-4">
            <THead><TR><TH>Код</TH><TH>Название</TH><TH>Цена</TH></TR></THead>
            <TBody>
              {edgeMaterials.map((item) => (
                <TR key={item.id}>
                  <TD>{item.code}</TD>
                  <TD>{item.name}</TD>
                  <TD>{item.price}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <h3>Фурнитура</h3>
          <Table className="mt-4">
            <THead><TR><TH>Код</TH><TH>Название</TH><TH>Цена</TH></TR></THead>
            <TBody>
              {hardware.map((item) => (
                <TR key={item.id}>
                  <TD>{item.code}</TD>
                  <TD>{item.name}</TD>
                  <TD>{item.price}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </AppShell>
  );
}

