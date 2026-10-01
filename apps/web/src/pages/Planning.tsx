import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { type StatisticsPayload, project } from '@wmm/shared';
import { PageHeader } from '@/components/layout/AppShell';
import { DataGate } from '@/components/DataGate';
import { tooltipStyle } from '@/components/charts/CashflowChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Slider } from '@/components/ui/controls';
import { InfoTip } from '@/components/ui/overlay';
import { Alert } from '@/components/ui/misc';
import { Money } from '@/components/metric/Money';
import { useFormat } from '@/lib/format';
import { useSaveSection, useSettings } from '@/lib/queries';

export default function Planning() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('planning.title')} />
      <DataGate>{(data) => <PlanningContent data={data} />}</DataGate>
    </>
  );
}

function PlanningContent({ data }: { data: StatisticsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const settings = useSettings();
  const save = useSaveSection('planning');
  const stored = data.projections;
  const inputs = stored.inputs;

  const initial = {
    growth: stored.investmentGrowthRate,
    monthly: stored.monthlyInvestmentAmount,
    swr: inputs?.safeWithdrawalRate ?? 0.04,
    horizon: inputs?.horizonYears ?? Math.max(1, stored.data.length - 1),
    goal: stored.targetGoal,
  };
  const [v, setV] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const result = useMemo(() => {
    if (!inputs) return stored;
    return project({
      currentInvested: inputs.currentInvested,
      currentCash: inputs.currentCash,
      meanMonthlySurplus: inputs.meanMonthlySurplus,
      annualExpenses: inputs.annualExpenses,
      safeWithdrawalRate: v.swr,
      investmentGrowthRate: v.growth,
      monthlyInvestmentAmount: v.monthly,
      targetAssetGoal: v.goal,
      horizonYears: v.horizon,
      startYear: inputs.startYear,
    });
  }, [inputs, stored, v]);

  const saveDefaults = async () => {
    const current = settings.data?.settings.planning;
    if (!current) return;
    await save.save({
      ...current,
      investmentGrowthRate: v.growth,
      monthlyInvestmentAmount: v.monthly,
      safeWithdrawalRate: v.swr,
      horizonYears: v.horizon,
      targetAssetGoal: v.goal,
    });
    toast.success(t('planning.savedDefaults'));
  };

  const m = result.milestones;
  const reached = (year: number | null) => (year ? t('planning.reachedIn', { year }) : t('planning.notReached', { years: v.horizon }));

  return (
    <div className="grid gap-4">
      {!inputs && <Alert tone="info">{t('planning.legacy')}</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={t('planning.whatIf')} description={t('planning.whatIfHint')} />
          <CardContent className="grid gap-5">
            <SliderField
              label={t('planning.growth')}
              display={f.percent(v.growth * 100)}
              value={v.growth * 100}
              min={0}
              max={12}
              step={0.5}
              disabled={!inputs}
              onChange={(x) => setV({ ...v, growth: x / 100 })}
            />
            <SliderField
              label={t('planning.monthly')}
              display={<Money value={v.monthly} />}
              value={v.monthly}
              min={0}
              max={Math.max(3000, Math.ceil(initial.monthly / 500) * 1000)}
              step={50}
              disabled={!inputs}
              onChange={(x) => setV({ ...v, monthly: x })}
            />
            <SliderField
              label={t('planning.swr')}
              display={f.percent(v.swr * 100)}
              value={v.swr * 100}
              min={2}
              max={6}
              step={0.25}
              disabled={!inputs}
              onChange={(x) => setV({ ...v, swr: x / 100 })}
            />
            <SliderField
              label={t('planning.horizon')}
              display={t('planning.years', { count: v.horizon })}
              value={v.horizon}
              min={5}
              max={50}
              step={1}
              disabled={!inputs}
              onChange={(x) => setV({ ...v, horizon: x })}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={saveDefaults} disabled={!dirty || save.isPending || !inputs}>
                {save.isPending ? t('common.saving') : t('planning.saveDefaults')}
              </Button>
              <Button variant="ghost" onClick={() => setV(initial)} disabled={!dirty}>
                {t('planning.reset')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('planning.chart')} />
          <CardContent className="pt-3">
            <div className="private-axis h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    width={64}
                    tickFormatter={(x: number) => f.money(x, { compact: true })}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(x, name) => [f.money(Number(x)), name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <ReferenceLine y={v.goal} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: t('planning.target'), fontSize: 11, fill: 'var(--muted-foreground)', position: 'insideTopRight' }} />
                  {result.retirementTarget && (
                    <ReferenceLine y={result.retirementTarget} stroke="var(--positive)" strokeDasharray="4 4" label={{ value: t('planning.fiNumber'), fontSize: 11, fill: 'var(--muted-foreground)', position: 'insideBottomLeft' }} />
                  )}
                  <Line type="monotone" dataKey="fullSurplusAssets" name={t('planning.fullSurplus')} stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="configuredAmountAssets" name={t('planning.fixedAmount', { amount: f.money(v.monthly) })} stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Milestone label={t('planning.target')} value={<Money value={v.goal} />} lines={[`${t('planning.fullSurplus')}: ${reached(m.targetYearFullSurplus)}`, `${t('planning.fixedAmount', { amount: f.money(v.monthly) })}: ${reached(m.targetYearConfiguredAmount)}`]} />
        <Milestone
          label={t('planning.fiNumber')}
          info={t('planning.fiNumberHint')}
          value={<Money value={result.retirementTarget} />}
          lines={[`${t('planning.fullSurplus')}: ${reached(m.retirementYearFullSurplus)}`, `${t('planning.fixedAmount', { amount: f.money(v.monthly) })}: ${reached(m.retirementYearConfiguredAmount)}`]}
        />
        <Milestone label={t('planning.safeWithdrawal')} info={t('planning.safeWithdrawalHint')} value={<Money value={result.safeMonthlyWithdrawal} />} />
        <Milestone label={t('metric.totalInvested')} value={<Money value={inputs?.currentInvested ?? data.assets.totalInvestedEur} />} />
      </div>
    </div>
  );
}

function SliderField({
  label,
  display,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  display: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular">{display}</span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} label={label} />
    </div>
  );
}

function Milestone({ label, value, lines, info }: { label: string; value: React.ReactNode; lines?: string[]; info?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {info && <InfoTip>{info}</InfoTip>}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
      {lines && (
        <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
          {lines.map((l) => (
            <li key={l} className="private">
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
