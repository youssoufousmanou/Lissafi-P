import { apiClient } from '../../api/client';

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

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}

function unwrapData<T>(response: ApiDataResponse<T>): T {
  return response.data ?? response;
}

export async function getDailySummary(date?: string) {
  const response = await apiClient<ApiDataResponse<DailySummary>>(`/operations/summary/daily${buildQuery({ date })}`);

  return unwrapData(response);
}

export async function getMonthlySummary(year?: number, month?: number) {
  const response = await apiClient<ApiDataResponse<MonthlySummary>>(`/operations/summary/monthly${buildQuery({ year, month })}`);

  return unwrapData(response);
}
