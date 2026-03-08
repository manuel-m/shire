import type { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import { DataTable } from '../../../components/tables/DataTable.js';

const statusColors: Record<string, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  review: 'primary',
  final: 'success',
};

const columns: GridColDef[] = [
  { field: 'title', headerName: 'Title', flex: 1 },
  { field: 'version', headerName: 'Version', width: 80 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (params) => (
      <Chip label={params.value as string} color={statusColors[params.value as string] || 'default'} size="small" />
    ),
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) =>
      row.createdAt ? new Date(row.createdAt as string).toLocaleDateString() : '',
  },
];

interface Report {
  _id: string;
  title: string;
  version: number;
  status: string;
  createdAt: string;
}

interface Props {
  data: Report[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick: (row: Report) => void;
  loading: boolean;
}

export function ReportsTable({ data, total, page, pageSize, onPageChange, onRowClick, loading }: Readonly<Props>) {
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
