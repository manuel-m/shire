import type { GridColDef } from '@mui/x-data-grid';
import { DataTable } from '../../../components/tables/DataTable.js';
import { EngagementStatusChip } from './EngagementStatusChip.js';

const columns: GridColDef[] = [
  { field: 'description', headerName: 'Description', flex: 1 },
  { field: 'type', headerName: 'Type', width: 120 },
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    renderCell: (params) => <EngagementStatusChip status={params.value as string} />,
  },
  { field: 'priority', headerName: 'Priority', width: 100 },
  {
    field: 'creationDate',
    headerName: 'Created',
    width: 120,
    valueGetter: (_value: unknown, row: Record<string, unknown>) =>
      row.creationDate ? new Date(row.creationDate as string).toLocaleDateString() : '',
  },
];

interface Engagement {
  _id: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  creationDate: string;
}

interface Props {
  data: Engagement[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick: (row: Engagement) => void;
  loading: boolean;
}

export function EngagementsTable({ data, total, page, pageSize, onPageChange, onRowClick, loading }: Readonly<Props>) {
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
