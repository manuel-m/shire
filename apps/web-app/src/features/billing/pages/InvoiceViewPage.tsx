import { useParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { InvoiceDetail } from '../components/InvoiceDetail.js';
import { useInvoice } from '../api/invoiceQueries.js';

export function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!invoice) return null;

  return <InvoiceDetail invoice={invoice as never} />;
}
