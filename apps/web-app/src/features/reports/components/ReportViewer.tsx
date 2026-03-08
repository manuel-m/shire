import { Card, CardContent, Typography, Chip, Divider, Box } from '@mui/material';

interface Report {
  _id: string;
  title: string;
  version: number;
  status: string;
  clientName?: string;
  engagementDescription?: string;
  sections?: {
    executiveSummary?: string;
    problems?: { title: string; severity: string }[];
    recommendations?: { title: string; priority: string }[];
  };
  createdAt: string;
  updatedAt: string;
}

export function ReportViewer({ report }: Readonly<{ report: Report }>) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">{report.title}</Typography>
          <Chip label={report.status} size="small" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Version {report.version} | Created: {new Date(report.createdAt).toLocaleDateString()}
        </Typography>
        {report.clientName && (
          <Typography variant="body2" color="text.secondary">
            Client: {report.clientName}
          </Typography>
        )}
        {report.engagementDescription && (
          <Typography variant="body2" color="text.secondary">
            Engagement: {report.engagementDescription}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        {report.sections?.executiveSummary && (
          <>
            <Typography variant="h6" gutterBottom>Executive Summary</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>{report.sections.executiveSummary}</Typography>
          </>
        )}
        {report.sections?.problems && report.sections.problems.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>Problems ({report.sections.problems.length})</Typography>
            {report.sections.problems.map((p, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                <Typography variant="body2">
                  <Chip label={p.severity} size="small" sx={{ mr: 1 }} />
                  {p.title}
                </Typography>
              </Box>
            ))}
          </>
        )}
        {report.sections?.recommendations && report.sections.recommendations.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Recommendations ({report.sections.recommendations.length})</Typography>
            {report.sections.recommendations.map((r, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                <Typography variant="body2">
                  <Chip label={r.priority} size="small" sx={{ mr: 1 }} />
                  {r.title}
                </Typography>
              </Box>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
