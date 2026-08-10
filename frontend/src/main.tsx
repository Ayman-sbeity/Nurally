import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ApiRequestError } from '@/api/client';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { App } from './App';

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/landing.css';
import '@/styles/app.css';
import '@/styles/admin.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Availability changes as other clients book, so it must not be served
      // from a long cache; the individual availability query lowers this further.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a request the server has already answered definitively.
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root was not found.');

// `scripts/prerender.mjs` writes a crawlable copy of each page's facts into the
// document: plain HTML inside #root (React clears it on first render) and the
// route's JSON-LD in the head. The head scripts have to go by hand, otherwise a
// client-side navigation would leave the previous route's graph behind.
document.head.querySelectorAll('script[data-geo-static]').forEach((node) => node.remove());

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
