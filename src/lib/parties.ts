// Parties — customers and suppliers, derived rather than entered.
//
// Vyapar's first screen after install is "add a party", and Open's is the
// same. Ours has them already: the statement names everyone this business has
// paid or been paid by, and `derivePayees` has been doing half this job for
// the payouts page since Phase 4. A party master nobody typed is the whole
// difference between this and every other books app.
//
// Balances are DERIVED too — a customer's balance is what their invoices still
// have outstanding, not a number somebody keyed at go-live.

import { ANCHOR_DATE, Entity, Invoice } from "@/data/seed";
import { resolveCounterparty } from "@/lib/analysis";
import { daysBetween } from "@/lib/format";
import { Doc, docTotals } from "@/lib/docs";

export type PartyRole = "customer" | "supplier" | "both";

export interface Party {
  name: string;
  role: PartyRole;
  kind: string;
  /** Money they owe us (customers) — positive means receivable. */
  receivable: number;
  /** Money we owe them — filled once bills exist (Phase D). */
  payable: number;
  /** Tax withheld by this customer, tracked for 26AS. */
  tdsHeld: number;
  paidToThem: number;
  receivedFromThem: number;
  txnCount: number;
  lastActivity: string;
  /** Oldest overdue invoice, in days. 0 when nothing is late. */
  oldestOverdue: number;
  masked: string;
  gstin?: string;
}

const SUPPLIER_KINDS = new Set(["vendor", "labour", "transport", "rent", "utility", "ads"]);
const CUSTOMER_KINDS = new Set(["customer", "marketplace", "pg"]);

/** A 1% shortfall on a 194C/194J invoice is tax withheld, not a debt. */
function tdsOn(inv: Invoice): number {
  const short = Math.max(0, inv.total - inv.received);
  const isTds =
    !!inv.tdsSection && inv.received > 0 && Math.abs(short - Math.round(inv.total * 0.01)) <= 2;
  return isTds ? short : 0;
}

export function buildParties(entity: Entity, docs: Doc[] = []): Party[] {
  const map = new Map<string, Party>();

  const touch = (name: string, kind: string): Party => {
    let p = map.get(name);
    if (!p) {
      p = {
        name,
        role: CUSTOMER_KINDS.has(kind) ? "customer" : "supplier",
        kind,
        receivable: 0,
        payable: 0,
        tdsHeld: 0,
        paidToThem: 0,
        receivedFromThem: 0,
        txnCount: 0,
        lastActivity: "",
        oldestOverdue: 0,
        masked: `••${tail(name)}`,
      };
      map.set(name, p);
    }
    return p;
  };

  // 1 — everyone the bank has seen
  for (const t of entity.txns) {
    const r = resolveCounterparty(t.narration);
    if (!SUPPLIER_KINDS.has(r.kind) && !CUSTOMER_KINDS.has(r.kind)) continue;
    const p = touch(r.name, r.kind);
    if (t.direction === "debit") p.paidToThem += t.amount;
    else p.receivedFromThem += t.amount;
    p.txnCount++;
    if (t.date > p.lastActivity) p.lastActivity = t.date;
    // someone we both pay and get paid by is a real thing in SME books
    const asCustomer = t.direction === "credit";
    if ((p.role === "customer") !== asCustomer) p.role = "both";
  }

  // 2 — invoices carry the receivable, and name customers the bank has not
  //     paid us for yet
  for (const inv of entity.invoices) {
    const p = touch(inv.customer, "customer");
    if (p.role === "supplier") p.role = "both";
    const tds = tdsOn(inv);
    const open = Math.max(0, inv.total - inv.received - tds);
    p.receivable += open;
    p.tdsHeld += tds;
    if (inv.issueDate > p.lastActivity) p.lastActivity = inv.issueDate;
    if (open > 0) {
      const late = daysBetween(inv.dueDate, ANCHOR_DATE);
      if (late > p.oldestOverdue) p.oldestOverdue = late;
    }
  }

  // 3 — a credit note reduces what a customer owes; a debit note reduces what
  //     we owe a supplier. Counting invoices without netting the notes made
  //     the Parties screen disagree with the ledger the moment one existed.
  for (const d of docs) {
    if (d.kind !== "creditNote" && d.kind !== "debitNote") continue;
    const p = map.get(d.party);
    if (!p) continue;
    const t = docTotals(d).total;
    if (d.kind === "creditNote") p.receivable -= t;
    else p.payable -= t;
  }

  return [...map.values()].sort(
    (a, b) =>
      b.receivable - a.receivable ||
      b.paidToThem + b.receivedFromThem - (a.paidToThem + a.receivedFromThem),
  );
}

export function partyByName(entity: Entity, name: string): Party | undefined {
  return buildParties(entity).find((p) => p.name === name);
}

export interface PartyTotals {
  customers: number;
  suppliers: number;
  receivable: number;
  payable: number;
  tdsHeld: number;
  overdue: number;
}

export function partyTotals(parties: Party[]): PartyTotals {
  return {
    customers: parties.filter((p) => p.role !== "supplier").length,
    suppliers: parties.filter((p) => p.role !== "customer").length,
    receivable: parties.reduce((s, p) => s + p.receivable, 0),
    payable: parties.reduce((s, p) => s + p.payable, 0),
    tdsHeld: parties.reduce((s, p) => s + p.tdsHeld, 0),
    overdue: parties.filter((p) => p.oldestOverdue > 0).length,
  };
}

function tail(name: string): string {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 10000;
  return String(1000 + (h % 8999));
}
