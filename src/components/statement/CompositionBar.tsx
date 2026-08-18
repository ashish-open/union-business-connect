"use client";

// What a total is made of, under the total it belongs to.
//
// This replaces a full-width green progress bar that filled to 87% — the share
// of lines the engine had already matched. Four things on that screen rendered
// that one number, and the bar was the worst of them: it spent the most ink on
// the part needing no work, coloured it green directly beneath an amber count
// of the part that did, and stretched across three unrelated figures as though
// it described all of them.
//
// A composition bar answers something the page could not answer at all — where
// ₹22L went — and every slice is a filter, so the pixels navigate instead of
// decorate.
//
// Colour is categorical, which is a deliberate exception to B3 — money is never
// coloured, and these hues carry CATEGORY, not amount. Every figure on the card
// stays in ink. The set is validated rather than chosen: adjacent-pair
// separation for colourblind and normal vision, on this product's own surfaces,
// in both themes. It shipped first as an --ink opacity ramp and was unreadable
// past four segments.

import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import type { Segment } from "@/lib/statement";

/** The neutral for the folded tail and for own transfers — never a hue. */
const NEUTRAL = "color-mix(in srgb, var(--ink) 34%, transparent)";

/** A segment's paint: its categorical slot, or the neutral. */
function fill(slot: number): string {
  return slot >= 1 && slot <= 8 ? `var(--chart-${slot})` : NEUTRAL;
}

export function CompositionBar({
  segments,
  selected,
  onPick,
  emptyLabel,
  className,
}: {
  segments: Segment[];
  /** The kind currently filtering the table, if any. */
  selected?: string | null;
  onPick: (kind: string | null) => void;
  /** Shown when there is nothing to break down — absence is never a blank (D6). */
  emptyLabel: string;
  className?: string;
}) {
  if (segments.length === 0) {
    return <p className={cn("text-[11px] text-ink-3", className)}>{emptyLabel}</p>;
  }

  /* Every segment is named, biggest first.
     The bar paints in category order so its adjacent pairs match the pairs the
     palette was validated on; the ranking a reader actually wants lives here.
     A legend is not optional once there are hues: identity must never rest on
     colour alone, and three of these hues sit under 3:1 on a light surface, so
     the label is the thing carrying them. */
  const shown = [...segments].sort((a, b) => b.pct - a.pct);

  return (
    <div className={className}>
      {/* `tap-exempt` below, because globals.css gives every button a 44px
          minimum on a coarse pointer, which would turn an 8px bar into a wall.
          The hit box is widened vertically instead, and the legend below is the
          real target on a phone.

          A 2px gap in the surface colour between touching fills, so the
          boundary is a boundary and not a colour change the eye has to find. */}
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => {
          const on = selected === s.kind;
          /* Own transfers take the neutral whatever their size. On one persona
             they are 42% of money out, and a hue would make money that never
             left the business read as the largest thing it spends on. */
          const paint = on
            ? "var(--accent)"
            : s.kind === "internal"
              ? NEUTRAL
              : fill(s.slot);
          const ink = (
            <span
              className="block h-2 w-full transition-opacity"
              style={{ backgroundColor: paint }}
            />
          );
          /* The folded tail is several kinds at once, and the filter takes one
             value. A slice that looks clickable and narrows to nothing is worse
             than one that plainly is not, so it states its contents and stops
             there. */
          if (s.kind === "other") {
            return (
              <span
                key={s.kind}
                title={s.tooltip ?? s.label}
                style={{ width: `${s.pct}%` }}
                className="h-full min-w-0"
              >
                {ink}
              </span>
            );
          }
          return (
            <button
              key={s.kind}
              onClick={() => onPick(on ? null : s.kind)}
              title={`${s.label} · ${formatINR(s.amount)} · ${s.pct.toFixed(0)}%`}
              aria-label={`${s.label}, ${formatINR(s.amount)}, ${s.pct.toFixed(0)} percent. Show these lines.`}
              aria-pressed={on}
              style={{ width: `${s.pct}%` }}
              className="tap-exempt group relative h-full min-w-0 cursor-pointer py-2 -my-2"
            >
              {ink}
            </button>
          );
        })}
      </div>

      {/* Text wears text tokens, never the series colour — the dot beside it
          carries the identity. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {shown.map((s) => {
          const dot = (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  s.kind === "internal" || s.kind === "other" ? NEUTRAL : fill(s.slot),
              }}
            />
          );
          const text = `${s.label} ${s.pct.toFixed(0)}%`;
          return (
            <li key={s.kind}>
              {s.kind === "other" ? (
                <span
                  className="flex items-center gap-1.5 text-[11px] text-ink-3 tnum"
                  title={s.tooltip ?? s.label}
                >
                  {dot}
                  {text}
                </span>
              ) : (
                <button
                  onClick={() => onPick(selected === s.kind ? null : s.kind)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm text-[11px] tnum transition-colors cursor-pointer",
                    selected === s.kind ? "font-medium text-accent" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {dot}
                  {text}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
