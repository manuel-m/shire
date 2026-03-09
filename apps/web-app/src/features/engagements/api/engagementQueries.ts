import { useQuery } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { engagementKeys } from './engagementKeys.js';

interface Engagement {
  _id: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  creationDate: string;
}

interface EngagementListResponse {
  data: Engagement[];
  total: number;
}

export function useEngagementsList(page: number, limit: number) {
  return useQuery({
    queryKey: engagementKeys.list({ page, limit }),
    queryFn: ({ signal }) =>
      customFetcher<EngagementListResponse>({
        url: '/api/engagements',
        method: 'GET',
        params: { page: String(page), limit: String(limit) },
        signal,
      }),
  });
}

export function useEngagement(id: string | undefined) {
  return useQuery({
    queryKey: engagementKeys.detail(id!),
    queryFn: ({ signal }) =>
      customFetcher<Record<string, unknown>>({
        url: `/api/engagements/${id}`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });
}
