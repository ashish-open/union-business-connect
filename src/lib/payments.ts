// Payouts engine. Payees are DERIVED from payment history — the people you
// already pay are your payees, no data entry. Mode suggestions encode the
// rail realities: mode choice changes when money arrives, and the UI says so.

import { ANCHOR_DATE, Entity } from "@/data/seed";
import { addDays, fmtDate } from "@/lib/format";
import { resolveCounterparty } from "@/lib/analysis";

export interface Payee {
  name: string;
  kind: string;
  masked: string; // deterministic demo account tail
  ifsc: string;
  lastPaid: string;
  totalPaid: number;
  payments: number;
  /** What the BANK calls this account. See `legalNameFor`. */
  legalName: string;
  /** Set when someone accepted a name that did not match, and by whom. */
  mismatchAcceptedBy?: string;
}

const PAYEE_KINDS = new Set(["vendor", "labour", "transport", "rent", "utility"]);

/*
 * What the bank's records call an account, as against what the customer typed.
 *
 * A penny drop's entire purpose is that these two can differ, and a mismatch
 * between them is the commonest reason a payment goes to the wrong place. The
 * flow used to compute the "bank's" answer as `name.toUpperCase()`, so it agreed
 * by construction: the screen performed a verification whose outcome it had
 * already decided. A check that cannot fail is not a check.
 *
 * An explicit table rather than a rule. "Anything ending in Traders registers as
 * TRADING CO" would fire on payees where we have no reason to believe it, and a
 * mismatch warning that cries wolf gets clicked through — which is worse than
 * not having one. These are the accounts we are asserting a registered name for;
 * everything else matches, and says so.
 */
const REGISTERED: Record<string, string> = {
  "sri lakshmi traders": "SRI LAKSHMI TRADING CO",
  "sharma traders": "SHARMA TRADING COMPANY",
  "packman prints": "PACKMAN PRINTS PVT LTD",
  "kannan packaging": "KANNAN PACKAGING INDUSTRIES",
};

/** The bank's name for an account. Upper case, because bank records are. */
export function legalNameFor(typed: string): string {
  const key = typed.trim().toLowerCase().replace(/\s+/g, " ");
  return REGISTERED[key] ?? typed.trim().toUpperCase();
}

/**
 * Whether the bank's name and the typed name are the same account holder.
 *
 * Compared on letters and digits only: "M/s Sharma Traders." and "SHARMA
 * TRADERS" are the same name typed by two people, and flagging that as a
 * mismatch would be the cried wolf above.
 */
export function nameMatches(typed: string, legal: string): boolean {
  const flat = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return flat(typed) === flat(legal);
}

export function derivePayees(entity: Entity): Payee[] {
  const map = new Map<string, Payee>();
  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    const r = resolveCounterparty(t.narration);
    if (!PAYEE_KINDS.has(r.kind)) continue;
    const existing = map.get(r.name);
    if (existing) {
      existing.totalPaid += t.amount;
      existing.payments += 1;
      if (t.date > existing.lastPaid) existing.lastPaid = t.date;
    } else {
      map.set(r.name, {
        name: r.name,
        kind: r.kind,
        masked: `••${accountTail(r.name)}`,
        ifsc: ifscFor(r.name),
        legalName: legalNameFor(r.name),
        lastPaid: t.date,
        totalPaid: t.amount,
        payments: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.totalPaid - a.totalPaid);
}

/** Rail-aware mode suggestion — when the money lands is part of the choice. */
export function modeFor(amount: number): {
  mode: "IMPS" | "NEFT" | "RTGS";
  lands: string;
  alternatives: Array<{ mode: "IMPS" | "NEFT" | "RTGS"; lands: string }>;
} {
  if (amount >= 200000) {
    return {
      mode: "RTGS",
      lands: "lands in real time — for ₹2L and above",
      alternatives: [{ mode: "NEFT", lands: "next half-hour batch" }],
    };
  }
  return {
    mode: "IMPS",
    lands: "lands in seconds, 24×7",
    alternatives: [{ mode: "NEFT", lands: "next half-hour batch" }],
  };
}

/* ------------------------------------------------------------------ */
/* One payment, and what happened to it                                 */
/* ------------------------------------------------------------------ */

export interface PaymentEvent {
  label: string;
  detail?: string;
  /** "done" is history, "now" is where it has got to, "bad" is a return. */
  tone: "done" | "now" | "bad";
}

export interface PaymentRecord {
  id: string;
  payee: string;
  amount: number;
  date: string;
  status: RecentPayment["status"];
  utr?: string;
  note?: string;
  mode?: string;
  lands?: string;
  tag?: string;
  timeline: PaymentEvent[];
}

/**
 * The events behind a payment, derived from what it is rather than stored.
 *
 * A payment had no record of its own anywhere: the list showed a row, and the
 * row was everything the product could say. The question a vendor actually asks
 * — "can you send me the reference?" — had no screen to answer it, and a
 * returned payment showed a reason with no account of when it left, when it came
 * back, or what the money did in between.
 *
 * Three shapes, because there are three endings: it arrived, it is waiting to
 * go, or it came back.
 */
export function paymentTimeline(p: {
  status: RecentPayment["status"];
  date: string;
  payee: string;
  utr?: string;
  note?: string;
  mode?: string;
}): PaymentEvent[] {
  const rail = p.mode ?? "IMPS";
  if (p.status === "returned") {
    return [
      { label: "Submitted", detail: fmtDate(p.date), tone: "done" },
      { label: `Sent on ${rail}`, detail: `To ${p.payee}`, tone: "done" },
      {
        label: "Returned by the bank",
        /* The reason AND where the money is. A return that does not say the
           money is back reads as money lost. */
        detail: `${p.note ?? "Rejected"} · the money is back in your account`,
        tone: "bad",
      },
    ];
  }
  if (p.status === "credited") {
    return [
      { label: "Submitted", detail: fmtDate(p.date), tone: "done" },
      { label: `Sent on ${rail}`, tone: "done" },
      {
        label: "Credited to the payee",
        detail: p.utr ? `UTR ${p.utr}` : undefined,
        tone: "done",
      },
    ];
  }
  return [
    { label: "Submitted", detail: fmtDate(p.date), tone: "done" },
    { label: "Queued for the next payment run", tone: "now" },
  ];
}

export interface RecentPayment {
  id: string;
  payee: string;
  amount: number;
  date: string;
  status: "credited" | "returned" | "queued";
  utr?: string;
  note?: string;
}

/** Recent activity: latest debits as credited payments + the seeded return. */
/**
 * One payment by its id, from wherever it came from.
 *
 * Three sources, because a payment in this product can be a bank debit the
 * statement already carries (`tx-`), a return the bank sent back (`ret-`), or
 * one made in this session that has not settled yet (`sp-`). The detail screen
 * asks for an id and does not care which.
 */
export function paymentById(
  entity: Entity,
  id: string,
  session: Array<{ id: string; payee: string; amount: number; mode: string; lands: string; tag?: string }> = [],
): PaymentRecord | undefined {
  const mine = session.find((p) => p.id === id);
  if (mine) {
    const base = {
      status: "queued" as const,
      date: ANCHOR_DATE,
      payee: mine.payee,
      mode: mine.mode,
    };
    return {
      id,
      payee: mine.payee,
      amount: mine.amount,
      date: ANCHOR_DATE,
      status: "queued",
      mode: mine.mode,
      lands: mine.lands,
      tag: mine.tag,
      timeline: paymentTimeline(base),
    };
  }

  const found = recentPayments(entity, 500).find((p) => p.id === id);
  if (!found) return undefined;
  return {
    ...found,
    timeline: paymentTimeline(found),
  };
}

export function recentPayments(entity: Entity, limit = 7): RecentPayment[] {
  const out: RecentPayment[] = [];
  for (const r of entity.returned) {
    out.push({
      id: `ret-${r.id}`,
      payee: r.payee,
      amount: r.amount,
      date: r.date,
      status: "returned",
      note: r.reason,
    });
  }
  const cutoff = addDays(ANCHOR_DATE, -30);
  for (const t of entity.txns) {
    if (out.length >= limit + entity.returned.length) break;
    if (t.direction !== "debit" || t.date < cutoff) continue;
    const r = resolveCounterparty(t.narration);
    if (!PAYEE_KINDS.has(r.kind) && r.kind !== "payroll") continue;
    out.push({
      id: `tx-${t.id}`,
      payee: r.name,
      amount: t.amount,
      date: t.date,
      status: "credited",
      utr: t.ref,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit + 1);
}

/** Everything `recentPayments` draws from, so a truncated list can say so. */
export function payoutHistoryCount(entity: Entity): number {
  const cutoff = addDays(ANCHOR_DATE, -30);
  let n = entity.returned.length;
  for (const t of entity.txns) {
    if (t.direction !== "debit" || t.date < cutoff) continue;
    const r = resolveCounterparty(t.narration);
    if (PAYEE_KINDS.has(r.kind) || r.kind === "payroll") n += 1;
  }
  return n;
}

/* deterministic demo details — stable per name, no randomness */
function accountTail(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 10000;
  return String(h).padStart(4, "0");
}

const BANKS = ["PUNB0048210", "HDFC0001204", "ICIC0000441", "SBIN0009902", "UTIB0000310"];
function ifscFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 7 + c.charCodeAt(0)) % BANKS.length;
  return BANKS[h];
}
