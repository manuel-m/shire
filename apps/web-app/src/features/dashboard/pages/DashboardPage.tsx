import { useEffect, useState } from 'react';
import { Typography, Alert, CircularProgress, Box } from '@mui/material';
import Grid from '@mui/material/Grid2';
import PeopleIcon from '@mui/icons-material/People';
import WorkIcon from '@mui/icons-material/Work';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WarningIcon from '@mui/icons-material/Warning';
import { StatCard } from '../components/StatCard.js';
import { authHeaders } from '../../../lib/auth/headers.js';

interface DashboardData {
  totalClients: number;
  totalEngagements: number;
  totalReports: number;
  totalInvoices: number;
  activeEngagements: number;
  draftInvoices: number;
  overdueInvoices: number;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard', {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load dashboard');
        setData((await res.json()) as DashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void fetchDashboard();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Clients" value={data.totalClients} icon={<PeopleIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Active Engagements"
            value={data.activeEngagements}
            icon={<WorkIcon />}
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Reports" value={data.totalReports} icon={<DescriptionIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Invoices" value={data.totalInvoices} icon={<ReceiptIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Draft Invoices"
            value={data.draftInvoices}
            icon={<ReceiptIcon />}
            color="info.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Overdue Invoices"
            value={data.overdueInvoices}
            icon={<WarningIcon />}
            color="error.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Engagements"
            value={data.totalEngagements}
            icon={<WorkIcon />}
            color="secondary.main"
          />
        </Grid>
      </Grid>
    </>
  );
}
