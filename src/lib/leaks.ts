// The ways a platform underpays, as typed findings rather than one number.
//
// The feature had exactly one check: a settlement that came in below its own
// trailing median. Research on Indian marketplace settlements puts industry
// leakage at 2–5% of marketplace revenue; this product was finding 0.6%, because
// "the total was light" is a symptom with at least seven distinct causes and we
// were reporting the symptom as though it were the finding.
//
// Three of those seven are built here, and only three. A leak type needs
// evidence a reader can act on — an order id, a rate, a date — and a stub that
// produces a plausible rupee figure with nothing behind it is the fabrication
// problem one level up. Better three that are real.
//
// Each carries its own WINDOW, because that is how claim windows actually work:
// per claim type, not per platform. A settlement dispute and a payment enquiry
// are different desks with different clocks, and a single `disputeWindowDays` on
// the rail could never say so.

import { ANCHOR_DATE, Entity } from "@/data/seed";
import { daysBetween, fmtDate, formatINR, plural } from "@/lib/format";
import { channelSpec, type HasReport } from "@/lib/channels";
import { buildBatches } from "@/lib/settlements";
import { reconcileOrders } from "@/lib/orderbook";

export type LeakKind = "commission_above_slab" | "fee_on_zero_fee_item" | "delivered_not_remitted";

export interface Leak {
  id: string;
  kind: LeakKind;
  channelId: string;
  channel: string;
  /** Rupees at stake. */
  amount: number;
  /** How many orders are behind it. */
  orders: number;
  /** The claim, in the owner's words. */
  title: string;
  /** Where the number came from — never a restatement of the title. */
  evidence: string;
  /** Days left on THIS claim type's clock. Negative means the desk is closed. */
  daysLeft: number;
  /** Where the claim gets made. */
  href: string;
}

/**
 * What each kind is, and how long you have.
 *
 * The windows: a settlement dispute runs on the rail's own stated window. The
 * zero-fee claim is a fee-schedule correction rather than a dispute about a
 * rate, and platforms treat those more generously — 60 days is a plausible demo
 * value and is called out as one rather than presented as a citation. A payment
 * enquiry on an order that never arrived is the tightest of the three.
 */
const SPEC: Record<
  LeakKind,
  { label: string; window: number | "rail"; needs: "settlement" | "orders" }
> = {
  commission_above_slab: { label: "Fee above the contracted slab", window: "rail", needs: "settlement" },
  fee_on_zero_fee_item: { label: "Fee charged on a zero-rated item", window: 60, needs: "settlement" },
  delivered_not_remitted: { label: "Delivered and never paid for", window: 15, needs: "orders" },
};

export function leakLabel(kind: LeakKind): string {
  return SPEC[kind].label;
}

/**
 * The checks a given report switches on.
 *
 * Read from the same table the findings are, so the connect sheet cannot
 * promise a check the engine does not run — or, worse, stay quiet about one it
 * does. Adding a fourth leak kind updates the sales pitch by construction.
 */
export function checksUnlockedBy(needs: "settlement" | "orders"): string[] {
  return (Object.keys(SPEC) as LeakKind[]).filter((k) => SPEC[k].needs === needs).map(leakLabel);
}

/**
 * Every leak we can actually stand behind, biggest first.
 *
 * Nothing here is derivable from the bank alone — that is `bankOnlySuspicion`,
 * and it is a reason to fetch a report, not a claim. These need the platform's
 * file or the owner's order book, and each says which.
 */
export function leaksFor(
  entity: Entity,
  opts: { hasReport: HasReport; hasOrders: (channelId: string) => boolean },
): Leak[] {
  const out: Leak[] = [];

  for (const b of buildBatches(entity, opts.hasReport)) {
    if (b.variance <= 0) continue;
    const spec = channelSpec(b.channelId);
    const age = daysBetween(b.creditDate, ANCHOR_DATE);

    // One settlement, two claims — they go to different desks and carry
    // different evidence, so reporting "₹30,600 over" as a single line hid the
    // stronger of the two inside the weaker.
    for (const kind of ["commission_above_slab", "fee_on_zero_fee_item"] as const) {
      const cause = kind === "commission_above_slab" ? "above_slab" : "zero_fee_item";
      const orders = b.orders.filter((o) => o.cause === cause);
      if (orders.length === 0) continue;
      const amount = orders.reduce((s, o) => s + o.short, 0);
      if (amount <= 0) continue;
      const window = SPEC[kind].window === "rail" ? (spec?.disputeWindowDays ?? 30) : (SPEC[kind].window as number);
      out.push({
        id: `${b.id}-${kind}`,
        kind,
        channelId: b.channelId,
        channel: b.channel,
        amount,
        orders: orders.length,
        title:
          kind === "fee_on_zero_fee_item"
            ? `${b.channel} charged a referral fee on items under ${formatINR(spec?.zeroFeeBelow?.amount ?? 1000)}`
            : `${b.channel} charged above your contracted rate`,
        evidence:
          kind === "fee_on_zero_fee_item"
            ? `${plural(orders.length, "order")} · zero-rated since ${fmtDate(spec?.zeroFeeBelow?.from ?? ANCHOR_DATE)}`
            : `${plural(orders.length, "order")} · slab ${((spec?.rateCard[0]?.rate ?? 0) * 100).toFixed(1)}%`,
        daysLeft: window - age,
        href: `/dispute/${b.id}`,
      });
    }
  }

  // The finding the bank structurally cannot produce: an order that was
  // delivered and never settled leaves no line to be suspicious of.
  for (const r of reconcileOrders(entity, {
    hasOrders: opts.hasOrders,
    hasReport: opts.hasReport,
  })) {
    if (r.unremitted.length === 0) continue;

    // Live and expired are two findings, not one with an average deadline.
    // Reported as a single ₹17,620 with "4 days left" — which is the soonest
    // LIVE deadline — the line promises a window on money that is already past
    // one. Same drift as reporting a settlement's two claims as one total.
    for (const bucket of ["live", "closed"] as const) {
      const orders = r.unremitted.filter((o) => (bucket === "live" ? o.daysLeft > 0 : o.daysLeft <= 0));
      if (orders.length === 0) continue;
      out.push({
        id: `${r.channelId}-delivered_not_remitted-${bucket}`,
        kind: "delivered_not_remitted",
        channelId: r.channelId,
        channel: r.channel,
        amount: orders.reduce((s, o) => s + o.value, 0),
        orders: orders.length,
        title: `${r.channel} never paid for ${plural(orders.length, "delivered order")}`,
        evidence: `${plural(orders.length, "order")} · nothing settled against them`,
        daysLeft: bucket === "live" ? Math.min(...orders.map((o) => o.daysLeft)) : 0,
        href: `/channels/${r.channelId}`,
      });
    }
  }

  return out.sort((a, b) => b.amount - a.amount);
}

/**
 * The claims still worth acting on: window open, not already recovered.
 *
 * One definition, because three pages each had their own and two of them
 * counted RAILS. The sub-nav read "Disputes · 2" beside a register that said
 * "5 claims across 2 rails" — a counter that disagrees with the list it opens
 * is a counter nobody trusts twice.
 */
export function openClaims(leaks: Leak[], isRecovered: (leakId: string) => boolean): Leak[] {
  return leaks.filter((l) => l.daysLeft > 0 && !isRecovered(l.id));
}

/**
 * The register's order: soonest deadline first, closed desks last.
 *
 * `leaksFor` returns biggest-first, which is the right order for "where is my
 * money", and the wrong one for "what do I do today" — it put a ₹24,100 claim
 * whose window shut weeks ago above a ₹19,888 one with two days left. Size is a
 * tiebreak here, not the sort.
 */
export function byUrgency(leaks: Leak[]): Leak[] {
  return [...leaks].sort((a, b) => {
    const aOpen = a.daysLeft > 0;
    const bOpen = b.daysLeft > 0;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (aOpen && a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return b.amount - a.amount;
  });
}

/** Split by whether the desk is still open — the two are not one total. */
export function splitByWindow(leaks: Leak[]): { live: Leak[]; closed: Leak[] } {
  return {
    live: leaks.filter((l) => l.daysLeft > 0),
    closed: leaks.filter((l) => l.daysLeft <= 0),
  };
}
