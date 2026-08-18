// Statement-native insights — what the agent noticed while reading the
// lines. Rules: computed from the rows in view, each one carries a verb
// (or an honest "tracked" note), max three, ranked by rupee impact.

import { ANCHOR_DATE, Entity } from "@/data/seed";
import { addDays, formatINR } from "@/lib/format";
import { StatementRow } from "@/lib/statement";

export interface Insight {
  id: string;
  fact: string; // leads with the user's own number
  /** Evidence or consequence, ≤7 words (law G2) — three of these sit side by side. */
  sub: string;
  amount: number; // for ranking
  verb?: {
    label: string;
    kind: "filter" | "bulk-personal";
    match?: (row: StatementRow) => boolean;
  };
}

export function buildInsights(entity: Entity, rows: StatementRow[], days: number): Insight[] {
  const out: Insight[] = [];

  /* vendor concentration */
  const debits = new Map<string, number>();
  let moneyOut = 0;
  for (const r of rows) {
    if (r.txn.direction !== "debit") continue;
    moneyOut += r.txn.amount;
    if (r.kind !== "vendor") continue;
    debits.set(r.name, (debits.get(r.name) ?? 0) + r.txn.amount);
  }
  const topVendor = [...debits.entries()].sort((a, b) => b[1] - a[1])[0];
  const supplierTotal = [...debits.values()].reduce((s, v) => s + v, 0);
  if (topVendor && moneyOut > 0 && topVendor[1] / moneyOut >= 0.12) {
    /* Measured against SUPPLIER spend, not against money out.
       The statement now shows what money out is made of, and "Suppliers 51%"
       sits directly above this line. Stated as a share of money out too, the
       two read as rival percentages of one total — 45% and 51%, adjacent,
       different denominators, nothing explaining the gap. Against the supplier
       total it says the thing the bar cannot: one name is most of that slice. */
    out.push({
      id: "vendor-concentration",
      fact: `${topVendor[0]} is ${formatINR(topVendor[1], { compact: true })} of ${formatINR(supplierTotal, { compact: true })} paid to suppliers`,
      sub: `${Math.round((topVendor[1] / supplierTotal) * 100)}% of it goes to one name`,
      amount: topVendor[1],
      verb: { label: "See the lines", kind: "filter", match: (r) => r.name === topVendor[0] && r.txn.direction === "debit" },
    });
  }

  /* TDS tracked */
  const tdsRows = rows.filter((r) => r.recon.state === "matched" && r.recon.to?.includes("TDS"));
  if (tdsRows.length > 0) {
    const total = tdsRows.reduce((s, r) => {
      const inv = entity.invoices.find((i) => i.received === r.txn.amount);
      return s + (inv ? inv.total - inv.received : 0);
    }, 0);
    out.push({
      id: "tds",
      fact: `${formatINR(total)} of TDS tracked across ${tdsRows.length} payment${tdsRows.length > 1 ? "s" : ""}`,
      sub: "Claimable at filing · checked against 26AS",
      amount: total,
      verb: { label: "See the lines", kind: "filter", match: (r) => r.recon.state === "matched" && !!r.recon.to?.includes("TDS") },
    });
  }

  /* personal leakage — with the one-tap bulk verb */
  const personal = rows.filter((r) => r.recon.state === "personal");
  if (personal.length > 0) {
    const total = personal.reduce((s, r) => s + r.txn.amount, 0);
    out.push({
      id: "personal",
      fact: `${formatINR(total)} personal spend mixed in`,
      sub: `${personal.length} debits · keeps the books clean`,
      amount: total,
      verb: { label: `Mark all ${personal.length} personal`, kind: "bulk-personal", match: (r) => r.recon.state === "personal" },
    });
  }

  /* lending-grade balance footprint */
  const mab = balanceFootprint(entity, days);
  if (mab) {
    out.push({
      id: "mab",
      fact: `Average daily balance ${formatINR(mab.avg, { compact: true })} · never below ${formatINR(mab.min, { compact: true })}`,
      sub: "The footprint lenders price on",
      amount: 0, // informational; ranks last
    });
  }

  return out.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

/**
 * End-of-day balances walked back from today's total balance:
 * balance(d−1) = balance(d) − net(d). Deterministic and honest for a demo.
 */
export function balanceFootprint(entity: Entity, days: number): { avg: number; min: number } | null {
  if (entity.txns.length === 0) return null;
  const netByDate = new Map<string, number>();
  for (const t of entity.txns) {
    netByDate.set(t.date, (netByDate.get(t.date) ?? 0) + (t.direction === "credit" ? t.amount : -t.amount));
  }
  let bal = entity.accounts.reduce((s, a) => s + a.balance, 0);
  const balances: number[] = [bal];
  for (let i = 0; i < days - 1; i++) {
    const d = addDays(ANCHOR_DATE, -i);
    bal -= netByDate.get(d) ?? 0;
    balances.push(bal);
  }
  const min = Math.min(...balances);
  if (min < 0) return null; // walk-back artefact — don't show a false number
  return {
    avg: Math.round(balances.reduce((s, b) => s + b, 0) / balances.length),
    min,
  };
}
