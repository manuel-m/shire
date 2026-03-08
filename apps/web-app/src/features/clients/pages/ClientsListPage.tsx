import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ClientsTable } from '../components/ClientsTable.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface Client {
  _id: string;
  companyName: string;
  industry?: string;
  technicalStack: string[];
  createdAt: string;
}

export function ClientsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients?page=${page}&limit=${pageSize}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load clients');
        const json = (await res.json()) as { data: Client[]; total: number };
        setData(json.data);
        setTotal(json.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void fetchClients();
  }, [page, pageSize]);

  if (error) return <Alert severity="error">{error}</Alert>;

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
      {loading && !data.length ? (
        <CircularProgress />
      ) : (
        <ClientsTable
          data={data}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/clients/${row._id}`)}
          loading={loading}
        />
      )}
    </>
  );
}
