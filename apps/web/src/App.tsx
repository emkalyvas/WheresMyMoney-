import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/DataGate';
import { MetricHistoryProvider } from '@/components/metric/History';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { usePrivacy, useSystemThemeListener, initialTheme } from '@/lib/preferences';
import { useAuthStatus, useSettings } from '@/lib/queries';
import Overview from '@/pages/Overview';
import Login from '@/pages/auth/Login';
import Setup from '@/pages/auth/Setup';

// Less-visited pages are split into separate chunks.
const Cashflow = lazy(() => import('@/pages/Cashflow'));
const NetWorth = lazy(() => import('@/pages/NetWorth'));
const Tax = lazy(() => import('@/pages/Tax'));
const Planning = lazy(() => import('@/pages/Planning'));
const Reports = lazy(() => import('@/pages/Reports'));
const Health = lazy(() => import('@/pages/Health'));
const Welcome = lazy(() => import('@/pages/auth/Welcome'));
const SettingsLayout = lazy(() => import('@/pages/settings/SettingsLayout'));
const GeneralSettings = lazy(() => import('@/pages/settings/General'));
const ConnectionsSettings = lazy(() => import('@/pages/settings/Connections'));
const AccountsSettings = lazy(() => import('@/pages/settings/Accounts'));
const TaxSettings = lazy(() => import('@/pages/settings/Tax'));
const PlanningSettings = lazy(() => import('@/pages/settings/Planning'));
const ReportsSettings = lazy(() => import('@/pages/settings/Reports'));
const SecuritySettings = lazy(() => import('@/pages/settings/Security'));
const AppearanceSettings = lazy(() => import('@/pages/settings/Appearance'));
const DataSettings = lazy(() => import('@/pages/settings/Data'));

function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" />
    </div>
  );
}

/** Routes that require a session. Redirects to setup or login as needed. */
function RequireAuth() {
  const auth = useAuthStatus();
  const location = useLocation();
  if (auth.isLoading) return <FullPageLoader />;
  if (auth.data?.setupRequired) return <Navigate to="/setup" replace />;
  if (!auth.data?.authenticated) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />;
  }
  return (
    <SessionPreferences>
      <Outlet />
    </SessionPreferences>
  );
}

/** Applies server-side preferences (theme, privacy default) once settings are loaded. */
function SessionPreferences({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const privacy = usePrivacy();
  const theme = settings.data?.settings.appearance.theme ?? initialTheme();
  useSystemThemeListener(theme);
  const privacyDefault = settings.data?.settings.security.privacyModeDefault;
  useEffect(() => {
    if (privacyDefault !== undefined) privacy.setDefault(privacyDefault);
  }, [privacyDefault, privacy]);
  return <MetricHistoryProvider>{children}</MetricHistoryProvider>;
}

/** Login/setup are only reachable when they make sense. */
function PublicOnly({ mode }: { mode: 'login' | 'setup' }) {
  const auth = useAuthStatus();
  const location = useLocation();
  useSystemThemeListener(initialTheme());
  if (auth.isLoading) return <FullPageLoader />;
  if (mode === 'setup' && !auth.data?.setupRequired) {
    // Right after creating the password the next stop is the onboarding wizard.
    return <Navigate to={auth.data?.authenticated ? '/welcome' : '/login'} replace />;
  }
  if (mode === 'login' && auth.data?.setupRequired) return <Navigate to="/setup" replace />;
  if (mode === 'login' && auth.data?.authenticated) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />;
  }
  return mode === 'login' ? <Login /> : <Setup />;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('notFound.title')}
      action={
        <Button asChild>
          <Link to="/">{t('notFound.home')}</Link>
        </Button>
      }
    >
      {t('notFound.body')}
    </EmptyState>
  );
}

const lazyPage = (el: React.ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: '/login', element: <PublicOnly mode="login" /> },
  { path: '/setup', element: <PublicOnly mode="setup" /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/welcome', element: <Suspense fallback={<FullPageLoader />}><Welcome /></Suspense> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'cashflow', element: lazyPage(<Cashflow />) },
          { path: 'networth', element: lazyPage(<NetWorth />) },
          { path: 'tax', element: lazyPage(<Tax />) },
          { path: 'planning', element: lazyPage(<Planning />) },
          { path: 'reports', element: lazyPage(<Reports />) },
          { path: 'health', element: lazyPage(<Health />) },
          {
            path: 'settings',
            element: lazyPage(<SettingsLayout />),
            children: [
              { index: true, element: <Navigate to="general" replace /> },
              { path: 'general', element: lazyPage(<GeneralSettings />) },
              { path: 'connections', element: lazyPage(<ConnectionsSettings />) },
              { path: 'accounts', element: lazyPage(<AccountsSettings />) },
              { path: 'tax', element: lazyPage(<TaxSettings />) },
              { path: 'planning', element: lazyPage(<PlanningSettings />) },
              { path: 'reports', element: lazyPage(<ReportsSettings />) },
              { path: 'security', element: lazyPage(<SecuritySettings />) },
              { path: 'appearance', element: lazyPage(<AppearanceSettings />) },
              { path: 'data', element: lazyPage(<DataSettings />) },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
