import { useQuery } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';

interface DashboardData {
  totalClients: number;
  totalEngagements: number;
  totalReports: number;
  totalInvoices: number;
  activeEngagements: number;
  draftInvoices: number;
  overdueInvoices: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) =>
      customFetcher<DashboardData>({
        url: '/api/dashboard',
        method: 'GET',
        signal,
      }),
  });
}
