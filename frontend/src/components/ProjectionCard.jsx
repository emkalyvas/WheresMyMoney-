import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Target, Clock, TrendingUp } from 'lucide-react';
import { eurFmt } from './StatCard';

/** Custom tooltip for the projection chart */
function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip" role="tooltip">
      <div className="chart-tooltip-label">Year {label}</div>
      {payload.map((entry) => (
        <div className="chart-tooltip-row" key={entry.dataKey}>
          <div className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span style={{ color: 'var(--clr-text-secondary)' }}>{entry.name}:</span>
          <span style={{ color: entry.color, fontWeight: 'bold' }}>{eurFmt.format(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Milestone Badge Component */
function MilestoneBadge({ icon: Icon, label, value, yearFull, yearConfig, configAmount }) {
  return (
    <div className="stat-card fade-in-up" style={{ padding: 'var(--space-4)' }}>
      <div className="stat-card-header">
        <div className="stat-icon"><Icon size={20} /></div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value" style={{ fontSize: '1.25rem' }}>
        {value ? eurFmt.format(value) : 'N/A'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-3)', alignItems: 'flex-start' }}>
        <div className="badge" style={{ backgroundColor: 'rgba(2, 164, 227, 0.15)', color: '#02a4e3', whiteSpace: 'normal', textAlign: 'left' }}>
          {yearFull ? `Reached in ${yearFull}` : 'Not reached'} (All Surplus)
        </div>
        <div className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', whiteSpace: 'normal', textAlign: 'left' }}>
          {yearConfig ? `Reached in ${yearConfig}` : 'Not reached'} ({eurFmt.format(configAmount)}/mo Inv.)
        </div>
      </div>
    </div>
  );
}

/**
 * Future Projections line chart.
 * Shows projected assets over a configured horizon based on two scenarios.
 */
export default function ProjectionCard({ projections }) {
  if (!projections || !projections.data || !projections.data.length) {
    return null;
  }

  const { data, targetGoal, retirementTarget, milestones, investmentGrowthRate, monthlyInvestmentAmount } = projections;

  // Format Y-axis to compact currency
  const yAxisFormatter = (v) =>
    new Intl.NumberFormat(undefined, {
      notation: 'compact',
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="card fade-in-up">
      <div className="card-title">Future Asset Projections</div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)', marginBottom: 'var(--space-6)' }}>
        Projected growth assuming a {(investmentGrowthRate * 100).toFixed(1)}% annual investment return.
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <MilestoneBadge
          icon={TrendingUp}
          label={`Target Goal`}
          value={targetGoal}
          yearFull={milestones.targetYearFullSurplus}
          yearConfig={milestones.targetYearConfiguredAmount}
          configAmount={monthlyInvestmentAmount}
        />
        <MilestoneBadge
          icon={Clock}
          label={`Financial Independence`}
          value={retirementTarget}
          yearFull={milestones.retirementYearFullSurplus}
          yearConfig={milestones.retirementYearConfiguredAmount}
          configAmount={monthlyInvestmentAmount}
        />
      </div>

      <div className="chart-wrapper" style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisFormatter}
              width={70}
            />
            <Tooltip content={<ProjectionTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--clr-text-secondary)', paddingTop: 16 }} />

            {/* Reference lines for targets */}
            {targetGoal && (
              <ReferenceLine y={targetGoal} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} label={{ position: 'insideTopLeft', value: 'Target Goal', fill: '#f59e0b', fontSize: 11 }} />
            )}
            {retirementTarget && (
              <ReferenceLine y={retirementTarget} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} label={{ position: 'insideTopLeft', value: 'FI Target', fill: '#10b981', fontSize: 11 }} />
            )}

            <Line
              type="monotone"
              dataKey="fullSurplusAssets"
              name="All Surplus Invested"
              stroke="#02a4e3"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#02a4e3', stroke: '#fff', strokeWidth: 2 }}
            />

            <Line
              type="monotone"
              dataKey="configuredAmountAssets"
              name={`Fixed ${eurFmt.format(monthlyInvestmentAmount)}/mo Inv.`}
              stroke="#10b981"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
