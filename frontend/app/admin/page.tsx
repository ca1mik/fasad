import Link from "next/link";
import { Compass, KeyRound, Mail, ScrollText, ShieldCheck, Tags, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

const sections = [
  {
    href: "/admin/users",
    title: "Пользователи",
    description: "Управление пользователями, активностью и ролями.",
    icon: Users,
  },
  {
    href: "/admin/roles",
    title: "Роли",
    description: "Матрица ролей и доступов в системе.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/permissions",
    title: "Права доступа",
    description: "Справочник кодов доступа и правил.",
    icon: KeyRound,
  },
  {
    href: "/admin/price-book",
    title: "Справочник цен",
    description: "Артикулы со стоимостью, история изменения цен.",
    icon: Tags,
  },
  {
    href: "/admin/directions",
    title: "Направления",
    description: "Направления и буква, которую они дают номеру заказа.",
    icon: Compass,
  },
  {
    href: "/admin/channels",
    title: "Каналы связи",
    description: "Настройка почты, Telegram, WhatsApp и внешних вебхуков.",
    icon: Mail,
  },
  {
    href: "/admin/audit",
    title: "Журнал действий",
    description: "История ключевых действий и изменений.",
    icon: ScrollText,
  },
];

export default async function AdminPage() {
  const [users, roles, permissions, channels, auditLog] = await Promise.all([
    api.getAdminUsers(),
    api.getAdminRoles(),
    api.getAdminPermissions(),
    api.getChannelAccounts(),
    api.getAuditLog(),
  ]);

  return (
    <AppShell currentPath="/admin">
      <PageHeader
        eyebrow="Администрирование"
        title="Администрирование"
        description="Контур администрирования пользователей, ролей, каналов связи и системного аудита."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-slate-500">Пользователей</p>
          <p className="num mt-2 text-3xl font-semibold">{users.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Ролей</p>
          <p className="num mt-2 text-3xl font-semibold">{roles.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Прав доступа</p>
          <p className="num mt-2 text-3xl font-semibold">{permissions.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Каналов связи</p>
          <p className="num mt-2 text-3xl font-semibold">{channels.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Записей в журнале</p>
          <p className="num mt-2 text-3xl font-semibold">{auditLog.length}</p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:bg-slate-50">
              <Icon className="h-6 w-6 text-amber-700" />
              <h3 className="mt-4">{title}</h3>
              <p className="mt-2 text-sm text-slate-700">{description}</p>
            </Card>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
