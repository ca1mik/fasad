import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/reports/period-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

import { ReportChips } from "./report-chips";

/** Заказы, у которых направление не проставлено, — своя группа, а не «все». */
const NO_DIRECTION = "none";

type Props = {
  searchParams: Promise<{
    period?: string;
    metric?: string;
    date_from?: string;
    date_to?: string;
    /** Отбор одного направления: «а по какому направлению я делаю этот отчёт?» */
    direction_code?: string;
  }>;
};

const CATEGORY_STYLE: Record<string, string> = {
  regular: "bg-emerald-50 text-emerald-700",
  active: "bg-sky-100 text-sky-800",
  new: "bg-amber-100 text-amber-700",
  sleeping: "bg-orange-100 text-orange-800",
  lost: "bg-red-50 text-red-600",
  no_orders: "bg-slate-50 text-slate-700",
};

/** Тот же цвет, что и бейдж «материал заказан/отгружен» в списке заказов. */
const MATERIAL_STATUS_STYLE: Record<string, string> = {
  shipped: "bg-sky-50 text-sky-700",
  ordered: "bg-emerald-50 text-emerald-700",
  not_ordered: "bg-amber-50 text-amber-700",
};

function sqm(value: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м²`;
}

export default async function ReportsPage({ searchParams }: Props) {
  const {
    period = "month",
    metric = "accepted",
    date_from: dateFrom,
    date_to: dateTo,
    direction_code: directionCode,
  } = await searchParams;

  // свой диапазон дат сильнее кнопки периода — так же решает и бэкенд
  const params = new URLSearchParams({ period });
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.toString();
  // Отбор направления идёт во ВСЕ блоки и во все выгрузки. Раньше он доходил
  // только до объёмов: заказчик выбирала шпон, а обработка, клиенты и файлы
  // считались по всему производству — цифры на экране и в Excel расходились
  // молча, без единого предупреждения.
  const scoped = directionCode
    ? `${query}&direction_code=${encodeURIComponent(directionCode)}`
    : query;

  const [accepted, shipped, clients, workKinds, directions] = await Promise.all([
    api.getVolumeReport(`${scoped}&metric=accepted`),
    api.getVolumeReport(`${scoped}&metric=shipped`),
    api.getClientActivityReport(scoped),
    api.getWorkKindReport(`${scoped}&metric=${metric}`),
    api.getDirections(),
  ]);

  const active = metric === "shipped" ? shipped : accepted;

  const buildHref = (patch: { metric?: string; direction_code?: string }) => {
    const next = new URLSearchParams({
      period,
      metric: patch.metric ?? metric,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    });
    const nextDirection = patch.direction_code ?? directionCode;
    if (nextDirection) next.set("direction_code", nextDirection);
    return `/reports?${next.toString()}`;
  };

  const directionName =
    directionCode === NO_DIRECTION
      ? "Без направления"
      : directions.find((item) => item.code === directionCode)?.name || directionCode;

  return (
    <AppShell currentPath="/reports">
      <PageHeader
        eyebrow="Отчёты"
        title="Объёмы, деньги и клиенты"
        description="Сколько принято и отгружено за период — в рублях и в квадратных метрах, всего и по направлениям. Любая строка открывается в подробностях."
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Период</p>
            <PeriodFilter
              basePath="/reports"
              active={period}
              dateFrom={dateFrom}
              dateTo={dateTo}
              // Направление обязано пережить смену периода: иначе кнопка
              // «Квартал» молча сбрасывала отбор обратно на всё производство.
              extraParams={{ metric, direction_code: directionCode }}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Показатель</p>
            <ReportChips
              basePath="/reports"
              ariaLabel="Показатель отчёта"
              active={metric}
              items={[
                { value: "accepted", label: "Принято", href: buildHref({ metric: "accepted" }) },
                { value: "shipped", label: "Отгружено", href: buildHref({ metric: "shipped" }) },
              ]}
            />
          </div>
        </div>

        {/* Отбор направления. Заказчик: «а где можно выбрать, по какому
            направлению я делаю этот отчёт?». Разбивка по направлениям в отчёте
            была, а отбора не было — приходилось читать строку в таблице и
            держать в уме, что остальные цифры не про него. */}
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Направление</p>
          <ReportChips
            basePath="/reports"
            ariaLabel="Направление отчёта"
            active={directionCode || ""}
            items={[
              { value: "", label: "Все направления", href: buildHref({ direction_code: "" }) },
              ...directions.map((item) => ({
                value: item.code,
                label: item.name,
                hint: item.number_suffix ? `-${item.number_suffix}` : "без буквы",
                href: buildHref({ direction_code: item.code }),
              })),
              // Заказы, у которых направление не проставлено, иначе теряются:
              // в разбивке строка «Без направления» есть, а открыть её нечем.
              {
                value: NO_DIRECTION,
                label: "Без направления",
                href: buildHref({ direction_code: NO_DIRECTION }),
              },
            ]}
          />
          {directionCode ? (
            <p className="text-sm text-slate-600">
              Все цифры на странице и во всех выгрузках — только по направлению «{directionName}».
            </p>
          ) : null}
        </div>
        {active ? (
          <p className="text-sm text-slate-700">
            {active.metric_label} · {active.period.label}
            {active.period.date_from
              ? ` · с ${new Date(active.period.date_from).toLocaleDateString("ru-RU")}`
              : ""}
          </p>
        ) : null}

        {/* Выгрузка ровно за тот период, показатель и направление, что выбраны
            выше — иначе в файле окажутся не те цифры, что на экране. */}
        <div className="flex flex-wrap items-start gap-3 border-t border-slate-200 pt-4">
          <span className="self-center text-xs uppercase tracking-[0.12em] text-slate-500">
            Выгрузить
          </span>
          <DownloadButton path={`/reports/volume.xlsx?${scoped}&metric=${metric}`} variant="outline">
            Объёмы, Excel
          </DownloadButton>
          <DownloadButton
            path={`/reports/orders.xlsx?${scoped}&metric=${metric}`}
            variant="outline"
          >
            Заказы, Excel
          </DownloadButton>
          <DownloadButton
            path={`/reports/work-kinds.xlsx?${scoped}&metric=${metric}`}
            variant="outline"
          >
            Обработка, Excel
          </DownloadButton>
          <DownloadButton path={`/reports/clients.xlsx?${scoped}`} variant="outline">
            Клиенты, Excel
          </DownloadButton>
          <DownloadButton path={`/reports/production-time.xlsx?${scoped}`} variant="outline">
            Этапы, Excel
          </DownloadButton>
          <Button asChild variant="secondary">
            <Link href={`/reports/print?${scoped}&metric=${metric}`}>Версия для печати и PDF</Link>
          </Button>
        </div>
      </Card>

      {!active ? (
        <Card>
          <p className="text-sm text-red-600">
            Не удалось загрузить отчёт. Проверьте, что сервер отвечает, и обновите страницу.
          </p>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Заказов" value={String(active.total.orders_count)} />
            <StatCard
              label="Сумма"
              value={formatMoney(active.total.amount, active.total.currency)}
            />
            <StatCard
              label="Площадь фасадов"
              value={sqm(active.total.facade_area_sqm)}
              hint="то, что заказал клиент"
            />
            <StatCard
              label="Площадь материала"
              value={sqm(active.total.material_area_sqm)}
              hint="с учётом двусторонней оклейки ПВХ"
            />
          </section>

          <Card className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">По обработке</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Фрезеровка, шпон, мыло — {active.metric_label.toLowerCase()}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                Считается по строкам сметы заказа: в одном заказе бывает и фрезеровка, и шпон.
                Заказы без сметы сюда не попадают.
                {directionCode
                  ? ` Учтены только заказы направления «${directionName}» — со всеми работами, которые в них есть.`
                  : ""}
              </p>
            </div>
            {workKinds?.by_kind.length ? (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Тип работы</TH>
                      <TH>Заказов</TH>
                      <TH>Строк</TH>
                      <TH>Кол-во</TH>
                      <TH>Площадь</TH>
                      <TH>Сумма</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {workKinds.by_kind.map((row) => (
                      <TR key={row.kind}>
                        <TD className="font-medium text-slate-900">{row.kind_label}</TD>
                        <TD className="num">{row.orders_count}</TD>
                        <TD className="num">{row.positions_count}</TD>
                        <TD className="num">
                          {Number(row.quantity).toLocaleString("ru-RU", {
                            maximumFractionDigits: 2,
                          })}
                        </TD>
                        <TD className="num whitespace-nowrap">{sqm(row.area_sqm)}</TD>
                        <TD className="num whitespace-nowrap">{formatMoney(row.amount)}</TD>
                      </TR>
                    ))}
                    <TR>
                      <TD className="font-semibold text-slate-900">Всего</TD>
                      <TD className="num font-semibold">{workKinds.total.orders_count}</TD>
                      <TD className="num font-semibold">{workKinds.total.positions_count}</TD>
                      <TD />
                      <TD className="num whitespace-nowrap font-semibold">
                        {sqm(workKinds.total.area_sqm)}
                      </TD>
                      <TD className="num whitespace-nowrap font-semibold">
                        {formatMoney(workKinds.total.amount)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>

                <details className="rounded-2xl bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-900">
                    Разбивка до артикула ({workKinds.by_article.length})
                  </summary>
                  <Table className="mt-3">
                    <THead>
                      <TR>
                        <TH>Артикул</TH>
                        <TH>Наименование</TH>
                        <TH>Тип</TH>
                        <TH>Площадь</TH>
                        <TH>Сумма</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {workKinds.by_article.map((row) => (
                        <TR key={`${row.kind}-${row.article ?? row.name}`}>
                          <TD className="num">{row.article ?? "нестандарт"}</TD>
                          <TD className="font-medium text-slate-900">{row.name}</TD>
                          <TD>{row.kind_label}</TD>
                          <TD className="num whitespace-nowrap">{sqm(row.area_sqm)}</TD>
                          <TD className="num whitespace-nowrap">{formatMoney(row.amount)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </details>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                За период нет заказов со сметой. Заполните смету в карточке заказа — и обработка
                появится здесь.
              </p>
            )}
          </Card>

          {/* min-w-0 на карточках: внутри таблицы со своей прокруткой, а
              элемент сетки по умолчанию растягивается под содержимое — и на
              телефоне правый край карточки уезжал за экран */}
          <section className="grid gap-6 2xl:grid-cols-2">
            <Card className="min-w-0 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  По направлениям
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {active.metric_label} по типам
                </h2>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Направление</TH>
                    <TH>Заказов</TH>
                    <TH>Сумма</TH>
                    <TH>Фасады</TH>
                    <TH>Материал</TH>
                  </TR>
                </THead>
                <TBody>
                  {active.by_direction.map((row) => (
                    <TR key={row.key}>
                      {/* название и есть ссылка: отдельная колонка со ссылкой
                          не влезала в половину ширины и обрезалась */}
                      <TD className="font-medium text-slate-900">
                        {row.key === "none" ? (
                          row.label
                        ) : (
                          <Link
                            href={`/reports/directions/${row.key}?${new URLSearchParams({
                              period,
                              metric,
                              ...(dateFrom ? { date_from: dateFrom } : {}),
                              ...(dateTo ? { date_to: dateTo } : {}),
                            }).toString()}`}
                            className="text-amber-700 hover:underline"
                          >
                            {row.label}
                          </Link>
                        )}
                      </TD>
                      <TD className="num">{row.orders_count}</TD>
                      <TD className="num whitespace-nowrap">
                        {formatMoney(row.amount, row.currency)}
                      </TD>
                      <TD className="num whitespace-nowrap">{sqm(row.facade_area_sqm)}</TD>
                      <TD className="num whitespace-nowrap">{sqm(row.material_area_sqm)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {!active.by_direction.length ? (
                <p className="text-sm text-slate-500">
                  За выбранный период заказов нет. Смените период или показатель.
                </p>
              ) : null}
            </Card>

            <Card className="min-w-0 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">По месяцам</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Динамика</h2>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Месяц</TH>
                    <TH>Заказов</TH>
                    <TH>Сумма</TH>
                    <TH>Материал</TH>
                  </TR>
                </THead>
                <TBody>
                  {active.by_month.map((row) => (
                    <TR key={row.key}>
                      <TD className="font-medium text-slate-900">{row.label}</TD>
                      <TD>{row.orders_count}</TD>
                      <TD className="whitespace-nowrap">{formatMoney(row.amount, row.currency)}</TD>
                      <TD className="whitespace-nowrap">{sqm(row.material_area_sqm)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {!active.by_month.length ? (
                <p className="text-sm text-slate-500">Данных за период нет.</p>
              ) : null}
            </Card>
          </section>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Клиенты</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Сумма покупок и давность заказов
                </h2>
                {/* в таблице смешаны две базы отсчёта: без подписи «Постоянный»
                    с нулём заказов за месяц читается как ошибка */}
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Заказы, сумма и площадь — за выбранный период. Тип клиента, давность
                  последнего заказа и средний интервал — за всё время.
                  {directionCode ? ` Только покупки по направлению «${directionName}».` : ""}
                </p>
              </div>
              <Link
                href={`/reports/inactive${
                  directionCode ? `?direction_code=${encodeURIComponent(directionCode)}` : ""
                }`}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Кто давно не покупал
              </Link>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Клиент</TH>
                  <TH>Тип</TH>
                  <TH>Заказов</TH>
                  <TH>Сумма</TH>
                  <TH>Материал</TH>
                  <TH>Направления</TH>
                  <TH>Не заказывал</TH>
                  {/* Статус последнего заказа: заказчик спрашивает это же
                      каждое утро, что и в списке заказов — «на что материал
                      ещё не заказан», только по клиентам, а не по заказам. */}
                  <TH>Материал (посл. заказ)</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {(clients?.rows || []).map((row) => (
                  <TR key={row.client_id}>
                    <TD className="font-medium text-slate-900">
                      <Link href={`/clients/${row.client_id}`} className="hover:underline">
                        {row.full_name}
                      </Link>
                      {row.organization ? (
                        <span className="block text-xs text-slate-500">{row.organization}</span>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge className={CATEGORY_STYLE[row.category] || CATEGORY_STYLE.no_orders}>
                        {row.category_label}
                      </Badge>
                    </TD>
                    <TD>{row.orders_count}</TD>
                    <TD className="whitespace-nowrap">{formatMoney(row.amount, row.currency)}</TD>
                    <TD className="whitespace-nowrap">{sqm(row.material_area_sqm)}</TD>
                    <TD>{row.directions.length ? row.directions.join(", ") : "—"}</TD>
                    <TD className="whitespace-nowrap">
                      {row.days_since_last_order === null
                        ? "—"
                        : `${row.days_since_last_order} дн.`}
                      {row.average_days_between_orders ? (
                        <span className="block text-xs text-slate-500">
                          в среднем раз в {row.average_days_between_orders} дн.
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      {row.last_order_material_status ? (
                        <Badge
                          className={
                            MATERIAL_STATUS_STYLE[row.last_order_material_status] ||
                            CATEGORY_STYLE.no_orders
                          }
                        >
                          {row.last_order_material_status_label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <Link
                        href={`/clients/${row.client_id}`}
                        className="text-sm font-medium text-amber-700 hover:underline"
                      >
                        Карточка
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {!clients?.rows.length ? (
              <p className="text-sm text-slate-500">Клиентов пока нет.</p>
            ) : null}
          </Card>
        </>
      )}
    </AppShell>
  );
}
