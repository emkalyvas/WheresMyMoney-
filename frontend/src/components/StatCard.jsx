/** Shared number formatter for EUR amounts. */
export const eurFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a number as a percentage string. */
export function pctFmt(value, digits = 1) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

/**
 * A single summary stat card with an icon, label, large value, and optional badge.
 *
 * Props:
 *  - label (string)
 *  - value (string | number) — pre-formatted string or raw number
 *  - sub (string)            — small subtitle text
 *  - icon (ReactNode)        — Lucide icon component
 *  - accentColor (string)    — CSS colour for the top accent bar
 *  - iconBg (string)         — CSS background for icon container
 *  - badge ({ text, type })  — optional badge: type = 'positive' | 'negative' | 'warning'
 *  - valueClass (string)     — extra CSS class on the value (e.g. 'text-positive')
 */
export default function StatCard({
  label,
  value,
  sub,
  icon,
  accentColor,
  iconBg,
  badge,
  valueClass = '',
}) {
  return (
    <div className="card stat-card fade-in-up">
      {accentColor && (
        <div
          className="stat-card-accent"
          style={{ background: accentColor }}
          aria-hidden="true"
        />
      )}

      <div
        className="stat-card-icon"
        style={{ background: iconBg ?? 'rgba(255,255,255,0.06)' }}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="stat-card-label">{label}</div>

      <div className={`stat-card-value ${valueClass}`}>{value}</div>

      {(sub || badge) && (
        <div className="stat-card-sub">
          {sub && <span>{sub}</span>}
          {badge && (
            <span className={`badge badge-${badge.type}`}>{badge.text}</span>
          )}
        </div>
      )}
    </div>
  );
}
