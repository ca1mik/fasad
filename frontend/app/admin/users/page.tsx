import { AdminUserForm } from "@/components/forms/admin-user-form";
import { AdminUserRowActions } from "@/components/forms/admin-user-row-actions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function AdminUsersPage() {
  const [users, roles] = await Promise.all([api.getAdminUsers(), api.getAdminRoles()]);

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Пользователи"
        description="Создание учетных записей, назначение ролей и управление доступом."
      />
      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <h3>Новый пользователь</h3>
          <div className="mt-4">
            <AdminUserForm roles={roles} />
          </div>
        </Card>
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Роль</TH>
                <TH>Статус</TH>
                <TH>Создано</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.login} / {user.email}</p>
                      <div className="pt-2">
                        <AdminUserRowActions user={user} roles={roles} />
                      </div>
                    </div>
                  </TD>
                  <TD>{user.role.name}</TD>
                  <TD>{user.is_active ? "Работает" : "Отключён"}</TD>
                  <TD>{formatDate(user.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </AppShell>
  );
}

