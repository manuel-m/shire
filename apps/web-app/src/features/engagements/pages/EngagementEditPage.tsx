import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Paper, Box, Alert, CircularProgress } from '@mui/material';
import { EngagementForm } from '../components/EngagementForm.js';
import { useEngagement } from '../api/engagementQueries.js';

export function EngagementEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: engagement, isLoading, error } = useEngagement(id);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!engagement) return null;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Edit Engagement
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box>
          <EngagementForm
            engagementId={id}
            defaultValues={engagement as never}
            onSuccess={() => void navigate('/engagements')}
          />
        </Box>
      </Paper>
    </>
  );
}
