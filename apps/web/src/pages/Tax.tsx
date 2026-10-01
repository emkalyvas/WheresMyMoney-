import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import type { StatisticsPayload, TaxBreakdownRow } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { DataGate } from '@/components/DataGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/overlay';
import { EmptyState, Progress } from '@/components/ui/misc';
import { KpiTile } from '@/components/metric/KpiTile';
import { Delta, Money } from '@/components/metric/Money';
import { useOpenHistory } from '@/components/metric/History';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Tax() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('tax.title')} />
      <DataGate>
        {(data) =>
          data.tax.enabled ? (
            <TaxContent data={data} />
          ) : (
            <EmptyState
              icon={<Landmark />}
              title={t('tax.disabledTitle')}
              action={
                <Button asChild>
                  <Link to="/settings/tax">{t('tax.disabledAction')}</Link>
                </Button>
              }
            >
              {t('tax.disabledBody')}
            </EmptyState>
          )
        }
      </DataGate>
    </>
  );
}

function TaxContent({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const openHistory = useOpenHistory();
  const tax = data.tax;
  const year = tax.year ?? data.meta.currentYear;
  const revenue = tax.revenue ?? { net: tax.grossRevenue, gross: tax.grossRevenue, vat: 0 };
  const expenses = tax.expenses ?? { net: tax.companyExpenses, gross: tax.companyExpenses, vat: 0 };
  const vat = tax.vatLiability;
  const afterTax = tax.netTaxableProfit - tax.expectedTaxTotal;

  const breakdownLabel = (b: TaxBreakdownRow) => {
    const key = b.key as keyof typeof rowKeys | undefined;
    return key && key in rowKeys ? t(rowKeys[key]) : b.label;
  };

  return (
    <div className="grid gap-4">
      <p className="-mt-3 text-sm text-muted-foreground">{t('tax.year', { year })}</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          label={t('tax.profit')}
          value={<Money value={tax.netTaxableProfit} />}
          history={{ metric: 'taxableProfit', label: t('metric.taxableProfit'), format: 'currency' }}
        />
        <KpiTile
          label={t('tax.expected')}
          value={<Money value={tax.expectedTaxTotal} />}
          sub={
            <>
              {t('tax.effectiveRate')}: <span className="private tabular">{f.percent(tax.effectiveTaxRate)}</span>
            </>
          }
          history={{ metric: 'expectedTax', label: t('metric.expectedTax'), format: 'currency', invert: true }}
        />
        <KpiTile
          label={t('tax.netMonthly')}
          info={t('tax.netMonthlyHint')}
          value={<Money value={data.netMonthlyIncome.monthly} tone="auto" />}
          history={{ metric: 'netMonthlyIncome', label: t('metric.netMonthlyIncome'), format: 'currency' }}
        />
        {vat && (
          <KpiTile
            label={t('metric.vatRemaining')}
            value={<Money value={vat.remaining} />}
            history={{ metric: 'vatRemaining', label: t('metric.vatRemaining'), format: 'currency', invert: true }}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('tax.profitBridge')} />
          <CardContent className="grid gap-1 pt-3 text-sm">
            <BridgeRow
              label={t('tax.revenue')}
              value={revenue.net}
              detail={t('tax.gross', { gross: f.money(revenue.gross), vat: f.money(revenue.vat) })}
              onClick={() => openHistory({ metric: 'taxRevenueNet', label: t('metric.taxRevenueNet'), format: 'currency' })}
            />
            <BridgeRow
              label={t('tax.expenses')}
              value={-expenses.net}
              detail={t('tax.gross', { gross: f.money(expenses.gross), vat: f.money(expenses.vat) })}
              onClick={() => openHistory({ metric: 'taxExpensesNet', label: t('metric.taxExpensesNet'), format: 'currency', invert: true })}
            />
            <BridgeRow label={t('tax.profit')} value={tax.netTaxableProfit} strong />
            {(tax.breakdown ?? []).map((b) => (
              <BridgeRow key={b.path} label={breakdownLabel(b)} value={-b.value} detail={b.info} indent />
            ))}
            <BridgeRow label={t('tax.afterTax')} value={afterTax} strong tone />
          </CardContent>
        </Card>

        {vat && (
          <Card>
            <CardHeader title={t('tax.vat.title')} />
            <CardContent className="grid gap-1 pt-3 text-sm">
              <BridgeRow label={t('tax.vat.collected')} value={vat.collected} />
              <BridgeRow label={t('tax.vat.deductible')} value={-vat.paid} />
              <BridgeRow label={t('tax.vat.liability')} value={vat.total} strong />
              <BridgeRow label={t('tax.vat.paid')} value={-vat.paidToGovt} />
              <BridgeRow label={t('tax.vat.remaining')} value={vat.remaining} strong />
              {vat.total > 0 && (
                <div className="mt-3">
                  <Progress value={vat.paidToGovt / vat.total} tone="positive" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('tax.vat.progress', { percent: Math.round(Math.min(1, vat.paidToGovt / vat.total) * 100) })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title={t('tax.yoy')} action={<InfoTip>{t('tax.yoyHint')}</InfoTip>} />
        <CardContent className="grid gap-3 pt-3 sm:grid-cols-3">
          {(
            [
              ['income', data.yearOverYear.incomePreviousYear, data.yearOverYear.projectedIncomeThisYear, data.yearOverYear.incomeGrowthPercent, false],
              ['spending', data.yearOverYear.expensesPreviousYear, data.yearOverYear.projectedExpensesThisYear, data.yearOverYear.expensesGrowthPercent, true],
              ['surplus', data.surplus.previousYear, data.surplus.projectedThisYear, data.surplus.growthPercent, false],
            ] as const
          ).map(([key, prev, cur, pct, invert]) => (
            <div key={key} className="rounded-lg bg-muted/60 p-4">
              <div className="text-xs font-medium text-muted-foreground">{t(`tax.${key}`)}</div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">{data.yearOverYear.previousYear}</div>
                  <Money value={prev} className="text-sm" />
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">{t('overview.projected', { year: data.yearOverYear.currentYear })}</div>
                  <Money value={cur} className="text-base font-semibold" />
                </div>
              </div>
              <div className="mt-2">
                <Delta value={pct} invert={invert} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const rowKeys = {
  cit: 'tax.rows.cit',
  businessTax: 'tax.rows.businessTax',
  advanceTax: 'tax.rows.advanceTax',
  previousAdvanceTax: 'tax.rows.previousAdvanceTax',
} as const;

function BridgeRow({
  label,
  value,
  detail,
  strong,
  indent,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail?: string;
  strong?: boolean;
  indent?: boolean;
  tone?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={cn('min-w-0', indent && 'pl-4')}>
        <div className={cn(strong ? 'font-semibold' : 'text-foreground/90')}>{label}</div>
        {detail && <div className="private text-xs text-muted-foreground">{detail}</div>}
      </div>
      <Money value={value} decimals tone={tone ? 'auto' : 'none'} className={cn('shrink-0', strong && 'font-semibold')} />
    </>
  );
  const cls = cn('flex items-center justify-between gap-4 rounded-lg px-2 py-2', strong && 'border-t pt-3 mt-1');
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'w-full cursor-pointer text-left hover:bg-muted')}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
