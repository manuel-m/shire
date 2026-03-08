import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { EngagementsTable } from '../components/EngagementsTable.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface Engagement {
  _id: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  creationDate: string;
}

export function EngagementsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Engagement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/engagements?page=${page}&limit=${pageSize}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load engagements');
        const json = (await res.json()) as { data: Engagement[]; total: number };
        setData(json.data);
        setTotal(json.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [page, pageSize]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Engagements</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => void navigate('/engagements/new')}
        >
          New Engagement
        </Button>
      </Box>
      {loading && !data.length ? (
        <CircularProgress />
      ) : (
        <EngagementsTable
          data={data}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/engagements/${row._id}/edit`)}
          loading={loading}
        />
      )}
    </>
  );
}
