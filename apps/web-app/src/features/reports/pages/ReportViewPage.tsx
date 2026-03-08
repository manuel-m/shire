import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { ReportViewer } from '../components/ReportViewer.js';
import { authHeaders } from '../../../lib/auth/headers.js';

export function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/reports/${id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Report not found');
        setReport((await res.json()) as Record<string, unknown>);
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
  if (!report) return null;

  return <ReportViewer report={report as never} />;
}
