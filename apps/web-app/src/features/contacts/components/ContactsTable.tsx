import { Table, TableHead, TableBody, TableRow, TableCell, Typography } from '@mui/material';

interface Contact {
  _id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
}

interface Props {
  contacts: Contact[];
}

export function ContactsTable({ contacts }: Readonly<Props>) {
  if (contacts.length === 0) {
    return <Typography color="text.secondary">No contacts yet.</Typography>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Role</TableCell>
          <TableCell>Phone</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {contacts.map((c) => (
          <TableRow key={c._id}>
            <TableCell>{c.name}</TableCell>
            <TableCell>{c.email}</TableCell>
            <TableCell>{c.role || '-'}</TableCell>
            <TableCell>{c.phone || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
