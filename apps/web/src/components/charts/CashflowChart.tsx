import { useTranslation } from 'react-i18next';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyDatum } from '@wmm/shared';
import { useFormat } from '@/lib/format';

export const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--foreground)',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)',
};

/** Monthly income vs. spending bars with a surplus line. */
export function CashflowChart({ months, height = 260 }: { months: MonthlyDatum[]; height?: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="private-axis" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={months} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => f.monthShort(m)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            width={64}
            tickFormatter={(v: number) => f.money(v, { compact: true })}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            contentStyle={tooltipStyle}
            labelFormatter={(m) => f.month(String(m), 'long')}
            formatter={(v, name) => [f.money(Number(v)), name]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="income" name={t('overview.income')} fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expenses" name={t('overview.spending')} fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Line dataKey="surplus" name={t('overview.surplus')} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
