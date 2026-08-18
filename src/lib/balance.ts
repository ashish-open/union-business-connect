// Balance — "where is my money, and what shape is it in?"
//
// The daily series is walked BACK from today's known balances using the
// transaction ledger: balance(d−1) = balance(d) − net(d). Nothing is
// stored; every point is derived, so the chart can never disagree with the
// statement it came from.
//
// Per-account daily series is deliberately NOT offered: the seed ledger
// isn't account-tagged, and inventing a split would be a lie the rest of
// the product would contradict. Accounts get their live balance and the one
// fact that distinguishes them instead.

import { ANCHOR_DATE, Account, Entity } from "@/data/seed";
import { addDays } from "@/lib/format";
import { brand } from "@/config/brand";

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface AccountView {
  account: Account;
  /** share of total balance, 0–100 */
  share: number;
  /** the single fact that makes this account different from the others */
  note: string;
  /** money movement runs on our own rails; everything else is view-only */
  own: boolean;
  /** public routing code — safe to show in clear */
  ifsc: string;
  /** full number, revealed on demand only */
  fullNumber: string;
}

export interface BalanceView {
  total: number;
  series: BalancePoint[];
  low: number;
  high: number;
  moneyIn: number;
  moneyOut: number;
  accounts: AccountView[];
  days: number;
  /** true when the walk-back would go negative — we then hide the chart
      rather than draw a shape we can't stand behind */
  trustworthy: boolean;
}

// A general lookup — the entities here bank with several institutions and the
// statement has to name each one. Our own tenant leads; the rest are the banks
// that actually appear in the data, alphabetical.
const BANK_CODE: Array<[RegExp, string]> = [
  [brand.bankPattern, brand.ifscPrefix],
  [/axis/i, "UTIB"],
  [/hdfc/i, "HDFC"],
  [/icici/i, "ICIC"],
  [/punjab national|pnb/i, "PUNB"],
  [/state bank|sbi/i, "SBIN"],
];

function ifscFor(account: Account): string {
  const code = BANK_CODE.find(([re]) => re.test(account.bank))?.[1] ?? "BANK";
  const digits = account.masked.replace(/\D/g, "").padStart(4, "0");
  return `${code}0${digits}${digits.slice(-2)}`;
}

function fullNumberFor(account: Account): string {
  const digits = account.masked.replace(/\D/g, "").padStart(4, "0");
  // deterministic, demo-only: a stable 11-digit number ending in the mask
  const stem = String(
    [...digits].reduce((a, c) => (a * 7 + c.charCodeAt(0)) % 9_999_999, 31),
  ).padStart(7, "0");
  return `${stem}${digits}`;
}

function noteFor(account: Account, isPrimary: boolean): string {
  if (/rera|designated/i.test(account.label))
    return "Designated account — withdrawals need certified progress";
  if (account.readOnly) return "View only · connected through Account Aggregator";
  if (/savings/i.test(account.label)) return "Personal savings, kept separate from the business";
  if (isPrimary) return "Payments and collections run from here";
  return "Business account";
}

/**
 * What this business can actually pay from.
 *
 * The Today rail's hero number is the total across every account, which is
 * correct and, alone, misleading: money in an Account-Aggregator-linked account
 * is money we can see and cannot move. That is the entire premise of the
 * sweep-in offer, which calls the same rupees "idle" — so the landing page was
 * counting as capacity exactly what another screen offers to go and fetch.
 * Stating only the total directly above a list of upcoming debits implies room
 * that is not there.
 *
 * Returns null when nothing is payable — a non-customer banks entirely
 * elsewhere, and "₹0 available" is a true sentence that helps nobody on a screen
 * which is not offering to move money.
 */
export function payable(entity: Entity): number | null {
  const own = entity.accounts.filter((a) => !a.readOnly);
  if (own.length === 0) return null;
  return own.reduce((s, a) => s + a.balance, 0);
}

export function buildBalance(entity: Entity, days = 90): BalanceView {
  const total = entity.accounts.reduce((s, a) => s + a.balance, 0);

  const netByDate = new Map<string, number>();
  for (const t of entity.txns) {
    netByDate.set(
      t.date,
      (netByDate.get(t.date) ?? 0) + (t.direction === "credit" ? t.amount : -t.amount),
    );
  }

  // walk back from today, then reverse so the series reads oldest → newest
  const back: BalancePoint[] = [{ date: ANCHOR_DATE, balance: total }];
  let bal = total;
  for (let i = 0; i < days - 1; i++) {
    const d = addDays(ANCHOR_DATE, -i);
    bal -= netByDate.get(d) ?? 0;
    back.push({ date: addDays(ANCHOR_DATE, -(i + 1)), balance: bal });
  }
  const series = back.reverse();
  const values = series.map((p) => p.balance);

  const cutoff = addDays(ANCHOR_DATE, -(days - 1));
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of entity.txns) {
    if (t.date < cutoff) continue;
    if (t.direction === "credit") moneyIn += t.amount;
    else moneyOut += t.amount;
  }

  const primaryId = entity.accounts.find((a) => !a.readOnly)?.masked;
  const accounts: AccountView[] = [...entity.accounts]
    .sort((a, b) => b.balance - a.balance)
    .map((account) => ({
      account,
      share: total > 0 ? (account.balance / total) * 100 : 0,
      note: noteFor(account, account.masked === primaryId),
      own: !account.readOnly,
      ifsc: ifscFor(account),
      fullNumber: fullNumberFor(account),
    }));

  return {
    total,
    series,
    low: Math.min(...values),
    high: Math.max(...values),
    moneyIn,
    moneyOut,
    accounts,
    days,
    trustworthy: Math.min(...values) >= 0,
  };
}
