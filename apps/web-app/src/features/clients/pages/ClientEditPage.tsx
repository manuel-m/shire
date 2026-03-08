import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Paper, Box, Alert, CircularProgress } from '@mui/material';
import { ClientForm } from '../components/ClientForm.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface Client {
  _id: string;
  companyName: string;
  industry?: string;
  website?: string;
  technicalStack: string[];
  notes?: string;
}

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const res = await fetch(`/api/clients/${id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Client not found');
        setClient((await res.json()) as Client);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void fetchClient();
  }, [id]);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
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
