import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type PeriodKey, type StatisticsPayload, categoryMetricId } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { DataGate } from '@/components/DataGate';
import { PeriodControls } from '@/components/PeriodControls';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { InfoTip } from '@/components/ui/overlay';
import { Alert } from '@/components/ui/misc';
import { Delta, Money } from '@/components/metric/Money';
import { useOpenHistory } from '@/components/metric/History';
import { pctChange, useFormat } from '@/lib/format';
import { useView } from '@/lib/view';

interface Row {
  name: string;
  total: number;
  monthly: number;
  share: number;
  count: number;
  median?: number;
  trend?: number | null;
  rankChange?: number | null;
  /** VAT contained in `total` (when VAT in cash flow is enabled) */
  vat?: number;
}

export default function Cashflow() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('cashflow.title')} actions={<PeriodControls showMethod={false} />} />
      <DataGate>{(data) => <CashflowContent data={data} />}</DataGate>
    </>
  );
}

/** Rows for the categories table, from v2 period summaries or (old snapshots) v1 category lists. */
function useRows(data: StatisticsPayload, period: PeriodKey, kind: 'expenses' | 'income'): { rows: Row[]; legacy: boolean } {
  return useMemo(() => {
    const allTime = data.categories[kind];
    if (period === 'all' || !data.periods) {
      const usable = period === '90d' ? data.categories[kind === 'expenses' ? 'expenses90d' : 'income90d'] : null;
      if (usable) {
        const total = usable.reduce((s, c) => s + c.total, 0) || 1;
        return {
          legacy: !data.periods,
          rows: usable.map((c) => ({ name: c.name, total: c.total, monthly: c.monthlyMean, share: c.total / total, count: c.transactionCount })), // v1 snapshots: no VAT
        };
      }
      const total = allTime.reduce((s, c) => s + c.total, 0) || 1;
      return {
        legacy: !data.periods && period !== 'all',
        rows: allTime.map((c) => ({
          name: c.name,
          total: c.total,
          monthly: c.monthlyMean,
          median: c.monthlyMedian,
          share: c.total / total,
          count: c.transactionCount,
          trend: pctChange(c.monthlyMean, c.previousMonthlyMean),
          rankChange: c.rankChange,
          vat: c.vat,
        })),
      };
    }
    const p = data.periods[period];
    return {
      legacy: false,
      rows: p.categories[kind].map((c) => ({ name: c.name, total: c.total, monthly: c.monthly, share: c.share, count: c.transactionCount, vat: c.vat })),
    };
  }, [data, period, kind]);
}

function CashflowContent({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { period } = useView();
  const [kind, setKind] = useState<'expenses' | 'income'>('expenses');
  const { rows, legacy } = useRows(data, period, kind);
  const summary = data.periods?.[period];
  const months = data.monthlyData.slice(-24);

  const totals = summary
    ? { income: summary.income, expenses: summary.expenses, surplus: summary.surplus, rate: summary.savingsRate, mi: summary.monthlyIncome, me: summary.monthlyExpenses }
    : {
        income: data.monthlyData.reduce((s, m) => s + m.income, 0),
        expenses: data.monthlyData.reduce((s, m) => s + m.expenses, 0),
        surplus: data.monthlyData.reduce((s, m) => s + m.surplus, 0),
        rate: data.summary.savingsRate,
        mi: data.summary.meanMonthlyIncome,
        me: data.summary.meanMonthlyExpenses,
      };

  return (
    <div className="grid gap-4">
      {legacy && <Alert tone="info">{t('cashflow.legacySnapshot')}</Alert>}
      {summary && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t('cashflow.periodRange', { from: f.date(summary.from), to: f.date(summary.to) })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryTile
          label={t('cashflow.income')}
          value={<Money value={totals.income} />}
          sub={<Money value={totals.mi} />}
          vat={summary?.incomeVat}
        />
        <SummaryTile
          label={t('cashflow.spending')}
          value={<Money value={totals.expenses} />}
          sub={<Money value={totals.me} />}
          vat={summary?.expensesVat}
        />
        <SummaryTile label={t('cashflow.surplus')} value={<Money value={totals.surplus} tone="auto" />} sub={<Money value={totals.mi - totals.me} />} />
        <SummaryTile label={t('cashflow.savingsRate')} value={<span className="private tabular">{f.percent(totals.rate)}</span>} />
      </div>

      <Card>
        <CardHeader title={t('cashflow.history')} />
        <CardContent className="pt-3">
          <CashflowChart months={months} height={300} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={t('cashflow.categories')}
          description={
            data.meta.cashflowVat && (
              <span className="inline-flex items-center gap-1">
                {t(`cashflow.vatScope.${data.meta.cashflowVat}`)}
                <InfoTip>{t('cashflow.vatHint')}</InfoTip>
              </span>
            )
          }
          action={
            <Segmented
              label={t('cashflow.categories')}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'expenses', label: t('cashflow.expenses') },
                { value: 'income', label: t('cashflow.incomeTab') },
              ]}
            />
          }
        />
        <CardContent className="pt-3">
          <CategoryTable rows={rows} kind={kind} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, sub, vat }: { label: string; value: React.ReactNode; sub?: React.ReactNode; vat?: number }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-muted-foreground">
          {sub} {t('common.perMonth')}
        </div>
      )}
      {vat !== undefined && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t('cashflow.ofWhichVat')} <Money value={vat} />
        </div>
      )}
    </div>
  );
}

function CategoryTable({ rows, kind }: { rows: Row[]; kind: 'expenses' | 'income' }) {
  const { t } = useTranslation();
  const f = useFormat();
  const openHistory = useOpenHistory();
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{t('cashflow.noCategories')}</p>;
  const visible = expanded ? rows : rows.slice(0, 12);
  const hasMedian = rows.some((r) => r.median !== undefined);
  const hasVat = rows.some((r) => r.vat !== undefined);
  const color = kind === 'expenses' ? 'var(--chart-expense)' : 'var(--chart-income)';

  return (
    <>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full text-sm sm:min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">{t('cashflow.category')}</th>
              <th className="hidden w-[28%] py-2 font-medium sm:table-cell">{t('cashflow.share')}</th>
              <th className="py-2 text-right font-medium">{t('cashflow.monthly')}</th>
              {hasMedian && <th className="hidden py-2 text-right font-medium md:table-cell">{t('cashflow.median')}</th>}
              <th className="py-2 text-right font-medium">{t('cashflow.total')}</th>
              {hasVat && <th className="hidden py-2 text-right font-medium sm:table-cell">{t('cashflow.vat')}</th>}
              <th className="hidden py-2 text-right font-medium sm:table-cell">{t('cashflow.count')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.name} className="border-t">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                  <button
                    type="button"
                    className="cursor-pointer text-left hover:text-primary hover:underline"
                    onClick={() =>
                      openHistory({
                        metric: categoryMetricId(kind, r.name),
                        label: r.name,
                        format: 'currency',
                        invert: kind === 'expenses',
                      })
                    }
                  >
                    {r.name}
                  </button>
                  <div className="mt-1 h-1 w-full rounded-full bg-muted sm:hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.share * 100}%`, background: color }} />
                  </div>
                  {r.rankChange ? (
                    <span
                      className="ml-1.5 text-[11px] text-muted-foreground"
                      title={r.rankChange > 0 ? t('cashflow.rankUp', { count: r.rankChange }) : t('cashflow.rankDown', { count: -r.rankChange })}
                    >
                      {r.rankChange > 0 ? '↑' : '↓'}
                      {Math.abs(r.rankChange)}
                    </span>
                  ) : null}
                </th>
                <td className="hidden py-2.5 pr-3 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${r.share * 100}%`, background: color }} />
                    </div>
                    <span className="w-11 text-right text-xs tabular text-muted-foreground">{f.percent(r.share * 100, 0)}</span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    {r.trend !== undefined && <Delta value={r.trend} invert={kind === 'expenses'} className="hidden md:inline-flex" />}
                    <Money value={r.monthly} className="font-semibold" />
                  </span>
                </td>
                {hasMedian && (
                  <td className="hidden py-2.5 text-right text-muted-foreground md:table-cell">
                    <Money value={r.median} />
                  </td>
                )}
                <td className="py-2.5 text-right">
                  <Money value={r.total} />
                  {hasVat && (
                    <div className="text-[11px] text-muted-foreground sm:hidden">
                      {t('cashflow.vat')} <Money value={r.vat ?? 0} />
                    </div>
                  )}
                </td>
                {hasVat && (
                  <td className="hidden py-2.5 text-right sm:table-cell">
                    <Money value={r.vat ?? 0} />
                    <div className="text-[11px] text-muted-foreground">
                      {t('cashflow.net')} <Money value={r.total - (r.vat ?? 0)} />
                    </div>
                  </td>
                )}
                <td className="hidden py-2.5 text-right tabular text-muted-foreground sm:table-cell">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 12 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mx-auto mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {expanded ? t('common.showLess') : t('common.showAll', { count: rows.length })}
        </button>
      )}
    </>
  );
}
