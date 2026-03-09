import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Box, Alert, CircularProgress } from '@mui/material';
import { InvoicesTable } from '../components/InvoicesTable.js';
import { useInvoicesList } from '../api/invoiceQueries.js';

export function InvoicesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, error } = useInvoicesList(page, pageSize);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <>
      <Box mb={2}>
        <Typography variant="h4">Invoices</Typography>
      </Box>
      {isLoading && !data ? (
        <CircularProgress />
      ) : (
        <InvoicesTable
          data={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/invoices/${row._id}`)}
          loading={isLoading}
        />
      )}
    </>
  );
}
