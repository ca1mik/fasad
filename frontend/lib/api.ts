import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  AdminUser,
  AuditEvent,
  CatalogItem,
  ChannelAccount,
  Client,
  ClientDetail,
  CncJob,
  CatalogEstimate,
  Conversation,
  ConversationSummary,
  DashboardSummary,
  EdgeMaterial,
  Envelope,
  ExportFile,
  FilmCuttingOptions,
  Hardware,
  Lead,
  Material,
  Order,
  OrderFile,
  OrderStage,
  OrderStatus,
  Part,
  PaymentMethod,
  ClientActivityReport,
  Permission,
  PriceBookOptions,
  PriceItem,
  ReferenceValues,
  ProductionDirection,
  ProductionTimeReport,
  ProductionWorker,
  ProductionWorkflow,
  ProductTemplate,
  VolumeReport,
  WorkKindReport,
  Role,
  StagePartProgress,
  StockItem,
  StockMovement,
  TelegramBotResult,
} from "@/types/api";

const configuredApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
const API_URL =
  configuredApiUrl?.startsWith("http://") || configuredApiUrl?.startsWith("https://")
    ? configuredApiUrl
    : "http://127.0.0.1:8000/api/v1";

class UnauthorizedApiError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedApiError";
  }
}

/**
 * Вошёл, но раздел не его.
 *
 * Отдельно от «не вошёл»: на 401 мы уводим на страницу входа, считая, что
 * сессия протухла. Пока сервер отвечал на нехватку прав тем же 401, работник
 * цеха, открывший чужой раздел по прямой ссылке, попадал в петлю «войди —
 * снова войди»: логин верный, а на странице опять форма. Теперь такой раздел
 * просто отдаёт пустые данные, и страница показывает, что доступа нет.
 */
export class ForbiddenApiError extends Error {
  constructor() {
    super("Недостаточно прав");
    this.name = "ForbiddenApiError";
  }
}

async function request<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const token = auth ? (await cookies()).get("access_token")?.value : undefined;
  if (auth && !token) {
    throw new UnauthorizedApiError();
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new UnauthorizedApiError();
    }
    if (response.status === 403) {
      throw new ForbiddenApiError();
    }
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function safeData<T>(callback: () => Promise<Envelope<T>>, fallback: T): Promise<T> {
  try {
    const result = await callback();
    return result.data;
  } catch (error) {
    if (error instanceof UnauthorizedApiError) {
      redirect("/login");
    }
    // 403 на страницу входа не уводим: человек вошёл, просто раздел не его.
    // Страница соберётся на пустых данных, а рамка приложения покажет, что
    // доступа нет, — см. AppShell.
    return fallback;
  }
}

/**
 * Как `safeData`, но не отбрасывает `meta` — нужен настоящий `total`.
 *
 * Раньше страница заявок считала «найдено» как `leads.length` — то есть
 * длину уже обрезанной сервером страницы (максимум 100 записей), а не
 * реальное количество совпадений в базе. Если заявок с фильтром было, скажем,
 * 240, счётчик и бейдж молча показывали «100» — заказчик это и назвал «неверно
 * отображаются заявки».
 */
async function safeDataWithMeta<T>(
  callback: () => Promise<Envelope<T>>,
  fallback: T,
): Promise<{ data: T; total: number }> {
  try {
    const result = await callback();
    return { data: result.data, total: result.meta?.total ?? 0 };
  } catch (error) {
    if (error instanceof UnauthorizedApiError) {
      redirect("/login");
    }
    return { data: fallback, total: 0 };
  }
}

export const api = {
  login(payload: { login: string; password: string }) {
    return request<Envelope<{ token: { access_token: string }; user: { full_name: string } }>>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      false,
    );
  },
  async getDashboard() {
    return safeData(() => request<Envelope<DashboardSummary>>("/dashboard/summary"), {
      total_orders: 0,
      new_leads: 0,
      mock_revenue: "0",
      orders_by_status: [],
      stock_by_material_type: [],
      production: {
        active_stages: 0,
        in_progress_stages: 0,
        blocked_stages: 0,
        completed_reports: 0,
        done_quantity: 0,
        defect_quantity: 0,
        stages_by_status: [],
        reports_by_work_center: [],
        top_workers: [],
      },
    });
  },
  async getClients() {
    return safeData(() => request<Envelope<Client[]>>("/clients?page=1&size=50"), []);
  },
  async getClient(id: string) {
    return safeData(
      () => request<Envelope<ClientDetail>>(`/clients/${id}`),
      null as ClientDetail | null,
    );
  },
  async getDirections() {
    return safeData(
      () => request<Envelope<ProductionDirection[]>>("/directions?only_active=true"),
      [],
    );
  },
  /** Все направления, включая отключённые — для админки (admin/directions). */
  async getAllDirections() {
    return safeData(() => request<Envelope<ProductionDirection[]>>("/directions"), []);
  },
  async getVolumeReport(query: string) {
    return safeData(() => request<Envelope<VolumeReport>>(`/reports/volume?${query}`), null as VolumeReport | null);
  },
  async getClientActivityReport(query: string) {
    return safeData(
      () => request<Envelope<ClientActivityReport>>(`/reports/clients?${query}`),
      null as ClientActivityReport | null,
    );
  },
  async getWorkKindReport(query: string) {
    return safeData(
      () => request<Envelope<WorkKindReport>>(`/reports/work-kinds?${query}`),
      null as WorkKindReport | null,
    );
  },
  async getProductionTimeReport(query: string) {
    return safeData(
      () => request<Envelope<ProductionTimeReport>>(`/reports/production-time?${query}`),
      null as ProductionTimeReport | null,
    );
  },
  async getConversations() {
    return safeData(
      () => request<Envelope<ConversationSummary[]>>("/messaging/conversations?page=1&size=50"),
      [],
    );
  },
  async getConversation(id: string) {
    return safeData(
      () => request<Envelope<Conversation>>(`/messaging/conversations/${id}`),
      null as Conversation | null,
    );
  },
  async getAdminUsers() {
    return safeData(() => request<Envelope<AdminUser[]>>("/admin/users?page=1&size=100"), []);
  },
  async getAdminRoles() {
    return safeData(() => request<Envelope<Role[]>>("/admin/roles?page=1&size=100"), []);
  },
  async getAdminPermissions() {
    return safeData(() => request<Envelope<Permission[]>>("/admin/permissions?page=1&size=100"), []);
  },
  async getChannelAccounts() {
    return safeData(
      () => request<Envelope<ChannelAccount[]>>("/messaging/channel-accounts?page=1&size=100"),
      [],
    );
  },
  async getAuditLog() {
    return safeData(() => request<Envelope<AuditEvent[]>>("/admin/audit?page=1&size=100"), []);
  },
  async getLeads(query = "page=1&size=50") {
    return safeData(() => request<Envelope<Lead[]>>(`/leads?${query}`), []);
  },
  /** Как `getLeads`, но с настоящим `total` из `meta` — для счётчика на /leads. */
  async getLeadsPage(query = "page=1&size=50") {
    return safeDataWithMeta(() => request<Envelope<Lead[]>>(`/leads?${query}`), []);
  },
  async getLead(id: string) {
    return safeData(() => request<Envelope<Lead>>(`/leads/${id}`), null as Lead | null);
  },
  /** Подсказка номера для пустого поля — чтобы не искать последний номер в списке руками. */
  async getNextLeadNumber() {
    return safeData(
      () => request<Envelope<{ next_number: string }>>("/leads/next-number"),
      null as { next_number: string } | null,
    );
  },
  async getOrders(query = "page=1&size=50") {
    return safeData(() => request<Envelope<Order[]>>(`/orders?${query}`), []);
  },
  /**
   * Как `getOrders`, но с настоящим `total` из `meta` — тот же баг, что был
   * у заявок (см. `getLeadsPage`): без него список заказов молча обрезался
   * до первых 100 по дате, и старые заказы (а отменённые обычно старые —
   * их давно не трогают) просто выпадали из выдачи без единого признака,
   * что где-то есть ещё.
   */
  async getOrdersPage(query = "page=1&size=100") {
    return safeDataWithMeta(() => request<Envelope<Order[]>>(`/orders?${query}`), []);
  },
  async getOrderStatuses() {
    return safeData(() => request<Envelope<OrderStatus[]>>("/orders/statuses"), []);
  },
  async getOrder(id: string) {
    return safeData(() => request<Envelope<Order>>(`/orders/${id}`), null as Order | null);
  },
  async getPriceItems(query = "page=1&size=200") {
    return safeData(() => request<Envelope<PriceItem[]>>(`/price-book?${query}`), []);
  },
  async getPriceBookOptions() {
    return safeData(
      () => request<Envelope<PriceBookOptions>>("/price-book/options"),
      null as PriceBookOptions | null,
    );
  },
  async getReferenceValues() {
    return safeData(
      () => request<Envelope<ReferenceValues>>("/reference-values"),
      { colors: [], millings: [], articles: [] } as ReferenceValues,
    );
  },
  async getPaymentMethods() {
    return safeData(() => request<Envelope<PaymentMethod[]>>("/orders/payment-methods"), []);
  },
  async getOrderFiles(orderId: string) {
    return safeData(() => request<Envelope<OrderFile[]>>(`/orders/${orderId}/files`), []);
  },
  async getOrderStages(orderId: string) {
    return safeData(() => request<Envelope<OrderStage[]>>(`/orders/${orderId}/stages`), []);
  },
  async getParts(orderId: string) {
    return safeData(() => request<Envelope<Part[]>>(`/orders/${orderId}/parts`), []);
  },
  async getExports(orderId: string) {
    return safeData(() => request<Envelope<ExportFile[]>>(`/orders/${orderId}/exports`), []);
  },
  async getCncJobs(orderId: string) {
    return safeData(() => request<Envelope<CncJob[]>>(`/orders/${orderId}/cnc-jobs`), []);
  },
  async getProductionWorkflows() {
    return safeData(() => request<Envelope<ProductionWorkflow[]>>("/production/workflows?page=1&size=20"), []);
  },
  async getProductionQueue() {
    return safeData(() => request<Envelope<OrderStage[]>>("/production/queue?page=1&size=50"), []);
  },
  async getProductionStage(stageId: string) {
    return safeData(() => request<Envelope<OrderStage>>(`/production/stages/${stageId}`), null as OrderStage | null);
  },
  async getStagePartProgress(stageId: string) {
    return safeData(() => request<Envelope<StagePartProgress[]>>(`/production/stages/${stageId}/part-progress`), []);
  },
  async getWorkers() {
    return safeData(() => request<Envelope<ProductionWorker[]>>("/workers?page=1&size=100"), []);
  },
  async getWorker(id: string) {
    return safeData(() => request<Envelope<ProductionWorker>>(`/workers/${id}`), null as ProductionWorker | null);
  },
  async getMyWorkerCard() {
    return safeData(() => request<Envelope<ProductionWorker>>("/workers/me"), null as ProductionWorker | null);
  },
  async getTemplates() {
    return safeData(() => request<Envelope<ProductTemplate[]>>("/templates?page=1&size=50"), []);
  },
  async getCatalog() {
    return safeData(() => request<Envelope<CatalogItem[]>>("/templates/catalog"), []);
  },
  async getFilmCuttingOptions() {
    return safeData(
      () => request<Envelope<FilmCuttingOptions>>("/templates/film-cutting/options"),
      {
        default_roll_width_mm: 1400,
        default_trim_margin_mm: 70,
        colors: [],
        millings: [],
        catalog_items: [],
      },
    );
  },
  async getMaterials() {
    return safeData(() => request<Envelope<Material[]>>("/materials?page=1&size=50"), []);
  },
  async getEdgeMaterials() {
    return safeData(() => request<Envelope<EdgeMaterial[]>>("/edge-materials?page=1&size=50"), []);
  },
  async getHardware() {
    return safeData(() => request<Envelope<Hardware[]>>("/hardware?page=1&size=50"), []);
  },
  async getStockItems() {
    return safeData(() => request<Envelope<StockItem[]>>("/stock/items?page=1&size=50"), []);
  },
  async getStockMovements() {
    return safeData(() => request<Envelope<StockMovement[]>>("/stock/movements?page=1&size=50"), []);
  },
  async estimateCatalog(payload: {
    product_code: string;
    width: number;
    height: number;
    depth: number;
    quantity: number;
    material_code?: string;
  }) {
    return request<Envelope<CatalogEstimate>>("/templates/catalog/estimate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async simulateTelegramBot(payload: Record<string, unknown>) {
    return request<Envelope<TelegramBotResult>>("/messaging/telegram/bot/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
