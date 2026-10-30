import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatArea, formatMoney, leadPartArea, type LeadPart } from "@/lib/format";

type Props = {
  parts: LeadPart[];
};

/**
 * Позиции заявки — теми же колонками, что в бумажном бланке студии.
 *
 * Раньше карточка показывала только длину, ширину, количество и площадь: цвет,
 * толщина, фрезеровка и посчитанная цена оставались лежать в заявке, но на
 * экран не попадали, и менеджер сверял заказ с бумагой, а не с системой.
 * Читаем их общим разбором заявки (`readLeadParts`) — тем же, которым живут
 * бланк и раскрой, чтобы три экрана не разошлись в трактовке одной строки.
 */
export function LeadPositionsTable({ parts }: Props) {
  // Колонки расчёта показываем, только если заявку считали: у половины заявок
  // цены нет вовсе («посчитаем позже»), и три пустых столбца сжимали бы
  // размеры, ради которых таблицу и открывают.
  const priced = parts.some((part) => part.article || part.unitPrice || part.amount);
  const totalQuantity = parts.reduce((sum, part) => sum + part.quantity, 0);
  const totalArea = parts.reduce((sum, part) => sum + leadPartArea(part), 0);
  const totalAmount = parts.reduce((sum, part) => sum + Number(part.amount || 0), 0);

  return (
    <div className="min-w-0 space-y-2">
      {/* Прокрутку вбок держит сама `Table`: на телефоне ехать должна она, а не
          страница целиком. */}
      <div className="min-w-0">
        <Table>
          <THead>
            <TR>
              <TH>№</TH>
              <TH>Длина, мм</TH>
              <TH>Ширина, мм</TH>
              <TH>Кол-во</TH>
              <TH>Площадь</TH>
              <TH>Мм</TH>
              <TH>Фрезеровка</TH>
              <TH>Цвет</TH>
              {priced ? (
                <>
                  <TH>Артикул</TH>
                  <TH>Цена</TH>
                  <TH>Сумма</TH>
                </>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {parts.map((part, index) => (
              <TR key={`${part.width}-${part.height}-${index}`}>
                <TD className="num text-slate-500">{index + 1}</TD>
                <TD className="num">{part.width}</TD>
                <TD className="num">{part.height}</TD>
                <TD className="num">{part.quantity}</TD>
                <TD className="num">{formatArea(leadPartArea(part))}</TD>
                <TD className="num">{part.thickness || "—"}</TD>
                <TD>{part.milling || "—"}</TD>
                {/* Полный текст цвета — в подсказке: в ячейке остаётся сам
                    цвет, а студия пишет туда «Эмаль RAL 9003 плита 19мм». */}
                <TD title={part.materialSource || undefined}>{part.material || "—"}</TD>
                {priced ? (
                  <>
                    <TD className="num">{part.article || "—"}</TD>
                    <TD className="num">
                      {part.unitPrice ? formatMoney(part.unitPrice) : "—"}
                    </TD>
                    <TD className="num font-medium text-slate-900">
                      {part.amount ? formatMoney(part.amount) : "—"}
                    </TD>
                  </>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <p className="text-sm text-slate-600">
        Позиций: <span className="num font-medium text-slate-900">{parts.length}</span> · деталей:{" "}
        <span className="num font-medium text-slate-900">{totalQuantity}</span> · площадь:{" "}
        <span className="num font-medium text-slate-900">{formatArea(totalArea)}</span>
        {priced && totalAmount > 0 ? (
          <>
            {" "}
            · посчитано:{" "}
            <span className="num font-medium text-slate-900">{formatMoney(totalAmount)}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
