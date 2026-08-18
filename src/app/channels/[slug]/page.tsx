"use client";

// One rail: what it agreed to keep, and what it actually kept, settlement by
// settlement.
//
// The rate card is the whole basis of a dispute, so it is stated on the page
// rather than buried — you cannot argue a variance against a number nobody
// showed you.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Check, Lock, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { channelSpec, contractedTake, ordersHeld, reportHeld, unverifiedKept } from "@/lib/channels";
import { channelItems, channelView } from "@/lib/channelNav";
import { ConnectSheet } from "@/components/channels/ConnectSheet";
import { LeakRow } from "@/components/channels/LeakRow";
import { TableFooter, type PageSize } from "@/components/ui/TableFooter";
import { byUrgency, checksUnlockedBy, leaksFor, openClaims } from "@/lib/leaks";
import { bankOnlySuspicion, silentFor } from "@/lib/settlements";
import { daysBetween, fmtDate, formatINR, plural } from "@/lib/format";
import { ANCHOR_DATE } from "@/data/seed";
import type { ConnectMethod } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { useEntity, useStore } from "@/store/useStore";

/** How it got here, said in words rather than a code. */
const METHOD_LABEL: Record<ConnectMethod, string> = {
  upload: "You uploaded the reports",
  agent: "Fetched by the browser agent on your machine",
  api: "Pulled from the API",
};

export default function ChannelPage() {
  const params = useParams<{ slug: string }>();
  const entity = useEntity();
  const channelsConnected = useStore((s) => s.channelsConnected);
  const channelSources = useStore((s) => s.channelSources);
  const connectPortal = useStore((s) => s.connectPortal);
  const disconnectPortal = useStore((s) => s.disconnectPortal);
  const runChannel = useStore((s) => s.runChannel);
  const [running, setRunning] = useState(false);
  const disputes = useStore((s) => s.disputes);
  const setDispute = useStore((s) => s.setDispute);
  const [connecting, setConnecting] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(0);

  const { rails, batches } = useMemo(
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

  const spec = channelSpec(params.slug);
  const rail = rails.find((r) => r.spec.id === params.slug);
  const open = openClaims(leaks, (id) => disputes[`${entity.id}/${id}`] === "recovered");
  const items = channelItems(rails, open.length);

  if (!spec || !rail) {
    return (
      <AppShell>
        <SectionLayout title="Channels" items={items} active={`/channels/${params.slug}`}>
          <Card>
            <p className="text-[13px] font-medium text-ink">No such channel</p>
            <p className="mt-1 text-[12.5px] text-ink-3">Pick one from the list beside this.</p>
          </Card>
        </SectionLayout>
      </AppShell>
    );
  }

  const source = channelSources[`${entity.id}/${spec.id}`];
  // `lastRun` arrived after `since`, so a session persisted before it exists
  // carries a source with no lastRun at all — and `daysBetween(undefined)` is
  // NaN, which rendered as "Last checked NaN days ago". Fall back to when it
  // was connected, which is the honest answer for a source that has never
  // been refreshed since.
  const staleDays = source ? daysBetween(source.lastRun ?? source.since, ANCHOR_DATE) : 0;
  const mine = batches.filter((b) => b.channelId === spec.id);
  const pages = pageSize === null ? 1 : Math.max(1, Math.ceil(mine.length / pageSize));
  const start = pageSize === null ? 0 : Math.min(page, pages - 1) * pageSize;
  const shown = pageSize === null ? mine : mine.slice(start, start + pageSize);
  /* This rail's findings, read from the same `leaks` the register and the
     overview read — not from a second `reconcileOrders` call with its own gate.
     Two calculations of one fact is how the take rate drifted, and this page's
     copy of that gate said `rail.hasOrders` while the register's said something
     subtly different. */
  const mineLeaks = leaks.filter((l) => l.channelId === spec.id);
  const liveHere = mineLeaks
    .filter((l) => l.daysLeft > 0 && disputes[`${entity.id}/${l.id}`] !== "recovered")
    .reduce((s, l) => s + l.amount, 0);
  const contracted = contractedTake(spec) * 100;
  const suspicion = bankOnlySuspicion(entity, spec.id);
  const silence = silentFor(entity, spec.id, ANCHOR_DATE);

  return (
    <AppShell>
      <SectionLayout title="Channels" items={items} active={`/channels/${spec.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-ink-3">
            {`${spec.cycle} · reported by ${spec.reportSource}`}
          </p>
          {!rail.connected && !rail.hasOrders && (
            <Button size="sm" variant="secondary" onClick={() => setConnecting(true)}>
              Connect
            </Button>
          )}
        </div>

        {/* A rail that has stopped paying, on the page you land on to act.
            The overview flagged this and the rail's own page did not — the same
            split that had the overview silent on Amazon's ₹30,600 while this
            page shouted it, in reverse. */}
        {silence && (
          <Card className="mt-4 border-l-2 border-l-warn !py-3">
            <p className="text-[13px] font-medium text-ink">
              {`Nothing from ${spec.name} in ${plural(silence.days, "day")}`}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-3 tnum">
              {`It had been paying every ${plural(silence.typical, "day")} · last credit ${fmtDate(rail.lastCredit ?? ANCHOR_DATE)}`}
            </p>
          </Card>
        )}

        {/* How this rail is connected, and every way to change it.
            This was a green badge and nothing else: once both reports were in,
            the page had no control at all — you could not see how it was
            connected, switch method, refresh it or turn it off. A state you
            can enter and not leave is the same defect as a counter that
            cannot be opened. */}
        {(rail.connected || rail.hasOrders) && (
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-ink">
                <Check size={12} strokeWidth={2.5} className="shrink-0 text-pos" />
                {rail.connected && rail.hasOrders
                  ? "Settlements and orders"
                  : rail.connected
                    ? "Settlements only"
                    : "Orders only"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                {METHOD_LABEL[rail.method ?? "upload"]}
              </p>
              {/* Connected and current are different facts. An agent that
                  refreshes nightly and an upload from three weeks ago both
                  read as "connected", and a reconciliation you cannot date is
                  one you have no reason to trust. */}
              <p
                className={cn(
                  "mt-1 text-[11.5px] tnum",
                  staleDays > 7 ? "text-warn" : "text-ink-3",
                )}
              >
                {running
                  ? "Fetching the latest reports…"
                  : staleDays <= 0
                    ? "Last checked today"
                    : `Last checked ${plural(staleDays, "day")} ago${staleDays > 7 ? " — worth a refresh" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={running}
                onClick={() => {
                  setRunning(true);
                  setTimeout(() => {
                    runChannel(entity.id, spec.id, ANCHOR_DATE);
                    setRunning(false);
                  }, 1400);
                }}
              >
                <RefreshCw size={12} className={cn(running && "animate-spin")} />
                {running ? "Running" : "Run now"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConnecting(true)}>
                {rail.connected && rail.hasOrders ? "Change" : "Add the other report"}
              </Button>
              {/* Escape hatch below the happy path, never beside it (F4) —
                  so it is reachable without being the obvious click. */}
              <button
                onClick={() => disconnectPortal(entity.id, spec.id)}
                className="rounded-md px-1.5 py-1 text-[11.5px] text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </Card>
        )}

        {/* What we found, before what we read it from.
            The page opened with the rate card and then six settlements, five of
            which say "As contracted" — so the one finding that matters was
            below the fold, reached by scanning past the four that do not. The
            findings come first now; the ledger they came from is still here,
            further down, behind its own heading. */}
        {mineLeaks.length > 0 && (
          <>
            <h2 className="mt-6 text-[13px] font-semibold text-ink">
              {`${formatINR(mineLeaks.reduce((s, l) => s + l.amount, 0))} not paid to you`}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {liveHere > 0
                ? `${plural(mineLeaks.length, "claim")} · ${formatINR(liveHere)} still open`
                : `${plural(mineLeaks.length, "claim")} · every window has closed`}
            </p>
            <Card pad="none" className="mt-2.5">
              {byUrgency(mineLeaks).map((l) => (
                <LeakRow
                  key={l.id}
                  leak={l}
                  status={disputes[`${entity.id}/${l.id}`]}
                  showChannel={false}
                  onAdvance={(next) => setDispute(entity.id, l.id, next)}
                />
              ))}
            </Card>
          </>
        )}

        {/* What they agreed to keep — the basis of every claim on this page. */}
        <Card className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            What the contract lets them keep
          </p>
          <div className="mt-2 space-y-1">
            {spec.rateCard.length === 0 && (
              <p className="text-[12.5px] text-ink">
                Nothing. UPI carries no merchant discount rate by law.
              </p>
            )}
            {spec.rateCard.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-ink-2">
                  {l.label}
                  {l.gstOnIt && <span className="text-ink-3"> + 18% GST</span>}
                </span>
                <span className="text-ink tnum">
                  {l.basis === "pct-of-gross" ? `${(l.rate * 100).toFixed(1)}%` : formatINR(l.rate)}
                </span>
              </div>
            ))}
            {(spec.tcs52 || spec.tds194O) && (
              <div className="flex items-baseline justify-between border-t border-border pt-1.5 text-[12.5px]">
                <span className="text-ink-2">
                  {spec.tcs52 && spec.tds194O
                    ? "TCS u/s 52 and TDS u/s 194-O"
                    : spec.tcs52
                      ? "TCS u/s 52"
                      : "TDS u/s 194-O"}
                </span>
                <span className="text-ink-3">Tax paid for you — you claim it back</span>
              </div>
            )}
          </div>
          {spec.rateCard.length > 0 && (
            <p className="mt-2.5 border-t border-border pt-2.5 text-[11.5px] text-ink-3 tnum">
              {`${contracted.toFixed(1)}% of gross, GST included`}
            </p>
          )}
        </Card>

        {rail.connected && !rail.hasOrders && (
          /* D5 — the gap named, with the reason, rather than left blank. */
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">Orders they never paid for</p>
              <p className="text-[11.5px] text-ink-3">
                Needs your order report — a missing settlement leaves no bank line
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setConnecting(true)}>
              Add it
            </Button>
          </Card>
        )}

        {/* Settlements */}
        <h2 className="mt-6 text-[13px] font-semibold text-ink">Settlements</h2>
        {!rail.connected || mine.length === 0 ? (
          <Card className="mt-2.5">
            {/* The honest reason, not a plausible one.
                This said "a period has to close before it can be checked" for
                a rail with 90 daily credits — every period HAD closed. The
                real reason is that a T+1 gateway settles a day at a time with
                the fee already inside it, so there is no batch to rebuild.
                Inventing a tidier explanation is the fake-match sin again. */}
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <Lock size={14} className="text-ink-3" />
              {rail.connected
                ? `${spec.name} settles net, one ${spec.cycle.toLowerCase()} at a time`
                : "We can see the money, not the fee"}
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-3">
              {rail.connected
                ? `${plural(rail.credits.length, "credit")} totalling ${formatINR(rail.received, { compact: true })}, each already net of the fee. At your contracted ${contracted.toFixed(1)}% that is about ${formatINR(Math.round((rail.received / (1 - contracted / 100)) * (contracted / 100)))} kept — worked out from the rate card, not checked against a report.`
                : `${plural(rail.credits.length, "credit")} totalling ${formatINR(rail.received, { compact: true })} arrived. The fee is inside them — ${spec.reportSource} is what shows it.`}
            </p>
            {/* The bank-only finding, on the page that owns this rail.
                The overview showed "₹30,600 below your usual" for Amazon while
                this page — the one you land on to act — showed nothing at all,
                because the settlement list is the only thing that ever carried
                a number and it renders solely when connected. Same fact, both
                places, same words. */}
            {!rail.connected && suspicion.amount > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[12.5px] text-ink">
                  <span className="font-semibold tnum">{formatINR(suspicion.amount)}</span>
                  {` below what ${spec.name} usually pays`}
                </p>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  {`${plural(suspicion.count, "settlement")} below its own history · ${spec.reportSource} names the orders`}
                </p>
              </div>
            )}
            {/* What we would look for, named before it is asked for.
                An unconnected rail said only that the fee was invisible — a
                request for work with the payoff left to inference, the same
                defect the connect sheet had. The checks come from the leak
                table, so this page cannot advertise one the engine will not
                run. */}
            {!rail.connected && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  What the report would check
                </p>
                <div className="mt-1.5 space-y-1">
                  {checksUnlockedBy("settlement").map((c) => (
                    <p key={c} className="flex items-start gap-1.5 text-[12px] text-ink-2">
                      <Check size={12} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink-3" />
                      {c}
                    </p>
                  ))}
                  {!rail.hasOrders &&
                    checksUnlockedBy("orders").map((c) => (
                      <p key={c} className="flex items-start gap-1.5 text-[12px] text-ink-2">
                        <Check size={12} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink-3" />
                        {`${c} — needs your order report`}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          /* The ledger, once the findings above have had their say.
             Every period is here — a reconciliation you cannot audit is one
             nobody believes — but it opens on request rather than pushing the
             finding off the screen. The rows carry the claim amount only, no
             deadline: the clock belongs to the claim type, and the claims
             above own it. */
          <>
            <Card pad="none" className="mt-2.5">
              {shown.map((b) => {
                const found = leaks.filter((l) => l.id.startsWith(`${b.id}-`));
                return (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-ink">
                        {`${fmtDate(b.periodStart)}–${fmtDate(b.periodEnd)}`}
                        <span className="text-ink-3">{` · ${formatINR(b.gross)} gross`}</span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-3 tnum">
                        {`${formatINR(b.received)} landed ${fmtDate(b.creditDate)}`}
                      </p>
                    </div>
                    {found.length === 0 ? (
                      <Badge>
                        <Check size={11} strokeWidth={2.5} className="text-ink-3" /> As contracted
                      </Badge>
                    ) : (
                      /* Names the claims, does not restate their rupees. The
                         row read "₹30,600 short" while the two claims making up
                         that figure sat itemised a few inches above — one fact,
                         twice on one screen, in two different groupings. The
                         count is the link between the ledger and the findings;
                         the money is stated once, where it can be acted on. */
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-neg">
                          {plural(found.length, "claim")}
                        </span>
                        <Link href={`/dispute/${b.id}`}>
                          <Button size="sm" variant="secondary">
                            Pack <ArrowRight size={12} />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
              <TableFooter
                noun="settlement"
                total={mine.length}
                first={start + 1}
                last={start + shown.length}
                page={page}
                pages={pages}
                pageSize={pageSize}
                sizes={[10, 25, 50]}
                onPage={setPage}
                onPageSize={(s) => {
                  setPageSize(s);
                  setPage(0);
                }}
              />
            </Card>
          </>
        )}
        {connecting && (
          <ConnectSheet
            spec={spec}
            unverified={rail.connected ? 0 : unverifiedKept(rail)}
            suspicion={rail.connected ? 0 : suspicion.amount}
            onClose={() => setConnecting(false)}
            onConnected={(source) => {
              // Merge, never replace: a rail connected by API for settlements
              // and later by upload for orders holds both.
              const had = { settlement: rail.connected, orders: rail.hasOrders };
              connectPortal(entity.id, spec.id, {
                ...source,
                settlement: source.settlement || had.settlement,
                orders: source.orders || had.orders,
              });
              setConnecting(false);
            }}
          />
        )}
      </SectionLayout>
    </AppShell>
  );
}
