import type { GridColDef } from '@mui/x-data-grid';
import { DataTable } from '../../../components/tables/DataTable.js';

const columns: GridColDef[] = [
  { field: 'companyName', headerName: 'Company', flex: 1 },
  { field: 'industry', headerName: 'Industry', flex: 0.7 },
  {
    field: 'technicalStack',
    headerName: 'Tech Stack',
    flex: 1,
    valueGetter: (_value: unknown, row: Record<string, unknown>) => (row.technicalStack as string[])?.join(', ') || '',
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) =>
      row.createdAt ? new Date(row.createdAt as string).toLocaleDateString() : '',
  },
];

interface Client {
  _id: string;
  companyName: string;
  industry?: string;
  technicalStack: string[];
  createdAt: string;
}

interface Props {
  data: Client[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick: (row: Client) => void;
  loading: boolean;
}

export function ClientsTable({ data, total, page, pageSize, onPageChange, onRowClick, loading }: Readonly<Props>) {
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
