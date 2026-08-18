// The ledger — real double entry, posted from money that already moved.
//
// Vyapar and Open both make the owner key every entry, then reconcile the bank
// afterwards. We have the statement first, and it already resolves the
// counterparty and its kind — which IS the posting rule. So the journal builds
// itself, and the owner only touches what we could not explain.
//
// Two invariants this file exists to protect:
//   1. every entry balances (debit === credit), enforced at construction;
//   2. anything we cannot explain goes to Suspense rather than being guessed
//      into a plausible account. A wrong posting is worse than an open one.

import { Entity, Txn } from "@/data/seed";
import { CounterpartyKind, resolveCounterparty } from "@/lib/analysis";
import { A, account, ACCOUNTS, AccountType } from "@/lib/coa";
import { buildStock, itemById } from "@/lib/stock";
import { Doc, DOC_SPEC, docTotals, stockMovesFrom } from "@/lib/docs";
import type { DeductionLine, SettlementBatch } from "@/lib/settlements";

export interface Posting {
  account: string;
  debit: number;
  credit: number;
}

export type EntrySource = "bank" | "doc" | "manual" | "cash";

export interface JournalEntry {
  id: string;
  date: string;
  narration: string;
  source: EntrySource;
  /** Bank txn id or document number — every figure drills back to evidence. */
  ref?: string;
  /** Present on bank-sourced entries so a report row can open the line. */
  txnId?: string;
  postings: Posting[];
}

/* ------------------------------------------------------------------ */
/* construction                                                        */
/* ------------------------------------------------------------------ */

/** Build a two-legged entry. Throws rather than emit an unbalanced journal. */
export function entry(
  id: string,
  date: string,
  narration: string,
  source: EntrySource,
  postings: Posting[],
  extra?: { ref?: string; txnId?: string },
): JournalEntry {
  const dr = postings.reduce((s, p) => s + p.debit, 0);
  const cr = postings.reduce((s, p) => s + p.credit, 0);
  if (dr !== cr) {
    throw new Error(`Unbalanced entry ${id}: Dr ${dr} ≠ Cr ${cr}`);
  }
  return { id, date, narration, source, postings, ...extra };
}

export function dr(acc: string, amount: number): Posting {
  return { account: acc, debit: amount, credit: 0 };
}
export function cr(acc: string, amount: number): Posting {
  return { account: acc, debit: 0, credit: amount };
}

/* ------------------------------------------------------------------ */
/* posting rules — the statement's `kind` decides the account           */
/* ------------------------------------------------------------------ */

/**
 * Which expense/income head a resolved counterparty belongs to.
 * `null` means we genuinely do not know — the caller posts to Suspense
 * rather than inventing a head.
 */
export function accountForKind(kind: CounterpartyKind | "unknown", dir: "credit" | "debit"): string | null {
  if (dir === "credit") {
    switch (kind) {
      case "customer":
      case "marketplace":
      case "pg":
        return A.sales;
      default:
        return null;
    }
  }
  switch (kind) {
    case "vendor":
      return A.purchases;
    case "payroll":
      return A.salaries;
    case "rent":
      return A.rent;
    case "utility":
      return A.utilities;
    case "ads":
      return A.advertising;
    case "transport":
      return A.freight;
    case "labour":
      return A.labour;
    case "personal":
      return A.drawings;
    case "tax":
      return A.outputGst; // a GST payment discharges the liability
    default:
      return null;
  }
}

/**
 * "Internal transfer" turns out to name three different events, and posting
 * them the same way is what first broke the trial balance:
 *
 *   · Vistara's 70/30 auto-split moves between two accounts the business owns.
 *     Since every owned account collapses into one Bank ledger, this is a
 *     genuine no-op — the money has not left.
 *   · Arka's "self transfer to savings" leaves the business for the owner's
 *     personal account. That is Drawings.
 *   · The commissary's receipt from Nadi Foods comes from a different legal
 *     entity, so it is money owed to a sister company.
 *
 * One classifier, used by BOTH the journal and the opening balance, so the two
 * can never drift apart again.
 */
export interface Classified {
  contra: string;
  /** True when the money never actually left the business's own accounts. */
  bankNeutral: boolean;
}

const OWN_ACCOUNT = /AUTO SPLIT|OWN ACCOUNT|BETWEEN ACCOUNTS/i;
const TO_PERSONAL = /SELF TRANSFER|TO SAVINGS|PERSONAL A\/C/i;

export function classify(txn: Txn, entity: Entity, explained?: string): Classified {
  if (explained) return { contra: explained, bankNeutral: false };

  const r = resolveCounterparty(txn.narration);
  if (r.kind === "internal") {
    const owned = entity.accounts.filter((a) => !a.readOnly).length;
    if (OWN_ACCOUNT.test(txn.narration) && owned > 1) {
      return { contra: A.bank, bankNeutral: true };
    }
    if (TO_PERSONAL.test(txn.narration)) return { contra: A.drawings, bankNeutral: false };
    return { contra: A.interCompany, bankNeutral: false };
  }
  return {
    contra: accountForKind(r.kind, txn.direction) ?? A.suspense,
    bankNeutral: false,
  };
}

/* ------------------------------------------------------------------ */
/* the bank journal                                                    */
/* ------------------------------------------------------------------ */

export interface BankJournalOpts {
  /** Lines the owner explained by hand: txnId → account name. */
  explained?: Record<string, string>;
  /** txnId → the document this payment settles. */
  matched?: Map<string, { docNumber: string }>;
  /**
   * UTR → the settlement report behind that credit. Present only when the
   * channel is actually connected: without the report we do not know the
   * gross, and inventing one would be the Suspense mistake in reverse.
   */
  settled?: Map<string, SettlementBatch>;
  days?: number;
  from?: string;
}

/**
 * Every bank line becomes an entry. The bank leg is always certain — the money
 * did move — so only the contra can be unknown, and that is what Suspense is
 * for.
 */
export function bankJournal(entity: Entity, opts: BankJournalOpts = {}): JournalEntry[] {
  const explained = opts.explained ?? {};
  const txns = opts.from ? entity.txns.filter((t) => t.date >= opts.from!) : entity.txns;

  const matched = opts.matched;
  const settled = opts.settled;

  return txns.map((t) => {
    const batch = settled?.get(t.ref);
    if (batch) return settlementEntry(t, batch);

    const r = resolveCounterparty(t.narration);
    const hit = matched?.get(t.id);
    // A matched receipt is a debtor settling, not revenue arriving.
    const contra = hit
      ? t.direction === "credit"
        ? A.debtors
        : A.creditors
      : classify(t, entity, explained[t.id]).contra;
    const narration = hit
      ? `${r.name} — ${hit.docNumber}`
      : explained[t.id]
        ? `${r.name} — explained by you`
        : r.name;

    return entry(
      `je-bank-${t.id}`,
      t.date,
      narration,
      "bank",
      t.direction === "credit"
        ? [dr(A.bank, t.amount), cr(contra, t.amount)]
        : [dr(contra, t.amount), cr(A.bank, t.amount)],
      { ref: t.ref, txnId: t.id },
    );
  });
}

/**
 * A platform settlement, posted as what actually happened.
 *
 * The old entry was `Dr Bank / Cr Sales` for the amount that landed — so for a
 * business living on Swiggy and Zomato, Sales was understated by a third,
 * `Platform commission` sat in the chart of accounts with nothing ever posted
 * to it, and the GST charged on that commission — input credit the owner is
 * entitled to — was invisible.
 *
 * The sale is the GROSS. What the platform kept is an expense, the GST on it
 * is claimable, and TCS/TDS are not costs at all but taxes already paid on the
 * owner's behalf.
 *
 * The variance goes to commission too: the platform did deduct it, and until a
 * dispute is actually won, booking a receivable for it would be claiming money
 * we have not recovered. The claim lives in the dispute register, not the
 * ledger.
 */
function settlementEntry(t: Txn, b: SettlementBatch): JournalEntry {
  const of = (bucket: DeductionLine["bucket"]) =>
    b.deductions.filter((d) => d.bucket === bucket).reduce((s, d) => s + d.amount, 0);

  const postings: Posting[] = [dr(A.bank, t.amount)];
  const fees = of("fee") + b.variance;
  const gst = of("gst-on-fee");
  const ads = of("ads");
  const tcs = of("tcs");
  const tds = of("tds");

  if (fees > 0) postings.push(dr(A.commission, fees));
  if (gst > 0) postings.push(dr(A.inputGst, gst));
  if (ads > 0) postings.push(dr(A.advertising, ads));
  if (tcs > 0) postings.push(dr(A.tcsReceivable, tcs));
  if (tds > 0) postings.push(dr(A.tdsReceivable, tds));
  postings.push(cr(A.sales, b.gross));

  return entry(
    `je-bank-${t.id}`,
    t.date,
    `${b.channel} settlement ${b.periodStart} to ${b.periodEnd}`,
    "bank",
    postings,
    { ref: t.ref, txnId: t.id },
  );
}

/** The bank movement the journal will actually record, opening excluded. */
export function bankMovement(entity: Entity, from?: string, explained: Record<string, string> = {}): number {
  return entity.txns
    .filter((t) => !from || t.date >= from)
    .reduce((s, t) => {
      if (classify(t, entity, explained[t.id]).bankNeutral) return s;
      return s + (t.direction === "credit" ? t.amount : -t.amount);
    }, 0);
}

/**
 * Opening balances, so the books start from the world as it is rather than
 * from zero. Bank opening is walked back from today's balance through the
 * ledger; the balancing figure is capital.
 */
export function openingEntry(
  entity: Entity,
  from: string,
  explained: Record<string, string> = {},
): JournalEntry | null {
  const moved = bankMovement(entity, from, explained);
  // A non-customer arrives with every account read-only (they bank elsewhere),
  // so "accounts we run" would be nil and the books would open at zero.
  const owned = entity.accounts.filter((a) => !a.readOnly);
  const held = (owned.length ? owned : entity.accounts).reduce((s, a) => s + a.balance, 0);
  const opening = held - moved;
  if (opening === 0) return null;

  return entry(
    "je-opening",
    from,
    "Opening balance",
    "manual",
    opening > 0
      ? [dr(A.bank, opening), cr(A.capital, opening)]
      : [dr(A.capital, -opening), cr(A.bank, -opening)],
    { ref: "OPENING" },
  );
}

/**
 * Stock the business already held when the books open. Valued at cost, with
 * capital as the contra — the owner funded it before this window began.
 */
export function openingStockEntry(entity: Entity, from: string): JournalEntry | null {
  const value = buildStock(entity).rows.reduce(
    (s, r) => s + (r.item.service ? 0 : r.openingQty * r.item.cost),
    0,
  );
  if (value === 0) return null;
  return entry(
    "je-opening-stock",
    from,
    "Opening stock",
    "manual",
    [dr(A.stock, value), cr(A.capital, value)],
    { ref: "OPENING" },
  );
}

/**
 * Goods leaving or arriving post at cost, so the Stock in hand ledger and the
 * shelf can never disagree. Without this the Items screen would show closing
 * stock while the balance sheet still showed opening — two truths, which is
 * the failure mode this whole build exists to avoid.
 *
 * Perpetual inventory, so the direction matters:
 *   goods IN  — the cost moves OUT of Purchases and INTO Stock. A bill is not
 *               an expense while the goods are still on the shelf.
 *   goods OUT — the cost leaves Stock and becomes Cost of goods sold, at the
 *               moment it is actually sold.
 * Posting arrivals against COGS instead left it with a credit balance, which
 * is not a thing a cost account does.
 */
export function stockEntries(entity: Entity, docs: Doc[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const m of stockMovesFrom(docs)) {
    const item = itemById(entity, m.itemId);
    if (!item || item.service) continue;
    const value = Math.abs(m.qty) * item.cost;
    if (value === 0) continue;
    out.push(
      entry(
        `je-stock-${m.ref}-${m.itemId}`,
        m.date,
        `${item.name} — ${m.qty < 0 ? "out" : "in"} on ${m.ref}`,
        "doc",
        m.qty < 0
          ? [dr(A.cogs, value), cr(A.stock, value)]
          : [dr(A.stock, value), cr(A.purchases, value)],
        { ref: m.ref },
      ),
    );
  }
  return out;
}

/**
 * Documents that are accounting events. A quotation is a promise and posts
 * nothing; an invoice is a debt and posts.
 *
 * Only the OPEN portion of an invoice is posted, because the bank credit that
 * paid the rest already booked it to Sales. Splitting tax out of Sales waits
 * for Phase G, when the bank side can split it too — a Sales figure that means
 * gross on one entry and net on the next is worse than one that is
 * consistently gross.
 */
export function docEntries(docs: Doc[], matchedByDoc?: Map<string, number>): JournalEntry[] {
  const out: JournalEntry[] = [];

  for (const d of docs) {
    const spec = DOC_SPEC[d.kind];
    if (!spec.postsToLedger || d.status === "cancelled") continue;
    const { total } = docTotals(d);
    const sales = spec.side === "sales";

    if (d.kind === "creditNote" || d.kind === "debitNote") {
      // A reversal, posted in full — the goods came back.
      out.push(
        entry(
          `je-doc-${d.number}`,
          d.date,
          `${d.party} — ${d.number}`,
          "doc",
          sales
            ? [dr(A.sales, total), cr(A.debtors, total)]
            : [dr(A.creditors, total), cr(A.purchases, total)],
          { ref: d.number },
        ),
      );
      continue;
    }

    // Anything paid that we could NOT match to this document was already
    // booked to Sales by its bank line, so posting it again would double it.
    const matchedAmount = matchedByDoc?.get(d.number) ?? 0;
    const alreadyBooked = Math.max(0, d.paid - matchedAmount);
    const post = total - alreadyBooked;
    const { tds } = docTotals(d);
    if (post <= 0) continue;

    const party = sales ? A.debtors : A.creditors;
    const income = sales ? A.sales : A.purchases;

    if (matchedAmount > 0) {
      // The payment posts against the party account, so the document posts in
      // FULL and the tax withheld relieves the PARTY. Relieving Sales here as
      // well is what left Debtors at −₹3,392.
      out.push(
        entry(
          `je-doc-${d.number}`,
          d.date,
          `${d.party} — ${d.number}`,
          "doc",
          sales ? [dr(party, post), cr(income, post)] : [dr(income, post), cr(party, post)],
          { ref: d.number },
        ),
      );
      if (tds > 0) {
        out.push(
          entry(
            `je-tds-${d.number}`,
            d.date,
            `${d.party} — TDS u/s ${d.tdsSection}`,
            "doc",
            [dr(A.tdsReceivable, tds), cr(party, tds)],
            { ref: d.number },
          ),
        );
      }
      continue;
    }

    // Unmatched: the bank line already credited Sales for whatever was paid,
    // so only the unpaid remainder posts, and the withheld tax comes straight
    // out of Sales.
    const open = post - tds;
    if (open > 0) {
      out.push(
        entry(
          `je-doc-${d.number}`,
          d.date,
          `${d.party} — ${d.number}`,
          "doc",
          sales ? [dr(party, open), cr(income, open)] : [dr(income, open), cr(party, open)],
          { ref: d.number },
        ),
      );
    }
    if (tds > 0) {
      out.push(
        entry(
          `je-tds-${d.number}`,
          d.date,
          `${d.party} — TDS u/s ${d.tdsSection}`,
          "doc",
          [dr(A.tdsReceivable, tds), cr(A.sales, tds)],
          { ref: d.number },
        ),
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface LedgerRow {
  account: string;
  type: AccountType;
  group: string;
  debit: number;
  credit: number;
  /** Signed balance in the account's normal direction. */
  balance: number;
}

export interface TrialBalance {
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  /** Non-zero Suspense is the thing that blocks a close. */
  suspense: number;
}

export function trialBalance(entries: JournalEntry[]): TrialBalance {
  const acc = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    for (const p of e.postings) {
      const cur = acc.get(p.account) ?? { debit: 0, credit: 0 };
      cur.debit += p.debit;
      cur.credit += p.credit;
      acc.set(p.account, cur);
    }
  }

  const rows: LedgerRow[] = [];
  for (const a of ACCOUNTS) {
    const v = acc.get(a.name);
    if (!v || (v.debit === 0 && v.credit === 0)) continue;
    const net = v.debit - v.credit;
    rows.push({
      account: a.name,
      type: a.type,
      group: a.group,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
      balance: a.normal === "debit" ? net : -net,
    });
  }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
    suspense: rows.find((r) => r.account === A.suspense)?.balance ?? 0,
  };
}

/** Every posting touching one account, oldest last — the account ledger. */
export function accountLedger(
  entries: JournalEntry[],
  accountName: string,
): Array<{ entry: JournalEntry; debit: number; credit: number; running: number }> {
  const normal = account(accountName).normal;
  const rows = entries
    .filter((e) => e.postings.some((p) => p.account === accountName))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let running = 0;
  const out = rows.map((e) => {
    const p = e.postings.find((x) => x.account === accountName)!;
    running += normal === "debit" ? p.debit - p.credit : p.credit - p.debit;
    return { entry: e, debit: p.debit, credit: p.credit, running };
  });
  return out.reverse();
}

/** The day book: every entry, newest first. */
export function dayBook(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
