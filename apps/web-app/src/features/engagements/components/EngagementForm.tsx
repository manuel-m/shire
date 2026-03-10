import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateEngagementSchema } from '@shire/shared-types';
import { TextField, Stack, Button, Alert, MenuItem, Autocomplete, CircularProgress } from '@mui/material';
import { useState } from 'react';
import { useClientSearch } from '../../clients/api/clientQueries.js';
import { useCreateEngagement, useUpdateEngagement } from '../api/engagementMutations.js';

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
  preselectedClient?: { _id: string; companyName: string };
  onSuccess: () => void;
}

export function EngagementForm({ defaultValues, engagementId, preselectedClient, onSuccess }: Readonly<Props>) {
  const [clientSearch, setClientSearch] = useState('');
  const { data: clientOptions, isLoading: clientsLoading } = useClientSearch(clientSearch);

  const createMutation = useCreateEngagement();
  const updateMutation = useUpdateEngagement(engagementId);
  const mutation = engagementId ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EngagementFormData>({
    resolver: zodResolver(engagementId ? CreateEngagementSchema.partial() : CreateEngagementSchema),
    defaultValues,
  });

  const onSubmit = (data: EngagementFormData) => {
    mutation.mutate(data, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        {mutation.error && <Alert severity="error">{mutation.error.message}</Alert>}
        {!engagementId && preselectedClient && (
          <TextField label="Client" value={preselectedClient.companyName} disabled fullWidth />
        )}
        {!engagementId && !preselectedClient && (
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={clientOptions ?? []}
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
        <Button type="submit" variant="contained" disabled={mutation.isPending}>
          {(() => {
            if (mutation.isPending) return 'Saving...';
            return engagementId ? 'Update' : 'Create Engagement';
          })()}
        </Button>
      </Stack>
    </form>
  );
}
