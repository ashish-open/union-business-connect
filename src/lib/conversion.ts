// The conversion ladder, rungs 2/3/5 — deposits by consequence, not by ask.
//
// Every offer here is EARNED: it is led by a number computed from the
// owner's own data that they did not have before, and it returns null the
// moment that number doesn't exist. Nothing in this file can produce a
// banner, a rate card, or a pitch for a product the data hasn't justified.

import { ANCHOR_DATE, Account, Entity } from "@/data/seed";
import { addDays } from "@/lib/format";
import { buildUpcoming } from "@/lib/today";
import { buildBatches } from "@/lib/settlements";
import { reportHeld } from "@/lib/channels";
import { resolveCounterparty } from "@/lib/analysis";

/* ---------------------------------------------------------------- */
/* Rung 5 — Operate: sweep-in                                        */
/* ---------------------------------------------------------------- */

export interface SweepOffer {
  /** money we can see but cannot use, because it sits at another bank */
  idle: number;
  sources: Account[];
  /** the account the mandate would top up */
  destination: Account;
  /** committed outflows in the next 30 days — the reason a floor exists */
  committed30d: number;
  /** a defensible default floor: what's already promised, rounded up */
  suggestedFloor: number;
}

/** Round up to a clean lakh so the number reads like a human chose it. */
function toLakh(n: number): number {
  return Math.max(1, Math.ceil(n / 1_00_000)) * 1_00_000;
}

export function sweepOffer(entity: Entity): SweepOffer | null {
  const destination = entity.accounts.find((a) => !a.readOnly);
  const sources = entity.accounts.filter((a) => a.readOnly && a.balance > 0);
  if (!destination || sources.length === 0) return null;

  const idle = sources.reduce((s, a) => s + a.balance, 0);
  // an amount too small to be worth a mandate isn't an offer, it's noise
  if (idle < 50_000) return null;

  const committed30d = buildUpcoming(entity, 30, 20)
    .filter((u) => u.direction === "out")
    .reduce((s, u) => s + u.amount, 0);

  return {
    idle,
    sources,
    destination,
    committed30d,
    suggestedFloor: toLakh(committed30d || destination.balance / 2),
  };
}

export const SWEEP_CADENCES = [
  {
    id: "floor",
    label: "Whenever the balance dips below the floor",
    detail: "The mandate pulls only what's needed to get back above it.",
  },
  {
    id: "weekly",
    label: "Every Monday",
    detail: "A fixed weekly pull, whatever the balance.",
  },
  {
    id: "manual",
    label: "Only when I tap",
    detail: "The mandate stays ready; nothing moves on its own.",
  },
] as const;

export type SweepCadence = (typeof SWEEP_CADENCES)[number]["id"];

/* ---------------------------------------------------------------- */
/* Rung 3 — Settle: where marketplace money lands                    */
/* ---------------------------------------------------------------- */

export interface SettlementHome {
  /** platforms detected in the ledger */
  platforms: string[];
  /** the account their money currently lands in */
  landsIn: Account;
  /** true when that account is one we reconcile daily */
  reconcilable: boolean;
  /** weekly average across detected settlements */
  weekly: number;
  /** recoverable shortfall found so far — the reason the destination matters */
  shortfall: number;
}

export function settlementHome(entity: Entity, connected: boolean): SettlementHome | null {
  const cutoff = addDays(ANCHOR_DATE, -89);
  const credits = entity.txns.filter(
    (t) =>
      t.date >= cutoff &&
      t.direction === "credit" &&
      resolveCounterparty(t.narration).kind === "marketplace",
  );
  if (credits.length === 0) return null;

  const platforms = [
    ...new Set(credits.map((t) => resolveCounterparty(t.narration).name)),
  ];
  const total = credits.reduce((s, t) => s + t.amount, 0);
  // settlements land in the account we hold for them — read-only accounts
  // are watched, not banked, so the primary is where they arrive
  const landsIn = entity.accounts.find((a) => !a.readOnly) ?? entity.accounts[0];
  const shortfall = connected
    ? buildBatches(entity, reportHeld({ aggregatorsOn: connected })).reduce(
        (s, b) => s + Math.max(0, b.variance),
        0,
      )
    : 0;

  return {
    platforms,
    landsIn,
    reconcilable: !landsIn.readOnly,
    weekly: Math.round(total / 13),
    shortfall,
  };
}
