import { useId } from 'react';

/** Minimal inline sparkline (no axes, no tooltip) — purely decorative trend. */
export function Sparkline({
  values,
  color = 'var(--primary)',
  height = 32,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const id = useId();
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return <div style={{ height }} className={className} aria-hidden="true" />;
  const w = 100;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pts = clean.map((v, i) => [(i / (clean.length - 1)) * w, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} style={{ height, width: '100%' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${CSS.escape(id)})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
