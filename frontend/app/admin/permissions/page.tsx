import { AdminPermissionForm } from "@/components/forms/admin-permission-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";

export default async function AdminPermissionsPage() {
  const permissions = await api.getAdminPermissions();

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Права доступа"
        description="Список того, что сотрудник может делать в системе. Права собираются в роли, а роль выдаётся человеку — по одному праву никому ничего не назначают."
      />
      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <h3>Новое право</h3>
          <p className="mt-2 text-sm text-slate-700">
            Нужно редко: список закрывает всю систему. Заводите, только если появился раздел,
            доступ к которому надо выдавать отдельно.
          </p>
          <div className="mt-4">
            <AdminPermissionForm />
          </div>
        </Card>
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Что разрешает</TH>
                <TH>Код в системе</TH>
              </TR>
            </THead>
            <TBody>
              {permissions.map((permission) => (
                <TR key={permission.id}>
                  {/* Сначала человеческое название, потом код: админ ищет
                      глазами «Вести заказы», а не «orders.manage». */}
                  <TD className="font-medium text-slate-900">{permission.name}</TD>
                  <TD className="text-sm text-slate-500">{permission.code}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </AppShell>
  );
}

