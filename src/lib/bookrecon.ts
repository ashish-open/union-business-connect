// Matching bank lines to documents — where the accrual loop closes.
//
// Until now an invoice posted only its OPEN portion, because the bank credit
// that paid the rest had already booked itself to Sales. That was a safe
// shortcut, not the truth: a receipt is not revenue, it is a debtor settling.
//
// Once a credit is matched to an invoice we can post it properly —
//   invoice   Dr Debtors / Cr Sales        (the sale, when it was made)
//   receipt   Dr Bank    / Cr Debtors      (the debt, when it was settled)
// — and Sales stops depending on when money happened to arrive.
//
// The shortcut still holds for anything unmatched, so both worlds coexist and
// the books tie either way. That matters: real statements never match 100%.

import { Entity, Txn } from "@/data/seed";
import { resolveCounterparty } from "@/lib/analysis";
import { Doc, DOC_SPEC, docTotals } from "@/lib/docs";
import { daysBetween } from "@/lib/format";

export interface Match {
  txnId: string;
  docNumber: string;
  amount: number;
  /** 1 = exact amount and party; below that, needs a human. */
  confidence: number;
  reason: string;
}

/** How far apart a document and its payment may sit before we stop believing. */
const WINDOW_DAYS = 45;

export interface MatchResult {
  /** txnId → the match we are confident enough to post. */
  byTxn: Map<string, Match>;
  /** document number → total matched against it. */
  byDoc: Map<string, number>;
  /** Below-threshold candidates a human should confirm or reject. */
  suggested: Match[];
}

export function matchLines(
  entity: Entity,
  docs: Doc[],
  opts: { confirmed?: Record<string, string>; rejected?: Record<string, true> } = {},
): MatchResult {
  const confirmed = opts.confirmed ?? {};
  const rejected = opts.rejected ?? {};
  const byTxn = new Map<string, Match>();
  const byDoc = new Map<string, number>();
  const suggested: Match[] = [];

  const postable = docs.filter((d) => DOC_SPEC[d.kind].postsToLedger && d.status !== "cancelled");

  for (const txn of entity.txns) {
    const r = resolveCounterparty(txn.narration);
    const wantSales = txn.direction === "credit";
    const candidates = postable.filter((d) => {
      const spec = DOC_SPEC[d.kind];
      if (wantSales !== (spec.side === "sales")) return false;
      return Math.abs(daysBetween(d.date, txn.date)) <= WINDOW_DAYS;
    });

    // A human already ruled on this line; their answer wins over any score.
    if (confirmed[txn.id]) {
      const d = postable.find((x) => x.number === confirmed[txn.id]);
      if (d) {
        const m: Match = {
          txnId: txn.id,
          docNumber: d.number,
          amount: txn.amount,
          confidence: 1,
          reason: "You confirmed this",
        };
        byTxn.set(txn.id, m);
        byDoc.set(d.number, (byDoc.get(d.number) ?? 0) + txn.amount);
      }
      continue;
    }
    if (rejected[txn.id]) continue;

    let best: Match | null = null;
    for (const d of candidates) {
      const t = docTotals(d);
      const sameParty = normalise(d.party) === normalise(r.name);
      const exact = txn.amount === t.total;
      // A receipt short by exactly 1% on a 194C invoice is the tax, not a
      // mismatch — the same rule the statement has always used.
      const tdsShort =
        !!d.tdsSection && Math.abs(t.total - txn.amount - Math.round(t.total * 0.01)) <= 2;
      const partial = txn.amount < t.total && txn.amount >= t.total * 0.25;

      let confidence = 0;
      let reason = "";
      if (sameParty && exact) {
        confidence = 1;
        reason = "Same party, exact amount";
      } else if (sameParty && tdsShort) {
        confidence = 1;
        reason = `Same party, short by 1% TDS u/s ${d.tdsSection}`;
      } else if (sameParty && partial) {
        confidence = 0.7;
        reason = "Same party, part payment";
      } else if (exact) {
        confidence = 0.5;
        reason = "Exact amount, different name";
      }
      if (confidence > (best?.confidence ?? 0)) {
        best = { txnId: txn.id, docNumber: d.number, amount: txn.amount, confidence, reason };
      }
    }

    if (!best) continue;
    if (best.confidence >= 1) {
      byTxn.set(txn.id, best);
      byDoc.set(best.docNumber, (byDoc.get(best.docNumber) ?? 0) + best.amount);
    } else {
      suggested.push(best);
    }
  }

  return { byTxn, byDoc, suggested };
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|and|&|co|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Bank lines nobody has explained and nothing matched — the Suspense list. */
export function unexplainedLines(
  entity: Entity,
  matched: MatchResult,
  explained: Record<string, string>,
): Txn[] {
  return entity.txns.filter((t) => {
    if (matched.byTxn.has(t.id) || explained[t.id]) return false;
    const kind = resolveCounterparty(t.narration).kind;
    return kind === "unknown";
  });
}

/**
 * How much money the books cannot explain — the one computation every screen
 * that states it must use.
 *
 * There are two different rupee figures here and only one of them is the gap.
 * `A.suspense`'s trial-balance balance is a LEDGER BALANCE: an unnamed credit
 * posts Cr Suspense, an unnamed debit posts Dr, and the balance is the net of
 * the two. That is correct for a trial balance — it is what makes the books tie
 * — and it is wrong for every sentence a reader interprets as "money nobody can
 * account for", because an unnamed ₹18,400 receipt and an unnamed ₹13,950
 * payment are two holes worth ₹32,350, not one worth ₹4,450.
 *
 * The demo account is what exposed this: it is the first persona with unnamed
 * lines in BOTH directions, so `/reconcile` printed "₹1,10,610 sitting in
 * Suspense" over a list of 54 lines adding to ₹13,57,830, while the
 * completeness gap list printed the same sentence with the second number. Every
 * persona before it happened to have unnamed debits only, where net and gross
 * are the same figure and the drift was invisible.
 *
 * The netting also made the close gate answer the wrong question. Keyed on the
 * balance, a book whose unnamed credits happened to offset its unnamed debits
 * would report "Every line is posted to a real head" with nothing posted at all.
 * So `count` is the gate, not `gross` and never `net`.
 */
export interface SuspenseGap {
  /** The lines themselves, so a screen can list what it is totalling. */
  lines: Txn[];
  /** What blocks a close. Zero lines unnamed, or the month does not close. */
  count: number;
  /** Rupees the books cannot stand behind — magnitudes, never netted. */
  gross: number;
}

export function suspenseGap(
  entity: Entity,
  matched: MatchResult,
  explained: Record<string, string> = {},
): SuspenseGap {
  const lines = unexplainedLines(entity, matched, explained);
  return {
    lines,
    count: lines.length,
    gross: lines.reduce((s, t) => s + t.amount, 0),
  };
}
