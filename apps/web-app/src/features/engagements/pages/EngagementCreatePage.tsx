import { useNavigate, useSearchParams } from 'react-router-dom';
import { Typography, Paper, Box } from '@mui/material';
import { EngagementForm } from '../components/EngagementForm.js';

export function EngagementCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId') ?? undefined;
  const clientName = searchParams.get('clientName') ?? undefined;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        New Engagement
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box>
          <EngagementForm
            defaultValues={clientId ? { clientId } : undefined}
            preselectedClient={clientId && clientName ? { _id: clientId, companyName: clientName } : undefined}
            onSuccess={() => void navigate('/engagements')}
          />
        </Box>
      </Paper>
    </>
  );
}
