import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Box, Alert, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2';
import EditIcon from '@mui/icons-material/Edit';
import { ClientDetailCard } from '../components/ClientDetailCard.js';
import { ContactsTable } from '../../contacts/components/ContactsTable.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface Client {
  _id: string;
  companyName: string;
  industry?: string;
  website?: string;
  technicalStack: string[];
  notes?: string;
  engagementCount?: number;
  createdAt: string;
}

interface Contact {
  _id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = authHeaders();
        const [clientRes, contactsRes] = await Promise.all([
          fetch(`/api/clients/${id}`, { headers }),
          fetch(`/api/clients/${id}/contacts`, { headers }),
        ]);
        if (!clientRes.ok) throw new Error('Client not found');
        setClient((await clientRes.json()) as Client);
        if (contactsRes.ok) {
          setContacts((await contactsRes.json()) as Contact[]);
        }
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
          <ContactsTable contacts={contacts} />
        </Grid>
      </Grid>
    </>
  );
}
