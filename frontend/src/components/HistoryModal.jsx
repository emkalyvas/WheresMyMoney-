import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { X } from 'lucide-react';
import { fetchHistory } from '../api/client';
import { eurFmt, pctFmt } from './StatCard';

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'YTD', days: 'ytd' },
  { label: 'All', days: 'all' },
];

export default function HistoryModal({ metric, onClose }) {
  const [period, setPeriod] = useState(PERIODS[4]); // Default All
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { path, label, format, invertTrendColor } = metric;

  const dateRange = useMemo(() => {
    const end = new Date();
    let start = new Date();

    if (period.days === 'all') {
      start = new Date('2000-01-01'); // arbitrary old date
    } else if (period.days === 'ytd') {
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      start.setDate(end.getDate() - period.days);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [period]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const history = await fetchHistory(path, dateRange.start, dateRange.end);
        if (active) setData(history);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [path, dateRange]);

  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Filter data to only include items within the selected period
    // For 'all', we just use the raw data directly.
    const actualStart = period.label === 'All' ? new Date(data[0].date).getTime() : new Date(dateRange.start).getTime();
    
    return data
      .filter(d => new Date(d.date).getTime() >= actualStart)
      .map(d => ({
        ...d,
        timestamp: new Date(d.date).getTime()
      }));
  }, [data, dateRange, period]);

  const formatValue = (val) => {
    if (format === 'currency') return eurFmt.format(val);
    if (format === 'percentage') return pctFmt(val, 1);
    if (format === 'number') return Math.round(val).toString();
    return val?.toLocaleString() ?? '—';
  };
/** Custom tooltip that only shows when there is a real value */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const mainPoint = payload.find(p => p.dataKey === 'value');

    if (!mainPoint || mainPoint.value === null) return null;

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">
          {new Date(mainPoint.payload.timestamp).toLocaleDateString(undefined, { dateStyle: 'long' })}
        </div>
        <div className="chart-tooltip-row">
          <div className="chart-tooltip-dot" style={{ background: 'var(--clr-primary)' }} />
          <span style={{ color: 'var(--clr-text-secondary)' }}>Value:</span>
          <span style={{ color: 'var(--clr-text-primary)', fontWeight: 700 }}>
            {formatValue(mainPoint.value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

  const periodStats = useMemo(() => {
    if (!chartData.length) return null;
    
    // Find first and last NON-NULL values in chartData
    const dataPoints = chartData.filter(d => d.value !== null);
    if (dataPoints.length < 1) return null;

    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    
    if (first == null || last == null || first === 0) return null;
    const change = last - first;
    const pct = (change / Math.abs(first)) * 100;
    
    let isPositive = pct >= 0;
    if (invertTrendColor) isPositive = !isPositive;

    return { change, pct, first, last, isPositive };
  }, [chartData, invertTrendColor]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 className="modal-title" style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>{label} Historical Trend</h2>
            {periodStats && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>{formatValue(periodStats.last)}</span>
                <div className={`badge ${periodStats.isPositive ? 'badge-positive' : 'badge-negative'}`} style={{ fontSize: 'var(--font-size-sm)' }}>
                  {periodStats.pct >= 0 ? '▲' : '▼'} {Math.abs(periodStats.pct).toFixed(1)}%
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--clr-text-muted)' }}>over selected period</span>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', padding: 'var(--space-2)' }}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-period-selector" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.label}
              className={`btn period-btn ${period.label === p.label ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
              style={{
                background: period.label === p.label ? 'var(--clr-primary)' : 'rgba(255,255,255,0.05)',
                color: period.label === p.label ? '#fff' : 'var(--clr-text-muted)',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                transition: 'background 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="modal-chart-container" style={{ position: 'relative', minHeight: '300px' }}>
          {loading && <div className="loading-container" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}
          {error && <div className="error-container" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Failed to load data: {error}</div>}
          {!loading && !error && data.length === 0 && <div className="loading-container" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No historical data found for this period.</div>}
          {!loading && !error && data.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis 
                  dataKey="timestamp" 
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(tick) => {
                    const d = new Date(tick);
                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                  stroke="var(--clr-text-muted)"
                  fontSize={11}
                  tickMargin={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  tickFormatter={(tick) => format === 'currency' ? `€${(tick/1000).toFixed(1)}k` : tick}
                  stroke="var(--clr-text-muted)"
                  fontSize={11}
                  width={60}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  trigger="axis"
                  shared={true}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--clr-accent-blue)"
                  strokeWidth={3}
                  dot={{ r: 6, fill: '#fff', stroke: 'var(--clr-accent-blue)', strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: '#fff', stroke: 'var(--clr-accent-purple)', strokeWidth: 3 }}
                  name="value"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}