import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { InvoiceDetail } from '../components/InvoiceDetail.js';
import { authHeaders } from '../../../lib/auth/headers.js';

export function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Invoice not found');
        setInvoice((await res.json()) as Record<string, unknown>);
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
  if (!invoice) return null;

  return <InvoiceDetail invoice={invoice as never} />;
}
