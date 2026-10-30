/**
 * Русские подписи для служебных кодов, приходящих из API.
 *
 * Правило: интерфейс никогда не печатает сырой код. Если кода нет в словаре,
 * `labelFor` вернёт сам код — страница не упадёт и не покажет пустоту, а по
 * незнакомому значению сразу видно, что словарь надо дополнить.
 */

export type LabelMap = Record<string, string>;

export function labelFor(map: LabelMap, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

/** Этапы производства. */
export const STAGE_STATUS_LABELS: LabelMap = {
  pending: "Ожидает",
  in_progress: "В работе",
  blocked: "Заблокирован",
  done: "Завершён",
  cancelled: "Отменён",
};

/** Отчёт работника по детали. */
export const REPORT_STATUS_LABELS: LabelMap = {
  done: "Выполнено",
  defect: "Брак",
  rework: "На переделку",
};

/**
 * Заявки.
 *
 * Набор кодов должен совпадать с `backend/app/modules/leads/statuses.py`: тот
 * же список закрывает правку заявки и печатает статус в карточке клиента. Пока
 * списки жили порознь, «Спам» приходил с сервера и вылезал в плашку сырым
 * кодом, а «Квалифицирована» не было среди плашек отбора.
 */
export const LEAD_STATUS_LABELS: LabelMap = {
  new: "Ждёт ответа",
  in_progress: "В работе",
  qualified: "Квалифицирована",
  converted: "Стала заказом",
  rejected: "Отказ",
  spam: "Спам",
};

/** Порядок статусов заявки для плашек отбора: как заявка идёт по жизни. */
export const LEAD_STATUS_ORDER = Object.keys(LEAD_STATUS_LABELS);

/** Источник заявки. */
export const SOURCE_CHANNEL_LABELS: LabelMap = {
  website_form: "Форма на сайте",
  email: "Почта",
  telegram: "Telegram",
  telegram_bot: "Telegram-бот",
  whatsapp: "WhatsApp",
  max: "Мессенджер МАКС",
  webhook: "Внешний источник",
  manual_manager_input: "Ручной ввод",
  manager_film_cutting: "Расчёт раскроя",
  catalog_demo: "Расчёт по справочнику",
};

/** Диалоги в разделе «Диалоги». */
export const CONVERSATION_STATUS_LABELS: LabelMap = {
  open: "Открыт",
  needs_reply: "Нужен ответ",
  waiting_client: "Ждём клиента",
  closed: "Закрыт",
};

/** Исходящие сообщения. */
export const MESSAGE_STATUS_LABELS: LabelMap = {
  received: "Получено",
  sent: "Отправлено",
  failed: "Не отправлено",
  mock_sent: "Сохранено в CRM",
};

export const DIRECTION_LABELS: LabelMap = {
  inbound: "Входящее",
  outbound: "Исходящее",
};

/** Тип канала связи. */
export const CHANNEL_TYPE_LABELS: LabelMap = {
  email: "Почта",
  telegram: "Telegram",
  telegram_bot: "Telegram-бот",
  whatsapp: "WhatsApp",
  max: "Мессенджер МАКС",
  webhook: "Внешний источник",
  website_form: "Форма на сайте",
  manual_manager_input: "Ручной ввод",
};

/** Режим приёма сообщений в канале. */
export const INBOUND_MODE_LABELS: LabelMap = {
  webhook: "Вебхук",
  polling: "Опрос по расписанию",
  manual: "Вручную",
  form_post: "Отправка формы",
};

/** Должности. */
export const ROLE_LABELS: LabelMap = {
  admin: "Администратор",
  manager: "Менеджер",
  technologist: "Технолог",
  operator: "Оператор производства",
};

/** Производственные направления по ТЗ. */
export const PRODUCTION_DIRECTION_LABELS: LabelMap = {
  enamel: "Эмаль",
  pvc: "ПВХ",
  veneer: "Шпон",
};

/** Категории изделий из справочника шаблонов. */
export const PRODUCT_CATEGORY_LABELS: LabelMap = {
  wardrobe: "Шкаф",
  kitchen: "Кухня",
  facade: "Фасады",
};

/** Категории материалов. */
export const MATERIAL_CATEGORY_LABELS: LabelMap = {
  board: "Плита",
  facade: "Фасад",
  film: "Плёнка",
  paint: "Эмаль",
  veneer: "Шпон",
};

/** Тип складской позиции. */
export const STOCK_ITEM_TYPE_LABELS: LabelMap = {
  material: "Материал",
  edge_material: "Кромка",
  hardware: "Фурнитура",
  offcut: "Деловой обрезок",
};

/** Складские движения. */
export const MOVEMENT_TYPE_LABELS: LabelMap = {
  receipt: "Приход",
  reserve: "Резерв",
  writeoff: "Списание",
  adjustment: "Корректировка",
  release: "Снятие резерва",
};

/** Действия в журнале. */
export const AUDIT_ACTION_LABELS: LabelMap = {
  create_client: "Создан клиент",
  create_lead: "Создана заявка",
  update_lead: "Изменена заявка",
  create_order: "Создан заказ",
  change_status: "Изменён статус",
  change_order_status: "Изменён статус заказа",
  calculate_order: "Рассчитан заказ",
  generate_parts: "Сформированы детали",
  create_conversation: "Создан диалог",
  create_inbound_message: "Входящее сообщение",
  create_outbound_message: "Исходящее сообщение",
  mark_conversation_read: "Диалог прочитан",
  assign_conversation: "Назначен ответственный",
  create_channel_account: "Создан канал связи",
  update_channel_account: "Изменён канал связи",
  create_direction: "Создано направление",
  update_direction: "Изменено направление",
  create_user: "Создан пользователь",
  update_user: "Изменён пользователь",
  create_role: "Создана роль",
  update_role: "Изменена роль",
  create_permission: "Создано право",
  update_permission: "Изменено право",
  bootstrap_workflow: "Запущен маршрут производства",
  assign_stage: "Назначен исполнитель этапа",
  start_stage: "Этап начат",
  complete_stage: "Этап завершён",
  block_stage: "Этап заблокирован",
  add_stage_evidence: "Добавлено фото этапа",
  create_part_report: "Отчёт по детали",
  export_cutting: "Выгрузка раскроя",
  save_cutting_layout: "Сохранена карта раскроя",
  generate_cnc: "Задание для ЧПУ",
  reserve_stock: "Резерв на складе",
  writeoff_stock: "Списание со склада",
};

/** Над чем совершено действие. */
export const AUDIT_ENTITY_LABELS: LabelMap = {
  order: "Заказ",
  order_stage: "Этап заказа",
  stage_part_report: "Отчёт по детали",
  client: "Клиент",
  lead: "Заявка",
  conversation: "Диалог",
  message: "Сообщение",
  channel_account: "Канал связи",
  production_direction: "Направление",
  user: "Пользователь",
  role: "Роль",
  permission: "Право",
};

/** Тон значка: одинаково серые статусы не читаются. */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STAGE_TONES: Record<string, Tone> = {
  pending: "neutral",
  in_progress: "info",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

const REPORT_TONES: Record<string, Tone> = {
  done: "success",
  defect: "danger",
  rework: "warning",
};

const LEAD_TONES: Record<string, Tone> = {
  new: "info",
  in_progress: "warning",
  qualified: "info",
  converted: "success",
  rejected: "neutral",
};

const CONVERSATION_TONES: Record<string, Tone> = {
  open: "info",
  needs_reply: "warning",
  waiting_client: "neutral",
  closed: "neutral",
};

const MESSAGE_TONES: Record<string, Tone> = {
  received: "neutral",
  sent: "success",
  failed: "danger",
  mock_sent: "neutral",
};

export type StatusKind = "stage" | "report" | "lead" | "conversation" | "message";

const REGISTRY: Record<StatusKind, { labels: LabelMap; tones: Record<string, Tone> }> = {
  stage: { labels: STAGE_STATUS_LABELS, tones: STAGE_TONES },
  report: { labels: REPORT_STATUS_LABELS, tones: REPORT_TONES },
  lead: { labels: LEAD_STATUS_LABELS, tones: LEAD_TONES },
  conversation: { labels: CONVERSATION_STATUS_LABELS, tones: CONVERSATION_TONES },
  message: { labels: MESSAGE_STATUS_LABELS, tones: MESSAGE_TONES },
};

export function statusLabel(kind: StatusKind, value: string | null | undefined): string {
  return labelFor(REGISTRY[kind].labels, value);
}

export function statusTone(kind: StatusKind, value: string | null | undefined): Tone {
  if (!value) return "neutral";
  return REGISTRY[kind].tones[value] ?? "neutral";
}
