import { useQuery } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { reportKeys } from './reportKeys.js';

interface Report {
  _id: string;
  title: string;
  version: number;
  status: string;
  createdAt: string;
}

interface ReportListResponse {
  data: Report[];
  total: number;
}

export function useReportsList(page: number, limit: number) {
  return useQuery({
    queryKey: reportKeys.list({ page, limit }),
    queryFn: ({ signal }) =>
      customFetcher<ReportListResponse>({
        url: '/api/reports',
        method: 'GET',
        params: { page: String(page), limit: String(limit) },
        signal,
      }),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: reportKeys.detail(id!),
    queryFn: ({ signal }) =>
      customFetcher<Record<string, unknown>>({
        url: `/api/reports/${id}`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });
}
