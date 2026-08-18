// Compliance — late by design, and derived by design.
//
// Every other product in this market leads with e-invoice, e-way and GST,
// and every one of them asks you to type your invoices in twice. We arrive
// here last and ask for nothing: the return is computed from lines that are
// already explained, the IRN is attached to an invoice we already raised,
// and the e-way bill is inferred from goods we already watched move.
//
// The load-bearing idea: an unexplained line is not a tidiness problem, it
// is input credit you cannot claim. This file turns "needs your eyes" into
// rupees, which is the only argument that ever gets a line explained.

import { ANCHOR_DATE, Entity, Invoice, Txn } from "@/data/seed";
import { addDays } from "@/lib/format";
import { resolveCounterparty, CounterpartyKind, KIND_LABEL } from "@/lib/analysis";
import { buildStatement, needsAttention, LineResolution, StatementRow } from "@/lib/statement";
import { DOC_SPEC, docTotals } from "@/lib/docs";
import type { Books } from "@/lib/books";

/** Period = the anchor month to date, same window the Close uses. */
const PERIOD_DAYS = Number(ANCHOR_DATE.slice(8, 10)) - 1;
export const GST_PERIOD = "July 2026";
/** GSTR-3B and the cash payment are both due on the 20th of the next month. */
export const GST_DUE = "2026-08-20";

/* ------------------------------------------------------------------ */
/* rate                                                                */
/* ------------------------------------------------------------------ */

// Two schemes, because they are not the same product.
//
//   restaurant — supply at 5%, and the law makes that rate conditional on
//                claiming NO input credit at all. Showing a restaurant a
//                stack of claimable purchases would be a lie that costs
//                them a notice, so we show what the 5% deal costs instead.
//   regular    — supply at 18%, credit claimable on registered purchases.
//
// The rate is stated out loud rather than guessed silently: a number the
// owner can see and correct beats a right number they cannot check.
export type Scheme = "restaurant" | "regular";

export function schemeFor(entity: Entity): Scheme {
  return entity.txns.some((t) => /BUNDL|ZOMATO|SWIGGY/i.test(t.narration))
    ? "restaurant"
    : "regular";
}

/** Rate on what this business sells. */
export function rateFor(entity: Entity): number {
  return schemeFor(entity) === "restaurant" ? 5 : 18;
}

// Purchases carry the SUPPLIER's rate, not ours. Electricity is exempt —
// there is nothing on that bill to claim, and saying so is worth more than
// quietly inflating the credit by a few thousand rupees.
const INWARD_RATE: Partial<Record<CounterpartyKind, number>> = {
  utility: 0,
  transport: 5,
  ads: 18,
  rent: 18,
};

/** Tax inside a gross amount, at `pct`. */
function taxIn(gross: number, pct: number): number {
  if (pct === 0) return 0;
  return Math.round(gross - gross / (1 + pct / 100));
}

/* ------------------------------------------------------------------ */
/* what can and cannot be claimed                                      */
/* ------------------------------------------------------------------ */

// Input credit exists only on a registered supplier's tax invoice.
// Salary carries no GST, the GST payment itself is not a purchase, an
// internal transfer is our own money, and site labour is almost never
// registered. Claiming on any of these is how notices start.
const CLAIMABLE: CounterpartyKind[] = ["vendor", "ads", "utility", "transport", "rent"];
const NO_CREDIT: CounterpartyKind[] = ["payroll", "tax", "internal", "labour"];
const OUTWARD: CounterpartyKind[] = ["customer", "marketplace", "pg"];


export interface GstLine {
  label: string;
  gross: number;
  taxable: number;
  tax: number;
  count: number;
}

export interface GstView {
  period: string;
  due: string;
  gstin: string;
  scheme: Scheme;
  ratePct: number;
  outward: GstLine[];
  /** Empty under the restaurant scheme — the rate forbids the claim. */
  inward: GstLine[];
  outputTax: number;
  inputCredit: number;
  /** What the 5% rate costs: credit they could have claimed at 18%. */
  itcForgone: number;
  netPayable: number;
  /** GST debited to CBIC inside the period — that payment settled LAST month. */
  paid: number;
  /** Credit stranded in lines nobody has explained yet. */
  blocked: { count: number; gross: number; tax: number };
  /** Personal spend routed through the business account — never claimable. */
  excluded: { count: number; gross: number; tax: number };
  /** True when nothing was sold from this account — a stock-transfer entity. */
  noSales: boolean;
  rows: StatementRow[];
}

export function buildGst(
  entity: Entity,
  opts: {
    connected: boolean;
    resolutions: Record<string, LineResolution>;
    /**
     * The books. A tax invoice is the taxable event — not the payment that
     * follows it — so where a document exists it is the authority, and the
     * bank line that settles it must not be counted again.
     */
    books?: Books;
  },
): GstView | null {
  if (!entity.gstin) return null;

  const scheme = schemeFor(entity);
  const claimsItc = scheme === "regular";
  const pct = rateFor(entity);
  const { rows } = buildStatement(entity, { ...opts, days: PERIOD_DAYS });

  const outMap = new Map<string, GstLine>();
  const inMap = new Map<string, GstLine>();
  const blocked = { count: 0, gross: 0, tax: 0 };
  const excluded = { count: 0, gross: 0, tax: 0 };
  let itcForgone = 0;
  let paid = 0;

  // Documents first: their tax is stated, not inferred from a rate we guessed.
  const docs = opts.books?.docs ?? [];
  const coveredTxns = new Set([...(opts.books?.matched.byTxn.keys() ?? [])]);

  // A party we have invoiced is covered BY that invoice, whether or not we
  // managed to match the individual payment. Counting both put Anita Menon's
  // two ₹65,000 part payments into output tax on top of the ₹2,60,000 invoice
  // that caused them. Where a document exists it is the taxable event; the
  // money that follows is a settlement, not a second sale.
  const invoicedParties = new Set<string>();
  const billedParties = new Set<string>();
  for (const d of docs) {
    const spec = DOC_SPEC[d.kind];
    if (!spec.countsForGst || d.status === "cancelled") continue;
    const t = docTotals(d);
    if (t.tax === 0) continue;
    const map = spec.side === "sales" ? outMap : inMap;
    if (spec.side === "purchase" && !claimsItc) {
      itcForgone += t.tax;
      continue;
    }
    (spec.side === "sales" ? invoicedParties : billedParties).add(normaliseParty(d.party));
    const label = spec.side === "sales" ? "Billed on invoices" : "Billed by suppliers";
    const line = map.get(label) ?? { label, gross: 0, taxable: 0, tax: 0, count: 0 };
    line.gross += t.total;
    line.tax += t.tax;
    line.taxable += t.subtotal;
    line.count++;
    map.set(label, line);
  }

  for (const row of rows) {
    const { txn, kind } = row;
    // Settled by a document we have already counted.
    if (coveredTxns.has(txn.id)) continue;
    const partyKey = normaliseParty(row.name);
    if (txn.direction === "credit" && invoicedParties.has(partyKey)) continue;
    if (txn.direction === "debit" && billedParties.has(partyKey)) continue;
    const open = needsAttention(row);
    const k = kind as CounterpartyKind;

    if (txn.direction === "credit") {
      // Sales are declared whether or not we have explained them; hiding
      // revenue is the one error this product will not help anyone make.
      if (!OUTWARD.includes(k)) continue;
      push(outMap, KIND_LABEL[k] ?? "Other receipts", txn, pct);
      continue;
    }

    if (kind === "tax") {
      if (/GST/i.test(txn.narration)) paid += txn.amount;
      continue;
    }
    const rate = INWARD_RATE[k] ?? pct;

    if (kind === "personal") {
      excluded.count++;
      excluded.gross += txn.amount;
      excluded.tax += taxIn(txn.amount, 18);
      continue;
    }
    if (NO_CREDIT.includes(k)) continue;

    // An unexplained line is unexplained BECAUSE we could not resolve the
    // counterparty — so its kind is "unknown", which is never in CLAIMABLE.
    // Filtering on kind before checking `open` made this branch unreachable
    // and silently dropped exactly the lines that cost the owner credit.
    // Anything not already ruled out above is a candidate once explained.
    if (claimsItc && open) {
      blocked.count++;
      blocked.gross += txn.amount;
      blocked.tax += taxIn(txn.amount, rate);
      continue;
    }
    if (!CLAIMABLE.includes(k)) continue;

    if (!claimsItc) {
      // Not a loss we hide — a price we name. The 5% rate is only lawful
      // while nothing here is claimed.
      itcForgone += taxIn(txn.amount, INWARD_RATE[k] ?? 18);
      continue;
    }
    push(inMap, KIND_LABEL[k] ?? "Other purchases", txn, rate);
  }

  const outward = [...outMap.values()].sort((a, b) => b.gross - a.gross);
  const inward = [...inMap.values()].sort((a, b) => b.gross - a.gross);
  const outputTax = outward.reduce((s, l) => s + l.tax, 0);
  const inputCredit = inward.reduce((s, l) => s + l.tax, 0);

  return {
    period: GST_PERIOD,
    due: GST_DUE,
    gstin: entity.gstin,
    scheme,
    ratePct: pct,
    outward,
    inward,
    outputTax,
    inputCredit,
    itcForgone,
    netPayable: Math.max(0, outputTax - inputCredit),
    paid,
    blocked,
    excluded,
    noSales: outward.length === 0,
    rows,
  };
}

/** Same normalisation the matcher uses, so the two agree on who is who. */
function normaliseParty(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|and|&|co|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function push(map: Map<string, GstLine>, label: string, txn: Txn, pct: number) {
  const line = map.get(label) ?? { label, gross: 0, taxable: 0, tax: 0, count: 0 };
  const tax = taxIn(txn.amount, pct);
  line.gross += txn.amount;
  line.tax += tax;
  line.taxable += txn.amount - tax;
  line.count++;
  map.set(label, line);
}

/* ------------------------------------------------------------------ */
/* e-invoice                                                           */
/* ------------------------------------------------------------------ */

// An IRN is not paperwork, it is a payment blocker: until the invoice is
// registered, the buyer cannot claim the credit on it, and a buyer who
// cannot claim credit does not pay. So this belongs next to the money, and
// it is stated as a receivables risk rather than a compliance chore.

const B2B = /\b(ltd|llp|pvt|private|limited|developers|constructions|park|technologies|broking|systems|associates|foods|industries|enterprises)\b/i;

export interface EInvoice {
  invoice: Invoice;
  b2b: boolean;
  irn: string | null;
  ackDate?: string;
  outstanding: number;
  /** Tax deducted at source — paid in full, just not to you. Never "open". */
  tds: number;
}

export function eInvoices(entity: Entity): EInvoice[] | null {
  if (!entity.gstin) return null;
  return entity.invoices
    .map((invoice) => {
      const b2b = B2B.test(invoice.customer);
      const short = Math.max(0, invoice.total - invoice.received);
      // A 1% shortfall on a 194C/194J invoice is TDS, not a debt. Calling it
      // "open" would send the owner chasing a customer who paid in full.
      const isTds =
        !!invoice.tdsSection &&
        invoice.received > 0 &&
        Math.abs(short - Math.round(invoice.total * 0.01)) <= 2;
      const tds = isTds ? short : 0;
      const outstanding = isTds ? 0 : short;
      // Registered invoices are the ones the buyer has acted on. Where
      // nothing has been received we have no acknowledgement to show, and
      // we say we cannot confirm one rather than inventing a number.
      const registered = b2b && invoice.received > 0;
      return {
        invoice,
        b2b,
        irn: registered ? irnFor(invoice) : null,
        ackDate: registered ? invoice.issueDate : undefined,
        outstanding,
        tds,
      };
    })
    .sort((a, b) => (a.invoice.issueDate < b.invoice.issueDate ? 1 : -1));
}

/** Deterministic 64-hex IRN, so the same invoice always shows the same one. */
function irnFor(invoice: Invoice): string {
  const seed = `${invoice.number}|${invoice.customer}|${invoice.total}`;
  let h = 2166136261;
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    h ^= seed.charCodeAt(i % seed.length);
    h = Math.imul(h, 16777619) >>> 0;
    out.push("0123456789abcdef"[h % 16]);
  }
  return out.join("");
}

/* ------------------------------------------------------------------ */
/* e-way bill                                                          */
/* ------------------------------------------------------------------ */

// The threshold is ₹50,000 of consignment value, and it only applies if
// goods actually move. A restaurant does not move goods; an interiors firm
// does, every week. Rather than showing everyone an empty form, we decide
// from their own ledger whether this section applies at all — an honest
// "this does not apply to you" is worth more than a feature.

const EWAY_THRESHOLD = 50000;

export interface EwayItem {
  date: string;
  party: string;
  amount: number;
  ref: string;
  /** A freight payment within three days — evidence the goods moved. */
  covered: boolean;
}

export interface EwayView {
  /** False when this business never moves goods — the section is hidden. */
  moves: boolean;
  threshold: number;
  items: EwayItem[];
  uncovered: number;
}

export function buildEway(entity: Entity): EwayView {
  const cutoff = addDays(ANCHOR_DATE, -PERIOD_DAYS);
  const txns = entity.txns.filter((t) => t.date >= cutoff);

  const freight = txns
    .filter((t) => resolveCounterparty(t.narration).kind === "transport")
    .map((t) => t.date);
  if (freight.length === 0) {
    return { moves: false, threshold: EWAY_THRESHOLD, items: [], uncovered: 0 };
  }

  const items = txns
    .filter((t) => t.direction === "debit" && t.amount >= EWAY_THRESHOLD)
    .filter((t) => resolveCounterparty(t.narration).kind === "vendor")
    .map((t) => ({
      date: t.date,
      party: resolveCounterparty(t.narration).name,
      amount: t.amount,
      ref: t.ref,
      covered: freight.some((f) => Math.abs(dayGap(f, t.date)) <= 3),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    moves: true,
    threshold: EWAY_THRESHOLD,
    items,
    uncovered: items.filter((i) => !i.covered).length,
  };
}

function dayGap(a: string, b: string): number {
  return (Date.parse(a) - Date.parse(b)) / 86400000;
}

/* ------------------------------------------------------------------ */
/* expense cards                                                       */
/* ------------------------------------------------------------------ */

// Cards are the only spend that arrives already explained: the merchant,
// the holder and the category are on the line at birth, while every other
// debit has to be reconciled after the fact. That — not cashback — is the
// argument, and it is the same argument as the rest of the product.
//
// Gated twice: the business must be a company or an LLP with a second
// person to hold a card, and there must be evidence of card-shaped spend
// already happening off our rails. No evidence, no offer.

export interface CardEvidence {
  /** Card-rail spend already running through this account. */
  spend: number;
  count: number;
  merchants: string[];
  /** A charge that repeated on the same day — a limit would have stopped it. */
  duplicate: { merchant: string; amount: number; date: string } | null;
  /** Debits that still needed a human to explain them. */
  unexplained: number;
}

export interface CardOffer {
  holder: string;
  evidence: CardEvidence;
}

export function cardOffer(
  entity: Entity,
  opts: { connected: boolean; resolutions: Record<string, LineResolution> },
): CardOffer | null {
  if (entity.constitution === "Proprietorship") return null;
  if (!entity.secondUser) return null;

  const cutoff = addDays(ANCHOR_DATE, -PERIOD_DAYS);
  const cards = entity.txns.filter(
    (t) => t.date >= cutoff && t.direction === "debit" && t.mode === "CARD",
  );
  if (cards.length === 0) return null;

  const seen = new Map<string, Txn>();
  let duplicate: CardEvidence["duplicate"] = null;
  for (const t of cards) {
    const key = `${t.date}|${t.narration}|${t.amount}`;
    if (seen.has(key)) {
      duplicate = {
        merchant: resolveCounterparty(t.narration).name,
        amount: t.amount,
        date: t.date,
      };
    }
    seen.set(key, t);
  }

  const { rows } = buildStatement(entity, { ...opts, days: PERIOD_DAYS });
  const unexplained = rows.filter((r) => r.txn.direction === "debit" && needsAttention(r)).length;

  return {
    holder: entity.secondUser,
    evidence: {
      spend: cards.reduce((s, t) => s + t.amount, 0),
      count: cards.length,
      merchants: [...new Set(cards.map((t) => resolveCounterparty(t.narration).name))],
      duplicate,
      unexplained,
    },
  };
}
