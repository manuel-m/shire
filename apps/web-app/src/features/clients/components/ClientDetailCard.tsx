import { Card, CardContent, Typography, Chip, Stack, Box } from '@mui/material';

interface Props {
  client: {
    companyName: string;
    industry?: string;
    website?: string;
    technicalStack: string[];
    notes?: string;
    engagementCount?: number;
    createdAt: string;
  };
}

export function ClientDetailCard({ client }: Readonly<Props>) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {client.companyName}
        </Typography>
        {client.industry && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Industry: {client.industry}
          </Typography>
        )}
        {client.website && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Website: {client.website}
          </Typography>
        )}
        {client.engagementCount !== undefined && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Engagements: {client.engagementCount}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Created: {new Date(client.createdAt).toLocaleDateString()}
        </Typography>
        {client.technicalStack.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Tech Stack:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
              {client.technicalStack.map((tech) => (
                <Chip key={tech} label={tech} size="small" />
              ))}
            </Stack>
          </Box>
        )}
        {client.notes && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {client.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
