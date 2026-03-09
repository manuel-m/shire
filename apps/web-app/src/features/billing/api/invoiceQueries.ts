import { useQuery } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { invoiceKeys } from './invoiceKeys.js';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
}

interface InvoiceListResponse {
  data: Invoice[];
  total: number;
}

export function useInvoicesList(page: number, limit: number) {
  return useQuery({
    queryKey: invoiceKeys.list({ page, limit }),
    queryFn: ({ signal }) =>
      customFetcher<InvoiceListResponse>({
        url: '/api/invoices',
        method: 'GET',
        params: { page: String(page), limit: String(limit) },
        signal,
      }),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id!),
    queryFn: ({ signal }) =>
      customFetcher<Record<string, unknown>>({
        url: `/api/invoices/${id}`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });
}
