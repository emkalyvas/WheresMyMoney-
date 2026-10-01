import { type ComponentType, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PiggyBank,
  Settings,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, Menu, Tooltip } from '@/components/ui/overlay';
import { Select } from '@/components/ui/controls';
import { api } from '@/lib/api';
import { usePrivacy } from '@/lib/preferences';
import { keys, useHealth, useStats } from '@/lib/queries';
import { useFormat } from '@/lib/format';
import { useView } from '@/lib/view';
import { cn } from '@/lib/utils';
import { SyncButton } from './SyncButton';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

function useNavItems() {
  const { t } = useTranslation();
  const stats = useStats();
  const health = useHealth();
  const taxEnabled = stats.data?.data?.tax.enabled ?? false;
  const issues = (health.data?.checks ?? []).filter((c) => c.severity === 'warning' || c.severity === 'error').length;

  const main: NavItem[] = [
    { to: '/', label: t('nav.overview'), icon: LayoutDashboard },
    { to: '/cashflow', label: t('nav.cashflow'), icon: ArrowLeftRight },
    { to: '/networth', label: t('nav.networth'), icon: PiggyBank },
    ...(taxEnabled ? [{ to: '/tax', label: t('nav.tax'), icon: BriefcaseBusiness }] : []),
    { to: '/planning', label: t('nav.planning'), icon: TrendingUp },
    { to: '/reports', label: t('nav.reports'), icon: FileText },
  ];
  const secondary: NavItem[] = [
    { to: '/health', label: t('nav.health'), icon: HeartPulse, badge: issues || undefined },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ];
  return { main, secondary };
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <NavLink
      to={{ pathname: item.to, search: keepViewParams(location.search) }}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          isActive && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      <item.icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold text-warning">{item.badge}</span>
      ) : null}
    </NavLink>
  );
}

/** Carry the snapshot date across pages; period/method are page specific but harmless to keep. */
function keepViewParams(search: string) {
  const p = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const k of ['at', 'period', 'method']) {
    const v = p.get(k);
    if (v) keep.set(k, v);
  }
  const s = keep.toString();
  return s ? `?${s}` : '';
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 px-3">
      <img src="/icon.svg" alt="" className="size-7" />
      <span className="font-semibold tracking-tight">{t('app.name')}</span>
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { main, secondary } = useNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const mobileMain = main.slice(0, 4);
  const mobileMore = [...main.slice(4), ...secondary];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <div className="hidden border-r bg-card/60 lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-6 py-5">
        <Brand />
        <nav aria-label={t('nav.mainNavigation')} className="flex flex-1 flex-col gap-1 px-3">
          {main.map((i) => (
            <NavItemLink key={i.to} item={i} />
          ))}
          <div className="mt-auto flex flex-col gap-1">
            {secondary.map((i) => (
              <NavItemLink key={i.to} item={i} />
            ))}
          </div>
        </nav>
      </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        <TopBar />
        <SnapshotBanner />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={t('nav.mainNavigation')}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {mobileMain.map((i) => (
          <NavLink
            key={i.to}
            to={{ pathname: i.to, search: keepViewParams(location.search) }}
            end={i.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground', isActive && 'text-primary')
            }
          >
            <i.icon className="size-5" />
            <span className="max-w-full truncate px-1">{i.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
        >
          <MenuIcon className="size-5" />
          {t('nav.more')}
        </button>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title={t('nav.more')}>
        <div className="flex flex-col gap-1">
          {mobileMore.map((i) => (
            <NavItemLink key={i.to} item={i} onNavigate={() => setMoreOpen(false)} />
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function TopBar() {
  const { t } = useTranslation();
  const privacy = usePrivacy();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { at, setAt } = useView();
  const stats = useStats(at);
  const years = stats.data?.years ?? [];
  const thisYear = new Date().getFullYear();
  const pastYears = years.filter((y) => y < thisYear).reverse();

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    qc.clear();
    qc.setQueryData(keys.auth, { required: true, authenticated: false, setupRequired: false });
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
      <div className="lg:hidden">
        <img src="/icon.svg" alt={t('app.name')} className="size-7" />
      </div>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {pastYears.length > 0 && (
          <Select
            aria-label={t('topbar.asOf')}
            value={at ?? ''}
            onChange={(e) => setAt(e.target.value || undefined)}
            className="h-8 w-auto pr-7 text-xs"
          >
            <option value="">{t('topbar.live')}</option>
            {pastYears.map((y) => (
              <option key={y} value={`${y}-12-31`}>
                {t('topbar.snapshotYear', { year: y })}
              </option>
            ))}
          </Select>
        )}
        <SyncButton />
        <Tooltip
          content={
            <>
              {privacy.hidden ? t('topbar.privacyOn') : t('topbar.privacyOff')}
              <br />
              <span className="opacity-70">{t('topbar.privacyShortcut')}</span>
            </>
          }
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={privacy.toggle}
            aria-pressed={privacy.hidden}
            aria-label={privacy.hidden ? t('topbar.privacyOn') : t('topbar.privacyOff')}
          >
            {privacy.hidden ? <EyeOff /> : <Eye />}
          </Button>
        </Tooltip>
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('topbar.userMenu')}>
              <UserRound />
            </Button>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item onSelect={() => navigate('/settings')}>
              <Settings /> {t('nav.settings')}
            </Menu.Item>
            <Menu.Item onSelect={() => navigate('/health')}>
              <HeartPulse /> {t('nav.health')}
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item onSelect={logout}>
              <LogOut /> {t('nav.logout')}
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </div>
    </header>
  );
}

function SnapshotBanner() {
  const { t } = useTranslation();
  const f = useFormat();
  const { at, setAt } = useView();
  if (!at) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
      {t('topbar.viewingSnapshot', { date: f.date(at) })}
      <button type="button" className="cursor-pointer font-semibold underline underline-offset-2" onClick={() => setAt(undefined)}>
        {t('topbar.backToLive')}
      </button>
    </div>
  );
}

export function PageHeader({ title, actions, description }: { title: string; actions?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
