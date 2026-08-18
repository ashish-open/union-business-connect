// Seed registry: two bank customers, three entities, ~90 days of transactions
// each. Everything is generated deterministically from a fixed anchor date so
// every number on screen is computed from these rows — findings are derived by
// src/lib/analysis.ts, never hardcoded.

import { addDays } from "@/lib/format";

export const ANCHOR_DATE = "2026-07-29"; // "today" for the demo

export type TxnMode = "UPI" | "NEFT" | "IMPS" | "RTGS" | "NACH" | "CARD";

export interface Txn {
  id: string;
  date: string; // ISO yyyy-mm-dd
  amount: number; // positive integer rupees
  direction: "credit" | "debit";
  narration: string; // raw bank narration — the ugly evidence
  mode: TxnMode;
  ref: string; // UTR / RRN
}

export interface Invoice {
  number: string;
  customer: string;
  total: number;
  issueDate: string;
  dueDate: string;
  tdsSection?: "194C" | "194J";
  received: number; // amount received so far
}

export interface Account {
  bank: string;
  masked: string;
  label: string;
  balance: number;
  readOnly?: boolean; // non-primary-bank accounts connect view-only via AA
}

export interface PendingApproval {
  id: string;
  preparedBy: string;
  count: number;
  total: number;
  note: string;
}

export interface ReturnedPayout {
  id: string;
  payee: string;
  amount: number;
  reason: string;
  date: string;
}

export interface SuggestedMatch {
  id: string;
  credit: string;
  amount: number;
  matchTo: string;
  confidence: number;
}

/**
 * A line seen at ANOTHER bank, through Account Aggregator.
 *
 * Deliberately not in `entity.txns`. Twenty files in `lib/` read that array —
 * the books, GST, payroll, RERA, parties, the close — and every one of them
 * would silently absorb these, posting another bank's money to this business's
 * ledger and moving every figure in the product. That is the "two calculations
 * of one fact" failure at the scale of the whole app.
 *
 * So they live apart, and a screen has to ask for them. What can be done with
 * them is exactly what a read-only consent allows: shown, named, counted — and
 * never reconciled, never posted, never enriched.
 */
export interface ExternalTxn extends Txn {
  /** Masked number of the read-only account it landed in. */
  account: string;
}

export interface Entity {
  id: string;
  name: string;
  legalName: string;
  constitution: "Private Limited" | "Proprietorship" | "LLP";
  city: string;
  gstin?: string;
  secondUser?: string; // maker-checker only exists once a 2nd user does
  accounts: Account[];
  /** The primary account's lines. Everything in `lib/` is built from these. */
  txns: Txn[];
  /** Lines at another bank, visible through AA. Statement only — see above. */
  externalTxns?: ExternalTxn[];
  invoices: Invoice[];
  approvals: PendingApproval[];
  returned: ReturnedPayout[];
  suggested: SuggestedMatch[];
}

export interface BankCustomer {
  mobile: string; // 10 digits, no spaces
  name: string;
  firstName: string;
  entities: Entity[];
}

/* ------------------------------------------------------------------ */
/* generator helpers — all deterministic                               */
/* ------------------------------------------------------------------ */

let seq = 0;
function txn(
  date: string,
  amount: number,
  direction: "credit" | "debit",
  narration: string,
  mode: TxnMode,
): Txn {
  seq += 1;
  return {
    id: `t${seq}`,
    date,
    amount: Math.round(amount),
    direction,
    narration,
    mode,
    ref: `${mode}${date.replaceAll("-", "")}${String(seq).padStart(4, "0")}`,
  };
}

function weekday(iso: string): number {
  return new Date(iso + "T00:00:00").getDay(); // 0 Sun .. 6 Sat
}

const DAYS = 90;
const START = addDays(ANCHOR_DATE, -(DAYS - 1));

function eachDay(fn: (iso: string, i: number) => void) {
  for (let i = 0; i < DAYS; i++) fn(addDays(START, i), i);
}

/* ------------------------------------------------------------------ */
/* Nadi Foods — multi-outlet QSR (ICP A, "Vikram")                     */
/* ------------------------------------------------------------------ */

// Weekly settlement patterns, oldest → newest. Two Swiggy weeks and two
// Zomato weeks dip well below the trailing median — the analysis layer must
// *find* these, they are not labelled here.
const SWIGGY_WEEKS = [
  371200, 368400, 374800, 362900, 375600, 369100, 341600, 373400, 366800,
  337700, 371900, 364200, 372600,
];
const ZOMATO_WEEKS = [
  291400, 288700, 293800, 286200, 264800, 290600, 287900, 292400, 285100,
  289800, 261900, 290200, 288400,
];
// Daily takings variation (indexed mod 7 / mod 5)
const UPI_DAILY = [31200, 27800, 34600, 29400, 36100, 42800, 44500];
const CARD_DAILY = [38200, 33400, 41800, 36700, 44100];

/**
 * Marketplace money landing at the OTHER bank.
 *
 * Nadi Foods runs a current account at ICICI as well as the PNB one, and two of
 * its rails were pointed there when they were set up. The lines are visible
 * through AA and nothing more can be done with them: no report can be fetched
 * against an account we do not hold, so no gross, no fee, no claim — the exact
 * asymmetry that makes moving the payout worth something.
 *
 * Amounts and dates mirror the PNB settlements so the two are comparable; the
 * narrations are the real ones, because the rail has to be identifiable from
 * the string alone — that identification is the whole basis of the prompt.
 */
function nadiFoodsExternal(): ExternalTxn[] {
  const at = "\u2022\u20222210";
  return [
    {
      id: "x1",
      date: "2026-07-26",
      amount: 318400,
      direction: "credit",
      narration: "NEFT CR-HDFC0000060-ZOMATO LIMITED-WKLY SETL",
      mode: "NEFT",
      ref: "NEFT202607260901",
      account: at,
    },
    {
      id: "x2",
      date: "2026-07-19",
      amount: 296700,
      direction: "credit",
      narration: "NEFT CR-HDFC0000060-ZOMATO LIMITED-WKLY SETL",
      mode: "NEFT",
      ref: "NEFT202607190902",
      account: at,
    },
    {
      id: "x3",
      date: "2026-07-15",
      amount: 184200,
      direction: "credit",
      narration: "NEFT CR-ICIC0000104-BUNDL TECHNOLOGIES PVT LTD-SWIGGY WKLY SETL",
      mode: "NEFT",
      ref: "NEFT202607150903",
      account: at,
    },
    {
      id: "x4",
      date: "2026-07-12",
      amount: 41800,
      direction: "debit",
      narration: "ACH DR-BAJAJ ALLIANZ GEN INS-POLICY PREMIUM",
      mode: "NACH",
      ref: "NACH202607120904",
      account: at,
    },
  ];
}

function nadiFoodsTxns(): Txn[] {
  const out: Txn[] = [];
  let swiggyIdx = 0;
  let zomatoIdx = 0;

  eachDay((d, i) => {
    const wd = weekday(d);
    const dom = Number(d.slice(8, 10));

    // — money in —
    // UPI QR takings settle daily as one PSP lump
    out.push(
      txn(d, UPI_DAILY[i % 7], "credit", "UPI SETL-YESB0BHARATPE-BHARATPE MERCHANT DAILY SETTLEMENT", "UPI"),
    );
    // card takings settle on weekdays via PG
    if (wd >= 1 && wd <= 5) {
      out.push(
        txn(d, CARD_DAILY[i % 5], "credit", "NEFT CR-UTIB0000001-RAZORPAY SOFTWARE PVT LTD-CARD SETL T1", "NEFT"),
      );
    }
    // Swiggy settles Wednesdays, Zomato Thursdays
    if (wd === 3 && swiggyIdx < SWIGGY_WEEKS.length) {
      out.push(
        txn(d, SWIGGY_WEEKS[swiggyIdx], "credit", "NEFT CR-ICIC0000104-BUNDL TECHNOLOGIES PVT LTD-SWIGGY WKLY SETL", "NEFT"),
      );
      swiggyIdx += 1;
    }
    if (wd === 4 && zomatoIdx < ZOMATO_WEEKS.length) {
      out.push(
        txn(d, ZOMATO_WEEKS[zomatoIdx], "credit", "NEFT CR-HDFC0000060-ZOMATO LIMITED-WKLY SETL", "NEFT"),
      );
      zomatoIdx += 1;
    }

    // — money out —
    // raw material vendors: Tue and Fri
    if (wd === 2) {
      out.push(txn(d, 52400 + (i % 4) * 3800, "debit", "NEFT DR-SRI LAKSHMI TRADERS-VEG SUPPLY", "NEFT"));
    }
    if (wd === 5) {
      out.push(txn(d, 81600 + (i % 3) * 4200, "debit", "NEFT DR-FRESHPOINT AGRO PVT LTD-WKLY SUPPLY", "NEFT"));
    }
    // packaging fortnightly (1st and 15th)
    if (dom === 1 || dom === 15) {
      out.push(txn(d, 36800, "debit", "IMPS DR-KANNAN PACKAGING CO", "IMPS"));
    }
    // rent for 4 outlets on the 2nd
    if (dom === 2) {
      out.push(txn(d, 85000, "debit", "NACH DR-RENT HSR LAYOUT-LEASE 2201", "NACH"));
      out.push(txn(d, 72000, "debit", "NACH DR-RENT INDIRANAGAR-LEASE 1104", "NACH"));
      out.push(txn(d, 95000, "debit", "NACH DR-RENT WHITEFIELD-LEASE 3302", "NACH"));
      out.push(txn(d, 68000, "debit", "NACH DR-RENT KORAMANGALA-LEASE 0908", "NACH"));
    }
    // salaries on the 1st
    if (dom === 1) {
      out.push(txn(d, 418000, "debit", "BULK DR-SALARY BATCH-42 CREDITS", "NEFT"));
    }
    // electricity for outlets on the 6th
    if (dom === 6) {
      out.push(txn(d, 64200 + (i % 3) * 2100, "debit", "NACH DR-BESCOM-4 SERVICE IDS", "NACH"));
    }
    // GST on the 20th
    if (dom === 20) {
      out.push(txn(d, 212400, "debit", "NEFT DR-GST PMT-CBIC EPAYMENT", "NEFT"));
    }
    // Meta ads monthly on the 20th — July gets charged TWICE (the duplicate
    // the analysis layer should catch)
    if (dom === 20) {
      out.push(txn(d, 92400, "debit", "CARD PUR-META PLATFORMS INDIA-AD SPEND", "CARD"));
      if (d === "2026-07-20") {
        out.push(txn(d, 92400, "debit", "CARD PUR-META PLATFORMS INDIA-AD SPEND", "CARD"));
      }
    }
  });

  // charges the alias table won't resolve — keeps "counterparties resolved"
  // honest instead of a perfect 100%
  eachDay((d) => {
    const dom = Number(d.slice(8, 10));
    if (dom === 5) {
      out.push(txn(d, 590, "debit", "CHRG-SMS ALERTS QTLY-GST 18PCT", "NACH"));
      out.push(txn(d, 1180, "debit", "CHRG-CASH HANDLING FEE-BR 0482", "NACH"));
    }
  });

  // two corporate catering receipts, each short by exactly 1% TDS u/s 194C
  out.push(
    txn(addDays(ANCHOR_DATE, -16), 182160, "credit", "NEFT CR-HDFC0000042-PRESTIGE TECH PARK FM-CATERING INV 2214", "NEFT"),
  );
  out.push(
    txn(addDays(ANCHOR_DATE, -34), 153648, "credit", "NEFT CR-KKBK0000958-ZERODHA BROKING LTD-EVENT CATERING", "NEFT"),
  );

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

const NADI_INVOICES: Invoice[] = [
  {
    number: "INV-2214",
    customer: "Prestige Tech Park FM",
    total: 184000,
    issueDate: addDays(ANCHOR_DATE, -28),
    dueDate: addDays(ANCHOR_DATE, -13),
    tdsSection: "194C",
    received: 182160,
  },
  {
    number: "INV-2189",
    customer: "Zerodha Broking Ltd",
    total: 155200,
    issueDate: addDays(ANCHOR_DATE, -47),
    dueDate: addDays(ANCHOR_DATE, -32),
    tdsSection: "194C",
    received: 153648,
  },
];

/* ------------------------------------------------------------------ */
/* Rajesh Interiors — sole-prop project services (ICP B)               */
/* ------------------------------------------------------------------ */

function rajeshTxns(): Txn[] {
  const out: Txn[] = [];

  // milestone receipts from builders — each short by exactly 1% TDS u/s 194C
  out.push(
    txn(addDays(ANCHOR_DATE, -18), 336600, "credit", "NEFT CR-ICIC0000221-URBANNEST DEVELOPERS LLP-RA BILL 2 VILLA 41", "NEFT"),
  );
  out.push(
    txn(addDays(ANCHOR_DATE, -40), 118800, "credit", "NEFT CR-HDFC0001512-KEERTHI CONSTRUCTIONS-WARDROBE WORK", "NEFT"),
  );
  // an advance with no invoice behind it yet
  out.push(
    txn(addDays(ANCHOR_DATE, -9), 160000, "credit", "IMPS CR-KEERTHI CONSTRUCTIONS-ADV MODULAR KITCHEN BLOCK C", "IMPS"),
  );
  // homeowner part-payments: two UPI credits against one ₹2.6L invoice
  out.push(txn(addDays(ANCHOR_DATE, -22), 65000, "credit", "UPI CR-ANITA MENON-9845XX-PART PMT INTERIORS", "UPI"));
  out.push(txn(addDays(ANCHOR_DATE, -15), 65000, "credit", "UPI CR-ANITA MENON-9845XX-PART PMT INTERIORS", "UPI"));
  // small homeowner receipts
  out.push(txn(addDays(ANCHOR_DATE, -55), 84000, "credit", "UPI CR-RENJITH PILLAI-ADV FALSE CEILING", "UPI"));
  out.push(txn(addDays(ANCHOR_DATE, -62), 142000, "credit", "NEFT CR-SBIN0009331-PRAKASH SHETTY-HANDOVER PMT", "NEFT"));

  // weekly labour payouts on Saturdays
  const LABOUR = [48000, 52500, 44000, 57000];
  eachDay((d, i) => {
    if (weekday(d) === 6) {
      out.push(txn(d, LABOUR[i % 4], "debit", "UPI DR-LABOUR BATCH-SITE WEEKLY", "UPI"));
    }
  });

  // material purchases every ~6 days
  const MATERIALS: Array<[string, number]> = [
    ["SHREE TIMBER MART-PLY AND BOARD", 68400],
    ["ASIAN PAINTS DEALER-JAKKUR", 32700],
    ["GREENLAM LAMINATES DISTRIBUTOR", 41900],
    ["EBCO HARDWARE POINT", 23600],
    ["SLEEK KITCHEN FITTINGS", 55800],
  ];
  for (let k = 0; k < 14; k++) {
    const d = addDays(ANCHOR_DATE, -(4 + k * 6));
    const [name, amt] = MATERIALS[k % MATERIALS.length];
    out.push(txn(d, amt + (k % 3) * 1450, "debit", `NEFT DR-${name}`, "NEFT"));
  }
  // transport
  for (let k = 0; k < 6; k++) {
    out.push(txn(addDays(ANCHOR_DATE, -(7 + k * 14)), 8600 + (k % 2) * 1200, "debit", "UPI DR-PORTER-TRANSPORT", "UPI"));
  }
  // a supplier payment the alias table can't resolve — the ONLY unexplained
  // business debit in the seed, and the reason "credit stuck in lines nobody
  // has explained" is reachable at all. Without it that insight is unreachable
  // for every persona: the ITC-claiming entities are otherwise fully matched,
  // and the restaurant scheme cannot claim credit in the first place.
  out.push(txn(addDays(ANCHOR_DATE, -8), 47200, "debit", "NEFT DR-SS ENTERPRISES-INV 4471", "NEFT"));
  // personal spends routed through the business account — analysis flags these
  out.push(txn(addDays(ANCHOR_DATE, -12), 28500, "debit", "NEFT DR-VIBGYOR HIGH SCHOOL-TERM FEE", "NEFT"));
  out.push(txn(addDays(ANCHOR_DATE, -26), 6240, "debit", "CARD PUR-MYNTRA DESIGNS", "CARD"));
  out.push(txn(addDays(ANCHOR_DATE, -33), 3180, "debit", "UPI DR-APOLLO PHARMACY", "UPI"));

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Central-kitchen entity: quiet books, no exceptions — demos the all-clear state. */
function commissaryTxns(): Txn[] {
  const out: Txn[] = [];
  for (let k = 0; k < 12; k++) {
    const d = addDays(ANCHOR_DATE, -(3 + k * 7));
    out.push(txn(d, 180000, "credit", "NEFT CR-PUNB0048210-NADI FOODS PVT LTD-INTERNAL TRANSFER", "NEFT"));
    out.push(txn(addDays(d, -1), 96500 + (k % 3) * 2400, "debit", "NEFT DR-METRO CASH AND CARRY-BULK GROCERY", "NEFT"));
    out.push(txn(addDays(d, -2), 41200, "debit", "NEFT DR-NANDINI DAIRY DISTRIBUTOR", "NEFT"));
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

const RAJESH_INVOICES: Invoice[] = [
  {
    number: "INV-101",
    customer: "Urbannest Developers LLP",
    total: 340000,
    issueDate: addDays(ANCHOR_DATE, -48),
    dueDate: addDays(ANCHOR_DATE, -18),
    tdsSection: "194C",
    received: 336600,
  },
  {
    number: "INV-102",
    customer: "Keerthi Constructions",
    total: 120000,
    issueDate: addDays(ANCHOR_DATE, -70),
    dueDate: addDays(ANCHOR_DATE, -40),
    tdsSection: "194C",
    received: 118800,
  },
  {
    number: "INV-103",
    customer: "Anita Menon",
    total: 260000,
    issueDate: addDays(ANCHOR_DATE, -42),
    dueDate: addDays(ANCHOR_DATE, -12),
    received: 130000,
  },
  {
    number: "INV-104",
    customer: "Suresh Warrier",
    total: 180000,
    issueDate: addDays(ANCHOR_DATE, -50),
    dueDate: addDays(ANCHOR_DATE, -20),
    received: 0,
  },
  {
    number: "INV-105",
    customer: "Divya Nair",
    total: 95000,
    issueDate: addDays(ANCHOR_DATE, -38),
    dueDate: addDays(ANCHOR_DATE, -8),
    received: 0,
  },
  {
    number: "INV-106",
    customer: "Mohan Rao",
    total: 115000,
    issueDate: addDays(ANCHOR_DATE, -55),
    dueDate: addDays(ANCHOR_DATE, -25),
    received: 0,
  },
  {
    number: "INV-107",
    customer: "Urbannest Developers LLP",
    total: 90000,
    issueDate: addDays(ANCHOR_DATE, -35),
    dueDate: addDays(ANCHOR_DATE, -5),
    received: 0,
  },
];

/* ------------------------------------------------------------------ */
/* Vistara Projects — RERA developer (ICP C, "Sudhir")                  */
/* The designated account in accounts[] is what derives project mode —  */
/* nothing is asked. Buyer installments land in the designated account; */
/* the 30% ops share moves as an explicit auto-split (internal).        */
/* ------------------------------------------------------------------ */

const BUYER_INSTALLMENTS: Array<[number, string, string, number]> = [
  // [days ago, unit, buyer, amount]
  [4, "B-704", "KAVITHA SURESH", 3240000],
  [11, "A-1203", "MOHAMMED IRFAN", 2860000],
  [19, "C-302", "DEEPA AND ARJUN NAIR", 4150000],
  [26, "B-1108", "RAKESH GUPTA", 2380000],
  [33, "A-506", "SHILPA REDDY", 3620000],
  [41, "D-902", "VENKAT AND LATHA RAO", 2940000],
  [52, "C-1204", "PRIYANKA MENON", 3180000],
  [60, "B-208", "ARUN KRISHNAMURTHY", 2560000],
  [71, "A-1502", "FATIMA BEGUM", 3860000],
  [83, "D-405", "SANDEEP JOSHI", 2720000],
];

function vistaraTxns(): Txn[] {
  const out: Txn[] = [];

  for (const [ago, unit, buyer, amount] of BUYER_INSTALLMENTS) {
    const d = addDays(ANCHOR_DATE, -ago);
    // full installment lands in the RERA designated account, tagged to the unit's VA
    out.push(
      txn(d, amount, "credit", `NEFT CR-HDFC0000119-${buyer}-VA UNIT ${unit}-INSTALLMENT`, "NEFT"),
    );
    // 30% ops share moves out the same day — an auto-split, internal
    out.push(
      txn(d, Math.round(amount * 0.3), "debit", `IMPS DR-AUTO SPLIT 30PCT TO OPS-VA UNIT ${unit}-INTERNAL TRANSFER`, "IMPS"),
    );
  }

  // construction spend from the ops account, tagged to cost heads
  const CONTRACTOR_RUNS: Array<[number, string, number]> = [
    [7, "LNT GEOSTRUCTURE-RA BILL 14-CIVIL WORK", 5860000],
    [21, "JSW STEEL DEALER-TMT BARS", 2340000],
    [35, "LNT GEOSTRUCTURE-RA BILL 13-CIVIL WORK", 5420000],
    [49, "ULTRATECH RMC PLANT-CONCRETE SUPPLY", 1980000],
    [63, "LNT GEOSTRUCTURE-RA BILL 12-CIVIL WORK", 5140000],
    [77, "SCHINDLER INDIA-LIFT ADVANCE", 2260000],
  ];
  for (const [ago, narr, amount] of CONTRACTOR_RUNS) {
    out.push(txn(addDays(ANCHOR_DATE, -ago), amount, "debit", `RTGS DR-${narr}`, "RTGS"));
  }
  // consultants and marketing — ops money, never the designated account
  out.push(txn(addDays(ANCHOR_DATE, -15), 640000, "debit", "NEFT DR-MORPHOGENESIS ARCHITECTS-STAGE FEE", "NEFT"));
  out.push(txn(addDays(ANCHOR_DATE, -29), 480000, "debit", "NEFT DR-DENTSU CREATIVE-PROJECT MARKETING", "NEFT"));
  out.push(txn(addDays(ANCHOR_DATE, -44), 380000, "debit", "CARD PUR-META PLATFORMS INDIA-AD SPEND", "CARD"));
  // site salaries monthly
  eachDay((d) => {
    const dom = Number(d.slice(8, 10));
    if (dom === 1) {
      out.push(txn(d, 1840000, "debit", "BULK DR-SALARY BATCH-63 CREDITS", "NEFT"));
    }
  });

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Arka Kitchen — banks-elsewhere guest (Journey B: value before account)
/* One cloud kitchen on HDFC. Never in BANK_CUSTOMERS — a PNB sign-in
/* can't find it; /try imports it directly as the uploaded statement.    */
/* ------------------------------------------------------------------ */

// Weekly settlements with planted dips (same rule as Nadi: the analysis
// layer must find them). Smaller single-kitchen scale.
const ARKA_SWIGGY_WEEKS = [
  218400, 214200, 221800, 216900, 198300, 219600, 215800, 220400, 213700,
  195800, 217200, 214900, 219100,
];
const ARKA_ZOMATO_WEEKS = [
  152600, 149800, 154100, 150900, 153400, 137200, 151800, 150200, 153900,
  149400, 152800, 150600, 151900,
];
const ARKA_UPI_DAILY = [16400, 14800, 17900, 15600, 18700, 21400, 22600];

function arkaTxns(): Txn[] {
  const out: Txn[] = [];
  let swiggyIdx = 0;
  let zomatoIdx = 0;

  eachDay((d, i) => {
    const wd = weekday(d);
    const dom = Number(d.slice(8, 10));

    // — money in —
    out.push(
      txn(d, ARKA_UPI_DAILY[i % 7], "credit", "UPI SETL-YESB0BHARATPE-BHARATPE MERCHANT DAILY SETTLEMENT", "UPI"),
    );
    if (wd === 3 && swiggyIdx < ARKA_SWIGGY_WEEKS.length) {
      out.push(
        txn(d, ARKA_SWIGGY_WEEKS[swiggyIdx], "credit", "NEFT CR-ICIC0000104-BUNDL TECHNOLOGIES PVT LTD-SWIGGY WKLY SETL", "NEFT"),
      );
      swiggyIdx += 1;
    }
    if (wd === 4 && zomatoIdx < ARKA_ZOMATO_WEEKS.length) {
      out.push(
        txn(d, ARKA_ZOMATO_WEEKS[zomatoIdx], "credit", "NEFT CR-HDFC0000060-ZOMATO LIMITED-WKLY SETL", "NEFT"),
      );
      zomatoIdx += 1;
    }

    // — money out —
    if (wd === 2) {
      out.push(txn(d, 44800 + (i % 4) * 2600, "debit", "NEFT DR-SRI LAKSHMI TRADERS-VEG SUPPLY", "NEFT"));
    }
    if (wd === 5) {
      out.push(txn(d, 58200 + (i % 3) * 3100, "debit", "NEFT DR-FRESHPOINT AGRO PVT LTD-WKLY SUPPLY", "NEFT"));
    }
    if (dom === 1 || dom === 15) {
      out.push(txn(d, 21400, "debit", "IMPS DR-KANNAN PACKAGING CO", "IMPS"));
    }
    if (dom === 3) {
      out.push(txn(d, 92000, "debit", "NACH DR-RENT KUDLU GATE-LEASE 0107", "NACH"));
    }
    if (dom === 1) {
      out.push(txn(d, 264000, "debit", "BULK DR-SALARY BATCH-11 CREDITS", "NEFT"));
    }
    if (dom === 6) {
      out.push(txn(d, 41800 + (i % 3) * 1400, "debit", "NACH DR-BESCOM-2 SERVICE IDS", "NACH"));
    }
    if (dom === 20) {
      out.push(txn(d, 148600, "debit", "NEFT DR-GST PMT-CBIC EPAYMENT", "NEFT"));
      out.push(txn(d, 46200, "debit", "CARD PUR-META PLATFORMS INDIA-AD SPEND", "CARD"));
    }
    // owner's monthly sweep to savings — internal, keeps the walk-back honest
    if (dom === 25) {
      out.push(txn(d, 820000, "debit", "NEFT DR-SELF TRANSFER TO SAVINGS-INTERNAL TRANSFER", "NEFT"));
    }
    if (dom === 5) {
      out.push(txn(d, 590, "debit", "CHRG-SMS ALERTS QTLY-GST 18PCT", "NACH"));
    }
  });

  // personal spends routed through the business account
  out.push(txn(addDays(ANCHOR_DATE, -14), 19800, "debit", "NEFT DR-VIBGYOR HIGH SCHOOL-TERM FEE", "NEFT"));
  out.push(txn(addDays(ANCHOR_DATE, -29), 5340, "debit", "CARD PUR-MYNTRA DESIGNS", "CARD"));
  out.push(txn(addDays(ANCHOR_DATE, -41), 2860, "debit", "UPI DR-APOLLO PHARMACY", "UPI"));

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Kaaya Naturals — D2C skincare label (ICP D, "Ananya")               */
/* ------------------------------------------------------------------ */

// The persona the channels feature exists for. Nothing this business sells is
// paid for by the customer directly: every rupee arrives as a net settlement
// from somebody else's platform, on five different cycles, each keeping a
// different cut under a different name.
//
// Two Amazon fortnights and one Flipkart week settle below the trailing
// median. As with the QSRs, they are not labelled here — the engine has to
// find them.
const AMZ_FORTNIGHTS = [412600, 419800, 408200, 421400, 386700, 417300];
const FKT_WEEKS = [
  164200, 168900, 161700, 166400, 169100, 163800, 141500, 167200, 165600,
  162900, 168400, 164700, 166100,
];
const SHOPIFY_DAILY = [28400, 31600, 26900, 34200, 29800, 41300, 38700];
const COD_WEEKS = [86400, 91200, 84600, 88900, 92700, 87300, 90100];

function kaayaTxns(): Txn[] {
  const out: Txn[] = [];
  let amzIdx = 0;
  let fktIdx = 0;
  let codIdx = 0;

  eachDay((d, i) => {
    const wd = weekday(d);
    const dom = Number(d.slice(8, 10));

    // — money in, five rails —

    // Shopify storefront, settling through Razorpay on T+1
    out.push(
      txn(
        d,
        SHOPIFY_DAILY[i % 7],
        "credit",
        "NEFT CR-UTIB0000001-RAZORPAY SOFTWARE PVT LTD-SHOPIFY SETL T1",
        "NEFT",
      ),
    );

    // Amazon settles a fortnight at a time
    if (dom === 1 || dom === 16) {
      if (amzIdx < AMZ_FORTNIGHTS.length) {
        out.push(
          txn(
            d,
            AMZ_FORTNIGHTS[amzIdx++],
            "credit",
            "NEFT CR-HDFC0000521-CLICKTECH RETAIL PVT LTD-AMAZON SETTLEMENT",
            "NEFT",
          ),
        );
      }
    }

    // Flipkart, weekly on a Tuesday
    if (wd === 2 && fktIdx < FKT_WEEKS.length) {
      out.push(
        txn(
          d,
          FKT_WEEKS[fktIdx++],
          "credit",
          "NEFT CR-ICIC0000445-INSTAKART SERVICES PVT LTD-FLIPKART SETL",
          "NEFT",
        ),
      );
    }

    // Courier COD remittance, weekly on a Friday
    if (wd === 5 && codIdx < COD_WEEKS.length) {
      out.push(
        txn(
          d,
          COD_WEEKS[codIdx++],
          "credit",
          "NEFT CR-HDFC0000060-DELHIVERY LIMITED-COD REMITTANCE",
          "NEFT",
        ),
      );
    }

    // The weekend stall's card machine
    if (wd === 0 || wd === 6) {
      out.push(
        txn(d, 18600 + (i % 5) * 2200, "credit", "NEFT CR-PINE LABS PVT LTD-POS SETL T1", "NEFT"),
      );
    }

    // — money out —
    if (wd === 3) {
      out.push(
        txn(d, 186400 + (i % 3) * 8200, "debit", "NEFT DR-VEDIC HERBALS LLP-CONTRACT MFG", "NEFT"),
      );
    }
    if (dom === 8 || dom === 22) {
      out.push(txn(d, 74600, "debit", "NEFT DR-PACKMAN PRINTS-CARTONS AND LABELS", "NEFT"));
    }
    if (dom === 1) {
      out.push(txn(d, 386000, "debit", "BULK DR-SALARY BATCH-9 CREDITS", "NEFT"));
      out.push(txn(d, 64000, "debit", "NACH DR-RENT INDIRANAGAR STUDIO-LEASE 0442", "NACH"));
    }
    if (dom === 5 || dom === 19) {
      out.push(txn(d, 148200, "debit", "CARD PUR-META PLATFORMS INDIA-AD SPEND", "CARD"));
    }
    if (dom === 12) {
      out.push(txn(d, 96400, "debit", "CARD PUR-GOOGLE INDIA-ADS", "CARD"));
    }
    if (dom === 20) {
      out.push(txn(d, 212800, "debit", "NEFT DR-GST PMT-CBIC EPAYMENT", "NEFT"));
    }
    if (dom === 6) {
      out.push(txn(d, 12400, "debit", "NACH DR-BESCOM-1 SERVICE ID", "NACH"));
    }
    if (dom === 26) {
      out.push(txn(d, 480, "debit", "CHRG-SMS ALERTS QTLY-GST 18PCT", "NACH"));
    }
  });

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

const KAAYA_INVOICES: Invoice[] = [
  {
    number: "INV-3081",
    customer: "Nykaa Retail",
    total: 486000,
    received: 486000,
    issueDate: addDays(ANCHOR_DATE, -38),
    dueDate: addDays(ANCHOR_DATE, -8),
  },
  {
    number: "INV-3096",
    customer: "Wellness Cart",
    total: 214000,
    received: 0,
    issueDate: addDays(ANCHOR_DATE, -22),
    dueDate: addDays(ANCHOR_DATE, -2),
  },
];

/** The uploaded-statement entity for Journey B. Not a PNB customer. */
export const GUEST_ENTITY: Entity = {
  id: "arka-kitchen",
  name: "Arka Kitchen",
  legalName: "Arka Kitchen (Proprietorship)",
  constitution: "Proprietorship",
  city: "Bengaluru",
  gstin: "29ABMPI4437K1ZR",
  accounts: [
    { bank: "HDFC Bank", masked: "••4210", label: "Current account", balance: 1164820, readOnly: true },
  ],
  txns: arkaTxns(),
  invoices: [],
  approvals: [],
  returned: [],
  suggested: [],
};

/** The owner behind the guest entity — used by /apply for prefill copy. */
export const GUEST_OWNER = { name: "Meera Iyer", firstName: "Meera" };

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

export const BANK_CUSTOMERS: BankCustomer[] = [
  {
    mobile: "9845012345",
    name: "Vikram Rao",
    firstName: "Vikram",
    entities: [
      {
        id: "nadi-foods",
        name: "Nadi Foods",
        legalName: "Nadi Foods Pvt Ltd",
        constitution: "Private Limited",
        city: "Bengaluru",
        gstin: "29AAFCN2201Q1Z5",
        secondUser: "Priya (accountant)",
        accounts: [
          { bank: "Punjab National Bank", masked: "••4821", label: "Current account", balance: 684510 },
          { bank: "ICICI Bank", masked: "••2210", label: "Current account", balance: 112040, readOnly: true },
        ],
        txns: nadiFoodsTxns(),
        externalTxns: nadiFoodsExternal(),
        invoices: NADI_INVOICES,
        approvals: [
          {
            id: "ap1",
            preparedBy: "Priya",
            count: 6,
            total: 214600,
            note: "Thursday vendor run — raw material + packaging",
          },
        ],
        returned: [
          {
            id: "rp1",
            payee: "Ravi Kumar · salary",
            amount: 18500,
            reason: "Beneficiary account closed",
            date: addDays(ANCHOR_DATE, -1),
          },
        ],
        suggested: [],
      },
      {
        id: "nadi-commissary",
        name: "Nadi Commissary",
        legalName: "Nadi Commissary LLP",
        constitution: "LLP",
        city: "Bengaluru",
        gstin: "29AAKFN8814P1ZY",
        accounts: [
          { bank: "Punjab National Bank", masked: "••7702", label: "Current account", balance: 231480 },
        ],
        txns: commissaryTxns(),
        invoices: [],
        approvals: [],
        returned: [],
        suggested: [],
      },
    ],
  },
  {
    mobile: "9877001122",
    name: "Sudhir Reddy",
    firstName: "Sudhir",
    entities: [
      {
        id: "vistara-projects",
        name: "Vistara Projects",
        legalName: "Vistara Projects LLP",
        constitution: "LLP",
        city: "Bengaluru",
        gstin: "29AAQFV7719C1Z2",
        secondUser: "Rao & Associates (CA)",
        accounts: [
          { bank: "Punjab National Bank", masked: "••3308", label: "Current account (ops)", balance: 8412600 },
          { bank: "Punjab National Bank", masked: "••7091", label: "RERA designated · Vistara One", balance: 26718400 },
        ],
        txns: vistaraTxns(),
        invoices: [],
        approvals: [],
        returned: [],
        suggested: [],
      },
    ],
  },
  {
    mobile: "9812345678",
    name: "Rajesh Kumar",
    firstName: "Rajesh",
    entities: [
      {
        id: "rajesh-interiors",
        name: "Rajesh Interiors",
        legalName: "Rajesh Interiors (Proprietorship)",
        constitution: "Proprietorship",
        city: "Bengaluru",
        gstin: "29ABKPR6642M1ZQ",
        accounts: [
          { bank: "Punjab National Bank", masked: "••7264", label: "Current account", balance: 241830 },
          { bank: "State Bank of India", masked: "••9931", label: "Savings (personal)", balance: 86200, readOnly: true },
        ],
        txns: rajeshTxns(),
        invoices: RAJESH_INVOICES,
        approvals: [],
        returned: [
          {
            id: "rp1",
            payee: "Shree Timber Mart",
            amount: 68400,
            reason: "IFSC discontinued after branch merger",
            date: addDays(ANCHOR_DATE, -1),
          },
        ],
        suggested: [
          {
            id: "sm1",
            credit: "UPI credit from Anita Menon",
            amount: 65000,
            matchTo: "INV-103 · part 2 of 2",
            confidence: 92,
          },
        ],
      },
    ],
  },
  {
    mobile: "9611204488",
    name: "Ananya Shetty",
    firstName: "Ananya",
    entities: [
      {
        id: "kaaya-naturals",
        name: "Kaaya Naturals",
        legalName: "Kaaya Naturals LLP",
        constitution: "LLP",
        city: "Bengaluru",
        gstin: "29AAWFK6612M1Z8",
        accounts: [
          {
            bank: "Punjab National Bank",
            masked: "••7734",
            label: "Current account",
            balance: 1842600,
          },
        ],
        txns: kaayaTxns(),
        invoices: KAAYA_INVOICES,
        approvals: [],
        returned: [],
        suggested: [],
      },
    ],
  },
];

/*
 * The voice demo account.
 *
 * Separate from the four personas above on purpose. Those carry deliberately
 * messy histories — unconnected rails, held settlements, statutory exposure —
 * which is right for showing the product's judgement and wrong for a phone call,
 * where a caller asking "what's my balance" should get one clean answer.
 *
 * Deliberately small: a handful of parties so the closed-set name matcher has
 * something real to resolve against, two open invoices so receivables answer with
 * a figure, and no channels, so nothing Simran says depends on a report we don't
 * hold.
 *
 * Amul Distributors and Kamal Textiles are both here for a reason — they are the
 * pair that makes "Amal" genuinely ambiguous, so the demo can show Simran asking
 * which one rather than guessing.
 */
const VOICE_DEMO_INVOICES: Invoice[] = [
  {
    number: "INV-0041",
    customer: "Amul Distributors",
    total: 184000,
    received: 184000,
    issueDate: addDays(ANCHOR_DATE, -34),
    dueDate: addDays(ANCHOR_DATE, -4),
  },
  {
    number: "INV-0040",
    customer: "Kamal Textiles",
    total: 96500,
    received: 0,
    issueDate: addDays(ANCHOR_DATE, -22),
    dueDate: addDays(ANCHOR_DATE, -2), // overdue, so "who owes me" has an answer
  },
  {
    number: "INV-0039",
    customer: "Sharma Traders",
    total: 47200,
    received: 0,
    issueDate: addDays(ANCHOR_DATE, -9),
    dueDate: addDays(ANCHOR_DATE, 21),
  },
];

function voiceDemoTxns(): Txn[] {
  const out: Txn[] = [];
  let n = 0;
  const id = () => `vd${++n}`;

  // A plain rhythm: customers paying in, a supplier and payroll going out. No
  // marketplace settlements, so nothing here needs a channel report to explain.
  eachDay((d, i) => {
    const wd = weekday(d);
    const dom = Number(d.slice(8, 10));

    if (wd === 2 || wd === 5) {
      out.push({
        id: id(),
        date: d,
        amount: 18400 + ((i * 700) % 9000),
        direction: "credit",
        narration: `NEFT/AMULDIST/${1000 + i}`,
        mode: "NEFT",
        ref: `AXI${200000 + i}`,
      });
    }
    if (wd === 4) {
      out.push({
        id: id(),
        date: d,
        amount: 9600 + ((i * 430) % 4200),
        direction: "credit",
        narration: `UPI/KAMALTEX/${5000 + i}@ybl`,
        mode: "UPI",
        ref: `UPI${400000 + i}`,
      });
    }
    if (wd === 3) {
      out.push({
        id: id(),
        date: d,
        amount: 12400 + ((i * 310) % 3000),
        direction: "debit",
        narration: `NEFT/SHARMATRADERS/${9000 + i}`,
        mode: "NEFT",
        ref: `AXO${600000 + i}`,
      });
    }
    if (dom === 1) {
      out.push({
        id: id(),
        date: d,
        amount: 148000,
        direction: "debit",
        narration: "NACH/PAYROLL/SALARY",
        mode: "NACH",
        ref: `NCH${800000 + i}`,
      });
    }
  });

  return out;
}

/**
 * Wired to the handset in `VOICE_ALLOWED_CALLERS`. Keep the two in step — a
 * whitelist entry naming an entity that doesn't exist fails closed, which is safe
 * but reads as the agent not recognising a number that should work.
 */
export const VOICE_DEMO_CUSTOMER: BankCustomer = {
  mobile: "8907173502",
  name: "Deepa Nair",
  firstName: "Deepa",
  entities: [
    {
      id: "chitra-interiors",
      name: "Chitra Interiors",
      legalName: "Chitra Interiors",
      constitution: "Proprietorship",
      city: "Bengaluru",
      gstin: "29AASPC4417K1ZP",
      accounts: [
        {
          bank: "Punjab National Bank",
          masked: "••4421",
          label: "Current account",
          balance: 742380,
        },
      ],
      txns: voiceDemoTxns(),
      invoices: VOICE_DEMO_INVOICES,
      approvals: [],
      returned: [],
      suggested: [],
    },
  ],
};

BANK_CUSTOMERS.push(VOICE_DEMO_CUSTOMER);

export function findCustomer(mobile: string): BankCustomer | undefined {
  const clean = mobile.replace(/\D/g, "").slice(-10);
  return BANK_CUSTOMERS.find((c) => c.mobile === clean);
}
