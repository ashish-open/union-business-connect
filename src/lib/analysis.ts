// The statement analysis engine behind the 60-second aha. Every finding is
// computed from the entity's transactions and invoices — deterministic,
// inspectable, and each one names its evidence. No literals on screen.

import { ANCHOR_DATE, Entity, Txn } from "@/data/seed";
import { addDays, daysBetween, fmtDate, formatINR, plural } from "@/lib/format";
import { channelFor } from "@/lib/channels";
import { buildBalance } from "@/lib/balance";

/* ------------------------------------------------------------------ */
/* Counterparty resolution — narration grammar + alias table            */
/* ------------------------------------------------------------------ */

export type CounterpartyKind =
  | "marketplace"
  | "pg"
  | "customer"
  | "vendor"
  | "payroll"
  | "rent"
  | "tax"
  | "utility"
  | "ads"
  | "personal"
  | "labour"
  | "transport"
  | "internal";

/**
 * What each kind is called, once, for the whole product.
 *
 * There were three of these — `close/report/page.tsx`, `try/page.tsx` and
 * `compliance.ts` — and they had already drifted: `vendor` was "Vendors &
 * materials" on the close report, "Suppliers" on the other two; `utility` was
 * "Utilities", "Electricity & utilities" and "Electricity and utilities";
 * `transport` was "Transport" twice and "Freight and transport" once. One
 * category, three names, three screens an owner moves between in a minute.
 *
 * It lives beside the type it labels so a new kind is a compile error in one
 * place rather than a raw slug leaking onto a screen somewhere.
 */
export const KIND_LABEL: Record<CounterpartyKind | "unknown", string> = {
  marketplace: "Marketplaces",
  pg: "Cards & UPI",
  customer: "Customers",
  vendor: "Suppliers",
  payroll: "Salaries",
  rent: "Rent",
  tax: "GST & taxes",
  utility: "Utilities",
  ads: "Advertising",
  personal: "Personal",
  labour: "Labour",
  transport: "Transport",
  internal: "Own transfers",
  unknown: "Unnamed",
};

export interface Alias {
  match: RegExp;
  name: string;
  kind: CounterpartyKind;
}

// Exported so the statement can show its rules in plain language —
// every auto-match cites the rule that produced it.
export const ALIASES: Alias[] = [
  { match: /BUNDL TECHNOLOGIES/i, name: "Swiggy", kind: "marketplace" },
  { match: /ZOMATO/i, name: "Zomato", kind: "marketplace" },
  { match: /RAZORPAY/i, name: "Razorpay (cards)", kind: "pg" },
  { match: /BHARATPE/i, name: "BharatPe (UPI QR)", kind: "pg" },
  // Marketplaces settle the way aggregators do — a report with a gross, so
  // they take the batch path and can be checked against their rate card.
  { match: /CLICKTECH|AMAZON/i, name: "Amazon", kind: "marketplace" },
  { match: /INSTAKART|FLIPKART/i, name: "Flipkart", kind: "marketplace" },
  // A COD remittance and a card machine both hand over money collected for
  // you, net of a fee only their own report shows.
  { match: /DELHIVERY/i, name: "Delhivery (COD)", kind: "pg" },
  { match: /PINE LABS/i, name: "Pine Labs (POS)", kind: "pg" },
  { match: /VEDIC HERBALS/i, name: "Vedic Herbals", kind: "vendor" },
  { match: /PACKMAN PRINTS/i, name: "Packman Prints", kind: "vendor" },
  { match: /GOOGLE INDIA/i, name: "Google Ads", kind: "ads" },
  { match: /NYKAA/i, name: "Nykaa Retail", kind: "customer" },
  { match: /WELLNESS CART/i, name: "Wellness Cart", kind: "customer" },
  { match: /SALARY BATCH/i, name: "Salaries", kind: "payroll" },
  { match: /RENT /i, name: "Outlet rent", kind: "rent" },
  { match: /GST PMT|CBIC/i, name: "GST payment", kind: "tax" },
  { match: /BESCOM/i, name: "BESCOM electricity", kind: "utility" },
  { match: /META PLATFORMS/i, name: "Meta Ads", kind: "ads" },
  { match: /LAKSHMI TRADERS/i, name: "Sri Lakshmi Traders", kind: "vendor" },
  { match: /FRESHPOINT/i, name: "Freshpoint Agro", kind: "vendor" },
  { match: /KANNAN PACKAGING/i, name: "Kannan Packaging", kind: "vendor" },
  { match: /PRESTIGE TECH PARK/i, name: "Prestige Tech Park FM", kind: "customer" },
  { match: /ZERODHA/i, name: "Zerodha Broking Ltd", kind: "customer" },
  { match: /URBANNEST/i, name: "Urbannest Developers LLP", kind: "customer" },
  { match: /KEERTHI CONSTRUCTIONS/i, name: "Keerthi Constructions", kind: "customer" },
  { match: /ANITA MENON/i, name: "Anita Menon", kind: "customer" },
  { match: /RENJITH PILLAI/i, name: "Renjith Pillai", kind: "customer" },
  { match: /PRAKASH SHETTY/i, name: "Prakash Shetty", kind: "customer" },
  { match: /LABOUR BATCH/i, name: "Site labour", kind: "labour" },
  { match: /TIMBER MART/i, name: "Shree Timber Mart", kind: "vendor" },
  { match: /ASIAN PAINTS/i, name: "Asian Paints dealer", kind: "vendor" },
  { match: /GREENLAM/i, name: "Greenlam distributor", kind: "vendor" },
  { match: /EBCO/i, name: "Ebco Hardware Point", kind: "vendor" },
  { match: /SLEEK KITCHEN/i, name: "Sleek Kitchen Fittings", kind: "vendor" },
  { match: /PORTER/i, name: "Porter (transport)", kind: "transport" },
  { match: /NADI FOODS/i, name: "Nadi Foods (own entity)", kind: "internal" },
  { match: /AUTO SPLIT/i, name: "70/30 auto-split to ops", kind: "internal" },
  { match: /SELF TRANSFER|OWN ACCOUNT|INTERNAL TRANSFER/i, name: "Transfer to own account", kind: "internal" },
  { match: /LNT GEOSTRUCTURE/i, name: "L&T Geostructure", kind: "vendor" },
  { match: /JSW STEEL/i, name: "JSW Steel dealer", kind: "vendor" },
  { match: /ULTRATECH/i, name: "UltraTech RMC", kind: "vendor" },
  { match: /SCHINDLER/i, name: "Schindler India", kind: "vendor" },
  { match: /MORPHOGENESIS/i, name: "Morphogenesis Architects", kind: "vendor" },
  { match: /DENTSU/i, name: "Dentsu Creative", kind: "ads" },
  { match: /METRO CASH/i, name: "Metro Cash & Carry", kind: "vendor" },
  { match: /NANDINI DAIRY/i, name: "Nandini Dairy distributor", kind: "vendor" },
  { match: /VIBGYOR|SCHOOL/i, name: "School fee", kind: "personal" },
  { match: /MYNTRA/i, name: "Myntra", kind: "personal" },
  { match: /APOLLO PHARMACY/i, name: "Apollo Pharmacy", kind: "personal" },
  /*
   * The voice demo account (Chitra Interiors). Its whole premise is a clean
   * history — that is why a caller asking for a balance gets one answer and not
   * a hedge — and without these four the premise was false: all 54 of its lines
   * resolved "unknown", so every one sat in Suspense, the party master derived
   * nothing from the bank at all, and the completeness screen put ₹13.57L of gap
   * on a business holding ₹7.42L.
   *
   * The names must match `VOICE_DEMO_INVOICES` exactly or `buildParties` keeps
   * the invoice customer and the bank counterparty as two different parties.
   */
  { match: /AMULDIST/i, name: "Amul Distributors", kind: "customer" },
  { match: /KAMALTEX/i, name: "Kamal Textiles", kind: "customer" },
  { match: /SHARMATRADERS/i, name: "Sharma Traders", kind: "vendor" },
  { match: /PAYROLL/i, name: "Salaries", kind: "payroll" },
];

export interface Resolved {
  name: string;
  kind: CounterpartyKind | "unknown";
}

/**
 * Buyer installments arrive against a per-unit virtual account:
 * "NEFT CR-{IFSC}-{BUYER}-VA UNIT {UNIT}-INSTALLMENT". The buyer's name is
 * in the narration, so read it rather than falling back to the IFSC — a
 * statement line must never show a raw bank string where a name belongs.
 */
const VA_CREDIT = /-([A-Z][A-Z .]+?)-VA UNIT ([A-Z]-\d+)/i;

export function resolveCounterparty(narration: string): Resolved {
  for (const a of ALIASES) {
    if (a.match.test(narration)) return { name: a.name, kind: a.kind };
  }
  const va = narration.match(VA_CREDIT);
  if (va) return { name: titleCase(va[1].trim()), kind: "customer" };
  return { name: narration.split("-")[1] ?? narration, kind: "unknown" };
}

/** "Amazon and Flipkart" · "Swiggy, Zomato and Amazon" — never a bare list. */
function listNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Findings                                                             */
/* ------------------------------------------------------------------ */

export type FindingKind =
  | "channel_lump"
  | "balance_floor"
  | "settlement_dip"
  | "dispute_ready"
  | "duplicate"
  | "tds"
  | "receivables"
  | "advance"
  | "personal";

export type Tone = "info" | "warn" | "neg" | "pos";

/*
 * `title` and `evidence` land in a REPEATED row, so they carry a word budget
 * (law G2): the title states the fact after the amount, the evidence states
 * where the number came from, and neither restates the other. `body` is the
 * long form — it appears once, on the first-run handover, where a sentence read
 * a single time at the moment it decides something is the right shape.
 *
 * These titles used to be sentences: "looks short-settled against your own
 * weekly pattern" directly above "4 settlements vs 13-week median" — the
 * mechanism in prose and then again in numbers, twelve times down one column.
 */
export interface Finding {
  kind: FindingKind;
  /** Rails behind it, biggest first — so the CTA can name the real platform. */
  channels?: string[];
  amount: number; // the headline rupee figure
  title: string;
  body: string;
  action: string;
  /** Where the action goes. On the finding, so the handover cannot guess. */
  href: string;
  evidence: string; // "12 credits · 90 days" — where the number comes from
  tone: Tone;
}

export interface Analysis {
  txnCount: number;
  daysCovered: number;
  accountCount: number;
  resolvedPct: number; // % of txns whose counterparty we could name
  findings: Finding[];
  primaryCta: { label: string; sub: string; href: string };
  mode: "channels" | "projects";
}

export function analyse(entity: Entity, connected = false): Analysis {
  const txns = entity.txns;
  const findings: Finding[] = [];

  const resolved = txns.filter((t) => resolveCounterparty(t.narration).kind !== "unknown").length;

  /* 1 — marketplace money we can only see as lump sums (last 30 days) */
  const cutoff30 = addDays(ANCHOR_DATE, -30);
  const channelCredits = txns.filter(
    (t) =>
      t.direction === "credit" &&
      t.date >= cutoff30 &&
      resolveCounterparty(t.narration).kind === "marketplace",
  );
  if (channelCredits.length > 0 && !connected) {
    const total = sum(channelCredits);
    // Name the rails this business ACTUALLY has. The action here read
    // "Connect Swiggy & Zomato" for everybody — so a D2C brand's single
    // biggest first-run number pointed at two platforms it does not sell on.
    // On the one screen whose whole job is to prove we read the statement,
    // that is not a wrong label, it is a broken promise.
    const byRail = new Map<string, number>();
    for (const t of channelCredits) {
      const spec = channelFor(t.narration);
      const name = spec?.name ?? resolveCounterparty(t.narration).name;
      byRail.set(name, (byRail.get(name) ?? 0) + t.amount); // rank by rupees
    }
    const ranked = [...byRail.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    findings.push({
      kind: "channel_lump",
      href: "/channels",
      amount: total,
      title: `from ${listNames(ranked)} · fees not visible`,
      body: `${plural(channelCredits.length, "credit")} we can see the total of and nothing inside. Every commission and deduction stays invisible until the reports are connected.`,
      action: `Connect ${ranked[0]}`,
      evidence: `${plural(channelCredits.length, "credit")} · last 30 days`,
      tone: "info",
      channels: ranked,
    });
  }

  /* 2 — settlements that dip below the trailing pattern */
  const dips = settlementDips(txns);
  if (dips.total > 0 && connected) {
    findings.push({
      kind: "dispute_ready",
      href: "/channels/disputes",
      amount: dips.total,
      title: `recoverable · ${dips.weeks.length} short settlements`,
      body: `Commission charged above your contracted rate. Dispute packs drafted with order-level evidence.`,
      action: "Review disputes",
      evidence: `${dips.weeks.length} dispute packs · order-level evidence`,
      tone: "warn",
    });
  }
  if (dips.total > 0 && !connected) {
    findings.push({
      kind: "settlement_dip",
      href: "/channels/disputes",
      amount: dips.total,
      title: "short-settled",
      body: `${dips.weeks.length} settlements (${dips.weeks.join(", ")}) below the trailing median. Connect to confirm order-level.`,
      action: "See the gap",
      evidence: `${dips.weeks.length} settlements vs 13-week median`,
      tone: "warn",
    });
  }

  /* 3 — duplicate-looking debits */
  const dup = findDuplicate(txns);
  if (dup) {
    const sameDay = dup.a.date === dup.b.date;
    findings.push({
      kind: "duplicate",
      href: "/statement?filter=issues",
      amount: dup.amount,
      title: `possibly charged twice · ${resolveCounterparty(dup.a.narration).name}`,
      body: sameDay
        ? `${formatINR(dup.amount)} twice on ${fmtDate(dup.a.date)}. Worth a call if one wasn't intentional.`
        : `${formatINR(dup.amount)} on ${fmtDate(dup.a.date)} and ${fmtDate(dup.b.date)}. Worth a call if one wasn't intentional.`,
      action: "Review the pair",
      evidence: sameDay
        ? "2 debits · same amount, same day"
        : `2 debits · same amount, ${Math.abs(daysBetween(dup.b.date, dup.a.date))} days apart`,
      tone: "neg",
    });
  }

  /* 4 — TDS deducted by payers */
  const tds = tdsShortfalls(entity);
  if (tds.total > 0) {
    findings.push({
      kind: "tds",
      href: "/compliance/tds",
      amount: tds.total,
      title: `deducted as TDS · ${plural(tds.count, "payment")}`,
      body: `Landed at exactly 99% of invoice — TDS u/s 194C. Claimable at filing if you track it.`,
      action: "Track for 26AS",
      evidence: `${tds.count} credits at exactly invoice − 1%`,
      tone: "warn",
    });
  }

  /* 5 — overdue receivables */
  const due = overdue(entity);
  if (due.total > 0) {
    findings.push({
      kind: "receivables",
      href: "/collections",
      amount: due.total,
      title: `overdue · ${plural(due.customers, "customer")}`,
      body: `${plural(due.invoices, "invoice")} past due, the oldest by ${plural(due.oldestDays, "day")}. A reminder with a link recovers most.`,
      action: "Chase all with one tap",
      evidence: `${plural(due.invoices, "invoice")} past due`,
      tone: "neg",
    });
  }

  /* 6 — advances with no invoice behind them */
  const adv = advances(entity);
  if (adv.total > 0) {
    const plural = adv.count > 1;
    findings.push({
      kind: "advance",
      href: "/sales/invoice",
      amount: adv.total,
      title: plural
        ? `advances with no invoices raised`
        : `advance with no invoice raised`,
      body: `${adv.names.join(" and ")} paid ahead of billing. Raise the invoice${plural ? "s" : ""} to keep GST clean.`,
      action: plural ? "Raise the invoices" : "Raise the invoice",
      evidence: `${adv.count} credit${plural ? "s" : ""} · no open invoice matches`,
      tone: "info",
    });
  }

  /* 7 — personal spends in the business account */
  const personal = personalSpends(txns);
  if (personal.total > 0) {
    findings.push({
      kind: "personal",
      href: "/statement?filter=issues",
      amount: personal.total,
      title: `personal spend in the business account`,
      body: `${personal.count} debits look personal. Marking them keeps your books and credit file clean.`,
      action: "Mark as personal",
      evidence: `${personal.count} debits · last 60 days`,
      tone: "info",
    });
  }

  /* A clean business still deserves a number it has never seen.
     "All clear" is truthful and forgettable, and a first impression is the one
     moment this product cannot afford to be forgettable. The balance floor is
     the fact every business has, nobody has been shown, and a lender actually
     prices on — so it needs no data beyond the statement that is already here. */
  if (findings.length === 0) {
    // buildBalance already walks back from today's real balances through the
    // same classifier the journal uses, so internal transfers between the
    // owner's own accounts do not move the line. A second walk-back written
    // here counted them and drove the floor negative — the "two calculations
    // of one fact" trap this codebase has been bitten by four times.
    const bal = buildBalance(entity, 90);
    const floor = bal.trustworthy ? bal.low : 0;
    if (floor > 0) {
      findings.push({
        kind: "balance_floor",
      href: "/balance",
        amount: floor,
        title: "lowest balance this quarter",
        body: `Walked back day by day from today's balance. That floor is what a lender prices on, and most owners have never seen theirs.`,
        action: "See how it moved",
        evidence: `${plural(txns.length, "line")} · walked back from today`,
        tone: "pos",
      });
    }
  }

  findings.sort((a, b) => b.amount - a.amount);
  const top = findings.slice(0, 4);

  const mode: Analysis["mode"] = channelCredits.length > 0 ? "channels" : "projects";
  /* The end of the first run pays off its own peak.
     The CTA used to be chosen by `mode`, so a developer shown a ₹3.29 Cr
     balance floor was then offered "See who owes you" — a different errand
     from the one fact they had just been given. Peak and end are the two
     moments anyone remembers; making them disagree wastes both. */
  const peak = top[0];
  /* The sub-line under the last button is a PAYOFF, not provenance.
     It read `peak.evidence` — "7 credits · last 30 days" — which is a
     footnote. The end of an experience is remembered as much as its peak, and
     a footnote is not a reason to press anything. So it says what pressing it
     gets you, and where we already have a number for that, it uses the
     number. */
  const alreadyOwed = top.find((f) => f.kind === "settlement_dip" || f.kind === "dispute_ready");
  const payoff = peak
    ? peak.kind === "channel_lump"
      ? alreadyOwed
        ? `${formatINR(alreadyOwed.amount)} already looks over-charged`
        : "Every fee becomes visible, order by order"
      : peak.kind === "balance_floor"
        ? "The number a lender would price on"
        : peak.evidence
    : "Nothing needs you today";
  const primaryCta = peak
    ? { label: peak.action, sub: payoff, href: peak.href }
    : { label: "Go to your workspace", sub: payoff, href: "/today" };

  return {
    txnCount: txns.length,
    /* From the OLDEST line, found by value.
       This read `txns[txns.length - 1].date`, which assumes every seed's
       transactions are sorted newest-last. They are not: Nadi's array ends
       oldest and Chitra's ends today, so the same expression reported "89 days"
       for one business and "last 0 days" for the other — on the sentence whose
       entire job is to say how much statement we read. */
    daysCovered: txns.length
      ? daysBetween(
          txns.reduce((oldest, t) => (t.date < oldest ? t.date : oldest), txns[0].date),
          ANCHOR_DATE,
        )
      : 0,
    accountCount: entity.accounts.length,
    resolvedPct: txns.length ? Math.round((resolved / txns.length) * 100) : 0,
    findings: top,
    primaryCta,
    mode,
  };
}

/* ------------------------------------------------------------------ */
/* detectors                                                            */
/* ------------------------------------------------------------------ */

function sum(txns: Txn[]): number {
  return txns.reduce((s, t) => s + t.amount, 0);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Weekly marketplace settlements that land >5% below that channel's median. */
function settlementDips(txns: Txn[]): { total: number; weeks: string[] } {
  const channels = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.direction !== "credit") continue;
    const r = resolveCounterparty(t.narration);
    if (r.kind !== "marketplace") continue;
    const list = channels.get(r.name) ?? [];
    list.push(t);
    channels.set(r.name, list);
  }
  let total = 0;
  const weeks: string[] = [];
  for (const [name, list] of channels) {
    if (list.length < 6) continue; // need a pattern before calling anomalies
    const med = median(list.map((t) => t.amount));
    for (const t of list) {
      if (t.amount < med * 0.95) {
        total += med - t.amount;
        weeks.push(`${name} ${fmtDate(t.date)}`);
      }
    }
  }
  return { total: Math.round(total), weeks };
}

/** Two debits, same counterparty, same amount ≥ ₹25k, ≤3 days apart. */
function findDuplicate(txns: Txn[]): { a: Txn; b: Txn; amount: number } | null {
  const debits = txns.filter((t) => t.direction === "debit" && t.amount >= 25000);
  for (let i = 0; i < debits.length; i++) {
    for (let j = i + 1; j < debits.length; j++) {
      const a = debits[i];
      const b = debits[j];
      if (
        a.amount === b.amount &&
        resolveCounterparty(a.narration).name === resolveCounterparty(b.narration).name &&
        Math.abs(daysBetween(b.date, a.date)) <= 3
      ) {
        return { a, b, amount: a.amount };
      }
    }
  }
  return null;
}

/** Credits that land at exactly total × (1 − 1%) against a TDS-eligible invoice. */
function tdsShortfalls(entity: Entity): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const inv of entity.invoices) {
    if (!inv.tdsSection || inv.received === 0) continue;
    const expectedNet = Math.round(inv.total * 0.99);
    if (Math.abs(inv.received - expectedNet) <= 2) {
      total += inv.total - inv.received;
      count += 1;
    }
  }
  return { total, count };
}

function overdue(entity: Entity): {
  total: number;
  invoices: number;
  customers: number;
  oldestDays: number;
} {
  const late = entity.invoices.filter(
    (i) => i.dueDate < ANCHOR_DATE && i.received < i.total && !isTdsSettled(i),
  );
  const total = late.reduce((s, i) => s + (i.total - i.received), 0);
  const customers = new Set(late.map((i) => i.customer)).size;
  const oldestDays = late.length
    ? Math.max(...late.map((i) => daysBetween(i.dueDate, ANCHOR_DATE)))
    : 0;
  return { total, invoices: late.length, customers, oldestDays };
}

/** An invoice short by exactly its 1% TDS is settled, not overdue. */
function isTdsSettled(inv: { total: number; received: number; tdsSection?: string }): boolean {
  return !!inv.tdsSection && Math.abs(inv.received - Math.round(inv.total * 0.99)) <= 2;
}

/** Credits ≥ ₹50k from known customers with no open invoice to absorb them. */
function advances(entity: Entity): { total: number; count: number; names: string[] } {
  const openByCustomer = new Map<string, number>();
  for (const inv of entity.invoices) {
    if (inv.received < inv.total && !isTdsSettled(inv)) {
      openByCustomer.set(inv.customer, (openByCustomer.get(inv.customer) ?? 0) + (inv.total - inv.received));
    }
  }
  let total = 0;
  let count = 0;
  const names: string[] = [];
  for (const t of entity.txns) {
    if (t.direction !== "credit" || t.amount < 50000) continue;
    if (!/ADV/i.test(t.narration)) continue;
    const r = resolveCounterparty(t.narration);
    if (r.kind !== "customer") continue;
    const open = openByCustomer.get(r.name) ?? 0;
    if (t.amount > open) {
      total += t.amount;
      count += 1;
      if (!names.includes(r.name)) names.push(r.name);
    }
  }
  return { total, count, names };
}

function personalSpends(txns: Txn[]): { total: number; count: number } {
  const cutoff = addDays(ANCHOR_DATE, -60);
  const personal = txns.filter(
    (t) =>
      t.direction === "debit" &&
      t.date >= cutoff &&
      resolveCounterparty(t.narration).kind === "personal",
  );
  return { total: sum(personal), count: personal.length };
}
