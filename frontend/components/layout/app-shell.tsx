import { cookies } from "next/headers";
import Link from "next/link";
import { ReactNode } from "react";
import {
  Boxes,
  ChartColumn,
  Factory,
  FileSpreadsheet,
  FolderKanban,
  HardHat,
  KeyRound,
  Layers,
  LockKeyhole,
  MessageSquare,
  Scissors,
  ScrollText,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminUser, Envelope } from "@/types/api";

const configuredApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
const API_URL =
  configuredApiUrl?.startsWith("http://") || configuredApiUrl?.startsWith("https://")
    ? configuredApiUrl
    : "http://127.0.0.1:8000/api/v1";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Права, при которых пункт показываем в меню: «чья это работа». */
  menu: string[];
  /**
   * Права, при которых раздел вообще открывается по прямой ссылке.
   * Шире, чем `menu`: технолог не ведёт клиентов, но карточку клиента из
   * заказа открыть должен. Не задано — совпадает с `menu`.
   */
  access?: string[];
  /**
   * Раздел живёт по ссылкам, но в панели его не показываем.
   *
   * Запись при этом обязана остаться: `navItems` — не только меню, но и
   * таблица прав по прямой ссылке (см. `isDenied` ниже). Если запись убрать,
   * раздел перестанет находиться в этом списке, проверка прав молча
   * выключится, и страница откроется любому вошедшему.
   */
  hidden?: boolean;
};

// Меню собрано по правам, а не «одно на всех». Раньше работник цеха видел
// «Клиенты», «Отчёты» и «Администрирование», а по клику его выкидывало на
// страницу входа — человек думал, что у него слетел пароль, и шёл к админу.
const navItems: NavItem[] = [
  {
    href: "/manager",
    label: "Рабочее место",
    icon: ChartColumn,
    menu: ["orders.manage", "leads.manage"],
  },
  { href: "/dashboard", label: "Сводка", icon: ChartColumn, menu: ["dashboard.read"] },
  {
    href: "/reports",
    label: "Отчёты",
    icon: FileSpreadsheet,
    // Отчёты — это выручка, объёмы и активность клиентов, и закрыты они своим
    // правом. Раньше здесь стояло dashboard.read, и работник цеха открывал их
    // по прямой ссылке и по клику с плитки «Выручка».
    menu: ["reports.read"],
    access: ["reports.read"],
  },
  {
    href: "/clients",
    label: "Клиенты",
    icon: Boxes,
    menu: ["clients.manage"],
    access: ["clients.manage", "orders.manage"],
  },
  {
    // Пункт скрыт: заказчик — «она же тупо дублирует рабочее место». Форма
    // приёма и правда одна и та же, а входы в раздел остались — кнопки «Все
    // заявки» на рабочем месте, плитка сводки, карточка клиента и диалог.
    //
    // Запись оставлена ради проверки прав: без неё /leads и /leads/{id}
    // открылись бы работнику цеха, а приём заявки прав не требует вовсе.
    href: "/leads",
    label: "Заявки",
    icon: ScrollText,
    hidden: true,
    menu: ["leads.manage"],
    // Как на бэкенде: список заявок отдаётся и по orders.manage, иначе
    // технолог жмёт «Все заявки» и получает «Недостаточно прав».
    access: ["leads.manage", "orders.manage"],
  },
  {
    // Пункт скрыт: заказчик — «диалоги убрать». Раздел остаётся по прямой
    // ссылке (и в правах доступа), просто не занимает место в панели — как и
    // «Заявки» выше. Удалять запись целиком нельзя: тогда пропадёт и проверка
    // прав на /inbox, страница станет открытой кому угодно.
    href: "/inbox",
    label: "Диалоги",
    icon: MessageSquare,
    hidden: true,
    menu: ["messaging.read", "messaging.reply"],
  },
  {
    href: "/orders",
    label: "Заказы",
    icon: FolderKanban,
    // Список заказов — это вся выручка студии разом, и он только для тех, кто
    // ведёт деньги. Карточку конкретного заказа цех по-прежнему открывает из
    // своего этапа: тот адрес лежит под /production.
    menu: ["orders.manage"],
    access: ["orders.manage"],
  },
  {
    href: "/film-cutting",
    label: "Раскрой листа",
    icon: Scissors,
    menu: ["orders.manage", "templates.manage", "production.manage"],
  },
  {
    href: "/cutting-batch",
    label: "Раскрой партией",
    icon: Layers,
    menu: ["orders.manage", "templates.manage", "production.manage"],
  },
  {
    href: "/production",
    label: "Производство",
    icon: Factory,
    menu: ["production.read", "production.manage", "production.execute"],
  },
  {
    href: "/workers",
    label: "Работники",
    icon: HardHat,
    menu: ["production.manage"],
    access: ["production.read", "production.manage", "production.execute"],
  },
  {
    href: "/materials",
    label: "Материалы",
    icon: Boxes,
    menu: ["templates.manage", "stock.manage", "production.manage"],
    // Справочник материалов открыт каждой рабочей роли: по нему сверяются и в
    // цехе. Но не роли, заведённой без единой галочки, — у такой доступа нет
    // ни к чему, и API отвечает так же.
    access: [
      "orders.manage",
      "templates.manage",
      "production.read",
      "production.manage",
      "production.execute",
    ],
  },
  {
    href: "/stock",
    label: "Склад",
    icon: Warehouse,
    menu: ["stock.manage", "production.manage"],
  },
  {
    href: "/admin",
    label: "Администрирование",
    icon: KeyRound,
    menu: ["users.manage", "roles.manage", "permissions.manage", "channels.manage", "audit.read"],
  },
];

type Props = {
  children: ReactNode;
  currentPath: string;
  containerClassName?: string;
  mainClassName?: string;
};

function isActivePath(currentPath: string, href: string) {
  return currentPath === href || (href !== "/dashboard" && currentPath.startsWith(href));
}

/**
 * Права текущего сотрудника из /auth/me.
 *
 * Свой запрос, а не общий api-клиент: тот на 401 уводит на страницу входа, а
 * оболочке нужно ровно обратное — при непонятном ответе не трогать человека и
 * показать меню как раньше.
 */
async function loadCurrentUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Envelope<AdminUser>;
    return payload.data;
  } catch {
    return null;
  }
}

export async function AppShell({
  children,
  currentPath,
  containerClassName,
  mainClassName,
}: Props) {
  const user = await loadCurrentUser();
  // Роль admin проходит везде — так же, как require_permissions на бэкенде.
  const grantedCodes =
    user?.role.code === "admin"
      ? null
      : new Set(user?.role.permissions.map((permission) => permission.code) ?? []);

  const allows = (codes: string[] | undefined) => {
    if (!codes || codes.length === 0) {
      return true;
    }
    // Полные права есть только у подтверждённого администратора. Если проверка
    // пользователя не удалась, закрытые разделы не показываем.
    if (grantedCodes === null) {
      return true;
    }
    return codes.some((code) => grantedCodes.has(code));
  };

  const visibleItems = navItems.filter((item) => !item.hidden && allows(item.menu));
  // Самое длинное совпадение: «/production/orders/…» — это раздел производства.
  const currentItem = [...navItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isActivePath(currentPath, item.href));
  const isDenied = currentItem ? !allows(currentItem.access ?? currentItem.menu) : false;

  return (
    <div className="app-grid min-h-screen">
      <div
        className={cn(
          "mx-auto flex min-h-screen w-full max-w-[1720px] flex-col gap-4 px-3 py-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 lg:px-6 lg:py-4",
          containerClassName,
        )}
      >
        <aside className="panel z-20 flex flex-col gap-6 p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:p-6">
          <div className="space-y-3">
            <Badge className="bg-amber-200 text-slate-900">Фасадное производство</Badge>
            <div className="space-y-2">
              <p className="text-2xl font-semibold text-slate-900">Операционный контур</p>
              <p className="subtle-text">
                Эмаль, ПВХ и шпон: приём заявок, клиенты, заказы, раскрой листа, материалы, запуск в
                производство и контроль этапов в цехе.
              </p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:auto-rows-max lg:overflow-visible lg:pb-0">
            {visibleItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActivePath(currentPath, href) ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActivePath(currentPath, href)
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{user.full_name}</p>
              <p className="mt-1 text-slate-600">{user.role.name}</p>
            </div>
          ) : null}
        </aside>

        <main className={cn("min-w-0 space-y-6 pb-6", mainClassName)}>
          {isDenied ? (
            <AccessDenied
              section={currentItem?.label}
              roleName={user?.role.name}
              // Уводим не на общую главную, а в первый доступный человеку
              // раздел: у работника цеха «главной» является его производство.
              homeHref={visibleItems[0]?.href ?? "/"}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function AccessDenied({
  section,
  roleName,
  homeHref,
}: {
  section?: string;
  roleName?: string;
  homeHref: string;
}) {
  return (
    <div className="panel flex flex-col items-start gap-4 p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
        <LockKeyhole className="h-6 w-6 text-amber-700" />
      </span>
      <div className="space-y-2">
        <h2>Недостаточно прав</h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate-700">
          {section ? `Раздел «${section}» ` : "Этот раздел "}
          закрыт для вашей роли{roleName ? ` «${roleName}»` : ""}. Вы вошли в систему, выходить и
          входить заново не нужно.
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-slate-700">
          Если доступ нужен для работы — попросите администратора отметить это право в карточке
          вашей роли.
        </p>
      </div>
      <Link
        href={homeHref}
        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Вернуться к своим задачам
      </Link>
    </div>
  );
}
