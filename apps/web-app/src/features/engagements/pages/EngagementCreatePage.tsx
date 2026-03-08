import { useNavigate } from 'react-router-dom';
import { Typography, Paper, Box } from '@mui/material';
import { EngagementForm } from '../components/EngagementForm.js';

export function EngagementCreatePage() {
  const navigate = useNavigate();

  return (
    <>
      <Typography variant="h4" gutterBottom>
        New Engagement
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box>
          <EngagementForm onSuccess={() => void navigate('/engagements')} />
        </Box>
      </Paper>
    </>
  );
}
