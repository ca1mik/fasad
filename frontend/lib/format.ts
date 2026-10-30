import { cleanColorText } from "@/lib/material-text";

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Только дата, как в бумажном бланке заказа: 30.07.2026. */
export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

/** Размер вложения в килобайтах и мегабайтах, а не в сырых байтах. */
export function formatFileSize(bytes: number | null | undefined) {
  // Неизвестный размер и пустой файл — разные вещи. Выгрузки системы
  // сохранялись без размера, и список файлов заказа печатал им «0 КБ»: человек
  // видел заведомо пустой файл там, где на диске лежало 187 байт текста.
  if (bytes === null || bytes === undefined) return "размер неизвестен";
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "размер неизвестен";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export function formatMoney(value: string | number | null | undefined, currency = "RUB") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Одна позиция из построчного ввода размеров. */
export type SizeLine = {
  width: number;
  height: number;
  quantity: number;
  /** Материал позиции — то, что стоит в строке после первого «|». */
  material?: string;
  /** Толщина плиты, мм — колонка «Мм» бланка заказа. */
  thickness?: string;
  /** Артикул фрезеровки — колонка «Фрезеровка» бланка заказа. */
  milling?: string;
};

export type SizeLinesResult = {
  lines: SizeLine[];
  errors: { line: number; source: string }[];
  totalQuantity: number;
  /** Площадь фасадов, м² — то, что заказал клиент. */
  facadeAreaSqm: number;
};

/**
 * Разбирает список размеров так же, как раскрой: «560 123 3», «560x123x3»,
 * «560*123». Если количество не указано, берётся 1.
 *
 * После «|» идут поля бланка заказа — цвет, толщина, фрезеровка:
 * «391 706 1 | Эмаль RAL 9003 плита 19мм | 19 | Арт 109». Любое можно
 * пропустить. Так вся строка бланка заказчика доезжает до раскроя и до печати
 * через заявку и остаётся видна менеджеру — правится прямо в поле.
 *
 * Держим здесь, а не в раскрое, чтобы форма заявки и карта раскроя понимали
 * ввод одинаково — иначе менеджер получил бы два разных формата.
 */
export function parseSizeLines(input: string): SizeLinesResult {
  const lines: SizeLine[] = [];
  const errors: { line: number; source: string }[] = [];

  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((source, index) => {
      if (!source) return;
      // материал отделяем первым: в его названии бывает «х» («орех»), а её
      // ниже заменяет разделитель размеров — название бы порвалось
      const [sizePart, ...rest] = source.split("|");
      const [material = "", thickness = "", milling = ""] = rest.map((piece) => piece.trim());
      const pieces = sizePart
        .replace(/[xXхХ*]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);

      if (pieces.length < 2 || pieces.length > 3) {
        errors.push({ line: index + 1, source });
        return;
      }

      const width = Number(pieces[0]);
      const height = Number(pieces[1]);
      const quantity = pieces[2] ? Number(pieces[2]) : 1;

      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isSafeInteger(quantity) ||
        width <= 0 ||
        height <= 0 ||
        quantity <= 0
      ) {
        errors.push({ line: index + 1, source });
        return;
      }

      lines.push({
        width,
        height,
        quantity,
        ...(material ? { material } : {}),
        ...(thickness ? { thickness } : {}),
        ...(milling ? { milling } : {}),
      });
    });

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const facadeAreaSqm =
    lines.reduce((sum, line) => sum + line.width * line.height * line.quantity, 0) / 1_000_000;

  return { lines, errors, totalQuantity, facadeAreaSqm };
}

/** Площадь в м² с двумя знаками, по-русски. */
export function formatArea(value: string | number | null | undefined) {
  const area = Number(value || 0);
  return `${area.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} м²`;
}

/** Деталь из разобранной заявки. */
export type LeadPart = {
  width: number;
  height: number;
  quantity: number;
  /**
   * Цвет позиции — уже без толщины и основы.
   *
   * В бланке заказчика колонка «Цвет» содержит всё сразу («Эмаль RAL 9003
   * плита 19мм»), поэтому наружу отдаём вычищенное значение: по нему
   * подписываются карты раскроя и ячейки таблиц.
   */
  material?: string;
  /**
   * Исходная запись цвета, как её занесли. Нужна там, где из текста ещё надо
   * что-то достать — толщину для деления карт, — и менеджеру для сверки с
   * бумагой.
   */
  materialSource?: string;
  thickness?: string;
  milling?: string;
  /**
   * Расчёт по строке. Появляется, только когда менеджер посчитал заявку:
   * артикул из справочника и цена на момент расчёта.
   *
   * Заявка — черновик, и цены в ней может не быть вовсе: клиент спросил
   * «сколько выйдет», менеджер занёс размеры и считает позже. Поэтому все три
   * поля необязательны, а старые заявки читаются как раньше.
   */
  article?: string;
  /** Цена за единицу на момент расчёта. Строкой — как её отдаёт сервер. */
  unitPrice?: string;
  /** Сумма строки. Хранится посчитанной, чтобы бумага не разошлась с экраном. */
  amount?: string;
  /** Единица расчёта: «sqm» — цена за м², иначе за штуку. */
  unit?: string;
};

/**
 * Площадь так, как она печатается в бланке студии: пять знаков через запятую.
 *
 * Один форматтер на все три таблицы — бумагу, заявку и смету заказа. Когда у
 * каждой был свой, смета показывала «0.3660», а бланк «0,36600», и менеджер,
 * сверяя лист с экраном, видел два разных числа под одинаковой подписью.
 */
export function formatBlankArea(value: number) {
  return value.toFixed(5).replace(".", ",");
}

/** Площадь позиции в м². Размеры в миллиметрах, как в бланке заказчика. */
export function leadPartArea(part: Pick<LeadPart, "width" | "height" | "quantity">) {
  return (part.width * part.height * part.quantity) / 1_000_000;
}

// Здесь был `leadThicknessTally` — сводка «16- / 19-» справа от итогов бланка.
// Её никто не импортировал: и печатный бланк, и файл считают эту табличку у
// себя. Убран, чтобы не появилась третья копия того же счёта.

/**
 * Достаёт список деталей из разобранных данных заявки.
 *
 * Держим здесь, а не на странице, чтобы карточка заявки и раскрой по заявкам
 * читали одно и то же место — иначе в двух местах разошлись бы правила.
 */
export function readLeadParts(payload: Record<string, unknown> | null | undefined): LeadPart[] {
  const text = (key: string, value: unknown) =>
    typeof value === "string" && value.trim() ? { [key]: value.trim() } : {};
  const raw = (payload?.raw_payload ?? null) as Record<string, unknown> | null;
  const parts = raw?.parts;
  if (!Array.isArray(parts)) {
    return [];
  }
  return parts
    .filter(
      (item): item is LeadPart =>
        typeof item === "object" &&
        item !== null &&
        Number.isFinite((item as LeadPart).width) &&
        Number.isFinite((item as LeadPart).height),
    )
    .map((item) => {
      // В хранилище поля лежат так, как их пишет сервер и форма заявки —
      // через подчёркивание. Наружу отдаём привычные для фронта имена.
      const stored = item as Record<string, unknown>;
      const money = (key: string, value: unknown) =>
        value === null || value === undefined || value === "" ? {} : { [key]: String(value) };

      // Цвет чистим здесь, в единственной точке чтения деталей заявки: дальше
      // по нему строятся коды материалов и подписи карт, и если чистить
      // где-то ниже, один и тот же цвет разъедется на два материала.
      const material = cleanColorText(typeof item.material === "string" ? item.material : "");

      return {
        width: item.width,
        height: item.height,
        quantity:
          Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1,
        ...(material ? { material } : {}),
        ...text("materialSource", item.material),
        ...text("thickness", item.thickness),
        ...text("milling", item.milling),
        ...text("article", stored.article),
        ...text("unit", stored.unit),
        ...money("unitPrice", stored.unit_price ?? stored.unitPrice),
        ...money("amount", stored.amount),
      };
    });
}

/** Русское склонение дней: 1 день, 2 дня, 5 дней. */
export function pluralDays(count: number) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}

/**
 * Отсчёт до срока сдачи: «осталось 12 дней», «срок сегодня», «просрочен на 3 дня».
 *
 * Заказчик: «вписали 14 дней — и отсчёт пошёл». Дату он видит и так, а знать
 * ему надо, сколько осталось: иначе срок считают в голове по календарю, а
 * просрочку замечают, когда клиент уже звонит.
 *
 * Считаем календарными днями, а не часами: срок называют датой, и «0» должно
 * означать «сегодня», а не «полдня назад».
 */
/** Сколько календарных дней до срока. Отрицательное — просрочен, null — даты нет. */
function daysUntilDue(due: string | null | undefined): number | null {
  if (!due) {
    return null;
  }
  const target = new Date(due);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const dayStart = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.round((dayStart(target) - dayStart(new Date())) / 86_400_000);
}

export function formatDueCountdown(due: string | null | undefined) {
  const days = daysUntilDue(due);
  if (days === null) {
    return "";
  }
  if (days === 0) {
    return "срок сегодня";
  }
  if (days > 0) {
    return `осталось ${days} ${pluralDays(days)}`;
  }
  const late = Math.abs(days);
  return `просрочен на ${late} ${pluralDays(late)}`;
}

/** Срок прошёл. Считается там же, где отсчёт, чтобы подсветка и текст не разошлись. */
export function isOverdue(due: string | null | undefined) {
  return formatDueCountdown(due).startsWith("просрочен");
}

/**
 * Срок горит: не просрочен, но осталось совсем мало.
 *
 * Заказчик: «можно помечать заказы, которые уже горят, например 2-3 дня — в
 * поле сроки красным». Просроченные и так красные (`isOverdue`) — это про
 * те, что вот-вот станут такими, пока их ещё можно спасти.
 */
export function isDueSoon(due: string | null | undefined, thresholdDays = 3) {
  const days = daysUntilDue(due);
  return days !== null && days >= 0 && days <= thresholdDays;
}

/** Дата в формате поля `type="date"`, по местному времени, а не по UTC. */
export function toDateInputValue(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}
