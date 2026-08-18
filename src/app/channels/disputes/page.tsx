"use client";

// The claims register.
//
// It listed one claim per settlement, because the engine had one finding per
// settlement: "₹30,600 over". But a settlement is not a claim — it is a period
// that may contain several, going to different desks on different clocks.
// Amazon's ₹30,600 is really ₹19,888 of fee charged above the slab, which had
// two days left, and ₹10,712 of referral fee charged on items the platform
// zero-rated, which had thirty-two. Reported as one line, the stronger of the
// two inherited the weaker one's deadline and would have been abandoned a month
// early.
//
// So the unit here is the LEAK, and the window belongs to the claim type.

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Check, Link2 } from "lucide-react";
import { LeakRow } from "@/components/channels/LeakRow";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ordersHeld, reportHeld } from "@/lib/channels";
import { channelItems, channelView } from "@/lib/channelNav";
import { byUrgency, leaksFor, openClaims, splitByWindow } from "@/lib/leaks";
import { suspicionsFor } from "@/lib/settlements";
import { formatINR, plural } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";

export default function DisputesPage() {
  const entity = useEntity();
  const channelsConnected = useStore((s) => s.channelsConnected);
  const channelSources = useStore((s) => s.channelSources);
  const disputes = useStore((s) => s.disputes);
  const setDispute = useStore((s) => s.setDispute);

  const { rails } = useMemo(
    () =>
      entity
        ? channelView(entity, channelSources, !!channelsConnected[entity.id])
        : { rails: [], batches: [] },
    [entity, channelSources, channelsConnected],
  );

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

  const statusOf = (id: string) => disputes[`${entity.id}/${id}`];
  const open = openClaims(leaks, (id) => statusOf(id) === "recovered");
  const items = channelItems(rails, open.length);

  const { live, closed } = splitByWindow(leaks);
  const claimable = live
    .filter((l) => statusOf(l.id) !== "recovered")
    .reduce((s, l) => s + l.amount, 0);
  const recovered = leaks
    .filter((l) => statusOf(l.id) === "recovered")
    .reduce((s, l) => s + l.amount, 0);
  const expired = closed.reduce((s, l) => s + l.amount, 0);

  // Whether anything has actually been checked — the difference between an
  // achievement and an absence of evidence.
  const checked = rails.some((r) => r.connected && r.spec.verifiable === "report");
  const suspicions = suspicionsFor(entity);
  const suspicionTotal = suspicions.reduce((sum, r) => sum + r.amount, 0);
  const suspicionCount = suspicions.reduce((sum, r) => sum + r.count, 0);

  return (
    <AppShell>
      <SectionLayout title="Channels" items={items} active="/channels/disputes">
        {leaks.length === 0 ? (
          checked ? (
            /* Achievement, so no CTA is invented (D1). */
            <Card className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pos-soft text-pos">
                <Check size={20} strokeWidth={2.5} />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-ink">Nothing to claim</p>
              <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-ink-3">
                Every settlement came in at the contracted rate.
              </p>
            </Card>
          ) : (
            <Card className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                <Link2 size={20} />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-ink">
                {suspicionTotal > 0 ? `${formatINR(suspicionTotal)} looks light` : "Nothing checked yet"}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-ink-3">
                {suspicionTotal > 0
                  ? `${plural(suspicionCount, "settlement")} below their own history · the report names the orders`
                  : "The rate card lives in the platform's own report."}
              </p>
              <Link href="/channels" className="mt-3">
                <Button size="sm" variant="secondary">
                  Connect a report <ArrowRight size={12} />
                </Button>
              </Link>
            </Card>
          )
        ) : (
          <>
            {/* Leads with the open count, because that is the number the
                sub-nav carries. "5 claims across 2 rails" beside "Disputes · 3"
                reads as a contradiction until the screen says which 3. */}
            <p className="text-[12.5px] text-ink-3">
              {`${open.length} still open · ${plural(leaks.length, "claim")} across ${plural(new Set(leaks.map((l) => l.channelId)).size, "rail")}`}
            </p>

            <Card className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    Claimable
                  </p>
                  <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                    {formatINR(claimable)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    Recovered
                  </p>
                  <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                    {formatINR(recovered)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    Window closed
                  </p>
                  <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                    {formatINR(expired)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {expired > 0 ? "Found too late" : "Nothing lost to the clock"}
                  </p>
                </div>
              </div>
            </Card>

            {/* A pipeline, not one list sorted by size.
                Ordered by amount, a ₹24,100 claim whose desk shut weeks ago sat
                above a ₹19,888 one with two days left — the register's whole job
                is "what do I do today", and it was answering "where is the most
                money". Open claims run soonest-deadline first; the closed ones
                are a separate group, kept because they are the argument for
                connecting sooner, not because anything can be done about them. */}
            {live.length > 0 && (
              <Card pad="none" className="mt-4">
                {byUrgency(live).map((l) => (
                  <LeakRow
                    key={l.id}
                    leak={l}
                    status={statusOf(l.id)}
                    onAdvance={(next) => setDispute(entity.id, l.id, next)}
                  />
                ))}
              </Card>
            )}

            {closed.length > 0 && (
              <>
                {/* Heading only. The KPI above already carries the rupees, and
                    each row carries its own count — restating either here would
                    print one fact twice on one screen. */}
                <h2 className="mt-6 text-[13px] font-semibold text-ink">Past their window</h2>
                <Card pad="none" className="mt-2.5">
                  {byUrgency(closed).map((l) => (
                    <LeakRow key={l.id} leak={l} status={statusOf(l.id)} />
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </SectionLayout>
    </AppShell>
  );
}
