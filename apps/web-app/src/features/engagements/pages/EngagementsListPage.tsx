import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { EngagementsTable } from '../components/EngagementsTable.js';
import { useEngagementsList } from '../api/engagementQueries.js';

export function EngagementsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, error } = useEngagementsList(page, pageSize);

  if (error) return <Alert severity="error">{error.message}</Alert>;

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
      {isLoading && !data ? (
        <CircularProgress />
      ) : (
        <EngagementsTable
          data={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onRowClick={(row) => void navigate(`/engagements/${row._id}/edit`)}
          loading={isLoading}
        />
      )}
    </>
  );
}
