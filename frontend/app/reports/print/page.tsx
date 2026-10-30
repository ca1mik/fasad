import { ReportPrintToolbar } from "@/components/print/report-print-toolbar";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Props = {
  searchParams: Promise<{
    period?: string;
    metric?: string;
    date_from?: string;
    date_to?: string;
    /**
     * Отбор направления. Без него печатная страница молча считала по всему
     * производству, хотя на экране был выбран один шпон, — распечатку с такими
     * цифрами уже подписывали.
     */
    direction_code?: string;
  }>;
};

function sqm(value: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}`;
}

function periodLine(label: string, from: string | null, to: string | null) {
  const dates = [from, to]
    .filter(Boolean)
    .map((value) => new Date(value as string).toLocaleDateString("ru-RU"));
  return dates.length === 2 ? `${label}: ${dates[0]} — ${dates[1]}` : label;
}

/**
 * Отчёты одной страницей под печать и сохранение в PDF.
 *
 * PDF собирает сам браузер: «Печать → Сохранить как PDF». Так кириллица
 * выходит без подбора шрифтов, а лист получается ровно таким, как на экране.
 * Excel-выгрузки живут отдельно — их отдаёт сервер по кнопкам на `/reports`.
 */
export default async function ReportsPrintPage({ searchParams }: Props) {
  const {
    period = "month",
    metric = "accepted",
    date_from: dateFrom,
    date_to: dateTo,
    direction_code: directionCode,
  } = await searchParams;

  const params = new URLSearchParams({ period });
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (directionCode) params.set("direction_code", directionCode);
  const query = params.toString();

  const [volume, workKinds, clients, directions] = await Promise.all([
    api.getVolumeReport(`${query}&metric=${metric}`),
    api.getWorkKindReport(`${query}&metric=${metric}`),
    api.getClientActivityReport(query),
    api.getDirections(),
  ]);

  const directionName = !directionCode
    ? null
    : directionCode === "none"
      ? "Без направления"
      : directions.find((item) => item.code === directionCode)?.name || directionCode;

  const backHref = `/reports?${query}&metric=${metric}`;
  const printedAt = new Date().toLocaleString("ru-RU");

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <ReportPrintToolbar
        backHref={backHref}
        title="Отчётность за период"
        hint="Кнопка открывает диалог печати — там выберите «Сохранить как PDF»."
      />

      <article className="report-print mx-auto w-full max-w-[1000px] space-y-6 bg-white p-8 text-slate-900 shadow-sm">
        <header className="space-y-1 border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-semibold">Отчётность</h1>
          <p className="text-sm">
            {volume
              ? `${volume.metric_label} · ${periodLine(volume.period.label, volume.period.date_from, volume.period.date_to)}`
              : "Период не определён"}
          </p>
          {/* Направление печатаем всегда: по подписанной распечатке должно быть
              видно, весь это объём или один шпон. */}
          <p className="text-sm font-medium">
            Направление: {directionName || "все направления"}
          </p>
          <p className="text-xs text-slate-500">
            Студия фасадов, Рахимова 8 корп. 1 · сформировано {printedAt}
          </p>
        </header>

        {volume ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Объёмы по направлениям</h2>
            <p className="text-sm">
              Всего заказов: <strong>{volume.total.orders_count}</strong>, на сумму{" "}
              <strong>{formatMoney(volume.total.amount, volume.total.currency)}</strong>. Площадь
              фасадов {sqm(volume.total.facade_area_sqm)} м², материала{" "}
              {sqm(volume.total.material_area_sqm)} м².
            </p>
            <table>
              <thead>
                <tr>
                  <th align="left">Направление</th>
                  <th align="right">Заказов</th>
                  <th align="right">Сумма</th>
                  <th align="right">Фасады, м²</th>
                  <th align="right">Материал, м²</th>
                </tr>
              </thead>
              <tbody>
                {volume.by_direction.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td align="right">{row.orders_count}</td>
                    <td align="right">{formatMoney(row.amount, row.currency)}</td>
                    <td align="right">{sqm(row.facade_area_sqm)}</td>
                    <td align="right">{sqm(row.material_area_sqm)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Итого</strong>
                  </td>
                  <td align="right">
                    <strong>{volume.total.orders_count}</strong>
                  </td>
                  <td align="right">
                    <strong>{formatMoney(volume.total.amount, volume.total.currency)}</strong>
                  </td>
                  <td align="right">
                    <strong>{sqm(volume.total.facade_area_sqm)}</strong>
                  </td>
                  <td align="right">
                    <strong>{sqm(volume.total.material_area_sqm)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        {workKinds && workKinds.by_kind.length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Обработка: фрезеровка, шпон, мыло</h2>
            <table>
              <thead>
                <tr>
                  <th align="left">Тип работы</th>
                  <th align="right">Заказов</th>
                  <th align="right">Строк</th>
                  <th align="right">Площадь, м²</th>
                  <th align="right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {workKinds.by_kind.map((row) => (
                  <tr key={row.kind}>
                    <td>{row.kind_label}</td>
                    <td align="right">{row.orders_count}</td>
                    <td align="right">{row.positions_count}</td>
                    <td align="right">{sqm(row.area_sqm)}</td>
                    <td align="right">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Итого</strong>
                  </td>
                  <td align="right">
                    <strong>{workKinds.total.orders_count}</strong>
                  </td>
                  <td align="right">
                    <strong>{workKinds.total.positions_count}</strong>
                  </td>
                  <td align="right">
                    <strong>{sqm(workKinds.total.area_sqm)}</strong>
                  </td>
                  <td align="right">
                    <strong>{formatMoney(workKinds.total.amount)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        {clients && clients.rows.length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Клиенты за период</h2>
            <table>
              <thead>
                <tr>
                  <th align="left">Клиент</th>
                  <th align="left">Тип</th>
                  <th align="right">Заказов</th>
                  <th align="right">Сумма</th>
                  <th align="right">Дней без заказов</th>
                </tr>
              </thead>
              <tbody>
                {clients.rows.map((row) => (
                  <tr key={row.client_id}>
                    <td>
                      {row.full_name}
                      {row.organization ? ` (${row.organization})` : ""}
                    </td>
                    <td>{row.category_label}</td>
                    <td align="right">{row.orders_count}</td>
                    <td align="right">{formatMoney(row.amount, row.currency)}</td>
                    <td align="right">{row.days_since_last_order ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <footer className="border-t border-slate-300 pt-3 text-xs text-slate-500">
          Подпись ответственного ______________________ / ______________________
        </footer>
      </article>
    </div>
  );
}
