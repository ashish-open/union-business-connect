"use client";

// Law E8 — the footer of a flow: retreat, park, advance.
//
// Three things, because a sheet with one button and an X makes you choose
// between finishing and losing what you typed:
//
//   retreat — leave, and NAME where leaving sends you. "Cancel" describes the
//             mechanism; "Back to invoices" describes the destination, which is
//             the thing you actually need to know before clicking it.
//   park    — keep the unfinished thing. Optional, and it must not be faked: it
//             appears only where there is somewhere real for a half-typed
//             document to go. A "Save as draft" that saves nothing is the
//             claim-with-nothing-behind-it shape this codebase keeps meeting.
//   advance — commit. Right-most, because that is where the eye lands last.
//
// The row is pinned OUTSIDE the sheet's scroll area, which is the whole point:
// the commit cannot scroll out of sight, and neither can the sentence saying
// why it is disabled. Disabled in place with the reason beneath it (D5), never
// a tooltip — `Button` sets `pointer-events-none` when disabled, so a title
// attribute on it would never be read by anyone.

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function SheetFooter({
  retreat,
  park,
  advance,
  hint,
  children,
}: {
  /** `label` names the destination, not the act of leaving. */
  retreat: { label: string; onClick: () => void };
  park?: { label: string; onClick: () => void; disabled?: boolean };
  advance: { label: string; onClick: () => void; disabled?: boolean };
  /** Why advance is disabled, or what committing will do. Always in place. */
  hint?: string;
  /** Totals — the number you are about to commit to, above the button. */
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-border px-5 py-3">
      {children}
      <div className={children ? "mt-3 flex items-center gap-2" : "flex items-center gap-2"}>
        <Button variant="ghost" size="md" onClick={retreat.onClick}>
          <ArrowLeft size={14} /> {retreat.label}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {park && (
            <Button variant="secondary" size="md" disabled={park.disabled} onClick={park.onClick}>
              {park.label}
            </Button>
          )}
          <Button size="md" disabled={advance.disabled} onClick={advance.onClick}>
            {advance.label}
          </Button>
        </div>
      </div>
      {hint && <p className="mt-1.5 text-[11.5px] leading-4 text-ink-3">{hint}</p>}
    </div>
  );
}
