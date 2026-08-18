// Payouts engine. Payees are DERIVED from payment history — the people you
// already pay are your payees, no data entry. Mode suggestions encode the
// rail realities: mode choice changes when money arrives, and the UI says so.

import { ANCHOR_DATE, Entity } from "@/data/seed";
import { addDays } from "@/lib/format";
import { resolveCounterparty } from "@/lib/analysis";

export interface Payee {
  name: string;
  kind: string;
  masked: string; // deterministic demo account tail
  ifsc: string;
  lastPaid: string;
  totalPaid: number;
  payments: number;
}

const PAYEE_KINDS = new Set(["vendor", "labour", "transport", "rent", "utility"]);

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
