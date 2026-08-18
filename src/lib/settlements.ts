// Settlement batches — the engine behind the waterfall and the dispute pack.
// Everything is reconstructed deterministically from the seeded bank credits:
// for each weekly marketplace credit we derive the gross, the contracted
// deduction lines, the expected net, and — for the dipped weeks the analysis
// layer flags — the order-level evidence of commission charged above contract.

import { Entity, Txn } from "@/data/seed";
import { addDays, daysBetween } from "@/lib/format";
import {
  channelFor,
  channelSpec,
  ChannelSpec,
  contractedTake,
  flatPerPeriod,
  type HasReport,
} from "@/lib/channels";

export interface DeductionLine {
  label: string;
  amount: number;
  /**
   * Which head this lands in when the batch reaches the ledger. Carried here
   * rather than re-derived from the label, because matching on prose is how
   * two calculations of one fact start to drift.
   */
  bucket: "fee" | "gst-on-fee" | "ads" | "tcs" | "tds";
}

/** Why this order was short — the two are different claims, not one. */
export type ShortCause =
  /** The fee was charged above the contracted slab. A rate comparison. */
  | "above_slab"
  /** A referral fee was charged at all, on an item the platform zero-rated.
      A bright line, and the stronger claim of the two: there is no rate to
      argue about, only a fee that should not exist. */
  | "zero_fee_item";

export interface DisputedOrder {
  id: string;
  date: string;
  itemTotal: number;
  contractedFee: number; // what the contract says they keep
  chargedFee: number; // what they actually kept
  short: number; // chargedFee − contractedFee
  cause: ShortCause;
}

export interface SettlementBatch {
  id: string;
  channel: string;
  /** The rail's spec id — so a batch can find its rate card and window. */
  channelId: string;
  periodStart: string;
  periodEnd: string;
  creditDate: string;
  ref: string; // UTR of the bank credit — the evidence anchor
  gross: number;
  deductions: DeductionLine[];
  expectedNet: number;
  received: number;
  /** What they netted off for ads this period. Theirs to take — not a claim. */
  adsRate: number;
  variance: number; // expectedNet − received; > 0 means short-settled
  orders: DisputedOrder[]; // only populated when variance > 0
}

/** Batch-id prefix per rail — the anchor a dispute pack is filed under. */
const PREFIX: Record<string, string> = {
  swiggy: "SWG",
  zomato: "ZMT",
  amazon: "AMZ",
  flipkart: "FKT",
};

/**
 * The dip rule, in one place: more than 5% below this rail's own trailing
 * median. Three callers had their own copy of the 0.95 — the batch builder, the
 * analysis finding and now the bank-only suspicion — which is the shape this
 * codebase keeps getting bitten by.
 */
export function dipAgainst(amount: number, med: number): number {
  return amount < med * 0.95 ? med - amount : 0;
}

export function medianOf(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Enough history to call anything anomalous. */
export const MIN_PATTERN = 6;

/**
 * What the BANK alone can say about a rail: settlements that fell below its own
 * pattern, and nothing more.
 *
 * Deliberately returns no orders and no batch. This is a suspicion — the reason
 * to go and get the report — and calling it a claim is what produced a dispute
 * pack for a rail nobody had connected.
 */
export function bankOnlySuspicion(
  entity: Entity,
  channelId: string,
): { amount: number; count: number } {
  /*
   * The test only means anything when each credit is a comparable PERIOD.
   *
   * A weekly or fortnightly settlement batches hundreds of orders, so one that
   * lands 5% under the trailing median is a real anomaly. A T+1 gateway credit
   * is a single day's takings, and days differ — roughly half of them sit below
   * the median by construction. Razorpay's rail page was reporting "₹1,26,100
   * below what Razorpay usually pays · 39 settlements below its own history"
   * out of 90 daily credits: ordinary variance, dressed as a finding, and the
   * largest number on that screen.
   *
   * `suspicionsFor` had this gate and this function did not, so the overview
   * showed nothing for Razorpay while its own page showed ₹1.26L. One gate,
   * here, where both callers meet it.
   */
  const spec = channelSpec(channelId);
  if (!spec || spec.verifiable !== "report") return { amount: 0, count: 0 };

  const credits = entity.txns.filter(
    (t) => t.direction === "credit" && channelFor(t.narration)?.id === channelId,
  );
  if (credits.length < MIN_PATTERN) return { amount: 0, count: 0 };
  const med = medianOf(credits.map((t) => t.amount));
  let amount = 0;
  let count = 0;
  for (const t of credits) {
    const dip = dipAgainst(t.amount, med);
    if (dip > 0) {
      amount += dip;
      count += 1;
    }
  }
  return { amount: Math.round(amount), count };
}

/**
 * A rail that has stopped paying — measured against its own rhythm.
 *
 * Delhivery COD's last credit was 12 June, seven weeks before the anchor, on a
 * rail that had been remitting weekly. Nothing said so: the row printed "last
 * 12 Jun" in the same grey as every other date, and staleness was only ever
 * checked on the REPORT (`lastRun`), which a rail nobody has connected does not
 * have. A courier that quietly stops remitting is the largest version of
 * "delivered and never paid for" there is, and it is one of the few findings
 * the bank statement can produce on its own.
 *
 * The threshold is the rail's own median gap rather than its declared cycle —
 * same reason the take rate had to become a measurement. Three missed cycles,
 * floored at three weeks so a T+1 gateway does not cry over a long weekend.
 */
export function silentFor(
  entity: Entity,
  channelId: string,
  on: string,
): { days: number; typical: number } | null {
  const dates = entity.txns
    .filter((t) => t.direction === "credit" && channelFor(t.narration)?.id === channelId)
    .map((t) => t.date)
    .sort();
  if (dates.length < MIN_PATTERN) return null;

  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
  const typical = medianOf(gaps);
  if (typical <= 0) return null;

  const days = daysBetween(dates[dates.length - 1], on);
  return days > Math.max(21, typical * 3) ? { days, typical } : null;
}

/**
 * What the platform actually netted off for advertising and promotions in a
 * period — and the one input that must NOT come from the contract.
 *
 * Gross was reconstructed as `expectedNet / (1 − contractedTake − 0.03)`. A
 * fixed 3% plug, which made the take rate equal the contracted rate plus a
 * constant on every rail, in every period, forever: "31.6% kept · 27.7%
 * contracted" was arithmetic wearing the clothes of a finding. The hero number
 * of the whole feature could not reveal anything, because nothing about the
 * platform's actual behaviour was an input to it.
 *
 * Ad spend is the real reason a platform's take moves fortnight to fortnight,
 * and it is legitimate — they are entitled to net it off. Deterministic per rail
 * and date so the demo is stable, independent of the rate card so the take rate
 * can finally say something.
 */
export function adsRateFor(spec: ChannelSpec, creditDate: string): number {
  let h = 0;
  for (const c of `${spec.id}:${creditDate}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // 1.2%–6.0% of gross. A quiet fortnight and a festive push are not the same
  // number; on a ₹6L settlement that band is roughly ₹7,000 to ₹36,000.
  return 0.012 + (h % 49) / 1000;
}

/**
 * Deductions rebuilt from the rate card, in the order an accountant reads them:
 * the platform's own fees, the GST charged on those fees (input credit, not a
 * cost), what they netted off, then the statutory taxes — which are not costs
 * at all but advances against the owner's own liability.
 *
 * `plug` is the ads-and-promotions line: whatever the report shows deducted
 * that the rate card does not name. It is the only line we do not derive, and
 * it is labelled as such.
 */
function deductionsFor(spec: ChannelSpec, gross: number, expectedNet: number): DeductionLine[] {
  const lines: DeductionLine[] = [];
  let named = 0;

  for (const line of spec.rateCard) {
    const base =
      line.basis === "pct-of-gross" ? Math.round(gross * line.rate) : Math.round(line.rate);
    const label =
      line.basis === "pct-of-gross"
        ? `${line.label} (${(line.rate * 100).toFixed(line.rate * 100 < 10 ? 1 : 0)}% contracted)`
        : line.label;
    lines.push({ label, amount: base, bucket: "fee" });
    named += base;
    if (line.gstOnIt) {
      const gst = Math.round(base * 0.18);
      lines.push({ label: `GST on ${line.label.toLowerCase()}`, amount: gst, bucket: "gst-on-fee" });
      named += gst;
    }
  }

  // Statutory: creditable, never an expense.
  if (spec.tcs52) {
    const tcs = Math.round(gross * 0.01);
    lines.push({ label: "TCS u/s 52 (GST) — creditable", amount: tcs, bucket: "tcs" });
    named += tcs;
  }
  if (spec.tds194O) {
    const tds = Math.round(gross * 0.01);
    lines.push({ label: "TDS u/s 194-O — creditable", amount: tds, bucket: "tds" });
    named += tds;
  }

  const plug = gross - named - expectedNet;
  if (plug > 0) lines.push({ label: "Ads & promotions (netted off)", amount: plug, bucket: "ads" });
  return lines;
}

/**
 * Settlement batches, ONLY for rails whose report is in hand.
 *
 * `hasReport` is required rather than optional on purpose: every call site has
 * to state its position, and the compiler finds the ones that were quietly
 * reconstructing settlements out of bank credits alone.
 */
/** Every rail's bank-only suspicion, biggest first. Nothing here needs a report. */
export function suspicionsFor(
  entity: Entity,
): Array<{ channel: string; channelId: string; amount: number; count: number }> {
  const ids = new Set<string>();
  for (const t of entity.txns) {
    if (t.direction !== "credit") continue;
    const spec = channelFor(t.narration);
    if (spec?.verifiable === "report") ids.add(spec.id);
  }
  return [...ids]
    .map((id) => ({
      channelId: id,
      channel: channelFor(entity.txns.find((t) => channelFor(t.narration)?.id === id)!.narration)!.name,
      ...bankOnlySuspicion(entity, id),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function buildBatches(entity: Entity, hasReport: HasReport): SettlementBatch[] {
  const byChannel = new Map<string, Txn[]>();
  for (const t of entity.txns) {
    if (t.direction !== "credit") continue;
    const spec = channelFor(t.narration);
    // Only rails whose report gives a gross can be reconstructed. A card
    // settlement has a real fee inside it that we simply cannot see.
    if (!spec || spec.verifiable !== "report") continue;
    // No report, no batch. The gross, the deductions and the order-level
    // evidence are all readings OF the report — without it there is nothing to
    // reconstruct and anything produced here would be invented.
    if (!hasReport(spec.id)) continue;
    const list = byChannel.get(spec.id) ?? [];
    list.push(t);
    byChannel.set(spec.id, list);
  }

  const out: SettlementBatch[] = [];
  for (const [id, list] of byChannel) {
    const spec = channelFor(list[0].narration)!;
    const prefix = PREFIX[id] ?? id.slice(0, 3).toUpperCase();
    if (list.length < MIN_PATTERN) continue; // need a pattern before calling anomalies
    const med = medianOf(list.map((t) => t.amount));
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const take = contractedTake(spec) + (spec.tcs52 ? 0.01 : 0) + (spec.tds194O ? 0.01 : 0);
    const period = spec.cycle === "Fortnightly" ? 14 : 7;

    sorted.forEach((t, idx) => {
      const dip = Math.round(dipAgainst(t.amount, med));
      const expectedNet = t.amount + dip;

      // Gross follows from what the platform ACTUALLY kept — the contracted
      // rate plus the ads it netted off this period — rounded to a clean
      // hundred the way a real settlement report reads.
      // Solved for gross, flat lines included:
      //   expectedNet = gross·(1 − take − ads) − flat
      // The flat term was missing, so gross came out short by the packaging
      // charge and the ads plug silently absorbed it.
      const ads = adsRateFor(spec, t.date);
      const flat = flatPerPeriod(spec);
      const gross = Math.round((expectedNet + flat) / (1 - take - ads) / 100) * 100;

      out.push({
        id: `${prefix}-${t.date.replaceAll("-", "")}`,
        channel: spec.name,
        channelId: spec.id,
        periodStart: addDays(t.date, -period),
        periodEnd: addDays(t.date, -1),
        creditDate: t.date,
        ref: t.ref,
        gross,
        adsRate: ads,
        deductions: deductionsFor(spec, gross, expectedNet),
        expectedNet,
        received: t.amount,
        variance: dip,
        orders: dip > 0 ? buildOrders(prefix, t.date, dip, idx, spec) : [],
      });
    });
  }

  return out.sort((a, b) => (a.creditDate < b.creditDate ? 1 : -1));
}

/**
 * Order-level evidence for a short-settled batch: the variance split across
 * plausible orders where the fee charged exceeds the contracted rate.
 * Deterministic — patterns indexed by position, remainder folded into the
 * last order so the shorts sum to the variance exactly.
 */
function buildOrders(
  prefix: string,
  creditDate: string,
  variance: number,
  seedIdx: number,
  spec: ChannelSpec,
): DisputedOrder[] {
  const ITEM_TOTALS = [1840, 2460, 1290, 3180, 2210, 1650, 2890, 1980, 2540, 1420, 3420, 2160];
  /* Items under the platform's zero-fee threshold. A real settlement is a mix
     of price points, and the mix is what makes the second check possible: a fee
     on one of these is not "a bit high", it is a fee that should not exist. */
  const SUB_THRESHOLD = [640, 820, 390, 750, 910, 480, 690, 560];

  const rule = spec.zeroFeeBelow;
  const ruleLive = !!rule && creditDate >= rule.from;

  const count = Math.max(12, Math.min(96, Math.round(variance / 420)));
  const base = Math.floor(variance / count);

  const orders: DisputedOrder[] = [];
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const short = i === count - 1 ? variance - allocated : base + ((i * 37) % 160) - 80;
    allocated += short;
    // Every third order is a low-priced item, where the rule applies.
    const zeroFee = ruleLive && i % 3 === 0;
    const itemTotal = zeroFee
      ? SUB_THRESHOLD[(i + seedIdx) % SUB_THRESHOLD.length]
      : ITEM_TOTALS[(i + seedIdx) % ITEM_TOTALS.length];
    const headline = spec.rateCard[0]?.rate ?? 0.2;
    // On a zero-rated item the contracted fee is nil, so the whole charge is
    // the claim. On any other, only the excess over the slab is.
    const contractedFee = zeroFee ? 0 : Math.round(itemTotal * headline);
    orders.push({
      id: `${prefix}-${creditDate.slice(5, 7)}${creditDate.slice(8, 10)}-${String(2140 + i * 7)}`,
      date: addDays(creditDate, -(1 + (i % 7))),
      itemTotal,
      contractedFee,
      chargedFee: contractedFee + short,
      short,
      cause: zeroFee ? "zero_fee_item" : "above_slab",
    });
  }
  return orders;
}

export function findBatch(
  entity: Entity,
  id: string,
  hasReport: HasReport,
): SettlementBatch | undefined {
  return buildBatches(entity, hasReport).find((b) => b.id === id);
}
