import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateEngagementSchema } from '@shire/shared-types';
import { TextField, Stack, Button, Alert, MenuItem, Autocomplete, CircularProgress } from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import { authHeaders } from '../../../lib/auth/headers.js';

type EngagementFormData = {
  clientId: string;
  type: 'diagnostic' | 'support' | 'resolution';
  accessType: 'black-box' | 'code-delivery' | 'code-credentials';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedConsultant?: string;
};

interface Props {
  defaultValues?: Partial<EngagementFormData>;
  engagementId?: string;
  onSuccess: () => void;
}

type ClientOption = { _id: string; companyName: string };

function useClientSearch(query: string) {
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!query) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ companyName: query, limit: '20' });
      void fetch(`/api/clients?${params.toString()}`, {
        headers: authHeaders(),
      })
        .then(async (res) => {
          if (res.ok) {
            const body = (await res.json()) as { data: ClientOption[] };
            setOptions(body.data);
          }
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { options, loading };
}

export function EngagementForm({ defaultValues, engagementId, onSuccess }: Readonly<Props>) {
  const [error, setError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const { options: clientOptions, loading: clientsLoading } = useClientSearch(clientSearch);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EngagementFormData>({
    resolver: zodResolver(engagementId ? CreateEngagementSchema.partial() : CreateEngagementSchema),
    defaultValues,
  });

  const onSubmit = async (data: EngagementFormData) => {
    setError(null);
    const url = engagementId ? `/api/engagements/${engagementId}` : '/api/engagements';
    const method = engagementId ? 'PUT' : 'POST';

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
        throw new Error(err.error?.message ?? 'Failed to save engagement');
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
        {!engagementId && (
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={clientOptions}
                getOptionLabel={(opt) => opt.companyName}
                isOptionEqualToValue={(opt, val) => opt._id === val._id}
                loading={clientsLoading}
                onInputChange={(_e, value) => setClientSearch(value)}
                onChange={(_e, value) => field.onChange(value?._id ?? '')}
                filterOptions={(x) => x}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Client"
                    required
                    error={!!errors.clientId}
                    helperText={errors.clientId?.message ?? 'Search by company name'}
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {clientsLoading && <CircularProgress color="inherit" size={20} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
            )}
          />
        )}
        <TextField
          label="Description"
          fullWidth
          required
          multiline
          rows={3}
          error={!!errors.description}
          helperText={errors.description?.message}
          {...register('description')}
        />
        {!engagementId && (
          <>
            <TextField label="Type" select fullWidth required defaultValue={defaultValues?.type || ''} {...register('type')}>
              <MenuItem value="diagnostic">Diagnostic</MenuItem>
              <MenuItem value="support">Support</MenuItem>
              <MenuItem value="resolution">Resolution</MenuItem>
            </TextField>
            <TextField label="Access Type" select fullWidth required defaultValue={defaultValues?.accessType || ''} {...register('accessType')}>
              <MenuItem value="black-box">Black Box</MenuItem>
              <MenuItem value="code-delivery">Code Delivery</MenuItem>
              <MenuItem value="code-credentials">Code Credentials</MenuItem>
            </TextField>
          </>
        )}
        <TextField label="Priority" select fullWidth required defaultValue={defaultValues?.priority || ''} {...register('priority')}>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </TextField>
        <TextField label="Assigned Consultant" fullWidth {...register('assignedConsultant')} />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {(() => {
            if (isSubmitting) return 'Saving...';
            return engagementId ? 'Update' : 'Create Engagement';
          })()}
        </Button>
      </Stack>
    </form>
  );
}
