// The pattern the whole product follows: reconciliation state lives on the
// statement line itself. You learn a settlement came in short while reading
// your statement — not by remembering to open a recon module later.

import { Check, CircleAlert, HelpCircle, Landmark, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDate, formatINR } from "@/lib/format";
import { Money } from "@/components/ui/Money";

export type ReconState =
  | { state: "matched"; to?: string }
  | { state: "suggested"; confidence: number }
  /**
   * Named and arrived, but the fee taken out of it is not visible to us.
   *
   * This state exists because the statement used to call every card and UPI
   * settlement "Matched · Card takings · T+1" — 154 credits on one persona,
   * checked against precisely nothing. Matched has to mean verified or it
   * means nothing, and "unexplained" would be a lie in the other direction:
   * we know exactly who sent it.
   */
  | { state: "received"; to: string }
  | { state: "short"; by: number }
  | { state: "unexplained" }
  | { state: "personal" }
  /**
   * Seen at another bank, and that is all.
   *
   * A read-only consent gives us the line and nothing behind it: no report can
   * be fetched against an account we do not hold, so there is no gross, no fee
   * and no claim. It is not "unexplained" — we know exactly who sent it — and
   * calling it matched would be the fake-match sin on a line we cannot check at
   * all. The state says what is true: visible, not reconcilable here.
   */
  | { state: "external"; bank: string };

export function SettlementBadge({ recon }: { recon: ReconState }) {
  const base =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap";
  switch (recon.state) {
    case "matched":
      return (
        <span className={cn(base, "bg-pos-soft text-pos")}>
          <Check size={11} strokeWidth={2.5} />
          {recon.to ? `Matched · ${recon.to}` : "Matched"}
        </span>
      );
    case "suggested":
      return (
        <span className={cn(base, "bg-info-soft text-info")}>
          {recon.confidence}% match — confirm?
        </span>
      );
    // Neutral, never green: it asks nothing of you (B2), but green is reserved
    // for figures we actually checked.
    case "received":
      return (
        <span className={cn(base, "bg-surface-2 text-ink-2")}>
          <Landmark size={11} strokeWidth={2.5} />
          {`Arrived · ${recon.to}`}
        </span>
      );
    case "short":
      return (
        <span className={cn(base, "bg-neg-soft text-neg")}>
          <CircleAlert size={11} strokeWidth={2.5} />
          Short {formatINR(recon.by)}
        </span>
      );
    case "unexplained":
      return (
        <span className={cn(base, "bg-warn-soft text-warn")}>
          <HelpCircle size={11} strokeWidth={2.5} />
          Unexplained
        </span>
      );
    case "external":
      return (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
          <Landmark size={11} />
          {`${recon.bank} · not reconcilable here`}
        </span>
      );
    case "personal":
      return (
        <span className={cn(base, "bg-surface-2 text-ink-2")}>
          <User size={11} strokeWidth={2.5} />
          Personal
        </span>
      );
  }
}

export function StatementLine({
  date,
  name,
  narration,
  amount,
  direction,
  recon,
}: {
  date: string;
  name: string;
  /** The raw bank string. Rendered, not hidden in a tooltip — see below. */
  narration: string;
  amount: number;
  direction: "credit" | "debit";
  recon: ReconState;
}) {
  return (
    <div
      className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-2/60 transition-colors"
      title={narration}
    >
      <span className="text-[11.5px] text-ink-3 tnum">{fmtDate(date)}</span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-ink">{name}</p>
        {/* The bank's own words, under the name they produced. This was a
            `title=` attribute, which is unreachable on a phone and invisible in
            a screenshot — and the moment it is wanted is the moment the name
            above it looks wrong. */}
        <p className="truncate font-mono text-[10.5px] leading-4 text-ink-3">{narration}</p>
        <div className="mt-0.5">
          <SettlementBadge recon={recon} />
        </div>
      </div>
      <Money
        value={direction === "debit" ? -amount : amount}
        size="sm"
        tone={direction === "credit" ? "pos" : undefined}
        signed={direction === "credit"}
      />
    </div>
  );
}
