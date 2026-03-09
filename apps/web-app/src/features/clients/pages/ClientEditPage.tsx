import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Paper, Box, Alert, CircularProgress } from '@mui/material';
import { ClientForm } from '../components/ClientForm.js';
import { useClient } from '../api/clientQueries.js';

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading, error } = useClient(id);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!client) return null;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Edit Client
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box>
          <ClientForm
            clientId={id}
            defaultValues={client}
            onSuccess={() => void navigate(`/clients/${id}`)}
          />
        </Box>
      </Paper>
    </>
  );
}
