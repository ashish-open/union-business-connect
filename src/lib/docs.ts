// The document engine.
//
// Vyapar ships eleven document types and eleven screens to match. They are the
// same document: a party, a date, numbered lines, a tax total. What actually
// differs is only three things — whether it posts to the ledger, whether it
// moves stock, and what it converts into. So that is what the spec carries,
// and one list, one editor and one detail view serve all of them.
//
// The other half of the idea is CONVERT, NEVER RETYPE. A quotation becomes a
// sales order becomes an invoice; the lines travel, the number changes, and
// the chain stays visible on both ends.

import { ANCHOR_DATE, Entity, Invoice } from "@/data/seed";
import { Item, itemsFor } from "@/data/items";
import { billsFor } from "@/data/bills";
import { seedDocsFor } from "@/data/docs";
import { rateFor } from "@/lib/compliance";
import { addDays } from "@/lib/format";

export type DocKind =
  // sales
  | "quotation"
  | "salesOrder"
  | "invoice"
  | "deliveryChallan"
  | "cashMemo"
  | "creditNote"
  // purchase
  | "purchaseOrder"
  | "receiptNote"
  | "bill"
  | "debitNote";

export type DocStatus = "draft" | "open" | "settled" | "cancelled";

export interface DocLine {
  /** null for an amount-only line — the shape the seed's invoices arrive in. */
  itemId: string | null;
  description: string;
  qty: number;
  rate: number;
  taxPct: number;
}

export interface Doc {
  id: string;
  kind: DocKind;
  number: string;
  party: string;
  date: string;
  dueDate?: string;
  lines: DocLine[];
  status: DocStatus;
  /** Document number this was converted from — the chain, backwards. */
  convertedFrom?: string;
  /** Amount already received/paid against it. */
  paid: number;
  note?: string;
  /** Carried from the seed so a 1% shortfall reads as TDS, not a debt. */
  tdsSection?: "194C" | "194J";
  /**
   * Line rates already include tax — the toggle Vyapar ships as
   * "inclusive/exclusive tax rates".
   *
   * It is not a preference here, it is arithmetic. Deriving net from a gross
   * and then re-deriving tax rounds twice, and some totals are simply not
   * expressible that way: ₹1,55,200 at 5% has no net that rounds back to it.
   * Extracting tax OUT of a gross always totals the gross exactly.
   */
  taxInclusive?: boolean;
}

export interface DocSpec {
  label: string;
  plural: string;
  side: "sales" | "purchase";
  /** Only some documents are accounting events. A quotation is a promise. */
  postsToLedger: boolean;
  movesStock: "in" | "out" | null;
  convertsTo: DocKind[];
  prefix: string;
  countsForGst: boolean;
  /** What this document is for, in one line. Density law G. */
  sub: string;
  /**
   * Law D3: an empty state says what the missing thing would DO for you, not
   * what it is. Reusing `sub` produced "No quotations yet. A price you offered.
   * Nothing owed yet." — a definition pasted after a void, and the middle
   * sentence meaningless in context.
   */
  emptyBody: string;
}

export const DOC_SPEC: Record<DocKind, DocSpec> = {
  quotation: {
    label: "Quotation", plural: "Quotations", side: "sales",
    postsToLedger: false, movesStock: null, convertsTo: ["salesOrder", "invoice"],
    prefix: "QT", countsForGst: false,
    sub: "A price you offered. Nothing owed yet.",
    emptyBody: "Quote a price without committing anyone to it.",
  },
  salesOrder: {
    label: "Sales order", plural: "Sales orders", side: "sales",
    postsToLedger: false, movesStock: null, convertsTo: ["invoice", "deliveryChallan"],
    prefix: "SO", countsForGst: false,
    sub: "Confirmed, not yet delivered or billed.",
    emptyBody: "Lock in what was agreed before you deliver it.",
  },
  invoice: {
    label: "Invoice", plural: "Invoices", side: "sales",
    postsToLedger: true, movesStock: "out", convertsTo: ["creditNote"],
    prefix: "INV", countsForGst: true,
    sub: "Billed. This is what they owe you.",
    emptyBody: "Bill a customer and it lands in your books and your GST.",
  },
  deliveryChallan: {
    label: "Delivery challan", plural: "Delivery challans", side: "sales",
    postsToLedger: false, movesStock: "out", convertsTo: ["invoice"],
    prefix: "DC", countsForGst: false,
    sub: "Goods sent, not yet billed.",
    emptyBody: "Move goods now and bill for them later.",
  },
  cashMemo: {
    label: "Cash memo", plural: "Cash memos", side: "sales",
    postsToLedger: true, movesStock: "out", convertsTo: [],
    prefix: "CM", countsForGst: true,
    sub: "Sold and paid on the spot.",
    emptyBody: "Ring up a counter sale that is settled as it happens.",
  },
  creditNote: {
    label: "Credit note", plural: "Credit notes", side: "sales",
    postsToLedger: true, movesStock: "in", convertsTo: [],
    prefix: "CN", countsForGst: true,
    sub: "A sale reversed — returns or a correction.",
    emptyBody: "Take back a sale without deleting the invoice it came from.",
  },
  purchaseOrder: {
    label: "Purchase order", plural: "Purchase orders", side: "purchase",
    postsToLedger: false, movesStock: null, convertsTo: ["receiptNote", "bill"],
    prefix: "PO", countsForGst: false,
    sub: "Ordered from a supplier. Nothing owed yet.",
    emptyBody: "Put an order on record before the goods or the bill arrive.",
  },
  receiptNote: {
    label: "Receipt note", plural: "Receipt notes", side: "purchase",
    postsToLedger: false, movesStock: "in", convertsTo: ["bill"],
    prefix: "GRN", countsForGst: false,
    sub: "Goods arrived, bill not yet in.",
    emptyBody: "Book stock in the day it lands, whatever the bill does.",
  },
  bill: {
    label: "Bill", plural: "Bills", side: "purchase",
    postsToLedger: true, movesStock: "in", convertsTo: ["debitNote"],
    prefix: "BILL", countsForGst: true,
    sub: "What you owe a supplier.",
    emptyBody: "Record what a supplier has charged you, then pay it.",
  },
  debitNote: {
    label: "Debit note", plural: "Debit notes", side: "purchase",
    postsToLedger: true, movesStock: "out", convertsTo: [],
    prefix: "DN", countsForGst: true,
    sub: "A purchase reversed — returns to a supplier.",
    emptyBody: "Send goods back without unpicking the bill.",
  },
};

export const SALES_KINDS = (Object.keys(DOC_SPEC) as DocKind[]).filter(
  (k) => DOC_SPEC[k].side === "sales",
);
export const PURCHASE_KINDS = (Object.keys(DOC_SPEC) as DocKind[]).filter(
  (k) => DOC_SPEC[k].side === "purchase",
);

/* ------------------------------------------------------------------ */
/* totals                                                              */
/* ------------------------------------------------------------------ */

export interface DocTotals {
  subtotal: number;
  tax: number;
  total: number;
  /** Genuinely owed by the party — tax withheld at source is NOT owed. */
  outstanding: number;
  /** Withheld under 194C/194J; it reaches us through 26AS. */
  tds: number;
}

export function lineSubtotal(l: DocLine): number {
  return Math.round(l.qty * l.rate);
}

export function docTotals(doc: Doc): DocTotals {
  let subtotal: number;
  let tax: number;
  let total: number;

  if (doc.taxInclusive) {
    total = doc.lines.reduce((s, l) => s + lineSubtotal(l), 0);
    tax = doc.lines.reduce(
      (s, l) => s + Math.round((lineSubtotal(l) * l.taxPct) / (100 + l.taxPct)),
      0,
    );
    subtotal = total - tax;
  } else {
    subtotal = doc.lines.reduce((s, l) => s + lineSubtotal(l), 0);
    tax = doc.lines.reduce((s, l) => s + Math.round((lineSubtotal(l) * l.taxPct) / 100), 0);
    total = subtotal + tax;
  }

  // A 1% shortfall on a 194C/194J invoice is tax withheld, not a debt. Counting
  // it as outstanding would put the document in the chase list and disagree
  // with the Parties screen, which has always excluded it.
  const short = Math.max(0, total - doc.paid);
  const isTds = !!doc.tdsSection && doc.paid > 0 && Math.abs(short - Math.round(total * 0.01)) <= 2;
  const tds = isTds ? short : 0;

  return { subtotal, tax, total, outstanding: short - tds, tds };
}

/* ------------------------------------------------------------------ */
/* seeding — the invoices that already exist become documents           */
/* ------------------------------------------------------------------ */

/**
 * The seed's `Invoice` is an amount, not a line-item document. Rather than
 * invent quantities that would move stock and quietly change the balance
 * sheet, a seeded invoice becomes a single amount-only line. Documents the
 * owner creates in-session carry real items and do move stock.
 */
export function seedDocs(entity: Entity): Doc[] {
  const pct = rateFor(entity);
  return entity.invoices.map((inv: Invoice) => ({
    id: `doc-${inv.number}`,
    kind: "invoice" as DocKind,
    number: inv.number,
    party: inv.customer,
    date: inv.issueDate,
    dueDate: inv.dueDate,
    // The seed records a gross amount and no tax split, so the document says
    // the same thing rather than inventing one.
    taxInclusive: true,
    lines: [{ itemId: null, description: describeFor(entity), qty: 1, rate: inv.total, taxPct: pct }],
    status: inv.received >= inv.total ? ("settled" as DocStatus) : ("open" as DocStatus),
    paid: inv.received,
    tdsSection: inv.tdsSection,
  }));
}

/**
 * Open supplier bills. Paid supplier debits already post to Purchases through
 * the statement, so only what is still owed is seeded here — the same
 * no-double-counting rule the sales side follows.
 */
export function seedPurchaseDocs(entity: Entity): Doc[] {
  return billsFor(entity.id).map((b) => ({
    id: `doc-${b.number}`,
    kind: "bill" as DocKind,
    number: b.number,
    party: b.party,
    date: addDays(ANCHOR_DATE, -b.daysAgo),
    dueDate: addDays(ANCHOR_DATE, -b.daysAgo + b.terms),
    lines: b.lines.map((l) => ({ ...l })),
    status: "open" as DocStatus,
    paid: b.paid ?? 0,
  }));
}

/** The rest of the suite — quotations, orders, challans, memos, notes. */
export function seedOtherDocs(entity: Entity): Doc[] {
  return seedDocsFor(entity.id).map((d) => {
    const total = d.lines.reduce(
      (s, l) => s + Math.round(l.qty * l.rate) + Math.round((l.qty * l.rate * l.taxPct) / 100),
      0,
    );
    return {
      id: `doc-${d.number}`,
      kind: d.kind,
      number: d.number,
      party: d.party,
      date: addDays(ANCHOR_DATE, -d.daysAgo),
      dueDate: d.terms ? addDays(ANCHOR_DATE, -d.daysAgo + d.terms) : undefined,
      lines: d.lines.map((l) => ({ ...l })),
      status: (d.settled ? "settled" : "open") as DocStatus,
      paid: d.settled ? total : (d.paid ?? 0),
      convertedFrom: d.convertedFrom,
    };
  });
}

function describeFor(entity: Entity): string {
  const services = itemsFor(entity.id).filter((i) => i.service);
  return services[0]?.name ?? "Goods and services supplied";
}

/* ------------------------------------------------------------------ */
/* numbering and conversion                                            */
/* ------------------------------------------------------------------ */

/** Next number in a series, continuing whatever the seed already used. */
export function nextNumber(docs: Doc[], kind: DocKind): string {
  const { prefix } = DOC_SPEC[kind];
  const used = docs
    .filter((d) => d.kind === kind)
    .map((d) => Number(d.number.replace(/\D+/g, "")))
    .filter((n) => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 100) + 1;
  return `${prefix}-${next}`;
}

/**
 * Convert without retyping: the lines travel, the number changes, and both
 * ends keep a pointer so the chain is visible from either direction.
 */
export function convert(doc: Doc, to: DocKind, all: Doc[]): Doc {
  return {
    id: `doc-${to}-${doc.number}`,
    kind: to,
    number: nextNumber(all, to),
    party: doc.party,
    date: ANCHOR_DATE,
    dueDate: DOC_SPEC[to].postsToLedger ? addDays(ANCHOR_DATE, 15) : undefined,
    lines: doc.lines.map((l) => ({ ...l })),
    status: "open",
    convertedFrom: doc.number,
    paid: 0,
  };
}

export function chainOf(doc: Doc, all: Doc[]): { from?: Doc; to: Doc[] } {
  return {
    from: all.find((d) => d.number === doc.convertedFrom),
    to: all.filter((d) => d.convertedFrom === doc.number),
  };
}

/* ------------------------------------------------------------------ */
/* helpers for the editor                                              */
/* ------------------------------------------------------------------ */

export function blankLine(item?: Item): DocLine {
  return item
    ? { itemId: item.id, description: item.name, qty: 1, rate: item.rate || item.cost, taxPct: item.gstPct }
    : { itemId: null, description: "", qty: 1, rate: 0, taxPct: 18 };
}

export function newDoc(kind: DocKind, all: Doc[], party = ""): Doc {
  return {
    id: `doc-new-${kind}-${all.length + 1}`,
    kind,
    number: nextNumber(all, kind),
    party,
    date: ANCHOR_DATE,
    dueDate: DOC_SPEC[kind].postsToLedger ? addDays(ANCHOR_DATE, 15) : undefined,
    lines: [blankLine()],
    status: "open",
    paid: 0,
  };
}

/** Stock movements a set of documents causes. */
export function stockMovesFrom(docs: Doc[]): Array<{ itemId: string; date: string; qty: number; ref: string }> {
  const out: Array<{ itemId: string; date: string; qty: number; ref: string }> = [];
  for (const d of docs) {
    const dir = DOC_SPEC[d.kind].movesStock;
    if (!dir || d.status === "cancelled") continue;
    for (const l of d.lines) {
      if (!l.itemId) continue;
      out.push({ itemId: l.itemId, date: d.date, qty: dir === "in" ? l.qty : -l.qty, ref: d.number });
    }
  }
  return out;
}
