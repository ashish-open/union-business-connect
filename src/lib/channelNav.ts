// The channels sub-nav, derived from the rails this business actually has.
//
// Kept in one place so the overview, each rail's page and the dispute register
// cannot drift out of step — the same reason complianceNav exists.

import type { SubNavItem } from "@/components/app/SubNav";
import type { Entity } from "@/data/seed";
import { buildChannels, reportHeld, type ChannelState } from "@/lib/channels";
import type { ChannelSource } from "@/store/useStore";
import { buildBatches, type SettlementBatch } from "@/lib/settlements";
import { formatINR } from "@/lib/format";

/**
 * Rails and their settlements, built once for whichever channels screen asked.
 *
 * All three pages need both, and both must come from the same call — the take
 * rate is only honest if it is measured against the grosses the waterfall
 * actually used.
 */
export function channelView(
  entity: Entity,
  sources: Record<string, ChannelSource>,
  aggregatorsOn: boolean,
): { rails: ChannelState[]; batches: SettlementBatch[] } {
  // One predicate, shared by the batches and the rail states, so the overview
  // cannot show a claim for a rail whose own page says it is not connected.
  const hasReport = reportHeld({
    source: (id) => sources[`${entity.id}/${id}`],
    aggregatorsOn,
  });
  const batches = buildBatches(entity, hasReport);
  /* Gross, and the two things that explain the gap between the contracted rate
     and what was actually kept: ads they are entitled to net off, and fee
     charged above the slab, which is the only part anybody can claim. */
  const grossBy = new Map<string, { gross: number; received: number; ads: number; excess: number }>();
  for (const b of batches) {
    const acc = grossBy.get(b.channelId) ?? { gross: 0, received: 0, ads: 0, excess: 0 };
    acc.gross += b.gross;
    acc.received += b.received;
    acc.ads += b.gross * b.adsRate;
    acc.excess += Math.max(0, b.variance);
    grossBy.set(b.channelId, acc);
  }
  const rails = buildChannels(entity, {
    // "Connected" means one precise thing to the engine: we hold the
    // settlement report, so a gross exists. Holding only the order book is a
    // real connection that answers a different question.
    source: (id) => sources[`${entity.id}/${id}`],
    aggregatorsOn,
    grossBy,
  });
  return { rails, batches };
}

export function channelItems(rails: ChannelState[], openClaims: number): SubNavItem[] {
  return [
    { label: "Overview", href: "/channels" },
    // One item per rail, biggest first — the meta is what it paid, because
    // that is how an owner tells them apart.
    ...rails.map((r) => ({
      label: r.spec.name,
      href: `/channels/${r.spec.id}`,
      meta: formatINR(r.received, { compact: true }),
    })),
    {
      label: "Disputes",
      href: "/channels/disputes",
      // A zero here is meaningful — it is a pipeline, not an inbox (C12).
      meta: String(openClaims),
    },
  ];
}
