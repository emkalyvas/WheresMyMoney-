import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { eurFmt } from './StatCard';

/** Custom tooltip for the monthly chart */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip" role="tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div className="chart-tooltip-row" key={entry.dataKey}>
          <div className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span style={{ color: 'var(--clr-text-secondary)' }}>{entry.name}:</span>
          <span style={{ color: entry.color }}>{eurFmt.format(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Monthly income vs expenses vs surplus bar/line combo chart.
 * Shows the last 24 months of data.
 */
export default function MonthlyChart({ monthlyData }) {
  // Show the most recent 24 months
  const data = monthlyData.slice(-24).map((d) => ({
    ...d,
    // Shorten YYYY-MM to readable Mon 'YY format
    label: (() => {
      const [year, month] = d.month.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      });
    })(),
  }));

  if (!data.length) {
    return (
      <div className="card fade-in-up" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
        <p className="text-muted">No monthly data available yet.</p>
      </div>
    );
  }

  return (
    <div className="card fade-in-up">
      <div className="card-title">Monthly Income vs Expenses (last 24 months)</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat(undefined, {
                  notation: 'compact',
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(v)
              }
              width={64}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--clr-text-secondary)', paddingTop: 8 }}
            />
            <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="surplus"
              name="Surplus"
              stroke="rgba(2, 164, 227, 1)"
              strokeWidth={2}
              dot={true}
              activeDot={{ r: 4, fill: 'rgba(2, 164, 227, 1)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
