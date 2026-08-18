// Income tax for a sole proprietor — the deadline this product was silent on.
//
// GST, TDS and professional tax are all tracked. Income tax is not, and for a
// proprietorship it is the largest of the four: the business has no separate
// existence, so its profit is the owner's income and lands in their ITR. It
// also carries the only interest that accrues for being *approximately* right —
// §234C charges you for underpaying an instalment even if the year-end return
// is perfect.
//
// SCOPE, stated because it constrains everything below:
//
//   1. This is an ESTIMATE from the books, not a computation of a filed
//      position. It knows nothing of other income, house property, capital
//      gains, chapter VI-A deductions or a spouse's return. Every surface says
//      so; no screen may present it as a liability.
//   2. The slabs are the new-regime slabs as they stand for FY 2025-26 under
//      the Finance Act 2025, carried into FY 2026-27. Rates are the one thing
//      here that a Finance Act can change annually, and this file is the only
//      place they appear so a correction is one edit.
//   3. §44AD presumptive taxation — 8%/6% deemed profit under ₹2Cr turnover —
//      is very common for exactly this taxpayer and often produces a lower
//      figure. It is NOT modelled. The projection is from actual book profit,
//      which is the conservative direction, and the surface says the CA may
//      have a better answer.

import { ANCHOR_DATE } from "@/data/seed";
import { daysBetween } from "@/lib/format";

/** New regime, FY 2025-26 (Finance Act 2025), carried forward. Rates live here only. */
const SLABS: Array<{ upto: number; rate: number }> = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.1 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.2 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.3 },
];

/** §87A: a resident individual under this taxable income pays nothing. */
const REBATE_CEILING = 1200000;
/** Health and education cess on tax plus surcharge. */
const CESS = 0.04;

/** Surcharge bands for an individual under the new regime. */
const SURCHARGE: Array<{ over: number; rate: number }> = [
  { over: 20000000, rate: 0.25 },
  { over: 10000000, rate: 0.15 },
  { over: 5000000, rate: 0.1 },
];

export interface Instalment {
  /** 1–4. */
  n: number;
  /** ISO date it is due. */
  due: string;
  /** Cumulative share of the year's tax due by this date — 15/45/75/100. */
  cumulativePct: number;
  /** Cumulative rupees due by this date. */
  cumulative: number;
  /** This instalment alone. */
  amount: number;
  /** Negative once the date has passed. */
  daysLeft: number;
}

export interface IncomeTax {
  /** Profit the books have recorded so far this financial year. */
  profitToDate: number;
  /** Months of the financial year elapsed, to one decimal. */
  monthsElapsed: number;
  /** Straight-line projection to 31 March. The one inference in the file. */
  projectedProfit: number;
  taxBeforeCess: number;
  surcharge: number;
  cess: number;
  /** What the year is heading for, all in. */
  total: number;
  instalments: Instalment[];
  /** The next one still open, or null once the year's schedule has run. */
  next: Instalment | null;
  /** True where the projection sits under the §87A ceiling and nothing is due. */
  rebated: boolean;
}

/** Tax on a taxable income, before surcharge and cess. */
export function slabTax(income: number): number {
  if (income <= 0) return 0;
  let tax = 0;
  let last = 0;
  for (const s of SLABS) {
    if (income <= last) break;
    tax += (Math.min(income, s.upto) - last) * s.rate;
    last = s.upto;
  }
  return Math.round(tax);
}

function surchargeOn(tax: number, income: number): number {
  for (const b of SURCHARGE) if (income > b.over) return Math.round(tax * b.rate);
  return 0;
}

/** 1 April of the financial year `on` falls in. */
export function fyStart(on: string): string {
  const [y, m] = on.split("-").map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
}

export function fyLabel(on: string): string {
  const start = Number(fyStart(on).slice(0, 4));
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * The year's tax, projected from the profit booked so far.
 *
 * `profitToDate` is the P&L's net figure for the financial year — owner's
 * drawings are not in it, which is the whole reason the drawings distinction
 * matters: a proprietor paying themselves is moving capital, not incurring an
 * expense, and treating it as one would understate the tax.
 */
export function incomeTaxFor(
  profitToDate: number,
  opts: {
    on?: string;
    /**
     * First date the BOOKS cover, which is rarely 1 April.
     *
     * Dividing this year's profit by the months since the financial year began
     * understates the monthly rate whenever the ledger starts later — every
     * persona here begins in May. The honest denominator is the period the
     * profit was actually earned over, so the projection annualises what the
     * books have seen rather than what the calendar has.
     */
    booksFrom?: string;
  } = {},
): IncomeTax {
  const on = opts.on ?? ANCHOR_DATE;
  const fy = fyStart(on);
  const start = opts.booksFrom && opts.booksFrom > fy ? opts.booksFrom : fy;
  const monthsElapsed = Math.max(0.5, daysBetween(start, on) / 30.44);
  const projectedProfit = Math.max(0, Math.round((profitToDate / monthsElapsed) * 12));

  const rebated = projectedProfit <= REBATE_CEILING;
  const base = rebated ? 0 : slabTax(projectedProfit);
  const surcharge = surchargeOn(base, projectedProfit);
  const cess = Math.round((base + surcharge) * CESS);
  const total = base + surcharge + cess;

  /* The instalment dates belong to the FINANCIAL year, never to whenever the
     books happen to begin. */
  const fyYear = Number(fy.slice(0, 4));
  const schedule: Array<[number, string, number]> = [
    [1, `${fyYear}-06-15`, 15],
    [2, `${fyYear}-09-15`, 45],
    [3, `${fyYear}-12-15`, 75],
    [4, `${fyYear + 1}-03-15`, 100],
  ];

  let paidByPrevious = 0;
  const instalments: Instalment[] = schedule.map(([n, due, pct]) => {
    const cumulative = Math.round((total * pct) / 100);
    const amount = cumulative - paidByPrevious;
    paidByPrevious = cumulative;
    return { n, due, cumulativePct: pct, cumulative, amount, daysLeft: daysBetween(on, due) };
  });

  return {
    profitToDate,
    monthsElapsed: Math.round(monthsElapsed * 10) / 10,
    projectedProfit,
    taxBeforeCess: base,
    surcharge,
    cess,
    total,
    instalments,
    next: instalments.find((i) => i.daysLeft >= 0) ?? null,
    rebated,
  };
}

/**
 * Whether this entity has income tax at all.
 *
 * A proprietorship is not a separate taxpayer — its profit is the owner's
 * income. A private limited company and an LLP file their own returns on their
 * own rules, and showing either an individual's slab table would be the
 * wrong-entity error the rest of the compliance module avoids.
 */
export function filesAsIndividual(constitution: string): boolean {
  return constitution === "Proprietorship";
}
