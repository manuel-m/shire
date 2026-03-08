import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import { Box } from '@mui/material';

interface DataTableProps<T> {
  rows: T[];
  columns: GridColDef[];
  total: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
}

export function DataTable<T extends { _id?: string }>({
  rows,
  columns,
  total,
  paginationModel,
  onPaginationModelChange,
  loading = false,
  onRowClick,
  getRowId,
}: Readonly<DataTableProps<T>>) {
  return (
    <Box sx={{ width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        pageSizeOptions={[10, 20, 50]}
        loading={loading}
        getRowId={getRowId ?? ((row: T) => row._id ?? '')}
        onRowClick={onRowClick ? (params) => onRowClick(params.row as T) : undefined}
        disableRowSelectionOnClick
        sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
      />
    </Box>
  );
}
