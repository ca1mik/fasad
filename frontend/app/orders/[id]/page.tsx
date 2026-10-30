import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions, OrderTextureToggle } from "@/components/forms/order-actions";
import { ProductionBootstrapButton } from "@/components/forms/production-bootstrap-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { OrderAdditionalButton } from "@/components/orders/order-additional-button";
import { OrderCuttingLinks } from "@/components/orders/order-cutting-links";
import { OrderDirectionSelect } from "@/components/orders/order-direction-select";
import { OrderDueDate } from "@/components/orders/order-due-date";
import { OrderExportsList } from "@/components/orders/order-exports-list";
import { OrderFiles } from "@/components/orders/order-files";
import { OrderMaterialToggle } from "@/components/orders/order-material-toggle";
import { OrderPaidToggle } from "@/components/orders/order-paid-toggle";
import { OrderRotationToggle } from "@/components/orders/order-rotation-toggle";
import { OrderPayments } from "@/components/orders/order-payments";
import { OrderPositionsTable } from "@/components/orders/order-positions-table";
import { OrderShippedToggle } from "@/components/orders/order-shipped-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatDueCountdown, formatMoney, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

/** Одна дата или статус заказа. Шесть таких плиток занимают строку вместо колонки. */
function OrderFact({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-4 py-3",
        tone === "bad"
          ? "border-rose-200 bg-rose-50"
          : tone === "good"
            ? "border-emerald-200 bg-emerald-50"
            : "border-slate-200 bg-slate-50",
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {/* title обязателен: плитка узкая, и «внесено 256 669,76 ₽» обрезается на
          середине суммы. Прочитать её со страницы было нельзя вообще никак —
          ни навести, ни развернуть. */}
      <p
        title={value}
        className={cn(
          "mt-1 truncate text-sm font-semibold",
          tone === "bad" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {/* Сумма переносится, а не обрезается: цифра — то, ради чего сюда
          смотрят, и прятать её под многоточие бессмысленно. */}
      {note ? (
        <p title={note} className="num mt-0.5 break-words text-xs text-slate-500">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export default async function OrderDetailsPage({ params }: Props) {
  const { id } = await params;
  const [
    order,
    exportsList,
    cncJobs,
    stages,
    statuses,
    priceItems,
    methods,
    files,
    // Типы работ нужны нестандартным строкам сметы: без них отчёт по
    // обработке считает такие строки «прочим».
    priceBookOptions,
    // Справочник направлений — для селекта в карточке: направление до сих пор
    // выбиралось только при создании заказа, и поправить его было негде.
    directions,
    // Подсказки «Фрезеровка/Цвет» — те же, что и на «Рабочем месте»: заказчик
    // просил, чтобы забитое один раз оставалось в памяти не только там.
    referenceValues,
  ] = await Promise.all([
    api.getOrder(id),
    // «Сгенерированные детали» (Part[]) убраны из карточки: технический
    // список для ЧПУ/резерва материала, почти всегда пустой у заказов без
    // изделий из каталога — не про смету и не про раскрой. Сама генерация
    // (`generate-parts`) осталась в «Технических действиях», просто выборку
    // Part[] на каждый заход карточки больше не тянем.
    api.getExports(id),
    api.getCncJobs(id),
    api.getOrderStages(id),
    api.getOrderStatuses(),
    api.getPriceItems("page=1&size=200&only_active=true"),
    api.getPaymentMethods(),
    api.getOrderFiles(id),
    api.getPriceBookOptions(),
    api.getDirections(),
    api.getReferenceValues(),
  ]);

  if (!order) {
    notFound();
  }

  const additionalOrders = order.additional_orders ?? [];

  return (
    <AppShell currentPath="/orders">
      <PageHeader
        eyebrow={order.status?.code || "order"}
        title={order.order_number}
        description={`Клиент: ${order.client?.full_name || "-"} | Сумма: ${formatMoney(order.final_amount, order.currency)}`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/orders">Назад к списку</Link>
            </Button>
          </div>
        }
      />

      {/* Клиент отдельным блоком: до этого в карточке заказа от него было
          только имя в подзаголовке. Адрес спрашивают ради «куда везти», а
          лежал он в карточке клиента — за два перехода от заказа, который
          сегодня грузят. */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">Клиент</h3>
            <p className="mt-2 text-sm text-slate-700">
              {order.client_id ? (
                <Link href={`/clients/${order.client_id}`} className="text-amber-700 hover:underline">
                  {order.client?.full_name || "Без имени"}
                </Link>
              ) : (
                order.client?.full_name || "Без имени"
              )}
              {order.client?.organization ? ` · ${order.client.organization}` : ""}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/clients/${order.client_id}`}>Карточка клиента</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Телефон</p>
            <p className="num mt-1 break-words text-sm font-medium text-slate-900">
              {order.client?.phone || "—"}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Почта</p>
            <p className="mt-1 break-words text-sm font-medium text-slate-900">
              {order.client?.email || "—"}
            </p>
          </div>
          {/* Адрес переносится целиком, а не обрезается: по половине улицы
              машину не отправишь. */}
          <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3 md:col-span-3 xl:col-span-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Адрес доставки
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-slate-900">
              {order.client?.address || "Не указан — спросите у клиента перед отгрузкой"}
            </p>
          </div>
        </div>

        {/* Комментарий заказа: раньше нигде не выводился в карточке, хотя
            сохранялся и уходил в API — при приёме заявки менеджер пишет сюда
            то, что нужно клиенту, и это должно быть видно, а не только в
            базе. */}
        {order.comment ? (
          <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Комментарий</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-slate-900">
              {order.comment}
            </p>
          </div>
        ) : null}
      </Card>

      {/* Скачивание/раскрой заказа — сразу под клиентом, одной строкой кнопок,
          а не потерянной карточкой в конце страницы среди сметы и маршрута.
          Заказчик: «раскрой заказа — это не раскрой заказа, а МДФ; если
          плёнка — то и раскрой плёнки, и распил МДФ». Одна карточка вместо
          трёх одинаковых кнопок, разбросанных по странице, плюс бланк,
          карты раскроя и выгрузка сразу здесь. */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900">Раскрой заказа</h3>
        <p className="mt-2 text-sm text-slate-700">
          Раскрой МДФ — по толщине (распил), нужен всегда. Раскрой плёнки — отдельно, только
          если в смете есть плёночные позиции. Результат остаётся в этом заказе и виден в
          списке экспортов.
        </p>
        <div className="mt-4">
          <OrderCuttingLinks
            orderId={order.id}
            hasFilmPositions={order.positions.some((position) => position.kind === "film")}
            sourceLeadId={order.source_lead_id ?? null}
          />
        </div>
      </Card>

      {/* Действия и состояние заказа в одной карточке: обе нужны менеджеру
          одновременно — он смотрит на даты и тут же жмёт кнопку, — а боковую
          колонку они занимали целиком и сжимали смету до половины экрана. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Заказ и действия по нему</h3>
            <p className="mt-2 text-sm text-slate-700">
              Расчёт, генерация деталей, раскрой, экспорт и запуск в производство. Раскрой — ниже,
              в карточке «Раскрой заказа».
            </p>
          </div>
        </div>

        {/* Оплата — первым фактом: «оплачен или нет» спрашивают чаще, чем дату
            согласования, а раньше за этим надо было прокручивать страницу до
            блока поступлений. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <OrderFact
            label="Оплата"
            value={order.balance?.status || "Нет расчёта"}
            note={
              order.balance && Number(order.balance.paid_amount) > 0
                ? `внесено ${formatMoney(order.balance.paid_amount, order.currency)}`
                : undefined
            }
            tone={
              order.balance?.status === "Долг"
                ? "bad"
                : order.balance?.status === "Оплачен полностью"
                  ? "good"
                  : undefined
            }
          />
          <OrderFact label="Статус" value={order.status?.name || "-"} />
          <OrderFact label="Создан" value={formatDate(order.created_at)} />
          <OrderFact label="Согласован" value={formatDate(order.approved_at)} />
          <OrderFact label="Старт производства" value={formatDate(order.production_start_at)} />
          <OrderFact label="Отгружен" value={formatDate(order.shipped_at)} />
        </div>

        {/* Отметки по ходу работы в одном ряду: материал заказан, оплачен,
            отгружен, текстура, запрет поворота. «Материал заказан» раньше жил
            заливкой ячейки в экселе, а оплату заказчик просила поставить рядом
            с отгрузкой. */}
        <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {/* Срок первым: заказчик смотрит на него чаще остального, а поставить
              его по заказу до этого было негде — единственное поле даты во всём
              интерфейсе жило в карточке заявки. Отсчёт считаем здесь, на
              сервере: в клиенте он разошёлся бы с разметкой при гидратации. */}
          <OrderDueDate
            orderId={order.id}
            dueDate={order.due_date}
            countdown={formatDueCountdown(order.due_date)}
            overdue={isOverdue(order.due_date)}
          />
          <OrderDirectionSelect
            orderId={order.id}
            directionId={order.direction_id}
            directions={directions}
            orderNumber={order.order_number}
          />
          <OrderMaterialToggle
            orderId={order.id}
            materialOrderedAt={order.material_ordered_at}
          />
          <OrderPaidToggle
            orderId={order.id}
            balance={order.balance}
            methods={methods}
            currency={order.currency}
          />
          <OrderShippedToggle orderId={order.id} shippedAt={order.shipped_at} />
          <OrderTextureToggle orderId={order.id} hasTexture={order.has_texture} />
          <OrderRotationToggle
            orderId={order.id}
            noRotation={order.no_rotation}
            hasTexture={order.has_texture}
          />
        </div>

        <div className="mt-4">
          <OrderActions orderId={order.id} statuses={statuses} currentStatusCode={order.status?.code ?? null} />
        </div>

        {/* Доп. заказы: клиент довёз замер или добавил фасады взамен
            испорченных. Деньги и отгрузка у допа свои, поэтому это отдельный
            заказ, но привязанный к этому. */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Доп. заказы</p>
              <p className="mt-1 text-sm text-slate-700">
                {order.parent_order_number ? (
                  <>
                    Это доп. заказ к{" "}
                    <Link
                      href={`/orders/${order.parent_order_id}`}
                      className="text-amber-700 hover:underline"
                    >
                      {order.parent_order_number}
                    </Link>
                  </>
                ) : additionalOrders.length ? (
                  `К заказу ${additionalOrders.length} доп. ${
                    additionalOrders.length === 1 ? "заказ" : "заказа"
                  } на ${formatMoney(order.additional_orders_total, order.currency)}`
                ) : (
                  "Пока ни одного. Добавьте, если клиент довёз замер или доборы."
                )}
              </p>
            </div>
            <OrderAdditionalButton
              orderId={order.id}
              orderNumber={order.order_number}
              currency={order.currency}
              priceItems={priceItems}
              kinds={priceBookOptions?.kinds ?? []}
              referenceValues={referenceValues}
            />
          </div>

          {/* Сами допы списком со ссылками: раньше карточка знала только их
              количество, и чтобы открыть доп, менеджер шёл в список заказов и
              искал его там по номеру — а номер она тоже не показывала.
              Развёрнуто по умолчанию (как было раньше) — менеджеру нужны все
              данные сразу, лишний клик на каждую карточку только мешает;
              <summary> при этом остаётся, чтобы можно было свернуть длинный
              список руками, если допов много. */}
          {additionalOrders.length ? (
            <details className="group mt-3" open>
              <summary className="cursor-pointer select-none text-sm font-medium text-amber-700 marker:content-none">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block transition group-open:rotate-90">▸</span>
                  {additionalOrders.length === 1 ? "Показать доп. заказ" : "Показать доп. заказы"}
                </span>
              </summary>
            <ul className="mt-3 space-y-2">
              {additionalOrders.map((extra) => (
                <li
                  key={extra.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${extra.id}`}
                      className="num font-medium text-amber-700 hover:underline"
                    >
                      {extra.order_number}
                    </Link>
                    <span className="ml-2 text-sm text-slate-600">
                      {extra.status?.name || "без статуса"} · от {formatDate(extra.created_at)}
                    </span>
                  </div>
                  {/* Раньше это были плашки в стиле кликабельных «таблеток»
                      статуса (order-actions.tsx) — менеджер пытался их нажать,
                      и ничего не происходило: это просто факты о допе, не
                      переключатели. Здесь — обычный текст через точку, без
                      кнопочной формы, плюс статус оплаты (заказчик: «статус
                      оплаты в самих заказах сделать» — у допа своя оплата, и
                      по счётчику родителя не видно, кто из допов ещё должен). */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span
                      className={cn(
                        "font-medium",
                        extra.payment_status === "Долг" ? "text-rose-700" : "text-slate-600",
                      )}
                    >
                      {extra.payment_status}
                    </span>
                    {extra.material_ordered && !extra.shipped_at ? <span>материал заказан</span> : null}
                    <span>{extra.shipped_at ? `отгружен ${formatDate(extra.shipped_at)}` : "не отгружен"}</span>
                    <span
                      className="num text-sm font-semibold text-slate-900"
                      title={formatMoney(extra.final_amount, extra.currency)}
                    >
                      {formatMoney(extra.final_amount, extra.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            </details>
          ) : null}
        </div>
      </Card>

      {/* Смета во всю ширину, вне сетки: в таблице пятнадцать колонок, и в
          боковой половине экрана она жила под горизонтальной прокруткой —
          «Цвет» и «Сумма» приходилось искать, отматывая вбок. */}
      <Card className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Смета заказа</h3>
            <p className="mt-2 max-w-4xl text-sm text-slate-700">
              «Фрезеровка» ищет по справочнику — цена подставляется сама. Чего в справочнике нет,
              проводится как нестандарт со своей ценой. Цена запоминается в заказе: когда справочник
              подорожает, этот заказ останется с той, по которой договаривались.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/price-book">Справочник цен</Link>
          </Button>
        </div>
        <div className="mt-4 min-w-0">
          <OrderPositionsTable
            orderId={order.id}
            positions={order.positions}
            priceItems={priceItems}
            currency={order.currency}
            kinds={priceBookOptions?.kinds ?? []}
            referenceValues={referenceValues}
          />
        </div>
      </Card>

      {/* min-w-0 обязателен: внутри лежит таблица сметы шириной 1100 px со
          своей прокруткой, а колонка сетки по умолчанию растягивается под
          содержимое — и тогда вбок едет вся страница, а не таблица */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Деньги по заказу</h3>
            <div className="mt-4">
              <OrderPayments
                orderId={order.id}
                payments={order.payments}
                balance={order.balance}
                methods={methods}
                currency={order.currency}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Файлы заказа</h3>
            <p className="mt-2 text-sm text-slate-700">
              Эскизы, замеры, сканы договора — всё, что прислал клиент, и всё, что нужно отправить
              ему в ответ.
            </p>
            <div className="mt-4">
              <OrderFiles orderId={order.id} files={files} />
            </div>
          </Card>

          {order.items.length ? (
            <Card>
              <h3 className="text-lg font-semibold text-slate-900">Изделия из каталога</h3>
              <Table className="mt-4">
                <THead>
                  <TR>
                    <TH>Наименование</TH>
                    <TH>Тип</TH>
                    <TH>Размер</TH>
                    <TH>Кол-во</TH>
                  </TR>
                </THead>
                <TBody>
                  {order.items.map((item) => (
                    <TR key={item.id}>
                      <TD className="font-medium text-slate-900">{item.name}</TD>
                      <TD>{item.item_type}</TD>
                      <TD>
                        {item.width} × {item.height} × {item.depth}
                      </TD>
                      <TD>{item.quantity}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ) : null}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Производственный маршрут</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Этапы производства, фотофиксация и фактическое выполнение по заказу.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ProductionBootstrapButton orderId={order.id} disabled={stages.length > 0} />
                <Link href={`/production/orders/${order.id}`} className="text-sm font-medium text-amber-700">
                  Открыть маршрут
                </Link>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {stages.length ? (
                stages.map((stage) => (
                  <div key={stage.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{stage.workflow_stage.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stage.status}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Участок: {stage.workflow_stage.work_center?.name || "-"} | Фото: {stage.evidence.length}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Производственный workflow по заказу пока не запущен.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Экспорты</h3>
            <div className="mt-4">
              <OrderExportsList orderId={order.id} exports={exportsList} />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Задания на ЧПУ</h3>
            <div className="mt-4 space-y-3">
              {cncJobs.length ? (
                cncJobs.map((job) => (
                  <div key={job.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-medium text-slate-900">{job.file_name}</p>
                    <p className="text-sm text-slate-500">
                      {job.machine_name} / {job.postprocessor}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">CNC-файлы пока не сгенерированы.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
