// The Smart Statement engine: every transaction gets a recon state and,
// where it needs eyes, a typed reason code. States change when a channel
// connects — marketplace lump sums become matched settlements (or short ones
// with order-level evidence). "Unexplained" is the product's most important
// number; this file is where it comes from.

import { ANCHOR_DATE, Entity, Invoice, Txn } from "@/data/seed";
import { addDays } from "@/lib/format";
import { channelFor, reportHeld, type HasReport } from "@/lib/channels";
import { resolveCounterparty, CounterpartyKind, KIND_LABEL } from "@/lib/analysis";
import { buildBatches } from "@/lib/settlements";
import type { ReasonCode } from "@/components/cards/ExceptionCard";
import type { ReconState } from "@/components/statement/StatementLine";

export type LineResolution = "accepted" | "rejected";

export interface StatementRow {
  txn: Txn;
  /**
   * The bank this line was seen at, when it was not ours.
   *
   * Present only on AA-visible lines. Everything else in the product is built
   * from the primary account, so its absence is the normal case and its
   * presence is the whole reason the row reads differently.
   */
  externalBank?: string;
  name: string;
  kind: CounterpartyKind | "unknown";
  recon: ReconState;
  reason?: ReasonCode; // present on rows that need eyes
  batchId?: string; // marketplace credits once the channel is connected
  channelId?: string; // which rail it arrived on, if any
}

export interface StatementData {
  rows: StatementRow[];
  /**
   * The PRIMARY account's money, and only its.
   *
   * The table is multi-bank now; these two are not. A figure that quietly
   * starts including another bank's settlements is a figure that changed
   * meaning without saying so, and every screen comparing against it — the
   * close, the composition bars, the agreement probe — would have moved with
   * it and reported no disagreement at all.
   */
  moneyIn: number;
  moneyOut: number;
  /** Seen at another bank in the same window. Stated, never folded in. */
  externalIn: number;
  externalOut: number;
  needsEyes: number;
  explainedPct: number;
}

export function buildStatement(
  entity: Entity,
  opts: {
    connected: boolean;
    resolutions: Record<string, LineResolution>;
    days?: number;
    /** Which rails' reports are in hand. Defaults to the legacy aggregator flag. */
    hasReport?: HasReport;
  },
): StatementData {
  const cutoff = addDays(ANCHOR_DATE, -(opts.days ?? 30));
  const txns = entity.txns.filter((t) => t.date >= cutoff);

  /* Lines from another bank, kept apart everywhere else and joined only here.
     They are display-only: no batch, no document match, no posting. Reading
     them into `entity.txns` would have handed them to the books, GST, payroll
     and the close — twenty files that would each have absorbed another bank's
     money as though it were this one's. */
  const external = (entity.externalTxns ?? []).filter((t) => t.date >= cutoff);
  const bankOf = new Map(entity.accounts.map((a) => [a.masked, a.bank] as const));

  const batchByRef = new Map(
    buildBatches(entity, opts.hasReport ?? reportHeld({ aggregatorsOn: opts.connected })).map(
      (b) => [b.ref, b] as const,
    ),
  );
  const duplicateIds = findDuplicateIds(txns);
  const partPaymentId = newestPartPaymentId(entity, txns);

  const rows: StatementRow[] = txns.map((t) => {
    const r = resolveCounterparty(t.narration);
    const row: StatementRow = { txn: t, name: r.name, kind: r.kind, recon: { state: "matched" } };

    // Which rail it arrived on, if any — set BEFORE the branches, because the
    // marketplace branch returns early and its rows were coming out without
    // one. A Swiggy line that cannot say it is a Swiggy line is a line that
    // cannot hand you to the page explaining it.
    const rail = t.direction === "credit" ? channelFor(t.narration) : undefined;
    if (rail) row.channelId = rail.id;

    build: {
      if (opts.resolutions[t.id] === "accepted") {
        row.recon = { state: "matched", to: "Explained by you" };
        break build;
      }

      if (r.kind === "marketplace") {
        const batch = batchByRef.get(t.ref);
        if (!batch) {
          row.recon = { state: "unexplained" };
          break build;
        }
        row.batchId = batch.id;
        row.recon =
          batch.variance > 0
            ? { state: "short", by: batch.variance }
            : { state: "matched", to: `Settlement ${fmtPeriod(batch.periodStart, batch.periodEnd)}` };
        if (batch.variance > 0) {
          const causes = new Set(batch.orders.map((o) => o.cause));
          row.reason =
            causes.size > 1
              ? "SETTLEMENT_SHORT_MULTIPLE"
              : causes.has("zero_fee_item")
                ? "FEE_ON_ZERO_RATED_ITEM"
                : "COMMISSION_HIGHER_THAN_CONTRACT";
        }
        break build;
      }

      // What a rail can honestly claim depends on what we can actually see.
      //
      // This used to be one line marking EVERY gateway credit "Matched · Card
      // takings · T+1" — a verification that never happened, on the money rail
      // that matters most. Now each rail says only what its own evidence
      // supports, and `channels.ts` owns which is which.
      if (rail) {
        if (rail.verifiable === "law") {
          // UPI carries zero MDR by law, so the whole collection must arrive.
          // That is a real check, and it needs nobody's portal.
          row.recon = { state: "matched", to: `${rail.name} · UPI carries no MDR` };
        } else {
          // No reason code: this is not a chore the owner can do on this line.
          // The fix is connecting the portal, which lives on /channels — a
          // per-line "needs you" here would be a queue item nobody can clear.
          row.recon = { state: "received", to: `${rail.name} · fee not visible` };
        }
        break build;
      }

      // RERA buyer installments arrive against a unit's virtual account and
      // are split 70/30 on arrival — the project ledger already explains
      // them, so the statement must agree rather than call them unexplained.
      const unit = t.narration.match(/VA UNIT ([A-Z]-\d+)/);
      if (unit && t.direction === "credit") {
        row.recon = { state: "matched", to: `Unit ${unit[1]} · 70% designated, 30% ops` };
        break build;
      }

      if (r.kind === "customer" && t.direction === "credit") {
        const tdsInv = matchTdsInvoice(entity.invoices, t.amount);
        if (tdsInv) {
          row.recon = { state: "matched", to: `${tdsInv.number} · TDS 1% tracked` };
          break build;
        }
        if (/ADV/i.test(t.narration)) {
          row.recon = { state: "unexplained" };
          row.reason = "ADVANCE_RECEIVED";
          break build;
        }
        if (t.id === partPaymentId) {
          row.recon = { state: "suggested", confidence: 92 };
          row.reason = "PART_PAYMENT";
          break build;
        }
        const openInv = entity.invoices.find(
          (i) => i.customer === r.name && i.received > 0 && i.received < i.total,
        );
        if (openInv) {
          row.recon = { state: "matched", to: `${openInv.number} · part payment` };
          break build;
        }
        row.recon = { state: "unexplained" };
        row.reason = "UNKNOWN_CREDIT";
        break build;
      }

      if (duplicateIds.has(t.id)) {
        row.recon = { state: "unexplained" };
        row.reason = "DUPLICATE_SUSPECT";
        break build;
      }

      if (r.kind === "personal") {
        row.recon = { state: "personal" };
        row.reason = "PERSONAL";
        break build;
      }

      if (r.kind === "internal") {
        row.recon = { state: "matched", to: "Internal transfer" };
        break build;
      }

      if (r.kind === "unknown") {
        row.recon = { state: "unexplained" };
        row.reason = t.direction === "debit" ? "BANK_CHARGE" : "UNKNOWN_CREDIT";
        break build;
      }

      // vendors, payroll, rent, utilities, tax, labour, transport, ads
      row.recon = { state: "matched" };
    }

    if (opts.resolutions[t.id] === "rejected" && row.recon.state === "suggested") {
      row.recon = { state: "unexplained" };
    }
    return row;
  });

  /* Appended after the primary rows are built, so nothing above can see them
     and no rule can accidentally claim one. */
  for (const t of external) {
    const r = resolveCounterparty(t.narration);
    rows.push({
      txn: t,
      name: r.name,
      kind: r.kind,
      externalBank: bankOf.get(t.account) ?? "another bank",
      recon: { state: "external", bank: bankOf.get(t.account) ?? "another bank" },
      channelId: t.direction === "credit" ? channelFor(t.narration)?.id : undefined,
    });
  }
  rows.sort((a, b) => (a.txn.date < b.txn.date ? 1 : a.txn.date > b.txn.date ? -1 : 0));

  const own = rows.filter((r) => r.recon.state !== "external");
  const moneyIn = sum(own.filter((r) => r.txn.direction === "credit"));
  const moneyOut = sum(own.filter((r) => r.txn.direction === "debit"));
  const externalIn = sum(rows.filter((r) => r.recon.state === "external" && r.txn.direction === "credit"));
  const externalOut = sum(rows.filter((r) => r.recon.state === "external" && r.txn.direction === "debit"));
  const needsEyes = rows.filter((r) => needsAttention(r)).length;
  const explainedPct = rows.length ? Math.round(((rows.length - needsEyes) / rows.length) * 100) : 100;

  return { rows, moneyIn, moneyOut, externalIn, externalOut, needsEyes, explainedPct };
}

/** One slice of a direction's total — a kind, its rupees, its share. */
export interface Segment {
  /** `"other"` is the collapsed tail, and is never a real kind. */
  kind: CounterpartyKind | "unknown" | "other";
  label: string;
  amount: number;
  /** Share of the direction's total, 0–100. Rounded only for display. */
  pct: number;
  /** What the folded tail contains, so "Other" can say so on hover. */
  tooltip?: string;
  /**
   * Which categorical slot paints this segment, 1-based; 0 for the neutral
   * tail. Assigned by CATEGORY in a fixed order, never by size — a longer
   * window changes which categories clear the floor, and colours that shuffle
   * when the period changes are colours nobody can learn.
   */
  slot: number;
}

/** Below this share a slice is a sliver nobody can read or click. */
const TAIL_FLOOR = 0.04;

/**
 * The order categories are painted in, and therefore the order they are read in.
 *
 * Own transfers sit last however large they are — on one persona they are 42% of
 * money out, and leading with money that never left the business buries the
 * spending.
 */
const CANONICAL: Array<CounterpartyKind | "unknown"> = [
  "marketplace",
  "pg",
  "customer",
  "vendor",
  "payroll",
  "ads",
  "tax",
  "rent",
  "utility",
  "labour",
  "transport",
  "personal",
  "unknown",
  "internal",
];

/**
 * What a direction's money is actually made of.
 *
 * The page had three totals and a progress bar, and could not answer "where did
 * ₹22L go" — the one question a statement summary exists to answer. This is
 * that answer, and it is derived here rather than in the component so the probe
 * can assert the thing that matters: the slices add up to the total printed
 * above them.
 *
 * Own transfers were briefly excluded, on the reasoning that a bar led by money
 * which never left the business says nothing about spending. That was wrong
 * twice over. It left a column with no bar at all wherever a business is funded
 * by its parent — an empty slot beside a full one, which reads as a chart that
 * failed to load. And worse, it broke the one invariant the bar exists to hold:
 * the slices decomposed a total the headline figure did not print. A bar that
 * does not add up to its own number is the fault this replaced.
 *
 * So they are a segment like any other, named plainly and sorted last, because
 * the business categories are what the reader came for.
 */
export function compositionOf(
  rows: StatementRow[],
  direction: "credit" | "debit",
): { segments: Segment[]; total: number } {
  /* Primary account only, because the figure this sits under is primary only.
     A bar decomposing a different total than the number above it is the bug
     this component was rebuilt to remove. */
  const mine = rows.filter((r) => r.txn.direction === direction && r.recon.state !== "external");
  const total = sum(mine);
  if (total <= 0) return { segments: [], total: 0 };

  const by = new Map<CounterpartyKind | "unknown", number>();
  for (const r of mine) by.set(r.kind, (by.get(r.kind) ?? 0) + r.txn.amount);

  /* Ordered by CATEGORY, not by size.
     The palette guarantees separation between ADJACENT slots, which is exactly
     what a stacked bar puts next to each other — so the render order has to be
     the slot order. The legend under the bar carries the ranking instead, which
     is where a reader looks for it anyway. */
  const ranked = [...by.entries()].sort(
    (a, b) => CANONICAL.indexOf(a[0]) - CANONICAL.indexOf(b[0]),
  );
  const head = ranked.filter(([, v]) => v / total >= TAIL_FLOOR);
  const tail = ranked.filter(([, v]) => v / total < TAIL_FLOOR);

  const segments: Segment[] = head.map(([kind, amount], i) => ({
    kind,
    label: KIND_LABEL[kind],
    amount,
    pct: (amount / total) * 100,
    // Slots run out at eight; beyond that a segment paints neutral rather than
    // inventing a ninth hue.
    slot: i < 8 ? i + 1 : 0,
  }));

  // The tail is folded, never dropped — the slices must still sum to the total
  // printed above them, or the bar is quietly lying about a number in ink.
  const tailAmount = tail.reduce((s, [, v]) => s + v, 0);
  if (tailAmount > 0) {
    segments.push({
      kind: "other",
      label: tail.length === 1 ? KIND_LABEL[tail[0][0]] : "Other",
      amount: tailAmount,
      pct: (tailAmount / total) * 100,
      slot: 0,
      tooltip: tail.map(([k, v]) => `${KIND_LABEL[k]} ${Math.round((v / total) * 100)}%`).join(" · "),
    });
  }

  return { segments, total };
}

export function needsAttention(row: StatementRow): boolean {
  return (
    row.recon.state === "unexplained" ||
    row.recon.state === "suggested" ||
    row.recon.state === "short" ||
    row.recon.state === "personal"
  );
}

function sum(rows: StatementRow[]): number {
  return rows.reduce((s, r) => s + r.txn.amount, 0);
}

function fmtPeriod(start: string, end: string): string {
  return `${Number(start.slice(8, 10))}–${Number(end.slice(8, 10))} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(end.slice(5, 7)) - 1]}`;
}

function matchTdsInvoice(invoices: Invoice[], amount: number): Invoice | undefined {
  return invoices.find(
    (i) => i.tdsSection && Math.abs(Math.round(i.total * 0.99) - amount) <= 2 && i.received === amount,
  );
}

/** Same pairing rule as the analysis layer; flags the LATER debit of the pair. */
function findDuplicateIds(txns: Txn[]): Set<string> {
  const out = new Set<string>();
  const debits = txns.filter((t) => t.direction === "debit" && t.amount >= 25000);
  for (let i = 0; i < debits.length; i++) {
    for (let j = i + 1; j < debits.length; j++) {
      const a = debits[i];
      const b = debits[j];
      if (
        a.amount === b.amount &&
        resolveCounterparty(a.narration).name === resolveCounterparty(b.narration).name &&
        Math.abs(daysDiff(a.date, b.date)) <= 3
      ) {
        out.add((a.date >= b.date ? a : b).id);
      }
    }
  }
  return out;
}

/** The newest part-payment credit against a still-open invoice → 92% suggestion. */
function newestPartPaymentId(entity: Entity, txns: Txn[]): string | null {
  const candidates = txns
    .filter((t) => {
      if (t.direction !== "credit" || !/PART PMT/i.test(t.narration)) return false;
      const r = resolveCounterparty(t.narration);
      return entity.invoices.some((i) => i.customer === r.name && i.received < i.total);
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return candidates[0]?.id ?? null;
}

function daysDiff(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000,
  );
}
