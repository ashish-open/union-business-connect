// Tier-2 filters for the statement (law C13).
//
// The pills above the table are tier 1 — the four slices worth a permanent
// home. This is the other tier: the one-off question ("credits over ₹50,000",
// "everything that came in on UPI") that does not deserve a pill but does
// deserve to be askable.
//
// The builder only ever offers values that are actually in the window. A field
// that offers "RTGS" to a business with no RTGS lines is a control whose only
// possible outcome is an empty table, and an empty table you asked for still
// reads as "we found nothing".

import type { StatementRow } from "@/lib/statement";
import { KIND_LABEL } from "@/lib/analysis";
import { formatINR } from "@/lib/format";

export type StatementFilter =
  | { field: "min"; value: number }
  | { field: "max"; value: number }
  | { field: "state"; value: string }
  | { field: "mode"; value: string }
  /* What kind of money it is. Added so a slice of the composition bar can put
     itself here: clicking "Suppliers" leaves a removable chip above the table,
     which is both the filter and the record of why the table narrowed. */
  | { field: "kind"; value: string };

/** How each recon state reads to an owner, not to the engine. */
const STATE_LABEL: Record<string, string> = {
  matched: "Matched",
  received: "Arrived · fee not visible",
  short: "Short",
  suggested: "Awaiting your confirm",
  unexplained: "Didn't match",
  personal: "Personal",
};

export function stateLabel(state: string): string {
  return STATE_LABEL[state] ?? state;
}

export function filterLabel(f: StatementFilter): string {
  switch (f.field) {
    case "min":
      return `Amount ≥ ${formatINR(f.value)}`;
    case "max":
      return `Amount ≤ ${formatINR(f.value)}`;
    case "state":
      return stateLabel(f.value);
    case "mode":
      return f.value;
    case "kind":
      return KIND_LABEL[f.value as keyof typeof KIND_LABEL] ?? f.value;
  }
}

export function filterMatches(f: StatementFilter, row: StatementRow): boolean {
  switch (f.field) {
    case "min":
      return row.txn.amount >= f.value;
    case "max":
      return row.txn.amount <= f.value;
    case "state":
      return row.recon.state === f.value;
    case "mode":
      return row.txn.mode === f.value;
    case "kind":
      return row.kind === f.value;
  }
}

/** Two filters on the same field would contradict rather than narrow. */
export function replaceFilter(
  existing: StatementFilter[],
  next: StatementFilter,
): StatementFilter[] {
  return [...existing.filter((f) => f.field !== next.field), next];
}

/**
 * The states and modes present in the window, commonest first — the order in
 * which they are worth looking at.
 */
export function filterOptions(rows: StatementRow[]): { states: string[]; modes: string[] } {
  const states = new Map<string, number>();
  const modes = new Map<string, number>();
  for (const r of rows) {
    states.set(r.recon.state, (states.get(r.recon.state) ?? 0) + 1);
    modes.set(r.txn.mode, (modes.get(r.txn.mode) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { states: rank(states), modes: rank(modes) };
}
