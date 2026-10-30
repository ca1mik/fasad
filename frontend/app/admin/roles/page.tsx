import { AdminRoleCard } from "@/components/forms/admin-role-card";
import { AdminRoleForm } from "@/components/forms/admin-role-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function AdminRolesPage() {
  const [roles, permissions] = await Promise.all([api.getAdminRoles(), api.getAdminPermissions()]);

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Роли"
        description="Настройка ролей и набора permission-кодов, которые получает пользователь."
      />
      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <h3>Новая роль</h3>
          <div className="mt-4">
            <AdminRoleForm permissions={permissions} />
          </div>
        </Card>
        <div className="grid gap-4">
          {roles.map((role) => (
            <AdminRoleCard key={role.id} role={role} permissions={permissions} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

