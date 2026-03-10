import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateClientSchema } from '@shire/shared-types';
import { TextField, Stack, Button, Alert } from '@mui/material';
import { useCreateClient, useUpdateClient } from '../api/clientMutations.js';

type ClientFormData = {
  companyName: string;
  industry?: string;
  technicalStack?: string[];
  website?: string;
  notes?: string;
};

interface Props {
  defaultValues?: Partial<ClientFormData>;
  clientId?: string;
  onSuccess: () => void;
}

export function ClientForm({ defaultValues, clientId, onSuccess }: Readonly<Props>) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient(clientId);
  const mutation = clientId ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ClientFormData>({
    resolver: zodResolver(CreateClientSchema),
    defaultValues,
    mode: 'all',
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} // eslint-disable-line @typescript-eslint/no-misused-promises
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        {mutation.error && <Alert severity="error">{mutation.error.message}</Alert>}
        <TextField
          label="Company Name"
          fullWidth
          required
          error={!!errors.companyName}
          helperText={errors.companyName?.message}
          {...register('companyName')}
        />
        <TextField label="Industry" fullWidth {...register('industry')} />
        <TextField
          label="Website"
          fullWidth
          placeholder="https://example.com"
          error={!!errors.website}
          helperText={errors.website?.message ?? 'Leave empty if none provided'}
          {...register('website')}
        />
        <TextField label="Notes" fullWidth multiline rows={3} {...register('notes')} />
        <Button type="submit" variant="contained" disabled={mutation.isPending || !isValid}>
          {(() => {
            if (mutation.isPending) return 'Saving...';
            return clientId ? 'Update Client' : 'Create Client';
          })()}
        </Button>
      </Stack>
    </form>
  );
}
