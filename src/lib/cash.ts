// The money that never touches the bank.
//
// `Cash in hand` (1010) has been in the chart of accounts since it was written
// and nothing has ever posted to it. Every figure in this product is derived
// from bank lines, which is its great strength — no setup, nothing to type —
// and also the one thing it structurally cannot see. For an Indian sole prop
// that is not a rounding error: a counter sale paid in notes, a coolie paid
// from the till, rent handed over in cash. The books tie perfectly and describe
// a fraction of the business.
//
// So this is the one place the owner types a number in, and it is deliberately
// the smallest possible surface: a date, a direction, an amount, a head. It
// posts a real double entry through the same `opts.manual` channel the journal
// sheet already uses, so nothing in the ledger needed changing to accept it.

import type { JournalEntry } from "@/lib/ledger";
import { A } from "@/lib/coa";

export interface CashEntry {
  id: string;
  date: string;
  /** In = money received in cash. Out = money paid out of the till. */
  direction: "in" | "out";
  amount: number;
  /** The head it belongs to — a revenue account for a sale, an expense for a spend. */
  head: string;
  /** What it was, in the owner's words. Shows on the ledger line. */
  note: string;
}

/** The heads worth offering, in the order a shop actually uses them. */
export const CASH_IN_HEADS = [A.sales, "Other income"] as const;
export const CASH_OUT_HEADS = [
  "Purchases",
  "Site labour",
  "Freight and transport",
  "Rent",
  "Salaries",
  "Other expenses",
] as const;

/**
 * One cash entry as a balanced journal entry.
 *
 * Cash received debits the till and credits the head that earned it; cash paid
 * debits the head that consumed it and credits the till. Both sides always
 * carry the same figure, so the trial balance cannot move — which is what
 * `books-probe` checks the moment an entry exists.
 */
export function cashEntryToJournal(e: CashEntry): JournalEntry {
  const postings =
    e.direction === "in"
      ? [
          { account: A.cash, debit: e.amount, credit: 0 },
          { account: e.head, debit: 0, credit: e.amount },
        ]
      : [
          { account: e.head, debit: e.amount, credit: 0 },
          { account: A.cash, debit: 0, credit: e.amount },
        ];

  return {
    id: `cash-${e.id}`,
    date: e.date,
    narration: e.note || (e.direction === "in" ? "Cash received" : "Cash paid"),
    source: "cash",
    ref: e.id,
    postings,
  };
}

export function cashJournals(entries: CashEntry[] | undefined): JournalEntry[] {
  return (entries ?? []).map(cashEntryToJournal);
}
