import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2';
import EditIcon from '@mui/icons-material/Edit';
import { ClientDetailCard } from '../components/ClientDetailCard.js';
import { ContactsTable } from '../../contacts/components/ContactsTable.js';
import { useClient, useClientContacts } from '../api/clientQueries.js';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { data: contacts } = useClientContacts(id);

  if (clientLoading) return <CircularProgress />;
  if (clientError) return <Alert severity="error">{clientError.message}</Alert>;
  if (!client) return null;

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{client.companyName}</Typography>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => void navigate(`/clients/${id}/edit`)}
        >
          Edit
        </Button>
      </Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ClientDetailCard client={client} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" gutterBottom>
            Contacts
          </Typography>
          <ContactsTable contacts={contacts ?? []} />
        </Grid>
      </Grid>
    </>
  );
}
