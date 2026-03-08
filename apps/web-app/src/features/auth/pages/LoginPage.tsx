import { Navigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { LoginForm } from '../components/LoginForm.js';
import { useAuth } from '../../../lib/auth/auth-context.js';

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Card sx={{ width: 400, p: 2 }}>
        <CardContent>
          <Typography variant="h4" gutterBottom align="center">
            Shire
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            AI Consulting Back-Office
          </Typography>
          <LoginForm />
        </CardContent>
      </Card>
    </Box>
  );
}
