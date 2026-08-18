import { ANCHOR_DATE, Entity } from "@/data/seed";
import { Books } from "@/lib/books";
import { Doc, DOC_SPEC, docTotals } from "@/lib/docs";
import { JournalEntry, LedgerRow, TrialBalance } from "@/lib/ledger";
import { daysBetween } from "@/lib/format";
import { Item } from "@/data/items";
// Report definitions — the sub-nav and its screens read from one list, so a
// report can never exist without a way to reach it.

export interface ReportDef {
  slug: string;
  label: string;
  /** One line, shown under the title. Density law G: no paragraphs. */
  sub: string;
  /** Phase F fills the rest; these are live now. */
  live: boolean;
}

export const REPORTS: ReportDef[] = [
  /* First, because it qualifies every report under it. The trial balance proves
     the books are internally correct; this one says how much of the business
     they actually cover, which is the question a correct-but-partial ledger
     cannot answer about itself. */
  { slug: "completeness", label: "Completeness", sub: "How much of the business the books can see", live: true },
  { slug: "trial-balance", label: "Trial balance", sub: "Every account, debit against credit", live: true },
  { slug: "day-book", label: "Day book", sub: "Every entry, newest first", live: true },
  { slug: "balance-sheet", label: "Balance sheet", sub: "What you own against what you owe", live: true },
  { slug: "profit-and-loss", label: "Profit & loss", sub: "Income against costs", live: true },
  { slug: "party-statement", label: "Party statement", sub: "One customer or supplier, in full", live: true },
  { slug: "aging", label: "Aging", sub: "Who owes you, and for how long", live: true },
  { slug: "cash-flow", label: "Cash flow", sub: "Where the money went", live: true },
  { slug: "stock-summary", label: "Stock summary", sub: "Quantity and value on hand", live: true },
  { slug: "item-pl", label: "Item P&L", sub: "Margin by item", live: true },
];

export const reportItems = REPORTS.map((r) => ({
  label: r.label,
  href: `/reports/${r.slug}`,
}));

export function reportBySlug(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

/* ------------------------------------------------------------------ */
/* derivations — all from the ledger, never a second calculation        */
/* ------------------------------------------------------------------ */


export interface Section {
  title: string;
  rows: LedgerRow[];
  total: number;
}

export interface ProfitAndLoss {
  income: Section[];
  expenses: Section[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}

/**
 * `LedgerRow.balance` is positive in the account's OWN normal direction, which
 * makes a contra account lie when you add it up: Drawings is an equity account
 * with a debit balance, so summing balances gave Capital PLUS Drawings when
 * equity is Capital MINUS Drawings. The balance sheet came out over by exactly
 * twice the drawings while the trial balance still tied — a contra account is
 * invisible to a debit-equals-credit check.
 *
 * So sections total by the SECTION's natural side, not the account's.
 */
function sectionsFor(rows: LedgerRow[], types: string[]): Section[] {
  const creditSide = types.some((t) => t === "liability" || t === "equity" || t === "income");
  const signed = (r: LedgerRow) => (creditSide ? r.credit - r.debit : r.debit - r.credit);
  const groups = [...new Set(rows.filter((r) => types.includes(r.type)).map((r) => r.group))];
  return groups.map((g) => {
    const gr = rows.filter((r) => r.group === g && types.includes(r.type));
    return { title: g, rows: gr, total: gr.reduce((s, r) => s + signed(r), 0) };
  });
}

/** The value a row contributes to its section, sign included. */
export function signedIn(row: LedgerRow): number {
  const creditSide =
    row.type === "liability" || row.type === "equity" || row.type === "income";
  return creditSide ? row.credit - row.debit : row.debit - row.credit;
}

export function profitAndLoss(tb: TrialBalance): ProfitAndLoss {
  const income = sectionsFor(tb.rows, ["income"]);
  const expenses = sectionsFor(tb.rows, ["expense"]);
  const totalIncome = income.reduce((s, x) => s + x.total, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.total, 0);
  return { income, expenses, totalIncome, totalExpense, net: totalIncome - totalExpense };
}

export interface BalanceSheet {
  assets: Section[];
  liabilities: Section[];
  equity: Section[];
  totalAssets: number;
  /** Liabilities + equity, INCLUDING the profit the period made. */
  totalClaims: number;
  net: number;
  balanced: boolean;
}

/**
 * Profit is not an account anybody posts to — it is what income exceeded costs
 * by. Until the year closes it belongs to the owner, so it sits in equity as
 * "Profit for the period". Leave it out and the sheet is short by exactly the
 * profit, which is the classic way a hand-rolled balance sheet fails.
 */
export function balanceSheet(tb: TrialBalance): BalanceSheet {
  const pl = profitAndLoss(tb);
  const assets = sectionsFor(tb.rows, ["asset"]);
  const liabilities = sectionsFor(tb.rows, ["liability"]);
  const equity = sectionsFor(tb.rows, ["equity"]);

  const totalAssets = assets.reduce((s, x) => s + x.total, 0);
  const totalClaims =
    liabilities.reduce((s, x) => s + x.total, 0) +
    equity.reduce((s, x) => s + x.total, 0) +
    pl.net;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalClaims,
    net: pl.net,
    balanced: totalAssets === totalClaims,
  };
}

/* ------------------------------------------------------------------ */

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

/** Who owes you and for how long — or whom you owe. */
export function aging(docs: Doc[], side: "sales" | "purchase"): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: "Not due", count: 0, amount: 0 },
    { label: "1–30 days", count: 0, amount: 0 },
    { label: "31–60 days", count: 0, amount: 0 },
    { label: "Over 60 days", count: 0, amount: 0 },
  ];
  for (const d of docs) {
    if (DOC_SPEC[d.kind].side !== side || !DOC_SPEC[d.kind].postsToLedger) continue;
    const open = docTotals(d).outstanding;
    if (open <= 0) continue;
    const late = d.dueDate ? daysBetween(d.dueDate, ANCHOR_DATE) : 0;
    const i = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3;
    buckets[i].count++;
    buckets[i].amount += open;
  }
  return buckets;
}

/* ------------------------------------------------------------------ */

export interface PartyLine {
  date: string;
  detail: string;
  debit: number;
  credit: number;
  running: number;
}

/** One party's whole story: what they were billed, what they paid. */
export function partyStatement(books: Books, party: string): PartyLine[] {
  const docs = books.docs.filter((d) => d.party === party && DOC_SPEC[d.kind].postsToLedger);
  const lines: PartyLine[] = docs.map((d) => {
    const t = docTotals(d);
    const sale = DOC_SPEC[d.kind].side === "sales";
    return {
      date: d.date,
      detail: `${DOC_SPEC[d.kind].label} ${d.number}`,
      debit: sale ? t.total : 0,
      credit: sale ? d.paid : t.total,
      running: 0,
    };
  });
  for (const d of docs) {
    if (DOC_SPEC[d.kind].side === "purchase" && d.paid > 0) {
      lines.push({ date: d.date, detail: `Paid against ${d.number}`, debit: d.paid, credit: 0, running: 0 });
    }
  }
  lines.sort((a, b) => (a.date < b.date ? -1 : 1));
  let run = 0;
  for (const l of lines) {
    run += l.debit - l.credit;
    l.running = run;
  }
  return lines;
}

/* ------------------------------------------------------------------ */

export interface CashRow {
  account: string;
  inflow: number;
  outflow: number;
}

/** Where the money actually went — bank-sourced entries only. */
export function cashFlow(entries: JournalEntry[]): { rows: CashRow[]; in: number; out: number } {
  const map = new Map<string, CashRow>();
  let cin = 0;
  let cout = 0;
  for (const e of entries) {
    if (e.source !== "bank") continue;
    const bank = e.postings.find((p) => p.account === "Bank");
    const other = e.postings.find((p) => p.account !== "Bank");
    if (!bank || !other) continue;
    const row = map.get(other.account) ?? { account: other.account, inflow: 0, outflow: 0 };
    if (bank.debit > 0) {
      row.inflow += bank.debit;
      cin += bank.debit;
    } else {
      row.outflow += bank.credit;
      cout += bank.credit;
    }
    map.set(other.account, row);
  }
  return {
    rows: [...map.values()].sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow)),
    in: cin,
    out: cout,
  };
}

/* ------------------------------------------------------------------ */

export interface ItemMargin {
  item: Item;
  soldQty: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
}

/** Margin by item — only what has actually been sold. */
export function itemMargins(books: Books): ItemMargin[] {
  const byId = new Map(books.stock.rows.map((r) => [r.item.id, r.item]));
  const acc = new Map<string, ItemMargin>();

  for (const d of books.docs) {
    const spec = DOC_SPEC[d.kind];
    if (spec.side !== "sales" || !spec.postsToLedger) continue;
    for (const l of d.lines) {
      if (!l.itemId) continue;
      const item = byId.get(l.itemId);
      if (!item) continue;
      const row =
        acc.get(l.itemId) ??
        ({ item, soldQty: 0, revenue: 0, cost: 0, margin: 0, marginPct: null } as ItemMargin);
      row.soldQty += l.qty;
      row.revenue += Math.round(l.qty * l.rate);
      row.cost += Math.round(l.qty * item.cost);
      acc.set(l.itemId, row);
    }
  }
  return [...acc.values()]
    .map((r) => ({
      ...r,
      margin: r.revenue - r.cost,
      marginPct: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : null,
    }))
    .sort((a, b) => b.margin - a.margin);
}

/** Every party with something open, for the statement picker. */
export function partiesWithActivity(books: Books): string[] {
  return [...new Set(books.docs.map((d) => d.party))].filter(Boolean).sort();
}

export type { Entity };
