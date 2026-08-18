// The four things the books do not catch.
//
// A ledger that ties tells you the arithmetic is sound. It says nothing about
// the money leaving silently because a rule was missed — and every one of
// these is money the owner never sees go:
//
//   · tax you were required to deduct and did not
//   · salaries paid with no PF, ESI or professional tax behind them
//   · input credit on a bill whose supplier never filed
//   · a micro supplier paid late enough to lose the whole deduction
//
// All four are computable from lines we already hold. None of them posts to
// the ledger: these are entries that were NEVER MADE, and asserting them would
// claim deductions that did not happen. The books must tie unchanged.

import { ANCHOR_DATE, Entity, Txn } from "@/data/seed";
import { resolveCounterparty, CounterpartyKind } from "@/lib/analysis";
import { Books } from "@/lib/books";
import { docTotals } from "@/lib/docs";
import { supplierMeta } from "@/data/bills";
import { daysBetween, formatINR, plural } from "@/lib/format";

export type ExposureKind = "tds" | "payroll" | "itc" | "msme";

export interface Exposure {
  kind: ExposureKind;
  /** Rupees genuinely at risk. */
  amount: number;
  count: number;
  /**
   * The fact, in the fewest words that carry it — law G2, and it now means it.
   * The plainest available wording belongs HERE: this used to read "42 salaries
   * paid, nothing statutory behind them" over a grey line saying "PF, ESI and
   * professional tax carry arrears and 12% interest", which is the sentence
   * anyone can actually read. The clear one was in the small text.
   */
  headline: string;
  /** Why it costs money, or what counted it. Evidence or consequence, never a restatement. */
  because: string;
  href: string;
  blocking: boolean;
  /** True where the number is modelled rather than read. Said out loud. */
  estimated?: boolean;
}

/* ------------------------------------------------------------------ */
/* 1 — tax you were required to deduct                                 */
/* ------------------------------------------------------------------ */

export interface TdsSection {
  code: "194C" | "194J" | "194I";
  label: string;
  rate: number;
  /** No deduction below this on a single payment. */
  single: number;
  /** …or below this in aggregate across the year. */
  annual: number;
}

// 194C is 1% to an individual or HUF and 2% to anyone else. Site labour is
// individuals; a supplier or transporter is a firm. Using one rate for both
// overstates the smaller party's liability, which is the wrong way to be wrong.
export const SECTIONS: Record<string, TdsSection> = {
  "194C-ind": { code: "194C", label: "Contract work — individual", rate: 1, single: 30000, annual: 100000 },
  "194C": { code: "194C", label: "Contract work", rate: 2, single: 30000, annual: 100000 },
  "194J": { code: "194J", label: "Professional fees", rate: 10, single: 30000, annual: 30000 },
  "194I": { code: "194I", label: "Rent", rate: 10, single: 240000, annual: 240000 },
};

// Professional services sit under 194J at 10%, not 194C at 2% — and the
// counterparty kinds do not distinguish them, so an architect was being taxed
// as a contractor at a fifth of the right rate. The name is the only signal we
// have, so it is the one we use.
const PROFESSIONAL =
  /ARCHITECT|CONSULT|ADVISOR|ASSOCIATES|CHARTERED|LEGAL|ADVOCATE|DESIGN STUDIO|AUDIT/i;

/** Which section a payment falls under, from the counterparty we resolved. */
export function sectionFor(
  kind: CounterpartyKind | "unknown",
  name = "",
): TdsSection | null {
  if (PROFESSIONAL.test(name) && kind !== "payroll" && kind !== "customer") {
    return SECTIONS["194J"];
  }
  switch (kind) {
    case "labour":
      return SECTIONS["194C-ind"];
    case "vendor":
    case "transport":
      return SECTIONS["194C"];
    case "rent":
      return SECTIONS["194I"];
    default:
      return null;
  }
}

export interface TdsLine {
  txn: Txn;
  party: string;
  section: TdsSection;
  /** What should have been withheld from this payment. */
  due: number;
}

export interface TdsView {
  lines: TdsLine[];
  due: number;
  /** Already deposited — a challan in the statement, if there is one. */
  deposited: number;
  /** Payments that DID cross a threshold, grouped by party. */
  parties: Array<{ name: string; section: TdsSection; paid: number; due: number; count: number }>;
}

const TDS_CHALLAN = /TDS|CHALLAN 281|24Q|26Q/i;

export function tdsPayable(entity: Entity): TdsView {
  const lines: TdsLine[] = [];
  const annual = new Map<string, number>();

  // Aggregate first: the annual threshold is per party, not per payment.
  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    const r = resolveCounterparty(t.narration);
    if (!sectionFor(r.kind, r.name)) continue;
    annual.set(r.name, (annual.get(r.name) ?? 0) + t.amount);
  }

  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    const r = resolveCounterparty(t.narration);
    const section = sectionFor(r.kind, r.name);
    if (!section) continue;
    // Either test can trigger the obligation — one big payment, or a year of
    // small ones. Checking only the single payment is the common mistake.
    const crossed = t.amount >= section.single || (annual.get(r.name) ?? 0) >= section.annual;
    if (!crossed) continue;
    lines.push({ txn: t, party: r.name, section, due: Math.round((t.amount * section.rate) / 100) });
  }

  const deposited = entity.txns
    .filter((t) => t.direction === "debit" && TDS_CHALLAN.test(t.narration))
    .reduce((s, t) => s + t.amount, 0);

  const byParty = new Map<string, { name: string; section: TdsSection; paid: number; due: number; count: number }>();
  for (const l of lines) {
    const key = `${l.party}|${l.section.code}`;
    const cur = byParty.get(key) ?? { name: l.party, section: l.section, paid: 0, due: 0, count: 0 };
    cur.paid += l.txn.amount;
    cur.due += l.due;
    cur.count++;
    byParty.set(key, cur);
  }

  return {
    lines: lines.sort((a, b) => b.due - a.due),
    due: lines.reduce((s, l) => s + l.due, 0),
    deposited,
    parties: [...byParty.values()].sort((a, b) => b.due - a.due),
  };
}

/* ------------------------------------------------------------------ */
/* 2 — salaries with nothing statutory behind them                     */
/* ------------------------------------------------------------------ */

export interface PayrollView {
  runs: number;
  paid: number;
  /** Read off the narration — "SALARY BATCH-42 CREDITS". */
  headcount: number;
  pfApplies: boolean;
  esiApplies: boolean;
  pfPaid: boolean;
  esiPaid: boolean;
  ptPaid: boolean;
  /** Modelled at statutory rates, not read from a payslip. */
  estimatedPf: number;
  estimatedEsi: number;
  estimatedPt: number;
}

const PF_CHALLAN = /EPFO|PROVIDENT|\bPF\b/i;
const ESI_CHALLAN = /ESIC|\bESI\b/i;
const PT_CHALLAN = /PROF.*TAX|PTAX/i;

// Employer share, on wages capped where the statute caps them.
const PF_RATE = 0.12;
const PF_WAGE_CAP = 15000;
const ESI_RATE = 0.0325;
const ESI_WAGE_CEILING = 21000;
const PT_PER_HEAD = 200;

export function payrollGaps(entity: Entity): PayrollView | null {
  const runs = entity.txns.filter(
    (t) => t.direction === "debit" && resolveCounterparty(t.narration).kind === "payroll",
  );
  if (runs.length === 0) return null;

  const paid = runs.reduce((s, t) => s + t.amount, 0);
  const head = Number(runs[0].narration.match(/(\d+)\s*CREDITS/i)?.[1] ?? 0);
  const perHead = head > 0 ? paid / runs.length / head : 0;

  // Applicability is derived from headcount, never assumed: PF bites at 20
  // employees, ESI at 10, and saying otherwise would invent an obligation.
  const pfApplies = head >= 20;
  const esiApplies = head >= 10 && perHead <= ESI_WAGE_CEILING;

  const has = (re: RegExp) => entity.txns.some((t) => t.direction === "debit" && re.test(t.narration));

  return {
    runs: runs.length,
    paid,
    headcount: head,
    pfApplies,
    esiApplies,
    pfPaid: has(PF_CHALLAN),
    esiPaid: has(ESI_CHALLAN),
    ptPaid: has(PT_CHALLAN),
    estimatedPf: pfApplies
      ? Math.round(Math.min(perHead, PF_WAGE_CAP) * PF_RATE * head * runs.length)
      : 0,
    estimatedEsi: esiApplies ? Math.round(perHead * ESI_RATE * head * runs.length) : 0,
    estimatedPt: Math.round(PT_PER_HEAD * head * runs.length),
  };
}

/* ------------------------------------------------------------------ */
/* 3 — credit on a bill the supplier never filed                       */
/* ------------------------------------------------------------------ */

export interface ItcRisk {
  supplier: string;
  tax: number;
  bills: number;
}

/**
 * A bank statement cannot tell you whether a supplier filed their GSTR-1 —
 * only the 2B can. So the filing status is seeded, and every screen that uses
 * it says where it came from rather than implying we worked it out.
 */
export function itcAtRisk(books: Books): { rows: ItcRisk[]; tax: number } {
  const map = new Map<string, ItcRisk>();
  for (const d of books.docs) {
    if (d.kind !== "bill") continue;
    const meta = supplierMeta(d.party);
    if (meta.filedGstr1) continue;
    const t = docTotals(d).tax;
    if (t === 0) continue;
    const cur = map.get(d.party) ?? { supplier: d.party, tax: 0, bills: 0 };
    cur.tax += t;
    cur.bills++;
    map.set(d.party, cur);
  }
  const rows = [...map.values()].sort((a, b) => b.tax - a.tax);
  return { rows, tax: rows.reduce((s, r) => s + r.tax, 0) };
}

/* ------------------------------------------------------------------ */
/* 4 — a micro supplier paid too late to deduct at all                 */
/* ------------------------------------------------------------------ */

export const MSME_DAYS = 45;

export interface MsmeRow {
  supplier: string;
  number: string;
  amount: number;
  days: number;
}

export function msmeExposure(books: Books): { rows: MsmeRow[]; amount: number } {
  const rows: MsmeRow[] = [];
  for (const d of books.docs) {
    if (d.kind !== "bill") continue;
    if (!supplierMeta(d.party).msme) continue;
    const open = docTotals(d).outstanding;
    if (open <= 0) continue;
    const days = daysBetween(d.date, ANCHOR_DATE);
    if (days <= MSME_DAYS) continue;
    rows.push({ supplier: d.party, number: d.number, amount: docTotals(d).total, days });
  }
  rows.sort((a, b) => b.days - a.days);
  return { rows, amount: rows.reduce((s, r) => s + r.amount, 0) };
}

/* ------------------------------------------------------------------ */
/* the four, in one list                                               */
/* ------------------------------------------------------------------ */

/**
 * TDS for a month is due on the 7th of the next one. Stated as a date because
 * "the 7th" makes the reader work out which month they are in.
 */
function tdsDueDate(): string {
  const [y, m] = ANCHOR_DATE.split("-").map(Number);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `7 ${MON[next.m - 1]}`;
}

/** "PF, ESI and PT" — only the heads this headcount actually attracts. */
function listHeads(pay: PayrollView): string {
  const heads = [
    pay.pfApplies && !pay.pfPaid ? "PF" : null,
    pay.esiApplies && !pay.esiPaid ? "ESI" : null,
    !pay.ptPaid ? "PT" : null,
  ].filter(Boolean) as string[];
  if (heads.length <= 1) return heads[0] ?? "PT";
  return `${heads.slice(0, -1).join(", ")} and ${heads[heads.length - 1]}`;
}

export function exposures(entity: Entity, books: Books): Exposure[] {
  const out: Exposure[] = [];

  const tds = tdsPayable(entity);
  const tdsOpen = tds.due - tds.deposited;
  if (tdsOpen > 0) {
    out.push({
      kind: "tds",
      amount: tdsOpen,
      count: tds.lines.length,
      headline: `${formatINR(tdsOpen)} TDS not deducted`,
      because: `Due ${tdsDueDate()} · else 30% disallowed`,
      href: "/compliance/tds",
      blocking: true,
    });
  }

  const pay = payrollGaps(entity);
  if (pay) {
    const missing =
      (pay.pfApplies && !pay.pfPaid ? pay.estimatedPf : 0) +
      (pay.esiApplies && !pay.esiPaid ? pay.estimatedEsi : 0) +
      (!pay.ptPaid ? pay.estimatedPt : 0);
    if (missing > 0) {
      out.push({
        kind: "payroll",
        amount: missing,
        count: pay.headcount,
        // Only the heads that genuinely apply are named. Listing PF for a
        // 12-person business would invent an obligation the statute does not
        // create, which is worse than being wordy.
        // Leads with the money like the other three. It never did, so the one
        // exposure whose amount is modelled was also the one that showed no
        // amount at all — and the Estimate badge beside it is what makes
        // printing a modelled figure honest rather than false precision.
        headline: `${formatINR(missing)} of ${listHeads(pay)} unpaid`,
        because: `${plural(pay.headcount, "salary", "salaries")} · arrears and 12% interest`,
        href: "/compliance/payroll",
        blocking: true,
        estimated: true,
      });
    }
  }

  const itc = itcAtRisk(books);
  if (itc.tax > 0) {
    out.push({
      kind: "itc",
      amount: itc.tax,
      count: itc.rows.length,
      headline: `${formatINR(itc.tax)} GST credit at risk`,
      because: `${plural(itc.rows.length, "supplier")} ${itc.rows.length === 1 ? "has" : "have"} not filed GSTR-1`,
      href: "/compliance/itc-risk",
      blocking: false,
    });
  }

  const msme = msmeExposure(books);
  if (msme.amount > 0) {
    out.push({
      kind: "msme",
      amount: msme.amount,
      count: msme.rows.length,
      headline: `${formatINR(msme.amount)} owed past 45 days`,
      because: `Micro supplier · s.43B(h) disallows it`,
      href: "/compliance/msme",
      blocking: true,
    });
  }

  return out;
}
