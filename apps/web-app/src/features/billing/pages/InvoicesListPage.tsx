import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Box, Alert, CircularProgress } from '@mui/material';
import { InvoicesTable } from '../components/InvoicesTable.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
}

export function InvoicesListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices?page=${page}&limit=${pageSize}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load invoices');
        const json = (await res.json()) as { data: Invoice[]; total: number };
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
      <Box mb={2}>
        <Typography variant="h4">Invoices</Typography>
      </Box>
      {loading && !data.length ? (
        <CircularProgress />
      ) : (
        <InvoicesTable
          data={data}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/invoices/${row._id}`)}
          loading={loading}
        />
      )}
    </>
  );
}
