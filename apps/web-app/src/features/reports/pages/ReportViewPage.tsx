import { useParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { ReportViewer } from '../components/ReportViewer.js';
import { useReport } from '../api/reportQueries.js';

export function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useReport(id);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!report) return null;

  return <ReportViewer report={report as never} />;
}
