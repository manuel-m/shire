import type { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import { DataTable } from '../../../components/tables/DataTable.js';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  issued: 'info',
  'pending-payment': 'warning',
  paid: 'success',
  overdue: 'error',
};

const columns: GridColDef[] = [
  { field: 'invoiceNumber', headerName: 'Invoice #', width: 150 },
  {
    field: 'amount',
    headerName: 'Amount',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) => {
      const currency = (row.currency as string) || 'EUR';
      const amount = row.amount as number;
      return `${amount.toLocaleString()} ${currency}`;
    },
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
    renderCell: (params) => (
      <Chip label={params.value as string} color={statusColors[params.value as string] || 'default'} size="small" />
    ),
  },
  {
    field: 'issueDate',
    headerName: 'Issue Date',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) =>
      row.issueDate ? new Date(row.issueDate as string).toLocaleDateString() : '',
  },
  {
    field: 'dueDate',
    headerName: 'Due Date',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) =>
      row.dueDate ? new Date(row.dueDate as string).toLocaleDateString() : '',
  },
];

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
}

interface Props {
  data: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick: (row: Invoice) => void;
  loading: boolean;
}

export function InvoicesTable({ data, total, page, pageSize, onPageChange, onRowClick, loading }: Readonly<Props>) {
  return (
    <DataTable
      rows={data}
      columns={columns}
      total={total}
      paginationModel={{ page: page - 1, pageSize }}
      onPaginationModelChange={(m) => onPageChange(m.page + 1, m.pageSize)}
      loading={loading}
      onRowClick={onRowClick}
    />
  );
}
