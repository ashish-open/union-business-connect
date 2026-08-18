"use client";

// The statutory exposures, as one card with a row each.
//
// They were three separate cards, and as a set they read as three of the same
// thing: same frame, same two-line shape, same "Look →" button, and the words
// "Blocks the close" stamped twice within 200px. Three of anything is a table,
// not three cards (law C), and the group heading can say once what each card was
// saying again.
//
// Nothing moved behind a click. Every exposure is still on the screen, because
// hiding a statutory deadline to save vertical space is the wrong trade — an
// owner who does not know that 30% of the expense is disallowed will not act on
// a TDS figure. Where the number is modelled rather than read it still says so:
// false precision on a tax liability is worse than an honest approximation.
//
// The group heading deliberately carries NO total. Two of these amounts are read
// and one is modelled, and adding them would produce exactly the false precision
// the rest of this file avoids.

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CLOSE_PERIOD } from "@/lib/close";
import { plural } from "@/lib/format";
import { Exposure } from "@/lib/statutory";

export function ExposureList({
  exposed,
  onOpen,
}: {
  exposed: Exposure[];
  onOpen: (x: Exposure) => void;
}) {
  if (exposed.length === 0) return null;
  // The ones that stop the close come first — they are the ones with a date.
  const rows = [...exposed].sort((a, b) => Number(b.blocking) - Number(a.blocking));
  const period = CLOSE_PERIOD.split(" ")[0];

  return (
    <Card pad="none">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
        <p className="text-[12px] font-semibold text-ink">{`Before you close ${period}`}</p>
        <p className="text-[11.5px] text-ink-3 tnum">{plural(rows.length, "item")}</p>
      </div>
      {rows.map((x) => (
        <button
          key={x.kind}
          onClick={() => onOpen(x)}
          className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] font-medium text-ink">{x.headline}</span>
              {x.estimated && <Badge variant="outline">Estimate</Badge>}
              {/* One word, not four: the heading above already said "before you
                  close", so the badge only has to say that this one stops it. */}
              {x.blocking && <Badge tone="warn">Blocks</Badge>}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-ink-3">{x.because}</span>
          </span>
          <ChevronRight size={14} className="shrink-0 text-ink-3" />
        </button>
      ))}
    </Card>
  );
}
