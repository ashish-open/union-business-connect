// A shape, not a readout.
//
// Deliberately no axes, no gridlines, no data labels: this chart answers
// "which way is it going", and the exact value is already spelled out in
// large type beside it. Giving it axes would invite reading a precision it
// can't support. Inline SVG, no chart library.

import { BalancePoint } from "@/lib/balance";
import { fmtDate, formatINR } from "@/lib/format";

export function BalanceChart({
  series,
  low,
  high,
  className,
}: {
  series: BalancePoint[];
  low: number;
  high: number;
  className?: string;
}) {
  if (series.length < 2) return null;

  const W = 600;
  const H = 120;
  const pad = 6;
  const span = Math.max(high - low, 1);
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - low) / span) * (H - pad * 2);

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const lastPoint = series[series.length - 1];

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full"
        role="img"
        aria-label={`Balance over ${series.length} days, from ${formatINR(series[0].balance, { compact: true })} on ${fmtDate(series[0].date)} to ${formatINR(lastPoint.balance, { compact: true })} today`}
      >
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#balance-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink-3">
        <span>{fmtDate(series[0].date)}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
