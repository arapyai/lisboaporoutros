import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { queryClient } from './adminConfig';
import { AdminApp } from './auth/AdminApp';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AdminApp />
  </QueryClientProvider>
);
