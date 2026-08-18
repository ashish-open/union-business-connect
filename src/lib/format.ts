// Indian-format money and dates. Money is the hero of every screen, so the
// rules are strict: tabular numerals (via .tnum class), Indian grouping,
// compact lakh/crore only where space demands it.

export function formatINR(amount: number, opts?: { compact?: boolean; sign?: boolean }): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : opts?.sign ? "+" : "";

  if (opts?.compact) {
    if (abs >= 1_00_00_000) return `${sign}₹${trimZero((abs / 1_00_00_000).toFixed(2))} Cr`;
    if (abs >= 1_00_000) return `${sign}₹${trimZero((abs / 1_00_000).toFixed(1))}L`;
    if (abs >= 1_000) return `${sign}₹${trimZero((abs / 1_000).toFixed(1))}K`;
  }

  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function trimZero(s: string): string {
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function maskAccount(acct: string): string {
  return `••${acct.slice(-4)}`;
}

// ── Reading what people actually type ────────────────────────────────────────
//
// Postel's law: be liberal in what you accept, conservative in what you send.
// We had three hand-rolled parsers instead, and two of them were wrong. The
// worst was on the payment sheet — `Number(x.replace(/\D/g, ""))` — where a
// decimal point silently multiplied the payment by a hundred: 50000.50 was
// sent as ₹50,00,050.
//
// So: one parser, liberal about the input, and it returns `null` rather than
// `0` when it cannot read something. A field that shows a confident wrong
// number is worse than a field that says it did not understand.

const AMOUNT = /^(\d+(?:\.\d+)?)(k|l|lakh|lac|cr|crore)?$/i;

const MULTIPLIER: Record<string, number> = {
  k: 1_000,
  l: 1_00_000,
  lakh: 1_00_000,
  lac: 1_00_000,
  cr: 1_00_00_000,
  crore: 1_00_00_000,
};

export interface Amount {
  /** Whole rupees. */
  value: number;
  /** What we did to their input, when we did not take it literally. */
  note: string | null;
}

/**
 * Accepts `₹1,50,000` · `1,50,000` · `150000` · `1.5L` · `2 Cr` · `45k` ·
 * `Rs. 50,000` · `50000.50`, and whatever spacing came with a paste.
 * Returns null for anything it cannot read, including empty and negative.
 */
export function parseAmount(raw: string): Amount | null {
  const cleaned = raw
    .replace(/[₹,\s ]/g, "")
    .replace(/^(rs\.?|inr)/i, "");
  if (!cleaned) return null;

  const m = AMOUNT.exec(cleaned);
  if (!m) return null;

  const [, digits, suffix] = m;
  const scaled = Number(digits) * (suffix ? MULTIPLIER[suffix.toLowerCase()] : 1);
  if (!Number.isFinite(scaled) || scaled <= 0) return null;

  // The books are whole-rupee, and so is GST — tax is rounded to the nearest
  // rupee by law. Paise are therefore rounded rather than carried. Doing that
  // silently would be the same class of bug we are fixing, so it says so.
  const value = Math.round(scaled);
  const note = suffix || value !== scaled ? `Reading this as ${formatINR(value)}` : null;
  return { value, note };
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Bank details arrive pasted out of WhatsApp, so spaces and hyphens are the
 * norm. Strip them, then check the real shape — `length > 4` let `PUNB 01234`
 * through to a penny drop that could only fail.
 */
export function parseIfsc(raw: string): string | null {
  const cleaned = raw.replace(/[\s -]/g, "").toUpperCase();
  return IFSC.test(cleaned) ? cleaned : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateFull(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00").getTime();
  const b = new Date(toIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  // build the ISO string locally — toISOString() converts to UTC and shifts
  // the date back a day for any timezone east of Greenwich
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * "1 entry" / "2 entries". Written once because hand-rolled plurals have now
 * shipped three bugs — "1 lines need explaining", "1 batch still waits",
 * "1 entries".
 */
export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? one + "s")}`;
}
