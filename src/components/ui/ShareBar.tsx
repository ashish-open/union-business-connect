"use client";

// A slim bar under an amount in a ranked list, showing its share of the total.
//
// A ranked list already says which is biggest — that is what ranking is for.
// What it does not say is by how much, and that is usually the point: five
// payees ordered by spend look like a gradient until you can see that the first
// is half of everything and the rest are rounding.
//
// Deliberately not a chart. No axis, no legend, no colour carrying a category —
// one neutral bar per row, read against the row above it. Colour in this
// product is spent on meaning, and "bigger" is not a meaning, it is a length.

import { cn } from "@/lib/cn";

export function ShareBar({
  value,
  total,
  className,
}: {
  value: number;
  /** Zero or less renders nothing rather than dividing by it. */
  total: number;
  className?: string;
}) {
  if (total <= 0 || value <= 0) return null;
  const pct = Math.min(100, (value / total) * 100);
  return (
    <span
      className={cn("mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-surface-2", className)}
      // The number is already printed beside it; the bar is the comparison, so
      // it adds nothing for a screen reader and says so.
      aria-hidden
    >
      <span
        className="block h-full rounded-full bg-ink-3/45"
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </span>
  );
}
