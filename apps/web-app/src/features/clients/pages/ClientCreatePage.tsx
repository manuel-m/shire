import { useNavigate } from 'react-router-dom';
import { Typography, Paper, Box } from '@mui/material';
import { ClientForm } from '../components/ClientForm.js';

export function ClientCreatePage() {
  const navigate = useNavigate();

  return (
    <>
      <Typography variant="h4" gutterBottom>
        New Client
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box>
          <ClientForm onSuccess={() => void navigate('/clients')} />
        </Box>
      </Paper>
    </>
  );
}
