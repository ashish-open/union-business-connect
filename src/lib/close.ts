// The Close — a ritual with a checklist and an artifact, not a dashboard.
// Every item is computed live; the period cannot close while anything is
// unexplained. "Unexplained is the product's most important number" ends
// here, at zero.

import { ANCHOR_DATE, Entity } from "@/data/seed";
import { buildBatches } from "@/lib/settlements";
import { reportHeld } from "@/lib/channels";
import { buildStatement, LineResolution, needsAttention, StatementRow } from "@/lib/statement";
import { formatINR } from "@/lib/format";
import type { Books } from "@/lib/books";
import { exposures } from "@/lib/statutory";

export const CLOSE_PERIOD = "July 2026";
// days back to the 1st of the anchor month (anchor 29 Jul → 28)
const PERIOD_DAYS = Number(ANCHOR_DATE.slice(8, 10)) - 1;

export interface CloseItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  href?: string; // where the remaining work lives
  verb?: string;
  /** Resolve key for a fact that can only be acknowledged, never cleared. */
  ack?: string;
}

export interface CloseState {
  period: string;
  items: CloseItem[];
  ready: boolean;
  rows: StatementRow[]; // period rows — the report and CSV read these
  /** What the month came to. Carried from the statement rather than
      re-summed on the page, because two calculations of one fact drift. */
  moneyIn: number;
  moneyOut: number;
}

export function buildClose(
  entity: Entity,
  opts: {
    connected: boolean;
    resolutions: Record<string, LineResolution>;
    resolved: Record<string, true>;
    /** The books, so a month cannot close over an unfinished ledger. */
    books?: Books;
  },
): CloseState {
  const data = buildStatement(entity, {
    connected: opts.connected,
    resolutions: opts.resolutions,
    days: PERIOD_DAYS,
  });
  const items: CloseItem[] = [];

  /* 1 — every line explained (short settlements are handled by their own
     item — a drafted dispute IS the explanation) */
  const open = data.rows.filter((r) => needsAttention(r) && r.recon.state !== "short");
  items.push({
    id: "lines",
    label: "Every line explained",
    detail:
      open.length === 0
        ? `All ${data.rows.length} lines carry an explanation`
        : `${open.length} of ${data.rows.length} lines still need your eyes`,
    done: open.length === 0,
    href: open.length > 0 ? "/statement?filter=issues" : undefined,
    verb: "Review them",
  });

  /* 2 — channel settlements reconciled (only if the business has channels) */
  const hasChannels = entity.txns.some((t) => /BUNDL|ZOMATO/i.test(t.narration));
  if (hasChannels) {
    if (!opts.connected) {
      items.push({
        id: "settlements",
        label: "Settlements reconciled",
        detail: "Channels not connected — settlements are still lump sums",
        done: false,
        href: "/statement?connect=1",
        verb: "Connect",
      });
    } else {
      const periodBatches = buildBatches(entity, reportHeld({ aggregatorsOn: opts.connected })).filter(
        (b) => b.creditDate >= ANCHOR_DATE.slice(0, 8) + "01",
      );
      const shorts = periodBatches.filter((b) => b.variance > 0);
      items.push({
        id: "settlements",
        label: "Settlements reconciled",
        detail:
          shorts.length > 0
            ? `${periodBatches.length} settlements explained · ${shorts.length} short, dispute packs drafted (${formatINR(
                shorts.reduce((s, b) => s + b.variance, 0),
              )})`
            : `${periodBatches.length} settlements explained, all clean`,
        done: true,
      });
    }
  }

  /* 3 — approvals cleared */
  if (entity.approvals.length > 0) {
    const pending = entity.approvals.filter((a) => !opts.resolved[`${entity.id}/ap-${a.id}`]);
    items.push({
      id: "approvals",
      label: "Payment approvals cleared",
      detail:
        pending.length === 0
          ? "Nothing waiting on you"
          : `${pending.length} batch${pending.length > 1 ? "es" : ""} (${formatINR(pending.reduce((s, a) => s + a.total, 0))}) still wait${pending.length > 1 ? "" : "s"} for approval`,
      done: pending.length === 0,
      href: pending.length > 0 ? "/payouts" : undefined,
      verb: "Approve",
    });
  }

  /* 4 — TDS tracked for 26AS */
  const tds = entity.invoices.filter(
    (i) => i.tdsSection && i.received > 0 && Math.abs(i.received - Math.round(i.total * 0.99)) <= 2,
  );
  if (tds.length > 0) {
    items.push({
      id: "tds",
      label: "TDS credits tracked",
      detail: `${formatINR(tds.reduce((s, i) => s + (i.total - i.received), 0))} across ${tds.length} payer${tds.length > 1 ? "s" : ""} — ready to verify against 26AS`,
      done: true,
    });
  }

  /* 5 — the books themselves. Suspense is the hinge from Phase A: a line
     nobody can name is not a tidiness problem, it is an unposted fact, and
     the month should not close over it. */
  if (opts.books) {
    /* The gate is the COUNT of unnamed lines, not the Suspense balance. An
       unnamed credit and an unnamed debit net each other off in the ledger, so a
       balance of zero is not evidence that anything was posted — see
       `suspenseGap`. The rupee figure is the gross, which is what /reconcile and
       the completeness gap list state. */
    const gap = opts.books.gap;
    items.push({
      id: "suspense",
      label: "Nothing left in Suspense",
      detail:
        gap.count === 0
          ? "Every line is posted to a real head"
          : `${formatINR(gap.gross)} is still waiting to be named`,
      done: gap.count === 0,
      href: gap.count > 0 ? "/reconcile" : undefined,
      verb: "Explain",
    });

    const pending = opts.books.matched.suggested.length;
    if (pending > 0) {
      items.push({
        id: "matches",
        label: "Payments matched to documents",
        detail: `${pending} payment${pending > 1 ? "s" : ""} might settle an invoice or a bill`,
        done: false,
        href: "/reconcile",
        verb: "Review",
      });
    }

    // Statutory exposure blocks a close for the same reason Suspense does:
    // closing over it does not make it go away, it just makes it invisible.
    //
    // But Suspense can be cleared and a tax position cannot — we detect it and
    // we deliberately file nothing. Hardcoding `done: false` therefore meant no
    // business could ever close a month, and the whole files section behind it
    // was unreachable on all five personas. A product that will not file for
    // you does not get to hold your books hostage either.
    //
    // So the exposure is acknowledged rather than resolved: the owner records
    // that they have seen it and are handling it, the close notes that, and
    // the figure stays on /compliance until it is genuinely dealt with.
    for (const x of exposures(entity, opts.books)) {
      if (!x.blocking) continue;
      const key = `close-${x.kind}`;
      const acked = !!opts.resolved[`${entity.id}/${key}`];
      items.push({
        id: `exp-${x.kind}`,
        label: x.headline,
        detail: acked ? `${x.because} — you said you are handling this` : x.because,
        done: acked,
        href: x.href,
        verb: "Look",
        ack: acked ? undefined : key,
      });
    }

    items.push({
      id: "books",
      label: "The books balance",
      detail: opts.books.tb.balanced
        ? `Debit and credit agree at ${formatINR(opts.books.tb.totalDebit)}`
        : "Debit and credit disagree",
      done: opts.books.tb.balanced,
      href: "/reports/trial-balance",
      verb: "Open",
    });
  }

  return {
    period: CLOSE_PERIOD,
    items,
    ready: items.every((i) => i.done),
    rows: data.rows,
    moneyIn: data.moneyIn,
    moneyOut: data.moneyOut,
  };
}

/*
 * The Tally/CA-ready ledger export now lives in `lib/csv.ts` as `statementCsv`.
 *
 * It moved because the statement itself needed to export the same rows, and a
 * second serialiser would have been a second answer to "what is a statement
 * line, in a spreadsheet" — the shape this codebase keeps getting wrong.
 */
