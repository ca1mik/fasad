import { formatBlankArea, formatDateOnly } from "@/lib/format";
import type { LeadPart } from "@/lib/format";

/**
 * Бланк заказа студии фасадов — ровно тот, что печатают в цехе.
 *
 * Вёрстка снята с их бумажного бланка: шапка с датами выдачи, таблица
 * «№ | Длина | Ширина | Кол-во | М2 | Мм | Фрезеровка | Цвет», строка итогов,
 * подписи «Размеры проверил» и «Заказ принял», подвал с адресом. Пустые строки
 * до 31-й печатаются как в оригинале — в них дописывают позиции руками.
 */

/** Столько строк в их бланке. Печатается всегда, даже если позиций меньше. */
const BLANK_ROWS = 31;

const SQ_MM_IN_SQ_M = 1_000_000;

export type OrderBlankProps = {
  /** Номер бланка заказчика («4419п»), если он известен. */
  blankNumber?: string | null;
  /** Наш номер заявки — печатается рядом, чтобы связать бумагу с системой. */
  leadNumber?: string | null;
  customer?: string | null;
  /**
   * Адрес доставки — тот, что записан у клиента.
   *
   * Адрес спрашивают ради одного: куда везти. Пока он жил только в карточке
   * клиента, водителю его переписывали в мессенджер руками — и переписывали с
   * ошибками. На бумаге, которая и так едет с заказом, ему самое место.
   */
  address?: string | null;
  createdAt?: string | null;
  /** Ориентировочная дата выдачи. Пустая — её вписывают от руки. */
  dueDate?: string | null;
  /** Комментарий заявки — то, что клиент просил дополнительно. */
  comment?: string | null;
  parts: LeadPart[];
};

function areaOf(part: LeadPart) {
  return (part.width * part.height * part.quantity) / SQ_MM_IN_SQ_M;
}

export function OrderBlank({
  blankNumber,
  leadNumber,
  customer,
  address,
  createdAt,
  dueDate,
  comment,
  parts,
}: OrderBlankProps) {
  const totalQuantity = parts.reduce((sum, part) => sum + part.quantity, 0);
  const totalArea = parts.reduce((sum, part) => sum + areaOf(part), 0);

  // сводка по толщинам — в их бланке это табличка «16- / 19-» справа от
  // итогов. Правая колонка — площадь по этой толщине в м², не количество
  // деталей: цех заказывает материал квадратами, штуки уже видны в таблице.
  const byThickness = new Map<string, number>();
  for (const part of parts) {
    const thickness = part.thickness?.trim();
    if (!thickness) continue;
    byThickness.set(thickness, (byThickness.get(thickness) ?? 0) + areaOf(part));
  }

  const rows = Array.from({ length: Math.max(BLANK_ROWS, parts.length) }, (_, index) => ({
    number: index + 1,
    part: parts[index] ?? null,
  }));

  return (
    <article className="blank">
      <h1 className="blank-title">Схема на присадку под петли должна быть вид &laquo;С ЛИЦА&raquo;</h1>

      <p className="blank-number">
        Бланк заказа: <strong>{blankNumber || leadNumber || "—"}</strong>
      </p>

      <dl className="blank-head">
        <div>
          <dt>Дата:</dt>
          <dd>{createdAt ? formatDateOnly(createdAt) : ""}</dd>
        </div>
        <div>
          <dt>Заказчик</dt>
          <dd>{customer || ""}</dd>
        </div>
        {/* Строка адреса печатается всегда, даже пустой: тогда её заполняют от
            руки при отгрузке, а не ищут телефон менеджера. */}
        <div>
          <dt>Адрес доставки</dt>
          <dd className={address ? undefined : "blank-fill"}>{address || ""}</dd>
        </div>
        {/* Тот же комментарий, что теперь есть в XLSX-версии бланка
            (blank_export.py) — раньше его не было ни здесь, ни там. */}
        <div>
          <dt>Комментарий</dt>
          <dd>{comment || ""}</dd>
        </div>
        <div className="blank-head-wide">
          <dt>Дата выдачи ориентировочная</dt>
          <dd className="blank-fill">{dueDate ? formatDateOnly(dueDate) : ""}</dd>
          <dt>Дата выдачи фактическая</dt>
          <dd className="blank-fill" />
        </div>
      </dl>

      <table className="blank-table">
        <thead>
          <tr>
            <th className="col-num">№</th>
            <th>Длина</th>
            <th>Ширина</th>
            <th className="col-qty" />
            <th>М2</th>
            <th className="col-mm">Мм</th>
            <th>Фрезеровка</th>
            <th className="col-color">Цвет</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ number, part }) => (
            <tr key={number}>
              <td className="col-num">{number}</td>
              <td>{part ? part.width : ""}</td>
              <td>{part ? part.height : ""}</td>
              <td>{part ? part.quantity : ""}</td>
              {/* пустая строка бланка печатает ноль — так в оригинале */}
              <td>{part ? formatBlankArea(areaOf(part)) : "0"}</td>
              <td className="col-mm">{part?.thickness ?? ""}</td>
              <td>{part?.milling ?? ""}</td>
              <td className="col-color">{part?.material ?? ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="col-num" />
            <td />
            <td />
            <td>{totalQuantity || ""}</td>
            <td>{totalArea ? formatBlankArea(totalArea) : ""}</td>
            <td className="col-mm" />
            <td />
            <td className="col-color" />
          </tr>
        </tfoot>
      </table>

      <div className="blank-bottom">
        <div className="blank-signs">
          <p>
            Размеры проверил<span className="blank-line" />
          </p>
          <p>
            Заказ принял<span className="blank-line" />
          </p>
        </div>

        {byThickness.size ? (
          <table className="blank-thickness">
            <tbody>
              {[...byThickness.entries()]
                .sort(([left], [right]) => Number(left) - Number(right))
                .map(([thickness, area]) => (
                  <tr key={thickness}>
                    <td>{thickness}-</td>
                    <td>{formatBlankArea(area)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <footer className="blank-footer">
        <p>Студия фасадов. Рахимова, 8 корпус 1. Тел: 8-987-000-56-35.</p>
        <p>работы: Пн-Пт с 09:00 до 17:00.</p>
      </footer>
    </article>
  );
}
