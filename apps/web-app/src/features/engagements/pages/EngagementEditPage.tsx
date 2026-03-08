import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Paper, Box, Alert, CircularProgress } from '@mui/material';
import { EngagementForm } from '../components/EngagementForm.js';
import { authHeaders } from '../../../lib/auth/headers.js';

export function EngagementEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/engagements/${id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Engagement not found');
        setEngagement((await res.json()) as Record<string, unknown>);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [id]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
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
