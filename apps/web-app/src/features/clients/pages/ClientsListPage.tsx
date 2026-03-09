import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ClientsTable } from '../components/ClientsTable.js';
import { useClientsList } from '../api/clientQueries.js';

export function ClientsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, error } = useClientsList(page, pageSize);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Clients</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => void navigate('/clients/new')}
        >
          New Client
        </Button>
      </Box>
      {isLoading && !data ? (
        <CircularProgress />
      ) : (
        <ClientsTable
          data={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/clients/${row._id}`)}
          loading={isLoading}
        />
      )}
    </>
  );
}
