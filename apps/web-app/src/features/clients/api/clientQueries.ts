import { useQuery } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { clientKeys } from './clientKeys.js';

interface Client {
  _id: string;
  companyName: string;
  industry?: string;
  website?: string;
  technicalStack: string[];
  notes?: string;
  engagementCount?: number;
  createdAt: string;
}

interface Contact {
  _id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
}

interface ClientListResponse {
  data: Client[];
  total: number;
}

export function useClientsList(page: number, limit: number) {
  return useQuery({
    queryKey: clientKeys.list({ page, limit }),
    queryFn: ({ signal }) =>
      customFetcher<ClientListResponse>({
        url: '/api/clients',
        method: 'GET',
        params: { page: String(page), limit: String(limit) },
        signal,
      }),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(id!),
    queryFn: ({ signal }) =>
      customFetcher<Client>({
        url: `/api/clients/${id}`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });
}

export function useClientContacts(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.contacts(id!),
    queryFn: ({ signal }) =>
      customFetcher<Contact[]>({
        url: `/api/clients/${id}/contacts`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });
}

export function useClientSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query);

  return useQuery({
    queryKey: clientKeys.search(debouncedQuery),
    queryFn: ({ signal }) =>
      customFetcher<ClientListResponse>({
        url: '/api/clients',
        method: 'GET',
        params: { companyName: debouncedQuery, limit: '20' },
        signal,
      }),
    enabled: debouncedQuery.length > 0,
    select: (res) => res.data,
  });
}
