import { AppProviders } from './providers/AppProviders.js';
import { AppRouter } from './app/router.js';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
