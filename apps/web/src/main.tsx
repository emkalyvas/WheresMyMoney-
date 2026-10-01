import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import { TooltipProvider } from '@/components/ui/overlay';
import { ApiError } from '@/lib/api';
import { applyTheme, initialTheme, PrivacyProvider } from '@/lib/preferences';
import { keys } from '@/lib/queries';
import './i18n';
import './styles.css';

// Apply the cached theme before first paint to avoid a flash.
applyTheme(initialTheme());

// v1 registered a pass-through service worker; remove it so it can't intercept requests.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
}

// Any 401 means the session expired: flip the auth state so the router shows the login page.
const onError = (error: unknown) => {
  if (error instanceof ApiError && (error.status === 401 || error.code === 'SETUP_REQUIRED')) {
    void queryClient.invalidateQueries({ queryKey: keys.auth });
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <TooltipProvider>
          <App />
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'text-sm' }} />
        </TooltipProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  </StrictMode>,
);
