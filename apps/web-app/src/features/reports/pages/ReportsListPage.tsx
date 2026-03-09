import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Box, Alert, CircularProgress } from '@mui/material';
import { ReportsTable } from '../components/ReportsTable.js';
import { useReportsList } from '../api/reportQueries.js';

export function ReportsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, error } = useReportsList(page, pageSize);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <>
      <Box mb={2}>
        <Typography variant="h4">Reports</Typography>
      </Box>
      {isLoading && !data ? (
        <CircularProgress />
      ) : (
        <ReportsTable
          data={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/reports/${row._id}`)}
          loading={isLoading}
        />
      )}
    </>
  );
}
