// The RERA engine — deterministic rules, human certificates, nothing moves
// without sign-off. Project mode is DERIVED from the designated account on
// the entity (never asked). Eligibility is arithmetic the developer can
// check; the certificate workflow is where humans stay in charge.

import { ANCHOR_DATE, Entity, Txn } from "@/data/seed";
import { addDays } from "@/lib/format";

/** A RERA-designated account on the entity switches project mode on. */
export function detectRera(entity: Entity): boolean {
  return entity.accounts.some((a) => /RERA/i.test(a.label));
}

export interface UnitCredit {
  date: string;
  unit: string;
  buyer: string;
  amount: number;
  opsShare: number; // the 30% that moved to ops the same day
}

export interface Certificate {
  form: "Form 1" | "Form 2" | "Form 3";
  role: string;
  name: string;
  attests: string;
  /** signed in the seed, or "awaiting" until the session signs it */
  seeded: "signed" | "awaiting";
  date?: string;
}

export interface CostHead {
  head: string;
  spent: number; // project lifetime
  permitted: boolean; // payable from the designated account?
  evidence: string;
}

export interface ReraState {
  project: {
    name: string;
    rera: string;
    unitsTotal: number;
    unitsSold: number;
    progressPct: number; // certified completion
    progressAsOf: string;
  };
  designatedMasked: string;
  designatedBalance: number;
  lifetimeCollections: number;
  withdrawnToDate: number;
  /** collections × certified progress − already withdrawn, capped by balance */
  eligibleToday: number;
  splits: UnitCredit[]; // last-90-day buyer credits with their auto-splits
  collections90d: number;
  certificates: Certificate[];
  costHeads: CostHead[];
  guardrail: { when: string; text: string };
  score: number; // compliance score the bank's risk team sees
}

// Project-lifetime figures — the ledger behind them predates the 90-day
// statement window, so they are seeded constants, stated as such on screen.
const LIFETIME_COLLECTIONS = 18_60_00_000;
const WITHDRAWN_TO_DATE = 10_35_00_000;
const PROGRESS_PCT = 68;

const VA_RE = /-([A-Z]+ [A-Z0-9-]+?)-VA UNIT ([A-Z]-\d+)-/;

function parseSplits(txns: Txn[]): UnitCredit[] {
  const credits = txns.filter((t) => t.direction === "credit" && /VA UNIT/.test(t.narration));
  return credits.map((t) => {
    const m = t.narration.match(VA_RE);
    const unitFromNarr = t.narration.match(/VA UNIT ([A-Z]-\d+)/)?.[1] ?? "—";
    const buyerRaw = m?.[1] ?? t.narration.split("-")[2] ?? "Buyer";
    return {
      date: t.date,
      unit: unitFromNarr,
      buyer: titleName(buyerRaw),
      amount: t.amount,
      opsShare: Math.round(t.amount * 0.3),
    };
  });
}

function titleName(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function buildRera(
  entity: Entity,
  opts: { caSigned: boolean; sessionWithdrawn: number },
): ReraState | null {
  const designated = entity.accounts.find((a) => /RERA/i.test(a.label));
  if (!designated) return null;

  const splits = parseSplits(entity.txns);
  const collections90d = splits.reduce((s, c) => s + c.amount, 0);
  const withdrawn = WITHDRAWN_TO_DATE + opts.sessionWithdrawn;
  const balance = designated.balance - opts.sessionWithdrawn;

  const eligibleRaw = Math.round(LIFETIME_COLLECTIONS * (PROGRESS_PCT / 100)) - withdrawn;
  const eligibleToday = Math.max(0, Math.min(eligibleRaw, balance));

  return {
    project: {
      name: "Vistara One",
      rera: "PRM/KA/RERA/1251/446/PR/240718/006934",
      unitsTotal: 220,
      unitsSold: 164,
      progressPct: PROGRESS_PCT,
      progressAsOf: addDays(ANCHOR_DATE, -17),
    },
    designatedMasked: designated.masked,
    designatedBalance: balance,
    lifetimeCollections: LIFETIME_COLLECTIONS,
    withdrawnToDate: withdrawn,
    eligibleToday,
    splits,
    collections90d,
    certificates: [
      {
        form: "Form 1",
        role: "Architect",
        name: "Morphogenesis Architects",
        attests: `${PROGRESS_PCT}% of construction complete`,
        seeded: "signed",
        date: addDays(ANCHOR_DATE, -17),
      },
      {
        form: "Form 2",
        role: "Engineer",
        name: "L&T site engineer",
        attests: "Cost incurred matches work done",
        seeded: "signed",
        date: addDays(ANCHOR_DATE, -17),
      },
      {
        form: "Form 3",
        role: "Chartered Accountant",
        name: "Rao & Associates",
        attests: "Withdrawal is proportionate to certified cost",
        seeded: opts.caSigned ? "signed" : "awaiting",
        date: opts.caSigned ? ANCHOR_DATE : undefined,
      },
    ],
    costHeads: [
      { head: "Civil & structure", spent: 6_20_00_000, permitted: true, evidence: "L&T RA bills 1–14, from the designated account" },
      { head: "Material — steel & concrete", spent: 2_90_00_000, permitted: true, evidence: "JSW, UltraTech supply bills" },
      { head: "Approvals & consultants", spent: 80_00_000, permitted: true, evidence: "BBMP, architect stage fees" },
      { head: "Marketing & sales", spent: 60_00_000, permitted: false, evidence: "Dentsu, Meta — paid from ops ••3308 only" },
    ],
    guardrail: {
      when: addDays(ANCHOR_DATE, -29),
      text: `Dentsu Creative payout attempted from ${designated.masked} — blocked, not a permitted cost head. Paid from ops.`,
    },
    score: 96,
  };
}
