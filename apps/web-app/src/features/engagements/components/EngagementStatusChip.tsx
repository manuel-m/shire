import { Chip } from '@mui/material';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  requested: 'default',
  diagnosis: 'info',
  'in-progress': 'primary',
  'waiting-for-client': 'warning',
  completed: 'success',
};

export function EngagementStatusChip({ status }: Readonly<{ status: string }>) {
  return <Chip label={status} color={statusColors[status] || 'default'} size="small" />;
}
