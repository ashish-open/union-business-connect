// The Today engine. Two products:
//   buildQueue    — "Needs you": approvals, returned payments, match confirms,
//                   plus the analysis findings. The bell counts these.
//   buildUpcoming — "Coming up": expected settlements and recurring
//                   obligations, both DETECTED from the transaction history
//                   (weekly/monthly cadence), never hand-written.

import { ANCHOR_DATE, Entity, Txn } from "@/data/seed";
import { addDays, daysBetween, plural } from "@/lib/format";
import { analyse, resolveCounterparty, Tone } from "@/lib/analysis";

/* ------------------------------------------------------------------ */
/* Needs you                                                            */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  id: string;
  kind: "approval" | "returned" | "confirm" | "finding" | "voice";
  tone: Tone;
  amount: number;
  title: string; // rendered after the amount
  sub: string;
  action: string;
  done: string; // shown once resolved
  href?: string; // findings navigate into the statement instead of resolving
  /**
   * Voice items only: the draft this row is a view of. Its presence is what
   * makes the row expand in place instead of navigating — the fields have to be
   * editable before anything is created, and a queue row cannot hold that.
   */
  draftRef?: string;
}

/**
 * Voice requests arrive as a third argument the way `connected` does, rather than
 * being read inside here.
 *
 * That matters: `NeedsYouBell` and Today both call this function, and the bell's
 * own comment says the badge and the list "can never disagree about what needs
 * you". Keeping one source means a spoken invoice shows up in the count from
 * every screen without a second nav item to maintain.
 */
export function buildQueue(
  entity: Entity,
  connected = false,
  voice: readonly QueueItem[] = [],
): QueueItem[] {
  // First while open. These are the newest thing the caller personally asked
  // for, and among rows that otherwise look alike the different one is the one
  // that gets seen.
  const items: QueueItem[] = [...voice];

  for (const a of entity.approvals) {
    items.push({
      id: `ap-${a.id}`,
      kind: "approval",
      tone: "info",
      amount: a.total,
      // The button says "Review & approve", so the title does not have to. It
      // used to read "waits for your approval" beside a button of the same
      // name, and the note carried its own second clause after an em-dash.
      title: `across ${plural(a.count, "payment")}`,
      sub: `${a.preparedBy} · ${a.note.split(" — ")[0]}`,
      action: "Review & approve",
      done: "Approved — queued for the next payment run",
    });
  }

  for (const r of entity.returned) {
    items.push({
      id: `rp-${r.id}`,
      kind: "returned",
      tone: "neg",
      amount: r.amount,
      title: `came back — ${r.payee}`,
      sub: `${r.reason} · money is back`,
      action: "Fix payee & retry",
      done: "Queued for retry once the payee re-verifies",
    });
  }

  for (const s of entity.suggested) {
    items.push({
      id: `sm-${s.id}`,
      kind: "confirm",
      tone: "info",
      amount: s.amount,
      title: `looks like ${s.matchTo}`,
      sub: `${s.credit} · ${s.confidence}% match`,
      action: "Confirm match",
      done: "Matched — your statement is updated",
    });
  }

  for (const f of analyse(entity, connected).findings) {
    // Connecting a rail is an unlock, not a decision, and the queue's resolved
    // line — "Noted — we'll keep tracking it" — would be a lie about it.
    // It gets its own strip on Today instead.
    if (f.kind === "channel_lump") continue;
    items.push({
      id: `f-${f.kind}`,
      kind: "finding",
      tone: f.tone,
      amount: f.amount,
      title: f.title,
      sub: f.evidence,
      action: f.action,
      done: "Noted — we'll keep tracking it",
      // The finding carries its own destination now. This mapping was a
      // second copy of it that had already drifted — channel findings were
      // still being sent to the statement's old connect modal.
      href: f.href,
    });
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Coming up                                                            */
/* ------------------------------------------------------------------ */

export interface UpcomingItem {
  id: string;
  date: string;
  label: string;
  amount: number;
  direction: "in" | "out";
  approx: boolean;
}

const OBLIGATION_KINDS = new Set([
  "vendor",
  "payroll",
  "rent",
  "utility",
  "tax",
  "labour",
  "ads",
]);

export function buildUpcoming(entity: Entity, windowDays = 25, limit = 6): UpcomingItem[] {
  const items: UpcomingItem[] = [...expectedSettlements(entity), ...recurringObligations(entity)];
  return items
    .filter((i) => daysBetween(ANCHOR_DATE, i.date) <= windowDays)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, limit);
}

/** Weekly marketplace settlements: median amount, cadence projected forward. */
function expectedSettlements(entity: Entity): UpcomingItem[] {
  const byChannel = new Map<string, Txn[]>();
  for (const t of entity.txns) {
    if (t.direction !== "credit") continue;
    const r = resolveCounterparty(t.narration);
    if (r.kind !== "marketplace") continue;
    const list = byChannel.get(r.name) ?? [];
    list.push(t);
    byChannel.set(r.name, list);
  }

  const out: UpcomingItem[] = [];
  for (const [name, list] of byChannel) {
    if (list.length < 6) continue;
    const dates = list.map((t) => t.date).sort();
    const last = dates[dates.length - 1];
    let next = addDays(last, 7);
    while (next <= ANCHOR_DATE) next = addDays(next, 7);
    out.push({
      id: `set-${name}`,
      date: next,
      label: `${name} settlement`,
      amount: median(list.map((t) => t.amount)),
      direction: "in",
      approx: true,
    });
  }
  return out;
}

/** Recurring debits: same counterparty, steady weekly/fortnightly/monthly gap. */
function recurringObligations(entity: Entity): UpcomingItem[] {
  // sum per counterparty per day first, so "4 rents on the 2nd" is one event
  const perName = new Map<string, Map<string, number>>();
  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    const r = resolveCounterparty(t.narration);
    if (!OBLIGATION_KINDS.has(r.kind)) continue;
    const days = perName.get(r.name) ?? new Map<string, number>();
    days.set(t.date, (days.get(t.date) ?? 0) + t.amount);
    perName.set(r.name, days);
  }

  const out: UpcomingItem[] = [];
  for (const [name, days] of perName) {
    const dates = [...days.keys()].sort();
    if (dates.length < 3) continue;
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
    const cadence = median(gaps);
    if (cadence < 5 || cadence > 35) continue; // no steady rhythm — skip
    const last = dates[dates.length - 1];
    let next = addDays(last, cadence);
    while (next <= ANCHOR_DATE) next = addDays(next, cadence);
    out.push({
      id: `ob-${name}`,
      date: next,
      label: name,
      amount: median(dates.map((d) => days.get(d)!)),
      direction: "out",
      approx: true,
    });
  }
  return out;
}

export interface UpcomingNet {
  inflow: number;
  outflow: number;
  net: number;
}

/**
 * The arithmetic the card used to make you do (C7): six dated rows and no total,
 * so "can I cover this" was left as an exercise.
 *
 * Derived from the ITEMS RENDERED, not recomputed from the entity, so the footer
 * cannot disagree with the rows above it. `sweepOffer` totals committed outflows
 * over a different window for a different purpose, and two numbers that mean
 * roughly the same thing, computed twice, is the shape this codebase has been
 * bitten by five times.
 */
export function upcomingNet(items: UpcomingItem[]): UpcomingNet {
  let inflow = 0;
  let outflow = 0;
  for (const i of items) {
    if (i.direction === "in") inflow += i.amount;
    else outflow += i.amount;
  }
  return { inflow, outflow, net: inflow - outflow };
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** "Today" / "Tomorrow" / "Sat 1 Aug" / "20 Aug · in 22 days" */
export function relativeLabel(date: string): string {
  const d = daysBetween(ANCHOR_DATE, date);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(date + "T00:00:00").getDay()
  ];
  const nice = `${wd} ${Number(date.slice(8, 10))} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(date.slice(5, 7)) - 1]}`;
  return d <= 7 ? nice : `${nice} · in ${d} days`;
}
