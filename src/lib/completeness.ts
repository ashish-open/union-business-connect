// How much of the business the books can actually see.
//
// The trial balance ties, so the books are internally correct — but correct is
// not the same as complete. A settlement whose report we do not hold posts at
// what landed, with the platform's fee invisible. A credit with no invoice
// behind it is revenue nobody can prove. A line nobody can name sits in
// Suspense. Each is a hole, and the books say nothing about any of them.
//
// The competitor prototype this came from prints "87% complete" over three
// tiers of sources, which is the right idea and the wrong number: theirs is a
// literal in a static file, and it implies 100% is reachable while the whole
// view is bank-only. A business that takes cash cannot be 100% complete on a
// bank feed, and a score that says otherwise is the same lie as a progress bar
// filled with the work nobody has to do.
//
// So: the percentage is measured, every gap is named in rupees where rupees can
// be known, and cash sits OUTSIDE the percentage until the owner logs some —
// stated, not silently assumed to be nil.

import { Entity } from "@/data/seed";
import { buildChannels, unverifiedKept, type ChannelSourceLike, type HasReport } from "@/lib/channels";
import { suspenseGap, type MatchResult } from "@/lib/bookrecon";
import type { StatementRow } from "@/lib/statement";
import { formatINR, plural } from "@/lib/format";

/** What a source contributes, and whether it is pulling its weight. */
export type SourceState = "auto" | "connected" | "partial" | "missing";

export interface SourceRow {
  label: string;
  /** What it contributes, in countable terms — never a restatement of the label. */
  detail: string;
  state: SourceState;
  /** Rupees this row leaves unevidenced. Absent where the row is complete. */
  at?: number;
  action?: { label: string; href: string };
}

export interface Tier {
  n: 1 | 2 | 3;
  title: string;
  /** The tier's own summary, right-aligned beside the title. */
  note: string;
  rows: SourceRow[];
}

export interface Completeness {
  /** Evidenced share of bank value, 0–100. Never a share of the business. */
  pct: number;
  evidenced: number;
  total: number;
  /** Rupees the books cannot stand behind, biggest first. */
  atRisk: number;
  tiers: Tier[];
  /**
   * Whether any cash has been logged.
   *
   * False means the percentage above describes the bank only, and every screen
   * showing the percentage has to say so. This is the one thing the source
   * material gets wrong and the reason the number is worth having at all.
   */
  cashTracked: boolean;
}

export function completenessOf(
  entity: Entity,
  opts: {
    /**
     * The statement's own reading of every line, over the full history.
     *
     * Passed in rather than recomputed so this agrees with what the statement
     * screen shows. It also settles a question this cannot answer alone: a RERA
     * buyer installment against a unit's virtual account has no invoice and
     * never will — the project ledger explains it — and counting those as
     * missing documents put ₹3.15Cr of false gap on one persona.
     */
    rows: StatementRow[];
    matched: MatchResult;
    explained: Record<string, string>;
    hasReport: HasReport;
    source?: (channelId: string) => ChannelSourceLike | undefined;
    aggregatorsOn?: boolean;
    /** How many cash entries the owner has logged. */
    cashEntries?: number;
  },
): Completeness {
  const total = entity.txns.reduce((s, t) => s + t.amount, 0);

  /* Tier 1 — every bank line landing on a head of account.
     The hole is the lines nobody can name. `suspenseGap` is shared with
     /reconcile and /close so the three cannot state it differently. */
  const gap = suspenseGap(entity, opts.matched, opts.explained);
  const unnamed = gap.lines;
  const unnamedValue = gap.gross;

  const tier1: Tier = {
    n: 1,
    title: "Bank lines",
    note: "Always on · classified as they arrive",
    rows: [
      {
        label: `${plural(entity.txns.length - unnamed.length, "line")} on a head of account`,
        detail: `${entity.accounts.length > 1 ? `${plural(entity.accounts.length, "account")} · ` : ""}posted as they arrive`,
        state: "auto",
      },
      ...(unnamed.length > 0
        ? [
            {
              label: `${plural(unnamed.length, "line")} nobody can name`,
              detail: `${formatINR(unnamedValue)} sitting in Suspense`,
              state: "missing" as const,
              at: unnamedValue,
              action: { label: "Explain them", href: "/reconcile" },
            },
          ]
        : []),
    ],
  };

  /* Tier 2 — the platforms.
     A rail whose report we hold posts at gross, with the fee broken out. A rail
     without one posts what landed: the revenue is understated by exactly the
     fee, and `unverifiedKept` is already the estimate of that fee. */
  const rails = buildChannels(entity, {
    source: opts.source,
    aggregatorsOn: opts.aggregatorsOn,
  });
  let hiddenFees = 0;
  const tier2rows: SourceRow[] = [];
  for (const r of rails) {
    if (r.spec.verifiable !== "report") continue;
    if (opts.hasReport(r.spec.id)) {
      tier2rows.push({
        label: r.spec.name,
        detail: `${plural(r.credits.length, "settlement")} read at gross · fee broken out`,
        state: "connected",
      });
    } else {
      const fee = unverifiedKept(r);
      hiddenFees += fee;
      tier2rows.push({
        label: r.spec.name,
        detail: `${plural(r.credits.length, "settlement")} · about ${formatINR(fee, { compact: true })} of fee not visible`,
        state: "missing",
        at: fee,
        action: { label: "Connect", href: `/channels/${r.spec.id}` },
      });
    }
  }
  const connectedRails = tier2rows.filter((r) => r.state === "connected").length;
  const tier2: Tier = {
    n: 2,
    title: "Platforms",
    note:
      tier2rows.length === 0
        ? "No platforms pay this business"
        : `${connectedRails} of ${tier2rows.length} reporting`,
    rows: tier2rows,
  };

  /* Tier 3 — what only the owner can supply.
     Money arrived and no document explains it, plus the cash that never touched
     the bank at all. */
  const undocumented = opts.rows.filter(
    (r) =>
      r.txn.direction === "credit" &&
      r.kind === "customer" &&
      (r.recon.state === "unexplained" || r.recon.state === "suggested"),
  );
  const undocumentedValue = undocumented.reduce((s, r) => s + r.txn.amount, 0);
  const cashTracked = (opts.cashEntries ?? 0) > 0;

  const tier3: Tier = {
    n: 3,
    title: "Your side",
    note: "Only you have these",
    rows: [
      ...(undocumented.length > 0
        ? [
            {
              label: `${plural(undocumented.length, "credit")} with no invoice`,
              detail: `${formatINR(undocumentedValue)} received, nothing raised against it`,
              state: "missing" as const,
              at: undocumentedValue,
              action: { label: "Raise them", href: "/sales" },
            },
          ]
        : []),
      cashTracked
        ? {
            label: `${plural(opts.cashEntries ?? 0, "cash entry")} logged`,
            detail: "In the books alongside the bank",
            state: "auto" as const,
          }
        : {
            label: "Cash not tracked",
            detail: "Money that never touched the bank is outside every figure here",
            state: "missing" as const,
            action: { label: "Log cash", href: "/reports" },
          },
    ],
  };

  const atRisk = unnamedValue + hiddenFees + undocumentedValue;
  const evidenced = Math.max(0, total - atRisk);

  /* 100 has to mean nothing is outstanding.
     Two ways it lies otherwise. Six lines in Suspense against a large book
     rounds to 100 and reads as "done" — so never round UP into it. And a
     business whose cash has never been logged cannot be complete on a bank
     feed at all, however clean the bank side is: the caveat line says so, but
     a hero "100%" is louder than any caveat under it. Both cap at 99. */
  const raw = total > 0 ? (evidenced / total) * 100 : 100;
  const settled = atRisk === 0 && cashTracked;
  const pct = settled ? Math.round(raw) : Math.min(99, Math.round(raw));

  return {
    pct,
    evidenced,
    total,
    atRisk,
    tiers: [tier1, tier2, tier3],
    cashTracked,
  };
}

/**
 * How the figure must be described wherever it is shown.
 *
 * A bare "94% complete" on a bank-only view is a claim about the business that
 * the data cannot support. Until cash is logged the percentage is about the
 * bank, and the caller does not get to forget that.
 */
export function completenessCaveat(c: Completeness): string {
  return c.cashTracked ? "of everything in your books" : "of what reached the bank · cash is not counted";
}
