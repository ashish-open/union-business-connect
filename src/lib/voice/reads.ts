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

import type { Account, Entity } from "@/data/seed";
import { ANCHOR_DATE, BANK_CUSTOMERS } from "@/data/seed";
import { brand } from "@/config/brand";
import { buildStatement } from "@/lib/statement";
import { buildBalance } from "@/lib/balance";
import { buildParties } from "@/lib/parties";
import { rupees, count, dateSpoken, maskedTail } from "./speak";

export function entityById(entityId: string): Entity | undefined {
  return BANK_CUSTOMERS.flatMap((c) => c.entities).find((e) => e.id === entityId);
}

/** Every read answers with the same envelope, so provenance is never optional. */
interface Answer {
  speak: string;
  data: Record<string, unknown> & { as_at: string };
}

const asAt = () => ({ as_at: ANCHOR_DATE });

/*
 * Naming an account aloud.
 *
 * Bank, kind, and the last four digit-by-digit via `maskedTail`, because this is
 * the string the caller checks against a passbook: "four four two one" survives
 * a bad line where "four thousand four hundred and twenty-one" does not. Our own
 * bank is spoken as `brand.bankShort` — "Union Bank of India current account"
 * four times in one breath is not something a person can follow, and the short
 * form is what the bank calls itself to a customer.
 */
function accountName(a: Account): string {
  const bank = brand.bankPattern.test(a.bank) ? brand.bankShort : a.bank;
  return `${bank} ${a.label.toLowerCase()} ending ${maskedTail(a.masked)}`;
}

/** "A, B and C" — spoken, so no serial comma for the ear to hear as a stop. */
function joined(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/*
 * Words that belong to the question rather than the answer.
 *
 * Stripped before matching because this argument arrives off a phone call: the
 * model may send "axis", "my Axis account", or the caller's whole sentence.
 * "bank" and "account" separate nothing — every account has both — and "india"
 * sits in three of the four bank names here. What survives is the one word that
 * actually distinguishes: axis, savings, current, advance.
 *
 * When nothing survives, the caller named no account and gets the combined
 * figure — the same outcome as sending no argument at all, which is what makes a
 * spuriously-filled field harmless rather than wrong.
 */
const ACCOUNT_NOISE = new Set([
  "a", "an", "the", "my", "our", "me", "i", "in", "on", "of", "for", "from", "to",
  "is", "s", "what", "whats", "how", "much", "there", "one", "and", "please",
  "account", "accounts", "acct", "ac", "acs", "bank", "banks", "india",
  "balance", "balances", "money", "have", "has", "got", "show", "tell", "ending",
]);

/*
 * A request for the split rather than for one account.
 *
 * "across all accounts" reads as a request for the total to a human and as a
 * request for the split to this test, and that is deliberately the safe way
 * round: the itemised answer opens with the total, so a caller who wanted one
 * number still hears it first and simply hears more after it. The reverse
 * mistake — answering one number when they asked for four — is the one that
 * sends them to the app.
 */
const ASKED_FOR_EACH =
  /\b(all|each|every|everything|break|breakdown|split|separate|separately|individual|individually|itemise|itemize)\b/;

function normalise(spoken: string): string {
  const t = spoken.trim();
  /* An unresolved `{{account}}` is the platform sending its own placeholder,
     not the caller naming anything. `asNumber` in handler.ts treats these as
     absent for figures; the same rule has to hold here, or a tool-config typo
     turns every balance question into "I don't see an account like that". */
  if (/^\{\{.*\}\}$/.test(t)) return "";
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const words = (s: string): string[] =>
  s.split(" ").filter((w) => w && !ACCOUNT_NOISE.has(w));

const digitsOf = (a: Account): string => a.masked.replace(/\D/g, "");

/*
 * Which account the caller meant.
 *
 * Kept in this file rather than in `resolve.ts` because there is one caller and
 * because the sentences it feeds are balance copy, which this file owns. It also
 * does not use the Levenshtein matcher in `match.ts`, and should not: party
 * names are open vocabulary, whereas an account is picked from four fixed
 * descriptions the bank wrote itself, so whole-word overlap is both sufficient
 * and safer than edit distance over a four-item list.
 *
 * The case that makes ambiguity mandatory rather than theoretical: this business
 * holds a Union Bank current account AND an Axis current account. "My current
 * account" identifies neither, and picking the larger one would be a confidently
 * wrong balance — the single worst thing this channel can do.
 */
type Pick =
  /** Nothing usable was said. Answer the combined figure, exactly as before. */
  | { kind: "combined" }
  | { kind: "each" }
  | { kind: "one"; account: Account }
  | { kind: "ambiguous"; accounts: Account[] }
  | { kind: "none" };

function pickAccount(entity: Entity, spoken?: string): Pick {
  const q = normalise(spoken ?? "");
  if (!q) return { kind: "combined" };
  if (ASKED_FOR_EACH.test(q)) return { kind: "each" };

  /* Four or more digits is the caller reading a number off something, so it
     wins over any word in the same phrase. Last four only: a caller who recites
     a full account number should still land on their account.
     The LAST run, not the first — a recited number arrives with the pause in it
     ("oh one two three four five six, five oh eight eight"), and the leading
     stem identifies nothing. The tail is the part that does. */
  const num = q.match(/\d{4,}/g)?.at(-1);
  const said = words(q);
  if (!num && said.length === 0) return { kind: "combined" };

  const candidates = num
    ? entity.accounts.filter((a) => digitsOf(a).endsWith(num.slice(-4)))
    : entity.accounts.filter((a) => {
        const descriptor = new Set(words(normalise(`${a.bank} ${a.label}`)));
        return said.every((w) => descriptor.has(w));
      });

  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "one", account: candidates[0] };
  return { kind: "ambiguous", accounts: candidates };
}

/*
 * The figures every branch carries, so `data.balance` means the same thing
 * whichever question was asked.
 *
 * A payload where `balance` is the total on one call and one account's holding
 * on the next is a trap for whoever wires the agent, and the mistake would be
 * invisible from both ends. So the entity-wide figures are constant here and
 * anything account-specific is a separately named key.
 */
function figures(entity: Entity) {
  const own = entity.accounts.filter((a) => !a.readOnly);
  const linked = entity.accounts.filter((a) => a.readOnly);
  return {
    ...asAt(),
    balance: buildBalance(entity).total,
    accounts: entity.accounts.length,
    linked: linked.length,
    /* What a payout can actually draw on. Separate from `balance` on purpose:
       the drafting tools need it and it must never be mistaken for the total. */
    transactable: own.reduce((s, a) => s + a.balance, 0),
  };
}

/**
 * The default answer, and the only one when no account is named.
 *
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
function combined(entity: Entity): Answer {
  const data = figures(entity);
  const total = data.balance;
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

  return { speak, data };
}

/**
 * Every account, when the caller asks for the split.
 *
 * Ordered largest first, which is the order `/balance` lists them in — the two
 * surfaces have to be readable against each other line by line, not just on the
 * total. The view-only caveat rides on its own line here rather than being
 * restated at the end: marked against the account it applies to, it is one fact
 * instead of two, and the caller does not have to work out which line it meant.
 */
function eachAccount(entity: Entity): Answer {
  const data = figures(entity);
  const ordered = [...entity.accounts].sort((a, b) => b.balance - a.balance);

  const lines = ordered.map(
    (a) => `${accountName(a)}, ${rupees(a.balance)}${a.readOnly ? ", view only" : ""}`,
  );

  return {
    speak: `Across ${count(entity.accounts.length, "account")}, ${rupees(data.balance)}. ${lines.join(". ")}.`,
    data: {
      ...data,
      breakdown: ordered.map((a) => ({
        bank: a.bank,
        masked: a.masked,
        label: a.label,
        balance: a.balance,
        view_only: Boolean(a.readOnly),
      })),
    },
  };
}

/** One named account. */
function oneAccount(entity: Entity, a: Account): Answer {
  const speak = a.readOnly
    ? `Your ${accountName(a)} holds ${rupees(a.balance)}. That one is linked for viewing only — I can see it but not move money from it.`
    : `Your ${accountName(a)} holds ${rupees(a.balance)}.`;

  return {
    speak,
    data: {
      ...figures(entity),
      account: `${a.bank} ${a.label}`,
      account_masked: a.masked,
      account_balance: a.balance,
      account_view_only: Boolean(a.readOnly),
    },
  };
}

/**
 * Deliberately figure-free, both of these.
 *
 * We do not yet know which account was meant, so any number would be a guess
 * dressed as an answer, and reciting all four to someone who asked for one is
 * over-answering on a channel with no scrollback. Names and a question only.
 */
function askWhich(entity: Entity, accounts: Account[]): Answer {
  const names = accounts.map(accountName);
  return {
    speak: `You have ${count(accounts.length, "account")} that could be — ${joined(names)}. Which one?`,
    data: { ...figures(entity), ambiguous: names },
  };
}

function noSuchAccount(entity: Entity): Answer {
  const names = entity.accounts.map(accountName);
  return {
    speak: `I don't see an account like that. You have ${joined(names)}. Which one did you mean?`,
    data: { ...figures(entity), found: false, known: names },
  };
}

/**
 * The balance read.
 *
 * `spoken` is whatever the caller said about WHICH account, passed through
 * verbatim rather than pre-parsed — the matching wants the caller's own words.
 * Absent, empty, or an unresolved template all mean the same thing and give the
 * combined figure, so this stays a strict superset of the old behaviour: a tool
 * config that never sends the field behaves exactly as it did before.
 */
export function balance(entity: Entity, spoken?: string): Answer {
  const pick = pickAccount(entity, spoken);
  switch (pick.kind) {
    case "each":
      return eachAccount(entity);
    case "one":
      return oneAccount(entity, pick.account);
    case "ambiguous":
      return askWhich(entity, pick.accounts);
    case "none":
      return noSuchAccount(entity);
    default:
      return combined(entity);
  }
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
