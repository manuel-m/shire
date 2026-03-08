import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateClientSchema } from '@shire/shared-types';
import { TextField, Stack, Button, Alert } from '@mui/material';
import { useState } from 'react';
import { authHeaders } from '../../../lib/auth/headers.js';

type ClientFormData = { companyName: string; industry?: string; technicalStack?: string[]; website?: string; notes?: string };

interface Props {
  defaultValues?: Partial<ClientFormData>;
  clientId?: string;
  onSuccess: () => void;
}

export function ClientForm({ defaultValues, clientId, onSuccess }: Readonly<Props>) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(CreateClientSchema),
    defaultValues,
  });

  const onSubmit = async (data: ClientFormData) => {
    setError(null);
    const url = clientId ? `/api/clients/${clientId}` : '/api/clients';
    const method = clientId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'Failed to save client');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Company Name"
          fullWidth
          required
          error={!!errors.companyName}
          helperText={errors.companyName?.message}
          {...register('companyName')}
        />
        <TextField label="Industry" fullWidth {...register('industry')} />
        <TextField label="Website" fullWidth {...register('website')} />
        <TextField label="Notes" fullWidth multiline rows={3} {...register('notes')} />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {(() => {
            if (isSubmitting) return 'Saving...';
            return clientId ? 'Update Client' : 'Create Client';
          })()}
        </Button>
      </Stack>
    </form>
  );
}
