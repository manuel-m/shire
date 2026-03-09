import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { clientKeys } from './clientKeys.js';

type ClientFormData = {
  companyName: string;
  industry?: string;
  technicalStack?: string[];
  website?: string;
  notes?: string;
};

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientFormData) =>
      customFetcher<unknown>({
        url: '/api/clients',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClient(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientFormData) =>
      customFetcher<unknown>({
        url: `/api/clients/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.detail(id!) });
      void queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}
