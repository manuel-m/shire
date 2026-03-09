import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetcher } from '@shire/api-client';
import { engagementKeys } from './engagementKeys.js';

type EngagementFormData = {
  clientId: string;
  type: 'diagnostic' | 'support' | 'resolution';
  accessType: 'black-box' | 'code-delivery' | 'code-credentials';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedConsultant?: string;
};

export function useCreateEngagement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<EngagementFormData>) =>
      customFetcher<unknown>({
        url: '/api/engagements',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: engagementKeys.lists() });
    },
  });
}

export function useUpdateEngagement(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<EngagementFormData>) =>
      customFetcher<unknown>({
        url: `/api/engagements/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: engagementKeys.detail(id!) });
      void queryClient.invalidateQueries({ queryKey: engagementKeys.lists() });
    },
  });
}
