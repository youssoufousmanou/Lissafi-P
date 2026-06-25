import { apiClient } from '../../api/client';
import { OperationType } from '../../navigation/types';

export type Operation = {
  id: string | number;
  type: OperationType;
  amount: number;
  article_name: string;
  quantity?: number;
  supplier_name?: string;
  op_date: string;
  description?: string;
};

export type OperationPayload = {
  type: OperationType;
  amount: number;
  article_name: string;
  quantity?: number;
  supplier_name?: string;
  op_date: string;
  description?: string;
};

export type ListOperationsParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: OperationType;
  date_from?: string;
  date_to?: string;
};

export type PaginatedOperations = {
  items: Operation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OperationsLimit = {
  used: number;
  limit: number;
  remaining: number;
  period?: string;
};

export type DailySummary = {
  profit?: number;
  revenue?: number;
  expenses?: number;
  sales?: number;
  purchases?: number;
  debts?: number;
  totals?: {
    profit?: number;
    revenue?: number;
    expenses?: number;
    sales?: number;
    purchases?: number;
    debts?: number;
  };
};

export type MonthlySummary = DailySummary & {
  year?: number;
  month?: number;
};

type ApiDataResponse<T> = T & {
  data?: T;
};

type OperationsListResponse = ApiDataResponse<{
  items?: Operation[];
  operations?: Operation[];
  results?: Operation[];
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}>;

type OperationsLimitResponse = ApiDataResponse<Partial<OperationsLimit> & { monthly_limit?: number; monthly_count?: number }>;

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function unwrapData<T>(response: ApiDataResponse<T>): T {
  return response.data ?? response;
}

function normalizeOperationsList(response: OperationsListResponse, fallbackPage = 1, fallbackLimit = 20): PaginatedOperations {
  const payload = unwrapData(response);
  const items = payload.items ?? payload.operations ?? payload.results ?? (Array.isArray(payload) ? payload : []);
  const total = payload.total ?? items.length;
  const limit = payload.limit ?? fallbackLimit;

  return {
    items,
    limit,
    page: payload.page ?? fallbackPage,
    total,
    totalPages: payload.totalPages ?? Math.max(1, Math.ceil(total / limit)),
  };
}

function normalizeLimit(response: OperationsLimitResponse): OperationsLimit {
  const payload = unwrapData(response);
  const limit = payload.limit ?? payload.monthly_limit ?? 0;
  const used = payload.used ?? payload.monthly_count ?? 0;

  return {
    limit,
    period: payload.period,
    remaining: payload.remaining ?? Math.max(0, limit - used),
    used,
  };
}

export async function listOperations(params: ListOperationsParams = {}) {
  const response = await apiClient<OperationsListResponse>(`/operations${buildQuery(params)}`);

  return normalizeOperationsList(response, params.page, params.limit);
}

export function createOperation(payload: OperationPayload) {
  return apiClient<ApiDataResponse<Operation>>('/operations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(unwrapData);
}

export function updateOperation(id: string | number, payload: OperationPayload) {
  return apiClient<ApiDataResponse<Operation>>(`/operations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then(unwrapData);
}

export function deleteOperation(id: string | number) {
  return apiClient<void>(`/operations/${id}`, {
    method: 'DELETE',
  });
}

export async function getOperationsLimit() {
  const response = await apiClient<OperationsLimitResponse>('/operations/limits');

  return normalizeLimit(response);
}

export async function getDailySummary(date?: string) {
  const response = await apiClient<ApiDataResponse<DailySummary>>(`/operations/summary/daily${buildQuery({ date })}`);

  return unwrapData(response);
}

export async function getMonthlySummary(year?: number, month?: number) {
  const response = await apiClient<ApiDataResponse<MonthlySummary>>(`/operations/summary/monthly${buildQuery({ year, month })}`);

  return unwrapData(response);
}
