export type Envelope<T> = {
  data: T;
  meta?: {
    page: number;
    size: number;
    total: number;
    pages: number;
  } & Record<string, unknown>;
};

export type Permission = {
  id: string;
  code: string;
  name: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Permission[];
};

export type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  login: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role: Role;
};

export type AuditEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
};

export type ProductionDirection = {
  id: string;
  code: string;
  name: string;
  number_suffix: string;
  material_area_factor?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type ReportPeriod = {
  code: string;
  label: string;
  date_from: string | null;
  date_to: string | null;
};

export type VolumeTotals = {
  orders_count: number;
  amount: string;
  currency: string;
  facade_area_sqm: string;
  material_area_sqm: string;
  items_count: number;
};

export type VolumeRow = VolumeTotals & {
  key: string;
  label: string;
};

/**
 * По какому направлению посчитан отчёт.
 *
 * Заказчик: цифры в файле молча расходились с экраном, потому что отбор жил
 * только на странице. Отчёт сам говорит, по какому направлению он посчитан, —
 * это печатают в шапке выгрузки и показывают рядом с цифрами.
 *
 * Отдаёт каждый отчёт: `DirectionScope` в `backend/app/modules/reports/schemas.py`.
 */
export type DirectionScope = {
  direction_code: string | null;
  direction_label: string | null;
};

export type VolumeReport = DirectionScope & {
  metric: string;
  metric_label: string;
  period: ReportPeriod;
  total: VolumeTotals;
  by_direction: VolumeRow[];
  by_month: VolumeRow[];
};

export type ClientActivityRow = {
  client_id: string;
  full_name: string;
  organization: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  category_label: string;
  orders_count: number;
  amount: string;
  currency: string;
  facade_area_sqm: string;
  material_area_sqm: string;
  items_count: number;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last_order: number | null;
  average_days_between_orders: number | null;
  directions: string[];
  /** Материал по последнему заказу клиента: not_ordered / ordered / shipped, null — заказов ещё не было. */
  last_order_material_status: string | null;
  last_order_material_status_label: string | null;
};

export type ClientActivityReport = DirectionScope & {
  period: ReportPeriod;
  total: VolumeTotals;
  rows: ClientActivityRow[];
  /** Порог «давно не покупал». Печатается в шапке выгрузки: иначе по файлу не
      понять, почему в нём двенадцать клиентов из ста. */
  inactive_days: number | null;
  /** Сколько клиентов отмечено галочками. `null` — отбора не было. */
  selected_clients: number | null;
};

/**
 * Строка «заказ»: сумма и площадь одной сделки.
 *
 * Заказчик сводит объёмы руками по заказам, поэтому нужен файл, где строка —
 * это заказ, а не свёрнутый итог по направлению.
 */
export type OrderVolumeRow = {
  order_id: string;
  order_number: string;
  created_at: string | null;
  shipped_at: string | null;
  client_name: string | null;
  organization: string | null;
  direction_name: string | null;
  status_name: string | null;
  items_count: number;
  facade_area_sqm: string;
  material_area_sqm: string;
  amount: string;
  currency: string;
};

export type OrderVolumeReport = DirectionScope & {
  metric: string;
  metric_label: string;
  period: ReportPeriod;
  total: VolumeTotals;
  rows: OrderVolumeRow[];
};

export type StageDurationRow = {
  stage_code: string;
  stage_name: string;
  work_center_name: string | null;
  completed_count: number;
  in_progress_count: number;
  blocked_count: number;
  average_hours: string | null;
  median_hours: string | null;
  longest_hours: string | null;
};

export type OrderCycleRow = {
  order_id: string;
  order_number: string;
  direction_name: string | null;
  client_name: string | null;
  stages_total: number;
  stages_done: number;
  current_stage_name: string | null;
  production_hours: string | null;
  is_finished: boolean;
};

export type ProductionTimeReport = {
  period: ReportPeriod;
  by_stage: StageDurationRow[];
  orders: OrderCycleRow[];
};

export type Client = {
  id: string;
  full_name: string;
  organization: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  /** Дата последнего заказа — считается пакетно для всей страницы списка. */
  last_order_at: string | null;
  /** «Долг» / «Аванс» / «Расчёты закрыты» / null — если заказов ещё не было. */
  balance_status: string | null;
};

export type ClientOrderHistoryItem = {
  id: string;
  order_number: string;
  created_at: string;
  final_amount: string;
  currency: string;
  status_name: string | null;
  direction_name: string | null;
  items_summary: string;
  items_count: number;
};

export type ClientPurchaseTotals = {
  orders_count: number;
  total_amount: string;
  currency: string;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last_order: number | null;
};

/** Баланс клиента: плюс — аванс, минус — долг. */
export type ClientBalance = {
  charged: string;
  paid: string;
  balance: string;
  status: string;
  currency: string;
  orders_count: number;
  unpaid_orders: number;
  due_total: string;
};

/** Расчёты по одному заказу: начислено, закрыто, остаток. */
export type ClientOrderSettlement = {
  order_id: string;
  order_number: string;
  created_at: string;
  shipped_at: string | null;
  status_name: string | null;
  direction_name: string | null;
  charged: string;
  paid: string;
  due: string;
  overpaid: string;
  payments_count: number;
  currency: string;
};

/** Событие взаиморасчётов: начисление по заказу или поступление денег. */
export type ClientLedgerEntry = {
  kind: "order" | "payment";
  kind_label: string;
  happened_at: string;
  order_id: string | null;
  order_number: string | null;
  charged: string;
  paid: string;
  /** Откуда поступление: наличные, карта, счёт — или направление заказа. */
  source: string | null;
  comment: string | null;
  balance_after: string;
};

export type ClientStatement = {
  balance: ClientBalance;
  orders: ClientOrderSettlement[];
  ledger: ClientLedgerEntry[];
};

export type ClientDetail = Client & {
  totals: ClientPurchaseTotals;
  order_history: ClientOrderHistoryItem[];
  /** Расчёты клиента: и ждущие ответа, и уже ставшие заказами. */
  calculations: ClientCalculation[];
  pending_calculations_count: number;
  pending_calculations_amount: string;
  statement: ClientStatement | null;
};

/** Сводка заявки: то, что менеджер видит сразу после её создания. */
/** Заказ, выросший из заявки: по нему карточка даёт ссылку, а не «заказов: 1». */
export type LeadOrderRef = {
  id: string;
  order_number: string;
  final_amount: string;
  currency: string;
  comment: string | null;
};

export type LeadSummary = {
  quantity: number;
  facade_area_sqm: string;
  material_area_sqm: string;
  estimated_amount: string | null;
  orders_count: number;
  orders_amount: string;
  currency: string;
  /** Сами заказы, а не только их количество. */
  orders?: LeadOrderRef[];
};

export type Lead = {
  id: string;
  /** Номер вида «З-0001» — его называют клиенту, ссылка на UUID для этого не годится. */
  lead_number: string | null;
  summary?: LeadSummary | null;
  source_channel: string;
  external_message_id: string | null;
  subject: string | null;
  raw_text: string;
  normalized_text: string | null;
  parsed_payload_json: Record<string, unknown>;
  status: string;
  /** Срок, названный клиенту при расчёте. Едет дальше по цепочке в заказ. */
  due_date: string | null;
  direction_id: string | null;
  client_id: string | null;
  assigned_manager_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  direction?: ProductionDirection | null;
  attachments: Array<{
    id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size_bytes: number;
  }>;
};

export type MessagingUserSummary = {
  id: string;
  full_name: string;
  login: string;
};

export type LeadReference = {
  id: string;
  lead_number: string | null;
  source_channel: string;
  status: string;
  created_at: string;
};

export type ImapSettings = {
  host: string;
  port: number;
  ssl: boolean;
  login: string;
  folder: string;
};

export type SmtpSettings = {
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  login: string;
  from_email: string;
  from_name: string;
};

export type EmailChannelConfig = {
  imap: ImapSettings;
  smtp: SmtpSettings;
  poll_interval_seconds: number;
  since_days: number;
  unseen_only: boolean;
  mark_seen: boolean;
};

export type ChannelAccount = {
  id: string;
  code: string;
  channel_type: string;
  name: string;
  description: string | null;
  inbound_mode: string;
  is_active: boolean;
  default_manager_id: string | null;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  next_poll_at: string | null;
  last_polled_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  configured_secrets: string[];
  default_manager?: MessagingUserSummary | null;
};

export type ChannelHealthCheckStep = {
  ok: boolean;
  detail: string;
};

export type ChannelHealthCheckResult = {
  ok: boolean;
  imap: ChannelHealthCheckStep | null;
  smtp: ChannelHealthCheckStep | null;
};

export type ChannelPollResult = {
  account_id: string;
  fetched: number;
  created: number;
  skipped: number;
  error: string | null;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  lead_id: string | null;
  user_id: string | null;
  direction: string;
  status: string;
  source_channel: string;
  external_message_id: string | null;
  subject: string | null;
  body_text: string;
  normalized_text: string | null;
  raw_payload_json: Record<string, unknown>;
  sender_name: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  sender_external_id: string | null;
  read_at: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  created_at: string;
  updated_at: string;
  lead?: LeadReference | null;
  user?: MessagingUserSummary | null;
  attachments: Array<{
    id: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size_bytes: number;
  }>;
};

export type ConversationSummary = {
  id: string;
  channel_account_id: string;
  client_id: string | null;
  source_lead_id: string | null;
  assigned_manager_id: string | null;
  status: string;
  contact_key: string;
  external_chat_id: string | null;
  external_thread_id: string | null;
  subject: string | null;
  participant_name: string | null;
  participant_phone: string | null;
  participant_email: string | null;
  participant_external_id: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  channel_account: ChannelAccount;
  client?: Client | null;
  source_lead?: LeadReference | null;
  assigned_manager?: MessagingUserSummary | null;
};

export type Conversation = ConversationSummary & {
  messages: ConversationMessage[];
};

export type OrderStatus = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
};

export type OrderItem = {
  id: string;
  order_id: string;
  template_id: string | null;
  item_type: string;
  name: string;
  width: string;
  height: string;
  depth: string;
  quantity: number;
  material_id: string | null;
  facade_material_id: string | null;
  thickness: string | null;
  params_json: Record<string, unknown>;
  price: string;
  created_at: string;
  updated_at: string;
};

/**
 * Доп. заказ строкой в карточке родителя и в списке заказов.
 *
 * Раньше наружу уходил только счётчик, и «2 доп. заказа» были просто текстом:
 * менеджер видел, что допы есть, а открыть их мог только поиском по номеру.
 */
export type AdditionalOrderLink = {
  id: string;
  order_number: string;
  created_at: string;
  final_amount: string;
  currency: string;
  shipped_at: string | null;
  material_ordered: boolean;
  status?: { code: string; name: string } | null;
  /** «Долг» / «Аванс» / «Оплачен полностью» — та же подпись, что и у главного заказа. */
  payment_status: string;
};

export type Order = {
  id: string;
  order_number: string;
  direction_id: string | null;
  client_id: string;
  manager_id: string;
  status_id: string;
  total_amount: string;
  discount_amount: string;
  final_amount: string;
  currency: string;
  comment: string | null;
  // Материал с текстурой: деталь нельзя разворачивать при раскрое.
  has_texture: boolean;
  /** Прямой запрет поворота, отдельно от текстуры: шлифовка, рисунок фрезы. */
  no_rotation: boolean;
  source_lead_id: string | null;
  /** Срок сдачи, названный клиенту. Приезжает из заявки, переносится по заказу. */
  due_date: string | null;
  /** Материал заказан поставщику: раньше это была заливка ячейки в экселе. */
  material_ordered: boolean;
  material_ordered_at: string | null;
  // Доп. заказ к основному: у допа заполнен родитель, у основного — счётчик
  // допов, чтобы в списке читалось «заказ 1024 (2 доп. заказа)».
  parent_order_id: string | null;
  parent_order_number: string | null;
  additional_orders_count: number;
  additional_orders_total: string;
  /** Сами допы, а не только счётчик: по ним карточка и список дают ссылки. */
  additional_orders?: AdditionalOrderLink[];
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  production_start_at: string | null;
  shipped_at: string | null;
  client?: Client | null;
  direction?: ProductionDirection | null;
  status?: OrderStatus | null;
  items: OrderItem[];
  status_history: Array<{
    id: string;
    changed_at: string;
    comment: string | null;
    old_status?: OrderStatus | null;
    new_status: OrderStatus;
  }>;
  positions: OrderPosition[];
  payments: OrderPayment[];
  balance: OrderBalance | null;
};

/** Артикул из справочника: по нему подтягивается цена в смету заказа. */
export type PriceItem = {
  id: string;
  article: string;
  name: string;
  kind: string;
  kind_label: string;
  unit: string;
  unit_label: string;
  price: string;
  comment: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PriceItemChange = {
  id: string;
  old_price: string;
  new_price: string;
  comment: string | null;
  changed_at: string;
  changed_by: string | null;
};

export type PriceItemDetail = PriceItem & {
  price_changes: PriceItemChange[];
};

export type PriceBookOptions = {
  kinds: Array<{ code: string; label: string }>;
  units: Array<{ code: string; label: string }>;
  /**
   * Направления производства для выбора при приёме заявки: эмаль, плёнка ПВХ,
   * шпон. Это не весь список типов работ — фрезеровка, мыло и кромка живут
   * внутри заказа как операции, и в выборе направления им не место.
   *
   * `code` — код направления, тот же, что принимает приём заявки в
   * `direction_code`. `kind` — тип работ прайса того же направления: под ним
   * заводится номенклатура из артикулов, набранных в заявке руками. Поле
   * сервер отдаёт давно, но в типе его не было — и «причесав» массив до
   * `{code,label}`, тип работ у артикула молча выродился бы в «Прочее».
   */
  production_kinds: Array<{ code: string; label: string; kind?: string }>;
};

/**
 * Строка сметы заказа.
 *
 * `unit_price` — копия цены справочника на момент продажи. Справочник дорожает,
 * старый заказ остаётся с той ценой, по которой договаривались.
 */
export type OrderPosition = {
  id: string;
  order_id: string;
  line_no: number;
  price_item_id: string | null;
  is_custom: boolean;
  article: string | null;
  name: string;
  kind: string;
  kind_label: string;
  unit: string;
  unit_label: string;
  quantity: string;
  width: string | null;
  height: string | null;
  area_sqm: string;
  unit_price: string;
  amount: string;
  thickness: string | null;
  color: string | null;
  milling: string | null;
  comment: string | null;
};

export type OrderPayment = {
  id: string;
  order_id: string;
  amount: string;
  method: string;
  method_label: string;
  paid_at: string;
  comment: string | null;
  created_at: string;
};

/** Деньги по заказу: плюс — аванс, минус — долг. */
export type OrderBalance = {
  positions_total: string;
  final_amount: string;
  paid_amount: string;
  balance: string;
  status: string;
  by_method: Array<{ method: string; label: string; amount: string }>;
};

export type PaymentMethod = { code: string; label: string };

/** Файл, приложенный к заказу, или выгрузка системы. */
export type OrderFile = {
  id: string;
  order_id: string;
  doc_type: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  comment: string | null;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
};

export type WorkKindRow = {
  kind: string;
  kind_label: string;
  orders_count: number;
  positions_count: number;
  quantity: string;
  area_sqm: string;
  amount: string;
};

export type WorkKindArticleRow = WorkKindRow & {
  article: string | null;
  name: string;
};

export type WorkKindReport = {
  metric: string;
  metric_label: string;
  period: { code: string; label: string; date_from: string | null; date_to: string | null };
  total: WorkKindRow;
  by_kind: WorkKindRow[];
  by_article: WorkKindArticleRow[];
};

export type WorkCenter = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type WorkflowStage = {
  id: string;
  workflow_id: string;
  work_center_id: string | null;
  code: string;
  name: string;
  sort_order: number;
  auto_start_next: boolean;
  requires_photo: boolean;
  requires_comment: boolean;
  is_active: boolean;
  work_center?: WorkCenter | null;
};

export type ProductionWorkflow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages: WorkflowStage[];
};

export type ProductionUserSummary = {
  id: string;
  full_name: string;
  login: string;
};

export type StageAssignment = {
  id: string;
  order_stage_instance_id: string;
  assigned_user_id: string | null;
  assigned_by: string | null;
  comment: string | null;
  assigned_at: string;
  assigned_user?: ProductionUserSummary | null;
  assigned_by_user?: ProductionUserSummary | null;
};

export type StageEvidence = {
  id: string;
  order_stage_instance_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number;
  evidence_type: string;
  comment: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploaded_by_user?: ProductionUserSummary | null;
};

export type StagePartReport = {
  id: string;
  order_stage_instance_id: string;
  part_id: string;
  worker_id: string | null;
  report_status: string;
  quantity_done: number;
  quantity_defect: number;
  comment: string | null;
  photo_file_name: string | null;
  photo_file_path: string | null;
  photo_mime_type: string | null;
  photo_size_bytes: number | null;
  created_at: string;
  updated_at: string;
  part: Part;
  worker?: ProductionUserSummary | null;
};

export type StagePartProgress = {
  part: Part;
  required_quantity: number;
  reported_quantity: number;
  done_quantity: number;
  defect_quantity: number;
  remaining_quantity: number;
  reports_count: number;
  last_report_at: string | null;
  last_worker?: ProductionUserSummary | null;
  reports: StagePartReport[];
};

export type OrderStage = {
  id: string;
  order_id: string;
  workflow_id: string;
  workflow_stage_id: string;
  assigned_user_id: string | null;
  created_by: string | null;
  completed_by: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  order?: {
    id: string;
    order_number: string;
    client?: Client | null;
    status?: OrderStatus | null;
  } | null;
  workflow?: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
  } | null;
  workflow_stage: WorkflowStage;
  assigned_user?: ProductionUserSummary | null;
  creator?: ProductionUserSummary | null;
  completer?: ProductionUserSummary | null;
  assignments: StageAssignment[];
  evidence: StageEvidence[];
};

export type ProductionWorker = {
  id: string;
  full_name: string;
  login: string;
  role_code: string;
  role_name: string;
  active_stage_count: number;
  completed_reports_count: number;
  done_quantity: number;
  defect_quantity: number;
  last_report_at: string | null;
  active_stages: OrderStage[];
  recent_reports: StagePartReport[];
};

export type ProductTemplate = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  formula_config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CatalogItem = {
  code: string;
  name: string;
  category: string;
  template_code: string | null;
  description: string;
  bot_menu_label: string;
  default_material_code: string;
  requires_depth: boolean;
  min_width: number;
  max_width: number;
  min_height: number;
  max_height: number;
  min_depth: number;
  max_depth: number;
  bot_questions: string[];
  available_materials: Material[];
};

export type CatalogEstimate = {
  product_code: string;
  product_name: string;
  material_code: string;
  material_name: string | null;
  width: number;
  height: number;
  depth: number;
  quantity: number;
  area_sqm: string;
  material_area_sqm: string;
  edge_length_m: string;
  subtotal: string;
  final_amount: string;
  currency: string;
  components: Array<{
    code: string;
    name: string;
    amount: string;
    unit: string;
    quantity: string;
  }>;
  lead_preview_text: string;
};

export type FilmColor = {
  code: string;
  name: string;
  finish: string;
};

export type FilmMilling = {
  code: string;
  name: string;
  extra_margin_mm: number;
  description: string;
};

export type FilmCatalogItem = {
  code: string;
  name: string;
  description: string;
  default_length_mm: number;
  default_width_mm: number;
  default_depth_mm: number;
  default_quantity: number;
  default_milling_code: string;
  default_color_code: string;
};

export type FilmCuttingLine = {
  line_index: number;
  catalog_item_code: string | null;
  name: string;
  length_mm: number;
  width_mm: number;
  quantity: number;
  depth_mm: number;
  milling_code: string;
  milling_name: string;
  color_code: string;
  color_name: string;
  net_area_sqm: string;
  blank_length_mm: number;
  blank_width_mm: number;
  blank_area_sqm: string;
};

export type FilmCuttingLayoutItem = {
  line_index: number;
  source_name: string;
  x_mm: number;
  y_mm: number;
  length_mm: number;
  width_mm: number;
};

export type FilmCuttingLayoutRow = {
  row_index: number;
  y_mm: number;
  length_mm: number;
  used_width_mm: number;
  remaining_width_mm: number;
  items: FilmCuttingLayoutItem[];
};

export type FilmCuttingColorPlan = {
  color_code: string;
  color_name: string;
  item_count: number;
  net_area_sqm: string;
  blank_area_sqm: string;
  estimated_roll_length_mm: number;
  estimated_roll_area_sqm: string;
  waste_area_sqm: string;
  waste_percent: string;
  layout_rows: FilmCuttingLayoutRow[];
};

export type FilmCuttingOptions = {
  default_roll_width_mm: number;
  default_trim_margin_mm: number;
  colors: FilmColor[];
  millings: FilmMilling[];
  catalog_items: FilmCatalogItem[];
};

export type FilmCuttingEstimate = {
  roll_width_mm: number;
  trim_margin_mm: number;
  total_details: number;
  total_net_area_sqm: string;
  total_blank_area_sqm: string;
  estimated_roll_length_mm: number;
  estimated_roll_area_sqm: string;
  waste_area_sqm: string;
  waste_percent: string;
  lines: FilmCuttingLine[];
  color_plans: FilmCuttingColorPlan[];
  lead_preview_text: string;
};

export type TelegramBotMenuButton = {
  text: string;
  callback_data: string | null;
};

export type TelegramBotResult = {
  reply: {
    text: string;
    session_state: string;
    buttons: TelegramBotMenuButton[][];
    lead_id: string | null;
    estimated_total: string | null;
    estimated_area_sqm: string | null;
  };
};

export type Material = {
  id: string;
  code: string;
  name: string;
  category?: string;
  thickness?: string | null;
  unit: string;
  price: string;
  is_active: boolean;
};

export type EdgeMaterial = {
  id: string;
  code: string;
  name: string;
  thickness?: string | null;
  unit: string;
  price: string;
  is_active: boolean;
};

export type Hardware = {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: string;
  params_json: Record<string, unknown>;
  is_active: boolean;
};

export type Part = {
  id: string;
  part_code: string;
  name: string;
  length: string;
  width: string;
  thickness: string;
  quantity: number;
  label_text: string | null;
  edges: Array<{ id: string; side: string; length_mm: string }>;
  operations: Array<{ id: string; operation_type: string; x: string | null; y: string | null; depth: string | null }>;
};

export type ExportFile = {
  id: string;
  export_type: string;
  format: string;
  file_name: string;
  file_path: string;
  version: number;
  created_at: string;
};

export type CncJob = {
  id: string;
  file_name: string;
  file_path: string;
  version: number;
  machine_name: string;
  postprocessor: string;
  created_at: string;
};

export type StockItem = {
  id: string;
  material_type: string;
  material_id: string;
  quantity: string;
  reserved_quantity: string;
  unit: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  movement_type: string;
  quantity: string;
  unit: string;
  created_at: string;
  comment: string | null;
};

export type DashboardSummary = {
  total_orders: number;
  new_leads: number;
  /** Выручка. `null` — роль её не видит, а не «выручки нет». */
  mock_revenue: string | null;
  orders_by_status: Array<{ code: string; name: string; count: number }>;
  stock_by_material_type: Array<{ material_type: string; count: number }>;
  production: {
    active_stages: number;
    in_progress_stages: number;
    blocked_stages: number;
    completed_reports: number;
    done_quantity: number;
    defect_quantity: number;
    stages_by_status: Array<{ code: string; name: string; count: number }>;
    reports_by_work_center: Array<{ code: string; name: string; count: number }>;
    top_workers: Array<{
      worker_id: string | null;
      worker_name: string;
      reports_count: number;
      done_quantity: number;
      defect_quantity: number;
    }>;
  };
};

/** Значение, которое студия уже писала: подсказка для поиска в таблице. */
export type ReferenceValue = {
  value: string;
  used: number;
};

/**
 * Расчёт клиента: заявка, которая может ещё не стать заказом.
 *
 * Заказчик: «сдала клиента, 2 заказа посчитала, но их здесь нет». Посчитанное и
 * не купленное в выручку не идёт, но из карточки клиента исчезать не должно.
 */
export type ClientCalculation = {
  id: string;
  lead_number: string | null;
  created_at: string;
  due_date: string | null;
  status: string;
  status_label: string;
  quantity: number;
  facade_area_sqm: string;
  estimated_amount: string | null;
  order_id: string | null;
  order_number: string | null;
  currency: string;
};

export type ReferenceValues = {
  colors: ReferenceValue[];
  millings: ReferenceValue[];
  /** Номера артикулов, набранные руками в заявках и заказах. */
  articles: ReferenceValue[];
};
