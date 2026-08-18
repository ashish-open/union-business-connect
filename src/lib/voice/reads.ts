/*
 * The read tools, over the same derivations the screens use.
 *
 * The rule this file exists to hold: what Simran says and what the dashboard
 * renders must come from one code path. If the balance on the phone and the
 * balance on /balance can disagree, we have built the "two numbers for one fact"
 * failure into the product whose whole claim is that figures reconcile — and
 * that is the one mistake a user never forgives.
 *
 * So: no arithmetic here, no formatting here beyond `speak.ts`. Every figure is
 * read from `src/lib/*` and every figure carries an `as_at`.
 */

import type { Entity } from "@/data/seed";
import { ANCHOR_DATE, BANK_CUSTOMERS } from "@/data/seed";
import { buildStatement } from "@/lib/statement";
import { buildBalance } from "@/lib/balance";
import { buildParties } from "@/lib/parties";
import { rupees, count, dateSpoken } from "./speak";

export function entityById(entityId: string): Entity | undefined {
  return BANK_CUSTOMERS.flatMap((c) => c.entities).find((e) => e.id === entityId);
}

/** Every read answers with the same envelope, so provenance is never optional. */
interface Answer {
  speak: string;
  data: Record<string, unknown> & { as_at: string };
}

const asAt = () => ({ as_at: ANCHOR_DATE });

export function balance(entity: Entity): Answer {
  /*
   * `buildBalance` is the derivation `/balance` renders its hero figure from, so
   * this reads it rather than summing accounts again. It used to total only the
   * transactable accounts, which broke the rule at the top of this file three
   * ways: the caller heard a figure the screen's hero contradicted, and for a
   * business whose one account is AA-linked view-only there were no transactable
   * accounts at all — so Simran told a proprietor holding ₹11.6L that they had
   * "nothing", across "0 accounts". A confidently wrong balance is the worst
   * thing this channel can do, because the phone is where it cannot be checked.
   *
   * What the caller can actually SPEND is a second fact, and it is stated as
   * one below instead of quietly replacing the first.
   */
  const total = buildBalance(entity).total;
  const own = entity.accounts.filter((a) => !a.readOnly);
  const linked = entity.accounts.filter((a) => a.readOnly);

  // Named, not "across N accounts" — a total whose composition is invisible is a
  // claim the caller cannot check.
  const where =
    entity.accounts.length === 1
      ? `in your ${entity.accounts[0].label.toLowerCase()} ending ${entity.accounts[0].masked.replace(/\D/g, "")}`
      : `across ${count(entity.accounts.length, "account")}`;

  /* Naming the linked accounts is not enough on its own — the caller cannot
     reconcile the total against the screen without knowing how much of it they
     cannot move. So the caveat carries the figure, EXCEPT where every account is
     view-only: there the caveat's figure is the total, and speaking one number
     twice in two sentences reads as two facts. */
  const viewOnly = linked.reduce((s, a) => s + a.balance, 0);
  const speak =
    linked.length === 0
      ? `You have ${rupees(total)} ${where}.`
      : own.length === 0
        ? `You have ${rupees(total)} in ${count(linked.length, "linked account")} we can see but not transact on.`
        : `You have ${rupees(total)} ${where}. ${rupees(viewOnly)} of that ${linked.length === 1 ? "sits" : "sit"} in ${count(linked.length, "linked account")} we can see but not transact on.`;

  return {
    speak,
    data: {
      ...asAt(),
      balance: total,
      accounts: entity.accounts.length,
      linked: linked.length,
      /* What a payout can actually draw on. Separate from `balance` on purpose:
         the drafting tools need it and it must never be mistaken for the total. */
      transactable: own.reduce((s, a) => s + a.balance, 0),
    },
  };
}

export function transactions(entity: Entity, limit = 5): Answer {
  /*
   * `connected: false` on purpose. A channel report the caller has not connected
   * would let the statement claim settlement detail we cannot actually see, and
   * the phone is the worst place to over-claim. Unenriched rows are still true.
   */
  const rows = buildStatement(entity, { connected: false, resolutions: {} }).rows.slice(0, limit);
  if (rows.length === 0) {
    return { speak: "I don't see any transactions yet.", data: { ...asAt(), rows: 0 } };
  }

  const lines = rows.map(
    (r) =>
      `${dateSpoken(r.txn.date)}, ${r.txn.direction === "credit" ? "in" : "out"}, ` +
      `${rupees(r.txn.amount)}, ${r.name}`,
  );

  return {
    speak: `Your last ${count(rows.length, "transaction")}: ${lines.join(". ")}.`,
    data: { ...asAt(), rows: rows.length },
  };
}

export function receivables(entity: Entity): Answer {
  const open = entity.invoices.filter((i) => i.received < i.total);
  const owed = open.reduce((s, i) => s + (i.total - i.received), 0);
  const overdue = open.filter((i) => i.dueDate < ANCHOR_DATE);

  if (open.length === 0) {
    return { speak: "Nothing outstanding — every invoice is settled.", data: { ...asAt(), open: 0 } };
  }

  const late = overdue.length
    ? ` ${count(overdue.length, "invoice")} past the due date, ${rupees(
        overdue.reduce((s, i) => s + (i.total - i.received), 0),
      )} of it.`
    : " Nothing is overdue.";

  return {
    speak: `${rupees(owed)} is owed to you across ${count(open.length, "invoice")}.${late}`,
    data: { ...asAt(), owed, open: open.length, overdue: overdue.length },
  };
}

/**
 * "Did Acme pay me?" — the single most common reason to ring a bank.
 *
 * Direction matters and must not be conflated: "did Acme pay me" and "what did
 * we pay Acme" are different questions, and answering the wrong one confidently
 * is worse than not answering.
 */
export function partyPayments(
  entity: Entity,
  partyName: string,
  direction: "received" | "paid" | "both" = "both",
): Answer {
  const party = buildParties(entity).find((p) => p.name === partyName);
  if (!party) {
    return {
      speak: `I can't find anyone called ${partyName} on your account.`,
      data: { ...asAt(), found: false },
    };
  }

  const inward = party.receivedFromThem;
  const outward = party.paidToThem;

  const parts: string[] = [];
  if (direction !== "paid" && inward > 0) parts.push(`${rupees(inward)} in from them`);
  if (direction !== "received" && outward > 0) parts.push(`${rupees(outward)} out to them`);

  if (parts.length === 0) {
    return {
      speak: `I have ${party.name} on your account, but no payments either way yet.`,
      data: { ...asAt(), found: true, inward: 0, outward: 0 },
    };
  }

  const owed = party.receivable > 0 ? ` They still owe you ${rupees(party.receivable)}.` : "";

  return {
    speak: `${party.name}: ${parts.join(", and ")}.${owed}`,
    data: { ...asAt(), found: true, party: party.name, inward, outward, receivable: party.receivable },
  };
}

/**
 * Deliberately non-numeric, which is what makes it the one read allowed before
 * step-up: it tells a caller whether to bother reaching for the app without
 * revealing a rupee to someone who may have spoofed the number.
 */
export function pendingSummary(entity: Entity, draftCount: number): Answer {
  const approvals = entity.approvals.length;
  const total = approvals + draftCount;

  if (total === 0) {
    return { speak: "Nothing is waiting on you.", data: { ...asAt(), waiting: 0 } };
  }

  const bits: string[] = [];
  if (draftCount) bits.push(`${count(draftCount, "request")} from your calls`);
  if (approvals) bits.push(`${count(approvals, "payment run")} to approve`);

  return {
    speak: `${bits.join(", and ")} — all of it in the app on your Today screen.`,
    data: { ...asAt(), waiting: total, drafts: draftCount, approvals },
  };
}
