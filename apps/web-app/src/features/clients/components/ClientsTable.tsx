import type { GridColDef } from '@mui/x-data-grid';
import { DataTable } from '../../../components/tables/DataTable.js';
import { Badge, IconButton } from '@mui/material';
import WorkIcon from '@mui/icons-material/Work';
import PlusIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

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

export function ClientsTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  loading,
}: Readonly<Props>) {
  const navigate = useNavigate();

  const columns: GridColDef[] = [
    { field: 'companyName', headerName: 'Company', flex: 1 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            const row = params.row as Client;
            const search = new URLSearchParams({ clientId: row._id, clientName: row.companyName });
            void navigate(`/engagements/new?${search.toString()}`);
          }}
        >
          <Badge color="primary" badgeContent={<PlusIcon sx={{ fontSize: '10px' }} />}>
            <WorkIcon fontSize="medium" />
          </Badge>
        </IconButton>
      ),
    },
    { field: 'industry', headerName: 'Industry', flex: 0.5 },
    {
      field: 'technicalStack',
      headerName: 'Tech Stack',
      flex: 1,
      valueGetter: (_value: unknown, row: Record<string, unknown>) =>
        (row.technicalStack as string[])?.join(', ') || '',
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      valueGetter: (_value: unknown, row: Record<string, unknown>) =>
        row.createdAt ? new Date(row.createdAt as string).toLocaleDateString() : '',
    },
  ];

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
