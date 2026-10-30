const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Названия полей по-русски — их видит менеджер в тексте ошибки. */
const FIELD_LABELS: Record<string, string> = {
  "sender.email": "Email",
  "sender.phone": "Телефон",
  "sender.full_name": "Клиент",
  email: "Email",
  phone: "Телефон",
  full_name: "Клиент",
  subject: "Тема",
  text: "Текст",
  source_channel: "Источник",
  quantity: "Количество",
  width: "Длина",
  height: "Ширина",
};

/**
 * Причины отказа, которые чаще всего видит менеджер.
 *
 * Смотрим и на тип, и на текст: почта, например, приходит типом `value_error`,
 * и по одному типу её не отличить — а показывать английское «An email address
 * must have an @-sign» человеку нельзя.
 */
function explain(type: string, raw: string) {
  const text = `${type} ${raw}`.toLowerCase();
  if (text.includes("email")) return "нужен адрес с «@», например ivan@mail.ru";
  if (type === "missing") return "не заполнено";
  if (/^(int|float|decimal|number)/.test(type) || text.includes("valid number")) {
    return "нужно число";
  }
  if (text.includes("too_long") || text.includes("at most")) return "слишком длинное значение";
  if (text.includes("too_short") || text.includes("at least")) return "слишком короткое значение";
  // ничего не узнали — но английский текст сервера человеку не поможет
  return /[а-яё]/i.test(raw) ? raw : "значение не подходит";
}

type ValidationItem = { loc?: (string | number)[]; msg?: string; type?: string };

/**
 * Разбирает отказ сервера в понятный человеку текст.
 *
 * У приложения свой формат ошибок (`error.message`), но проверка входных данных
 * отвечает форматом FastAPI — списком `detail` с путём до поля. Раньше он не
 * разбирался, и менеджер видел «Request failed with status 422», не понимая,
 * какое поле не так. Теперь ошибка называет поле по-русски.
 */
export function readError(payload: unknown, status: number): string {
  const data = payload as {
    error?: { message?: string };
    detail?: string | ValidationItem[];
  };

  if (data?.error?.message) {
    return data.error.message;
  }

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail) && data.detail.length) {
    const parts = data.detail.slice(0, 3).map((item) => {
      // loc = ["body", "sender", "email"] — «body» человеку ничего не говорит
      const path = (item.loc ?? []).filter((step) => step !== "body").join(".");
      const label = FIELD_LABELS[path] ?? FIELD_LABELS[String(path).split(".").pop() ?? ""] ?? path;
      const reason = explain(item.type ?? "", item.msg ?? "значение не подходит");
      return label ? `«${label}» — ${reason}` : reason;
    });
    return `Проверьте поля: ${parts.join("; ")}`;
  }

  return `Сервер отклонил запрос (${status})`;
}

export async function clientRequest<T>(path: string, init?: RequestInit) {
  const token =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((item) => item.startsWith("access_token="))
          ?.split("=")[1]
      : undefined;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Сервер отклонил запрос (${response.status})`;
    try {
      message = readError(await response.json(), response.status);
    } catch {
      // тело не разобралось — оставляем текст со статусом
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
