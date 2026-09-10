import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data is reused across screens instead of refetching the same thing.
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry an auth or permission failure.
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                background: '#0f172a',
                color: '#fff',
                fontSize: '14px',
                maxWidth: '420px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
