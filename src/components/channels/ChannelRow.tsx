"use client";

// One rail, as a row: what it paid, what it kept, and whether we can stand
// behind that second number.
//
// The take rate is the number nobody else gives an owner. It stays in ink —
// money is never coloured (B3) — and the only thing that spends the accent is
// the part above what was contracted, because that is the finding.

import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { daysBetween, fmtDate, formatINR, plural } from "@/lib/format";
import { ANCHOR_DATE } from "@/data/seed";
import type { ChannelState } from "@/lib/channels";

export function ChannelRow({
  rail,
  claim,
  expired = 0,
  suspicion = 0,
  unverified = 0,
  silent,
}: {
  rail: ChannelState;
  /** Estimated from the rate card for a rail with no report. Never measured. */
  unverified?: number;
  /** This rail has stopped paying, measured against its own rhythm. */
  silent?: { days: number; typical: number } | null;
  /** Verified against the report, window still open — actionable today. */
  claim: number;
  /** Verified, but past the platform's window. Proven, and no longer a claim. */
  expired?: number;
  /** Visible from the bank alone — a reason to fetch the report, not a claim. */
  suspicion?: number;
}) {
  const stale = rail.lastRun ? daysBetween(rail.lastRun, ANCHOR_DATE) : 0;
  const staleDays = Number.isFinite(stale) ? stale : 0;
  return (
    <Link href={`/channels/${rail.spec.id}`} className="block">
      <Card className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 !py-3 transition-shadow hover:shadow-(--shadow-pop)">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
            {rail.spec.name}
            <Badge variant="outline">{rail.spec.cycle}</Badge>
            {!rail.connected && <Badge tone="warn">Not connected</Badge>}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-3 tnum">
            {rail.lastCredit
              ? `${formatINR(rail.received, { compact: true })} in · last ${fmtDate(rail.lastCredit)}`
              : formatINR(rail.received, { compact: true })}
            {/* Staleness is the thing you would not otherwise notice — a rail
                connected in March still reads "connected" in August.

                A rail that has stopped PAYING outranks it: the date was already
                printed here, in the same grey as every other date, so a courier
                that went quiet seven weeks ago looked exactly like one that paid
                on Tuesday. */}
            {silent ? (
              <span className="text-warn">{` · nothing for ${plural(silent.days, "day")}`}</span>
            ) : (
              staleDays > 7 && (
                <span className="text-warn">{` · checked ${plural(staleDays, "day")} ago`}</span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            {rail.takeRatePct === null ? (
              /* D5: disabled in place, with the reason — never a dash.
                 It said only "Not visible", while this rail's own page put a
                 rupee figure on the same gap. An estimate the reader can act on
                 beats a refusal, as long as it is marked as one: the number is
                 the rate card applied to the money that landed, and the word
                 "unchecked" is doing the honest work. */
              <>
                <p className="text-[12.5px] text-ink-2 tnum">
                  {unverified > 0 ? `≈${formatINR(unverified, { compact: true })} kept` : "Not visible"}
                </p>
                <p className="text-[11px] text-ink-3">
                  {unverified > 0 ? `Unchecked · ${rail.spec.reportSource}` : `Connect ${rail.spec.reportSource}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-ink tnum">
                  {`${rail.takeRatePct.toFixed(1)}% kept`}
                </p>
                {/* The gap over contract, split by whose it is.
                    "27.7% contracted + ads" lumped a legitimate deduction in
                    with an overcharge and named neither. Ads are the platform's
                    to net off; only what was charged above the slab is a claim,
                    and an owner cannot act on the difference until they are
                    told apart. */}
                <p className="text-[11px] text-ink-3 tnum">
                  {`${rail.contractedPct.toFixed(1)}% contracted`}
                  {rail.adsPct !== null && rail.adsPct >= 0.05 && ` · ${rail.adsPct.toFixed(1)}% ads`}
                  {rail.excessPct !== null && rail.excessPct >= 0.05 && (
                    <span className="text-neg">{` · ${rail.excessPct.toFixed(1)}% over`}</span>
                  )}
                </p>
              </>
            )}
          </div>
          {/* Two different facts, and they used to render identically. A claim
              is checked against the rate card and carries orders; a suspicion is
              a settlement below this rail's own history and carries nothing but
              the reason to go and look. Only the first earns the alert colour. */}
          {claim > 0 ? (
            <span className="flex items-center gap-1 text-[11.5px] font-medium text-neg tnum">
              <TriangleAlert size={12} /> {formatINR(claim)}
            </span>
          ) : expired > 0 ? (
            /* Proven and past its window is a THIRD state, and it used to fall
               through to "light" — the word for a hunch — on a rail whose report
               we hold and whose orders we can name. It earns no alert colour,
               because there is nothing left to do about it. */
            <span className="text-right text-[11.5px] text-ink-3 tnum">
              {`${formatINR(expired)} missed`}
            </span>
          ) : suspicion > 0 ? (
            <span className="text-right text-[11.5px] text-ink-3 tnum">
              {`${formatINR(suspicion)} light`}
            </span>
          ) : null}
          <ChevronRight size={14} className="shrink-0 text-ink-3" />
        </div>
      </Card>
    </Link>
  );
}
