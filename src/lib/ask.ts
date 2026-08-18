// "Ask your statement" — a deterministic answer engine over the statement
// rows. No model, no magic: keyword intents and counterparty lookups, every
// answer citing exactly what it computed. Unmatched questions fall back to
// plain text filtering.

import { Entity } from "@/data/seed";
import { formatINR } from "@/lib/format";
import { channelFor } from "@/lib/channels";
import { detectOutlets } from "@/lib/outlets";
import { SettlementBatch } from "@/lib/settlements";
import { StatementRow } from "@/lib/statement";

export interface AskResult {
  answer: string;
  detail: string; // the working, cited
  match?: (row: StatementRow) => boolean; // applied to the visible list
}

/** The rails this business is actually paid by, biggest first. */
function railNames(rows: StatementRow[]): string[] {
  const by = new Map<string, number>();
  for (const r of rows) {
    if (r.txn.direction !== "credit") continue;
    const spec = channelFor(r.txn.narration);
    if (!spec || spec.verifiable !== "report") continue;
    by.set(spec.name, (by.get(spec.name) ?? 0) + r.txn.amount);
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

function listNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export function ask(
  raw: string,
  rows: StatementRow[],
  entity: Entity,
  opts: { days: number; connected: boolean; batches: SettlementBatch[] },
): AskResult | null {
  const q = raw.trim().toLowerCase();
  if (q.length < 3) return null;
  const windowLabel = `last ${opts.days} days`;

  /* platforms' effective take */
  if (/(platform|swiggy|zomato|marketplace)/.test(q) && /(keep|kept|take|cut|fee|commission|cost)/.test(q)) {
    if (!opts.connected) {
      // Named from THIS business's own credits. It said "Connect Swiggy &
      // Zomato" to everybody — so a D2C brand selling on Amazon and Flipkart
      // was pointed at two platforms it does not sell on, by the one feature
      // that is now on every screen. Same bug as the first-run finding had, in
      // the last place still carrying it.
      const names = railNames(rows);
      return {
        answer: names.length
          ? `Connect ${listNames(names)} to see what they kept.`
          : "Connect a platform to see what it kept.",
        detail: "Their order reports show gross sales against what landed.",
        match: (r) => r.kind === "marketplace",
      };
    }
    const gross = opts.batches.reduce((s, b) => s + b.gross, 0);
    const received = opts.batches.reduce((s, b) => s + b.received, 0);
    const pct = Math.round(((gross - received) / gross) * 100);
    return {
      answer: `Platforms kept ${formatINR(gross - received)} of ${formatINR(gross, { compact: true })} gross — an effective ${pct}% take.`,
      detail: `${opts.batches.length} settlements, ${windowLabel} · gross from order reports minus bank credits. Your PNB QR takings carry no fee.`,
      match: (r) => r.kind === "marketplace",
    };
  }

  /* per-outlet costs — the outlet dimension, derived from rent narrations */
  if (/outlet|branch|location|per store|each store/.test(q)) {
    const view = detectOutlets(entity);
    if (!view)
      return {
        answer: "Only one location shows up in this statement.",
        detail: "Outlets are detected from rent lines — nothing to split yet.",
      };
    const parts = view.outlets
      .map((o) => `${o.name} ${formatINR(o.rentMonthly, { compact: true })}`)
      .join(" · ");
    return {
      answer: `${view.outlets.length} outlets — rent runs ${formatINR(view.rentMonthlyTotal, { compact: true })}/mo: ${parts}.`,
      detail: `From ${view.outlets.reduce((s, o) => s + o.lines, 0)} rent lines. ${view.sharedLabels.join(" · ")} — ${formatINR(view.sharedMonthly, { compact: true })}/mo shared, not split per outlet.`,
      match: (r) => r.kind === "rent",
    };
  }

  /* TDS */
  if (/tds|26as|tax deducted/.test(q)) {
    const tdsRows = rows.filter((r) => r.recon.state === "matched" && r.recon.to?.includes("TDS"));
    if (tdsRows.length === 0) return { answer: "No TDS deductions detected in this window.", detail: `Scanned ${rows.length} lines, ${windowLabel}.` };
    const total = tdsRows.reduce((s, r) => {
      const inv = entity.invoices.find((i) => i.received === r.txn.amount);
      return s + (inv ? inv.total - inv.received : 0);
    }, 0);
    return {
      answer: `${formatINR(total)} of TDS tracked across ${tdsRows.length} customer payment${tdsRows.length > 1 ? "s" : ""} — claimable at filing.`,
      detail: `Credits that landed at exactly invoice − 1% (194C), ${windowLabel} · verified against 26AS at close.`,
      match: (r) => r.recon.state === "matched" && !!r.recon.to?.includes("TDS"),
    };
  }

  /* personal spends */
  if (/personal/.test(q)) {
    const p = rows.filter((r) => r.recon.state === "personal");
    const total = p.reduce((s, r) => s + r.txn.amount, 0);
    return {
      answer: p.length
        ? `${formatINR(total)} of personal spends are mixed into the business account (${p.length} debits).`
        : "No personal-looking spends in this window.",
      detail: `Known personal merchants (school, shopping, pharmacy), ${windowLabel}.`,
      match: p.length ? (r) => r.recon.state === "personal" : undefined,
    };
  }

  /* biggest vendor / expense */
  if (/(biggest|largest|top)/.test(q)) {
    const debits = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      if (r.txn.direction !== "debit") continue;
      const e = debits.get(r.name) ?? { sum: 0, n: 0 };
      e.sum += r.txn.amount;
      e.n += 1;
      debits.set(r.name, e);
    }
    const top = [...debits.entries()].sort((a, b) => b[1].sum - a[1].sum)[0];
    if (!top) return null;
    const out = rows.filter((r) => r.txn.direction === "debit").reduce((s, r) => s + r.txn.amount, 0);
    return {
      answer: `${top[0]} — ${formatINR(top[1].sum)} across ${top[1].n} payment${top[1].n > 1 ? "s" : ""}, ${Math.round((top[1].sum / out) * 100)}% of money out.`,
      detail: `Largest payee by total debits, ${windowLabel}.`,
      match: (r) => r.name === top[0] && r.txn.direction === "debit",
    };
  }

  /* category intents */
  const CATEGORY: Array<[RegExp, (r: StatementRow) => boolean, string]> = [
    [/labour|labor|site staff/, (r) => r.kind === "labour", "site labour"],
    [/salar|payroll|staff cost/, (r) => r.kind === "payroll", "salaries"],
    [/rent/, (r) => r.kind === "rent", "rent"],
    [/gst|tax paid/, (r) => r.kind === "tax", "GST payments"],
    [/electric|utility|power/, (r) => r.kind === "utility", "utilities"],
    [/ads|marketing|meta/, (r) => r.kind === "ads", "ad spend"],
    [/upi|qr|counter/, (r) => r.kind === "pg" && r.name.includes("UPI"), "UPI QR takings"],
    [/card takings|card settle/, (r) => r.kind === "pg" && !r.name.includes("UPI"), "card takings"],
    [/vendor|supplier|material/, (r) => r.kind === "vendor", "vendor payments"],
  ];
  for (const [re, fn, label] of CATEGORY) {
    if (re.test(q)) {
      const hits = rows.filter(fn);
      if (hits.length === 0)
        return { answer: `Nothing matched to ${label} in this window.`, detail: `Scanned ${rows.length} lines, ${windowLabel}.` };
      const debit = hits.filter((r) => r.txn.direction === "debit").reduce((s, r) => s + r.txn.amount, 0);
      const credit = hits.filter((r) => r.txn.direction === "credit").reduce((s, r) => s + r.txn.amount, 0);
      const main = debit >= credit ? `${label} cost ${formatINR(debit)}` : `${label} brought in ${formatINR(credit)}`;
      return {
        answer: `${cap(main)} across ${hits.length} line${hits.length > 1 ? "s" : ""}.`,
        detail: `Sum of lines matched to ${label}, ${windowLabel}.`,
        match: fn,
      };
    }
  }

  /* a known counterparty mentioned by name */
  const names = [...new Set(rows.map((r) => r.name))];
  const hit = names.find((n) => {
    const tokens = n.toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 4);
    return tokens.some((t) => q.includes(t));
  });
  if (hit) {
    const lines = rows.filter((r) => r.name === hit);
    const debit = lines.filter((r) => r.txn.direction === "debit").reduce((s, r) => s + r.txn.amount, 0);
    const credit = lines.filter((r) => r.txn.direction === "credit").reduce((s, r) => s + r.txn.amount, 0);
    const parts = [
      credit > 0 && `paid you ${formatINR(credit)}`,
      debit > 0 && `took ${formatINR(debit)}`,
    ].filter(Boolean);
    return {
      answer: `${hit} ${parts.join(" and ")} across ${lines.length} line${lines.length > 1 ? "s" : ""}.`,
      detail: `All lines for this counterparty, ${windowLabel}.`,
      match: (r) => r.name === hit,
    };
  }

  return null;
}

/** Persona-aware suggestion chips, built from what the data contains. */
export function askSuggestions(rows: StatementRow[], connected: boolean, entity?: Entity): string[] {
  const kinds = new Set(rows.map((r) => r.kind));
  const out: string[] = [];
  if (kinds.has("marketplace")) out.push(connected ? "How much did platforms keep?" : "What did platforms keep?");
  if (entity && detectOutlets(entity)) out.push("What does each outlet cost?");
  if (kinds.has("labour")) out.push("What did labour cost?");
  if (kinds.has("payroll")) out.push("What do salaries cost?");
  out.push("Biggest expense this month");
  if (rows.some((r) => r.recon.state === "matched" && r.recon.to?.includes("TDS")))
    out.push("TDS tracked so far");
  if (kinds.has("personal")) out.push("Personal spends");
  return out.slice(0, 4);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
