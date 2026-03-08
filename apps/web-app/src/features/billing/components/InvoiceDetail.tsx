import {
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
} from '@mui/material';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  clientName?: string;
  engagementDescription?: string;
  lineItems: LineItem[];
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
}

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  issued: 'info',
  'pending-payment': 'warning',
  paid: 'success',
  overdue: 'error',
};

export function InvoiceDetail({ invoice }: Readonly<{ invoice: Invoice }>) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">{invoice.invoiceNumber}</Typography>
          <Chip label={invoice.status} color={statusColors[invoice.status] || 'default'} />
        </Box>
        <Typography variant="h4" gutterBottom>
          {invoice.amount.toLocaleString()} {invoice.currency}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Issue Date: {new Date(invoice.issueDate).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Due Date: {new Date(invoice.dueDate).toLocaleDateString()}
        </Typography>
        {invoice.paidDate && (
          <Typography variant="body2" color="text.secondary">
            Paid Date: {new Date(invoice.paidDate).toLocaleDateString()}
          </Typography>
        )}
        {invoice.clientName && (
          <Typography variant="body2" color="text.secondary">
            Client: {invoice.clientName}
          </Typography>
        )}
        {invoice.engagementDescription && (
          <Typography variant="body2" color="text.secondary">
            Engagement: {invoice.engagementDescription}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          Line Items
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lineItems.map((item, i) => (
              <TableRow key={i}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{item.unitPrice.toLocaleString()}</TableCell>
                <TableCell align="right">{item.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
