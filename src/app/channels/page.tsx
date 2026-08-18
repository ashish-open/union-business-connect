"use client";

// Channels — where the money actually arrives.
//
// For a QSR or a D2C brand most revenue never arrives as a payment from a
// customer: it arrives as a net settlement from a platform, days later, with
// the platform's cut already taken out. This page answers the question no
// other product answers — what did each rail keep, and was that the rate we
// agreed?
//
// It had no home at all until now. Connecting was a modal on the statement,
// settlements were a section inside it, and a dispute pack was reachable only
// through a modal inside that section (§13's lesson, again).

import { useMemo } from "react";
import { Link2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { ChannelRow } from "@/components/channels/ChannelRow";
import { channelItems, channelView } from "@/lib/channelNav";
import { ordersHeld, reportHeld, unverifiedKept } from "@/lib/channels";
import { leaksFor, openClaims } from "@/lib/leaks";
import { silentFor, suspicionsFor } from "@/lib/settlements";
import { formatINR, plural } from "@/lib/format";
import { ANCHOR_DATE } from "@/data/seed";
import { useEntity, useStore } from "@/store/useStore";

export default function ChannelsPage() {
  const entity = useEntity();
  const channelsConnected = useStore((s) => s.channelsConnected);
  const channelSources = useStore((s) => s.channelSources);
  const disputes = useStore((s) => s.disputes);

  const { rails } = useMemo(
    () =>
      entity
        ? channelView(entity, channelSources, !!channelsConnected[entity.id])
        : { rails: [], batches: [] },
    [entity, channelSources, channelsConnected],
  );

  /* The rail total is the sum of its typed leaks, not of its settlement
     variances. Same rupees today, but a settlement can carry two claims on two
     clocks, and only the leak knows which of them is still live. */
  const leaks = useMemo(() => {
    if (!entity) return [];
    return leaksFor(entity, {
      hasReport: reportHeld({
        source: (id) => channelSources[`${entity.id}/${id}`],
        aggregatorsOn: !!channelsConnected[entity.id],
      }),
      hasOrders: ordersHeld({
        source: (id) => channelSources[`${entity.id}/${id}`],
        aggregatorsOn: !!channelsConnected[entity.id],
      }),
    });
  }, [entity, channelSources, channelsConnected]);

  if (!entity) return <AppShell />;

  const claimByRail = new Map<string, number>();
  for (const l of leaks) {
    if (disputes[`${entity.id}/${l.id}`] === "recovered") continue;
    if (l.daysLeft <= 0) continue;
    claimByRail.set(l.channelId, (claimByRail.get(l.channelId) ?? 0) + l.amount);
  }
  const open = openClaims(leaks, (id) => disputes[`${entity.id}/${id}`] === "recovered");

  const anyVerified = rails.some((r) => r.connected && r.spec.verifiable === "report");
  const claimTotal = [...claimByRail.values()].reduce((sum, v) => sum + v, 0);
  const liveLeaks = open.length;
  const closedTotal = leaks.filter((l) => l.daysLeft <= 0).reduce((s, l) => s + l.amount, 0);
  const expiredByRail = new Map<string, number>();
  for (const l of leaks) {
    if (l.daysLeft > 0) continue;
    expiredByRail.set(l.channelId, (expiredByRail.get(l.channelId) ?? 0) + l.amount);
  }
  /* What the bank alone can say, for the rails with no report yet. It is a
     suspicion and is labelled as one — the claim needs the platform's file.
     A rail with ANY leak is superseded, live or expired: once the report is in
     hand, "looks light" is the weaker of two things we can say about it. */
  const proven = new Set(leaks.map((l) => l.channelId));
  const suspicions = suspicionsFor(entity).filter((r) => !proven.has(r.channelId));
  const suspicionTotal = suspicions.reduce((sum, r) => sum + r.amount, 0);
  const suspicionCount = suspicions.reduce((sum, r) => sum + r.count, 0);
  const received = rails.reduce((s, r) => s + r.received, 0);
  const kept = rails.reduce((s, r) => s + (r.kept ?? 0), 0);
  const visible = rails.filter((r) => r.kept !== null);
  const grossVisible = visible.reduce((s, r) => s + (r.gross ?? 0), 0);
  /** Estimated from the rate card, for every rail we cannot yet measure. */
  const unverifiedTotal = rails
    .filter((r) => r.kept === null)
    .reduce((s, r) => s + unverifiedKept(r), 0);

  /** Rails that have stopped paying altogether — the bank can see this alone. */
  const silent = new Map(
    rails.map((r) => [r.spec.id, silentFor(entity, r.spec.id, ANCHOR_DATE)] as const),
  );

  /* Ranked by what is worth doing about it, not by size.
     The list was ordered by money received, so the rail with a claim expiring
     in two days sat wherever its revenue put it. Rank runs claimable → looks
     light → never checked → nothing to do, and only the CONTENT is reordered:
     the sub-nav beside it stays in money order, because an index that
     rearranges itself every time you mark a claim recovered is not an index. */
  const rank = (r: (typeof rails)[number]) => {
    if ((claimByRail.get(r.spec.id) ?? 0) > 0) return 0;
    // Money that stopped arriving beats money that arrived light.
    if (silent.get(r.spec.id)) return 1;
    if ((suspicions.find((x) => x.channelId === r.spec.id)?.amount ?? 0) > 0) return 2;
    if (!r.connected) return 3;
    return 4;
  };
  const weight = (r: (typeof rails)[number]) =>
    claimByRail.get(r.spec.id) ??
    suspicions.find((x) => x.channelId === r.spec.id)?.amount ??
    (r.connected ? 0 : unverifiedKept(r));
  const ranked = [...rails].sort(
    (a, b) => rank(a) - rank(b) || weight(b) - weight(a) || b.received - a.received,
  );

  return (
    <AppShell>
      <SectionLayout title="Channels" items={channelItems(rails, open.length)} active="/channels">
        {rails.length === 0 ? (
          /* Deficiency, not achievement: they have no rails because we found
             none, and there is something to do about it (D1/D2/D3). */
          <Card className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
              <Link2 size={20} />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">No platforms paying you</p>
            <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-ink-3">
              Swiggy, Amazon, a card machine or a gateway appears on its first settlement.
            </p>
            <p className="mt-1 text-[11.5px] text-ink-3">Found in your statement · nothing to set up</p>
          </Card>
        ) : (
          <>
            <p className="text-[12.5px] text-ink-3">
              {`${plural(rails.length, "rail")} paying you`}
            </p>

            {/* The number nobody has. Ink, always — only the excess over
                contract is ever coloured. */}
            <Card className="mt-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    Landed in your account
                  </p>
                  <Money value={received} size="lg" className="mt-1 block" compact />
                </div>
                {/* Absence is not zero (D6).
                    With no report in hand this read "Platforms kept · ₹0" at
                    hero weight, which says they kept nothing — the opposite of
                    true, and the exact failure the law was written for. Where
                    the number cannot be known the slot says so and states what
                    would produce it. */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    Platforms kept
                  </p>
                  {grossVisible > 0 ? (
                    <>
                      <Money value={kept} size="lg" className="mt-1 block" compact />
                      <p className="mt-0.5 text-[11px] text-ink-3 tnum">
                        {`${((kept / grossVisible) * 100).toFixed(1)}% of gross`}
                      </p>
                    </>
                  ) : (
                    /* With nothing connected this said "Not visible · inside 5
                       settlements — the reports break it out", and the footnote
                       under the card said the same thing again with the number
                       attached. D6 was right that ₹0 lies here; it does not
                       follow that the only honest answer is a refusal. The rate
                       card and the credits are both in hand, so the slot states
                       the estimate and marks it as one. */
                    <>
                      <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-2 tnum">
                        {`≈${formatINR(unverifiedTotal, { compact: true })}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        From the rate card · no report yet
                      </p>
                    </>
                  )}
                </div>
                {/* A dip below the usual pattern is visible from the bank
                    alone. Calling it "above contract" is a different and
                    stronger claim — it needs the rate card, which needs the
                    report. So the label follows the evidence we actually have.

                    Cold, that evidence is the SUSPICION, not a claim: the
                    batches are gated on the report now, so this slot used to
                    fall to ₹0 the moment the fabricated claims were removed. */}
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    {anyVerified ? "Owed back to you" : "Below your usual"}
                  </p>
                  <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                    {formatINR(anyVerified ? claimTotal : suspicionTotal)}
                  </p>
                  {/* Three kinds of underpayment, not one, and each on its own
                      clock — so the sub-line counts claims rather than
                      settlements, and the closed ones are excluded from the
                      figure above rather than quietly folded in. */}
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {anyVerified
                      ? claimTotal > 0
                        ? `${plural(liveLeaks, "claim")}${closedTotal > 0 ? ` · ${formatINR(closedTotal)} past its window` : ""}`
                        : "Every settlement as contracted"
                      : suspicionTotal > 0
                        ? `Across ${plural(suspicionCount, "settlement")} · a report proves why`
                        : "Every settlement matches its own pattern"}
                  </p>
                </div>
              </div>
              {/* What connecting the rest would put in scope, in rupees.
                  The line counted rails and stopped — "3 settle net of a fee
                  not yet visible" — which states a gap without sizing it, and a
                  gap nobody has sized is a gap nobody closes. The figure is the
                  rate card applied to the credits, so it says "about". */}
              {visible.length < rails.length && grossVisible > 0 && (
                <p className="mt-3 border-t border-border pt-3 text-[11.5px] text-ink-3">
                  {`${rails.length - visible.length} settle net of a fee not yet visible · about ${formatINR(unverifiedTotal, { compact: true })} kept, unchecked`}
                </p>
              )}
            </Card>

            <div className="mt-4 space-y-2.5">
              {ranked.map((r) => (
                <ChannelRow
                  key={r.spec.id}
                  rail={r}
                  claim={claimByRail.get(r.spec.id) ?? 0}
                  expired={expiredByRail.get(r.spec.id) ?? 0}
                  suspicion={suspicions.find((x) => x.channelId === r.spec.id)?.amount ?? 0}
                  unverified={r.connected ? 0 : unverifiedKept(r)}
                  silent={silent.get(r.spec.id)}
                />
              ))}
            </div>

          </>
        )}
      </SectionLayout>
    </AppShell>
  );
}
