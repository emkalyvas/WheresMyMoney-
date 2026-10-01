import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatisticsPayload } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { DataGate } from '@/components/DataGate';
import { PeriodControls } from '@/components/PeriodControls';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/overlay';
import { KpiTile } from '@/components/metric/KpiTile';
import { Delta, Money } from '@/components/metric/Money';
import { Sparkline } from '@/components/metric/Sparkline';
import { useOpenHistory } from '@/components/metric/History';
import { byKind, periodKpis } from '@/lib/kpis';
import { pctChange, useFormat } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { useView } from '@/lib/view';
import { isoDate } from '@/lib/utils';

export default function Overview() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('overview.title')} actions={<PeriodControls />} />
      <DataGate>{(data) => <OverviewContent data={data} />}</DataGate>
    </>
  );
}

function OverviewContent({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { period, method } = useView();
  const k = periodKpis(data, period, method);
  const last12 = data.monthlyData.slice(-12);
  // Sparklines show complete months only; a partial month would always look like a drop.
  const complete12 = data.monthlyData.slice(-13, -1);

  return (
    <div className="grid gap-4">
      <NetWorthHero data={data} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          label={t('overview.kpi.income')}
          value={<Money value={k.income} />}
          delta={<Delta value={pctChange(k.income, k.previousIncome)} />}
          sub={t(`period.${k.period}`) + ' · ' + t('overview.kpi.perMonth')}
          spark={complete12.map((m) => m.income)}
          sparkColor="var(--chart-income)"
          history={k.incomeMetric ? { metric: k.incomeMetric, label: t(`metric.${k.incomeMetric}`), format: 'currency' } : undefined}
        />
        <KpiTile
          label={t('overview.kpi.spending')}
          value={<Money value={k.expenses} />}
          delta={<Delta value={pctChange(k.expenses, k.previousExpenses)} invert />}
          sub={t(`period.${k.period}`) + ' · ' + t('overview.kpi.perMonth')}
          spark={complete12.map((m) => m.expenses)}
          sparkColor="var(--chart-expense)"
          history={
            k.expensesMetric
              ? { metric: k.expensesMetric, label: t(`metric.${k.expensesMetric}`), format: 'currency', invert: true }
              : undefined
          }
        />
        <KpiTile
          label={t('overview.kpi.savingsRate')}
          value={<span className="private tabular">{f.percent(k.savingsRate)}</span>}
          sub={
            <>
              <Money value={k.surplus} tone="auto" /> {t('overview.kpi.perMonth')}
            </>
          }
          spark={complete12.map((m) => (m.income > 0 ? (m.surplus / m.income) * 100 : 0))}
          history={{ metric: 'savingsRate', label: t('metric.savingsRate'), format: 'percent' }}
        />
        <KpiTile
          label={t('overview.kpi.runway')}
          info={t('overview.kpi.runwayHint')}
          value={
            <span className="private tabular">
              {data.runway.months == null ? '—' : t('overview.kpi.runwayValue', { value: f.number(data.runway.months, 1) })}
            </span>
          }
          sub={
            data.runway.liquidMonths != null && (
              <span className="private">
                {t('overview.kpi.cashRunway', {
                  value: t('overview.kpi.runwayValue', { value: f.number(data.runway.liquidMonths, 1) }),
                })}
              </span>
            )
          }
          history={{ metric: 'runwayMonths', label: t('metric.runwayMonths'), format: 'months' }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={t('overview.cashflowChart')} description={t('overview.last12Months')} />
          <CardContent className="pt-3">
            <CashflowChart months={last12} />
          </CardContent>
        </Card>
        <ThisMonth data={data} />
      </div>

      <YearCard data={data} />
    </div>
  );
}

function NetWorthHero({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const openHistory = useOpenHistory();
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);
  const history = useHistory('netWorth', isoDate(yearAgo), isoDate(today));

  const points = useMemo(
    () => (history.data?.points ?? []).filter((p): p is { date: string; value: number } => p.value != null),
    [history.data],
  );
  const monthAgo = isoDate(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()));
  const reference = [...points].reverse().find((p) => p.date <= monthAgo);
  const change = reference ? pctChange(data.assets.netWorthEur, reference.value) : null;

  const kinds = byKind(data);
  const total = Math.max(1, kinds.cash + kinds.investment + kinds.crypto);
  const segments = [
    { key: 'cash', value: kinds.cash, color: 'var(--chart-2)' },
    { key: 'investment', value: kinds.investment, color: 'var(--chart-1)' },
    { key: 'crypto', value: kinds.crypto, color: 'var(--chart-3)' },
  ] as const;

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.1fr] md:p-6">
        <div>
          <button
            type="button"
            onClick={() => openHistory({ metric: 'netWorth', label: t('metric.netWorth'), format: 'currency' })}
            className="group cursor-pointer text-left"
            aria-label={t('metric.showHistory', { name: t('metric.netWorth') })}
          >
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('metric.netWorth')}</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight group-hover:text-primary sm:text-5xl">
              <Money value={data.assets.netWorthEur} />
            </div>
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {reference && <Delta value={change} />}
            {reference && <span>{t('overview.sinceDate', { date: f.date(reference.date) })}</span>}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            {t('metric.totalAssets')} <Money value={data.assets.totalEur} className="font-medium text-foreground" /> ·{' '}
            {t('metric.totalLiabilities')} <Money value={data.assets.totalLiabilitiesEur} className="font-medium text-foreground" />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4">
          <Sparkline values={points.map((p) => p.value)} height={64} className="private" />
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{t('overview.composition')}</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {segments.map((s) =>
                s.value > 0 ? <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} /> : null,
              )}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {segments.map((s) => (
                <li key={s.key}>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    {t(`kinds.${s.key}`)}
                  </div>
                  <Money value={s.value} compact className="mt-0.5 block text-sm font-semibold" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ThisMonth({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const rows = data.categories.expenses
    .filter((c) => c.currentMonthAmount > 0)
    .sort((a, b) => b.currentMonthAmount - a.currentMonthAmount)
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.currentMonthAmount, r.monthlyMedian)));

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={t('overview.thisMonth')}
        action={<InfoTip>{t('overview.thisMonthHint')}</InfoTip>}
        description={
          <>
            <Money value={data.monthOverMonth.expensesCurrentMonth} /> · {t('overview.spending').toLowerCase()}
          </>
        }
      />
      <CardContent className="pt-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('overview.noSpendingThisMonth')}</p>
        ) : (
          <ul className="grid gap-3.5">
            {rows.map((r) => (
              <li key={r.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Delta value={pctChange(r.currentMonthAmount, r.monthlyMedian)} invert />
                    <Money value={r.currentMonthAmount} className="font-semibold" />
                  </span>
                </div>
                <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--chart-expense)]"
                    style={{ width: `${(r.currentMonthAmount / max) * 100}%` }}
                  />
                  <div
                    className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-foreground/50"
                    style={{ left: `${(r.monthlyMedian / max) * 100}%` }}
                    title={t('overview.typical')}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t('overview.typical')} <Money value={r.monthlyMedian} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function YearCard({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const y = data.yearOverYear;
  const rows = [
    { label: t('overview.income'), now: y.incomeThisYear, projected: y.projectedIncomeThisYear, prev: y.incomePreviousYear, pct: y.incomeGrowthPercent, invert: false },
    { label: t('overview.spending'), now: y.expensesThisYear, projected: y.projectedExpensesThisYear, prev: y.expensesPreviousYear, pct: y.expensesGrowthPercent, invert: true },
    { label: t('overview.surplus'), now: data.surplus.thisYear, projected: data.surplus.projectedThisYear, prev: data.surplus.previousYear, pct: data.surplus.growthPercent, invert: false },
  ];
  return (
    <Card>
      <CardHeader title={t('overview.yearToDate')} description={t('tax.yoyHint')} />
      <CardContent className="overflow-x-auto pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium" />
              <th className="py-2 text-right font-medium">{y.currentYear}</th>
              <th className="py-2 text-right font-medium">{t('overview.projected', { year: y.currentYear })}</th>
              <th className="py-2 text-right font-medium">{t('overview.lastYear', { year: y.previousYear })}</th>
              <th className="py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <th scope="row" className="py-2.5 text-left font-medium">
                  {r.label}
                </th>
                <td className="py-2.5 text-right">
                  <Money value={r.now} />
                </td>
                <td className="py-2.5 text-right font-semibold">
                  <Money value={r.projected} />
                </td>
                <td className="py-2.5 text-right text-muted-foreground">
                  <Money value={r.prev} />
                </td>
                <td className="py-2.5 text-right">
                  <Delta value={r.pct} invert={r.invert} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
