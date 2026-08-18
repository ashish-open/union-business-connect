// The other side of the reconciliation: what you sold.
//
// Everything else in this product reads the bank statement, which is a
// complete record of money that MOVED. It is silent on money that should have
// moved and did not — and that silence is where an SME loses the most.
//
// A platform that never remits an order does not appear anywhere in a bank
// statement. There is no line to be suspicious of. The only way to find it is
// to hold the order book beside the remittance and see which orders never
// arrived, which is exactly why Cointab reconciles internal-vs-external and
// why the bank-only view has a floor it cannot get under.
//
// So this file models the internal side. It is reconstructed deterministically
// from the same credits everything else reads — the order book "arrives" when
// the owner connects it, and what it reveals is computed, never stored.

import { ANCHOR_DATE as ANCHOR, Entity } from "@/data/seed";
import { addDays } from "@/lib/format";
import { channelFor, ChannelSpec } from "@/lib/channels";
import { buildBatches } from "@/lib/settlements";
import { NO_REPORTS, type HasReport } from "@/lib/channels";

export interface UnremittedOrder {
  id: string;
  /** When it was delivered — the clock on a COD claim starts here. */
  date: string;
  value: number;
  reason: "never_remitted" | "short_paid";
  /** Days left to raise it. Negative means the platform will not hear it. */
  daysLeft: number;
}

export interface OrderReconciliation {
  channelId: string;
  channel: string;
  /** Orders in the owner's own book for the window. */
  orders: number;
  /** Their total value. */
  ordered: number;
  /** What the platform actually sent, gross of its fees. */
  settled: number;
  unremitted: UnremittedOrder[];
  /** Money delivered and never paid for. */
  atRisk: number;
  /** Of that, what the platform will still accept a claim on. */
  claimable: number;
  /**
   * And what it will not, because the window ran out.
   *
   * This is the number that argues for the feature. Money already lost cannot
   * be recovered by connecting the report today — but it is the most honest
   * possible answer to "why should I bother", and hiding it would make the
   * claimable figure look like the whole problem.
   */
  expired: number;
  /** Soonest deadline still open, so the page can say how long you have. */
  daysLeft: number;
}

/**
 * Deterministic order values, so a given rail always produces the same book.
 * Indexed by position, never random — the demo has to be the same twice.
 */
const ORDER_VALUES = [1240, 2180, 890, 1650, 3120, 740, 2460, 1380, 1920, 1070, 2740, 1530];

/**
 * The orders a platform delivered and never paid for.
 *
 * Modelled at a rate that is deliberately unremarkable — a fraction of a
 * percent of orders, which is what makes it invisible without the report and
 * material once you add it up. A dramatic number would be a worse
 * demonstration, because nobody loses 20% of their orders and nobody would
 * believe it.
 */
function leakFor(spec: ChannelSpec, creditCount: number, seed: number): UnremittedOrder[] {
  // COD is the leaky rail in reality: the parcel is delivered, the cash is
  // collected by the courier, and the remittance is somebody else's job.
  // Marketplaces leak too, mostly through returns booked against the wrong
  // order. A gateway does not — it either authorised or it did not.
  const perCycle = spec.kind === "cod" ? 3 : spec.kind === "marketplace" ? 2 : 0;
  if (perCycle === 0) return [];

  const out: UnremittedOrder[] = [];
  const cycles = Math.min(creditCount, 6);
  for (let c = 0; c < cycles; c++) {
    for (let i = 0; i < perCycle; i++) {
      const n = c * perCycle + i;
      // The newest cycle is excluded: an order in it may simply not have
      // settled yet, and calling that a leak would be the fake-match sin.
      if (c < 1) continue;
      // Spread across the window so some are still claimable and some are
      // not. Both halves are the point.
      const age = 6 + c * 9 + i * 2;
      out.push({
        id: `${spec.id.slice(0, 3).toUpperCase()}-${String(84100 + seed + n * 13)}`,
        date: addDays(ANCHOR, -age),
        value: ORDER_VALUES[(n + seed) % ORDER_VALUES.length],
        reason: n % 3 === 0 ? "short_paid" : "never_remitted",
        daysLeft: spec.disputeWindowDays - age,
      });
    }
  }
  return out;
}

/**
 * Reconcile the order book against what the platform remitted.
 *
 * Only runs for rails whose order book we actually hold — the whole point is
 * that this finding is unavailable until the owner brings their own side.
 */
export function reconcileOrders(
  entity: Entity,
  opts: { hasOrders: (channelId: string) => boolean; hasReport?: HasReport },
): OrderReconciliation[] {
  const byRail = new Map<string, { spec: ChannelSpec; credits: number; settled: number }>();
  for (const t of entity.txns) {
    if (t.direction !== "credit") continue;
    const spec = channelFor(t.narration);
    if (!spec) continue;
    const acc = byRail.get(spec.id) ?? { spec, credits: 0, settled: 0 };
    acc.credits += 1;
    acc.settled += t.amount;
    byRail.set(spec.id, acc);
  }

  const grossByRail = new Map<string, number>();
  for (const b of buildBatches(entity, opts.hasReport ?? NO_REPORTS)) {
    grossByRail.set(b.channelId, (grossByRail.get(b.channelId) ?? 0) + b.gross);
  }

  const out: OrderReconciliation[] = [];
  for (const [id, acc] of byRail) {
    if (!opts.hasOrders(id)) continue;
    const seed = id.charCodeAt(0) + id.length;
    const unremitted = leakFor(acc.spec, acc.credits, seed);
    if (unremitted.length === 0) continue;

    const atRisk = unremitted.reduce((s, o) => s + o.value, 0);
    const live = unremitted.filter((o) => o.daysLeft > 0);
    // The book is what the platform accounted for plus what it never did.
    const gross = grossByRail.get(id) ?? acc.settled;
    const ordered = gross + atRisk;

    out.push({
      channelId: id,
      channel: acc.spec.name,
      orders: Math.round(ordered / 1800),
      ordered,
      settled: gross,
      unremitted,
      atRisk,
      claimable: live.reduce((s, o) => s + o.value, 0),
      expired: atRisk - live.reduce((s, o) => s + o.value, 0),
      daysLeft: live.length ? Math.min(...live.map((o) => o.daysLeft)) : 0,
    });
  }

  return out.sort((a, b) => b.atRisk - a.atRisk);
}

