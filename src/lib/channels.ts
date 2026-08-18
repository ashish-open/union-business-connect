// The rails money actually arrives on.
//
// For a QSR or a D2C brand most revenue never arrives as a payment from a
// customer. It arrives as a NET settlement from a platform, days later, with
// the platform's cut already removed. This table is what the contract says
// they may keep — everything else in the product measures against it.
//
// Built the way DOC_SPEC was: one row per rail carrying only what differs, so
// adding Cashfree or Meesho is a row, not a screen.

import { Entity, Txn } from "@/data/seed";

export type ChannelKind =
  | "aggregator" // Swiggy, Zomato — weekly, commission-heavy
  | "gateway" // Razorpay, Cashfree — T+1, MDR inside the credit
  | "upi" // BharatPe, Paytm QR — T+1, and zero MDR by law
  | "pos" // card machine — T+1, MDR by card type
  | "marketplace" // Amazon, Flipkart — fortnightly, referral + fees
  | "cod"; // Delhivery / Shiprocket COD remittance

/**
 * How much of the truth we can actually reach.
 *
 * This is the honest core of the whole feature. The statement used to mark
 * every gateway credit "matched" with the words "Card takings · T+1" — 154
 * credits on one persona, checked against nothing. A rail we cannot verify
 * must say so.
 */
export type Verifiability =
  /** The report gives gross and every deduction — arithmetic, with evidence. */
  | "report"
  /** No report needed: the law fixes the rate, so any deduction is a finding. */
  | "law"
  /** The fee is real and inside the credit; without the portal we cannot see it. */
  | "opaque";

export interface RateLine {
  label: string;
  /** Of gross sales, unless stated. */
  basis: "pct-of-gross" | "flat-per-period";
  rate: number;
  /** Commission attracts 18% GST — which is input credit the owner can claim. */
  gstOnIt?: boolean;
}

/**
 * How a rail's reports get here. A ladder of effort against trust:
 *
 *  · upload — the owner exports from the portal and drops the file in. Works
 *    everywhere, needs nobody's permission, and is stale the moment it lands.
 *  · agent  — a browser agent runs on the OWNER'S machine, signs in with the
 *    session they already have, and pulls the reports. The credentials never
 *    reach us, which is the only reason a bank could ship this.
 *  · api    — keys, and the platform hands the data over directly. Cleanest,
 *    and only possible where the platform actually has a seller API.
 */
export type ConnectMethod = "upload" | "agent" | "api";

/** Which of the two sides of a reconciliation we hold. */
export interface ReportsHeld {
  /** The platform's settlement report: gross, every fee, what they sent. */
  settlement: boolean;
  /** The owner's own order book: what was sold and shipped. */
  orders: boolean;
}

export interface ChannelSpec {
  id: string;
  name: string;
  kind: ChannelKind;
  /** Narration → rail. */
  match: RegExp;
  cycle: string;
  /** Where the truth lives, named so "connect it" means something. */
  reportSource: string;
  /** Sign-in page the browser agent would drive. */
  portalUrl: string;
  /** Ways in, in the order we would recommend them. */
  methods: ConnectMethod[];
  /** Named so the API option can say whose API, not "an API". */
  apiName?: string;
  verifiable: Verifiability;
  /** Days after the settlement in which the platform still accepts a claim. */
  disputeWindowDays: number;
  rateCard: RateLine[];
  /**
   * Statutory deductions, which are NOT costs — they are taxes already paid on
   * the owner's behalf and creditable against their own liability.
   *
   * The distinction matters and the old code got it wrong, labelling one line
   * "TCS u/s 194-O" — two different taxes welded into one nonsense name. TCS is
   * §52 of CGST; 194-O is income-tax TDS.
   *
   * And TCS does not apply to restaurant supplies through an aggregator: since
   * Jan 2022 the aggregator itself pays the GST under §9(5), so there is no
   * supply by the restaurant for §52 to collect on. Marketplaces selling goods
   * are the opposite — both apply.
   */
  tcs52: boolean;
  tds194O: boolean;
  /**
   * A price below which the platform charges no referral fee at all, and the
   * date the rule took effect.
   *
   * Amazon India zero-rated the referral fee on over 12.5 crore products priced
   * under ₹1,000 from 16 March 2026. It is the most checkable rule in
   * marketplace reconciliation — a bright line, not a rate comparison — which
   * is exactly why it belongs in a spec table WITH its effective date rather
   * than as a condition somewhere in the engine. Rules like this get revised,
   * and a revision should be an edit to one row.
   */
  zeroFeeBelow?: { amount: number; from: string };
}

const GST_ON_COMMISSION = 0.18;

export const CHANNELS: ChannelSpec[] = [
  {
    id: "swiggy",
    name: "Swiggy",
    kind: "aggregator",
    match: /BUNDL TECHNOLOGIES|SWIGGY/i,
    cycle: "Weekly",
    reportSource: "Swiggy partner portal",
    portalUrl: "partner.swiggy.com",
    methods: ["upload", "agent"],
    verifiable: "report",
    disputeWindowDays: 30,
    rateCard: [
      { label: "Commission", basis: "pct-of-gross", rate: 0.22, gstOnIt: true },
      { label: "Payment gateway fee", basis: "pct-of-gross", rate: 0.018 },
      { label: "Packaging charges", basis: "flat-per-period", rate: 6800 },
    ],
    tcs52: false, // §9(5) — Swiggy pays the GST on the restaurant supply
    tds194O: true,
  },
  {
    id: "zomato",
    name: "Zomato",
    kind: "aggregator",
    match: /ZOMATO/i,
    cycle: "Weekly",
    reportSource: "Zomato partner portal",
    portalUrl: "partners.zomato.com",
    methods: ["upload", "agent"],
    verifiable: "report",
    disputeWindowDays: 30,
    rateCard: [
      { label: "Commission", basis: "pct-of-gross", rate: 0.24, gstOnIt: true },
      { label: "Payment gateway fee", basis: "pct-of-gross", rate: 0.018 },
      { label: "Packaging charges", basis: "flat-per-period", rate: 5400 },
    ],
    tcs52: false,
    tds194O: true,
  },
  {
    id: "razorpay",
    name: "Razorpay",
    kind: "gateway",
    match: /RAZORPAY/i,
    cycle: "T+1",
    reportSource: "Razorpay dashboard",
    portalUrl: "dashboard.razorpay.com",
    methods: ["api", "agent", "upload"],
    apiName: "Razorpay API keys",
    verifiable: "opaque",
    disputeWindowDays: 90,
    rateCard: [{ label: "MDR", basis: "pct-of-gross", rate: 0.02, gstOnIt: true }],
    tcs52: false,
    tds194O: false,
  },
  {
    id: "bharatpe",
    name: "BharatPe UPI",
    kind: "upi",
    match: /BHARATPE/i,
    cycle: "Daily",
    reportSource: "BharatPe merchant app",
    portalUrl: "merchant.bharatpe.com",
    methods: ["upload", "agent"],
    // UPI carries zero MDR by law, so the whole collection must arrive. We can
    // say that without anyone's portal — and any deduction at all is a finding.
    verifiable: "law",
    disputeWindowDays: 60,
    rateCard: [],
    tcs52: false,
    tds194O: false,
  },
  {
    id: "pinelabs",
    name: "Pine Labs POS",
    kind: "pos",
    match: /PINE LABS|PINELABS/i,
    cycle: "T+1",
    reportSource: "Pine Labs merchant portal",
    portalUrl: "pluralonline.com",
    methods: ["upload", "agent"],
    verifiable: "opaque",
    disputeWindowDays: 90,
    rateCard: [{ label: "MDR (card mix)", basis: "pct-of-gross", rate: 0.017, gstOnIt: true }],
    tcs52: false,
    tds194O: false,
  },
  {
    id: "amazon",
    name: "Amazon",
    kind: "marketplace",
    match: /AMAZON SELLER|CLICKTECH|AMAZON PAY/i,
    cycle: "Fortnightly",
    reportSource: "Seller Central settlement report",
    portalUrl: "sellercentral.amazon.in",
    methods: ["api", "agent", "upload"],
    apiName: "Amazon SP-API",
    verifiable: "report",
    disputeWindowDays: 30,
    rateCard: [
      { label: "Referral fee", basis: "pct-of-gross", rate: 0.135, gstOnIt: true },
      { label: "Closing fee", basis: "pct-of-gross", rate: 0.021, gstOnIt: true },
      { label: "Shipping & fulfilment", basis: "pct-of-gross", rate: 0.062, gstOnIt: true },
    ],
    tcs52: true, // goods, so §52 applies
    tds194O: true,
    zeroFeeBelow: { amount: 1000, from: "2026-03-16" },
  },
  {
    id: "flipkart",
    name: "Flipkart",
    kind: "marketplace",
    match: /FLIPKART|INSTAKART/i,
    cycle: "Weekly",
    reportSource: "Seller Hub settlement report",
    portalUrl: "seller.flipkart.com",
    methods: ["api", "agent", "upload"],
    apiName: "Flipkart Seller API",
    verifiable: "report",
    disputeWindowDays: 30,
    rateCard: [
      { label: "Commission", basis: "pct-of-gross", rate: 0.124, gstOnIt: true },
      { label: "Collection fee", basis: "pct-of-gross", rate: 0.018, gstOnIt: true },
      { label: "Shipping fee", basis: "pct-of-gross", rate: 0.058, gstOnIt: true },
    ],
    tcs52: true,
    tds194O: true,
  },
  {
    id: "delhivery",
    name: "Delhivery COD",
    kind: "cod",
    match: /DELHIVERY|SHIPROCKET/i,
    cycle: "Weekly",
    reportSource: "Delhivery COD remittance report",
    portalUrl: "one.delhivery.com",
    methods: ["api", "agent", "upload"],
    apiName: "Delhivery API token",
    // A remittance is not an order value: returns and RTO come out of it, so
    // the two never agree and pretending otherwise would be noise.
    verifiable: "opaque",
    disputeWindowDays: 45,
    rateCard: [{ label: "COD handling", basis: "pct-of-gross", rate: 0.012, gstOnIt: true }],
    tcs52: false,
    tds194O: false,
  },
];

const BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

export function channelSpec(id: string): ChannelSpec | undefined {
  return BY_ID.get(id);
}

/** Which rail, if any, a bank narration belongs to. */
export function channelFor(narration: string): ChannelSpec | undefined {
  return CHANNELS.find((c) => c.match.test(narration));
}

/* ------------------------------------------------------------------ */

export interface ChannelState {
  spec: ChannelSpec;
  credits: Txn[];
  received: number;
  /** Only meaningful where we can see the report. */
  gross: number | null;
  kept: number | null;
  /** What share of gross the platform kept, actual. */
  takeRatePct: number | null;
  /** What the rate card says they should have kept. */
  contractedPct: number;
  /** Of the take, what went on ads — theirs to keep, not a claim. */
  adsPct: number | null;
  /** Of the take, what exceeded the contracted slab — yours to claim. */
  excessPct: number | null;
  lastCredit: string | null;
  /** We hold the platform's settlement report. */
  connected: boolean;
  /** We hold the owner's own order book. */
  hasOrders: boolean;
  /** How it got here, for the UI to say so. */
  method: ConnectMethod | null;
  /** ISO date the reports were last pulled, if ever. */
  lastRun: string | null;
}

/** Structural shape of a stored source — avoids importing the store here. */
export interface ChannelSourceLike {
  method: ConnectMethod;
  settlement: boolean;
  orders: boolean;
  since: string;
  lastRun: string;
}

/** The contracted take, as a share of gross, GST on fees included. */
/**
 * The flat lines — charged per settlement regardless of volume.
 *
 * `contractedTake` returns a RATE, so it can only ever describe the
 * percentage-of-gross lines. Swiggy and Zomato also levy a flat packaging
 * charge, and the settlement builder was reconstructing gross from the rate
 * alone: the flat ₹5,400 came out of the ads plug, which stayed positive only
 * because that plug was hardcoded at a generous 3%. Narrow the plug to
 * something realistic and the arithmetic stops closing.
 */
export function flatPerPeriod(spec: ChannelSpec): number {
  return spec.rateCard
    .filter((l) => l.basis === "flat-per-period")
    .reduce((s, l) => s + l.rate, 0);
}

/**
 * What a platform kept on a rail nobody has checked yet.
 *
 * Worked back from the rate card and the money that landed, so it is an
 * ESTIMATE and every caller labels it as one — it is what the contract says
 * they should have kept, not what they did. That distinction is the entire
 * feature, so it must never be printed as though it were measured.
 *
 * It exists because the overview said "Platforms kept · Not visible" for a rail
 * whose own page, one click away, put a number on it. Absence is not zero (D6),
 * but "we cannot know" is the wrong answer when the rate card and the credits
 * are both in hand: the honest answer is the estimate, marked as one.
 */
export function unverifiedKept(rail: ChannelState): number {
  const take = contractedTake(rail.spec);
  if (take <= 0 || take >= 1) return 0;
  const flat = flatPerPeriod(rail.spec) * rail.credits.length;
  return Math.round((rail.received / (1 - take)) * take + flat);
}

export function contractedTake(spec: ChannelSpec): number {
  return spec.rateCard
    .filter((l) => l.basis === "pct-of-gross")
    .reduce((s, l) => s + l.rate * (l.gstOnIt ? 1 + GST_ON_COMMISSION : 1), 0);
}

/**
 * Every rail this business actually receives money on.
 *
 * Rails are found in the statement, never configured — the same inversion the
 * rest of the product runs on. A business that has never taken a Swiggy order
 * does not get a Swiggy row to dismiss.
 */
/** Whether a rail's settlement report is actually in hand. */
export type HasReport = (channelId: string) => boolean;

/**
 * The single definition of "we hold this rail's report", because everything
 * downstream hangs off it: the batches, the take rate, the claim, and the
 * printable dispute pack.
 *
 * It was not a definition at all before — `buildChannels` decided per rail from
 * the source, while `buildBatches` reconstructed settlements for every rail with
 * six credits regardless. So a business that had connected nothing was still
 * offered a claim letter carrying its GSTIN, a real bank UTR and 79 fabricated
 * order IDs. A batch is a reading of a report; with no report there is nothing
 * to read.
 */
export function reportHeld(opts: {
  source?: (id: string) => ChannelSourceLike | undefined;
  /** The statement's one-tap aggregator flow, kept working. */
  aggregatorsOn?: boolean;
}): HasReport {
  return (id) => {
    const spec = BY_ID.get(id);
    if (!spec) return false;
    return !!opts.source?.(id)?.settlement || (spec.kind === "aggregator" && !!opts.aggregatorsOn);
  };
}

/** Nothing held. The honest default wherever a caller has no session to ask. */
export const NO_REPORTS: HasReport = () => false;

/**
 * Whether we hold the owner's ORDER book for a rail — the other side of the
 * reconciliation, and the only thing that can show an order that was delivered
 * and never paid for.
 *
 * It is a separate question from `reportHeld`, and it had no single answer:
 * `buildChannels` derived it one way while three pages each inlined their own,
 * and the inlined version read `orders || aggregatorsOn`, which handed an order
 * book to Amazon the moment a Swiggy connection existed. Unremitted orders are
 * invented from that predicate, so a loose reading here prints order IDs for a
 * book nobody gave us — the fabrication in §22, one file over.
 */
export function ordersHeld(opts: {
  source?: (id: string) => ChannelSourceLike | undefined;
  aggregatorsOn?: boolean;
}): (id: string) => boolean {
  return (id) => {
    const spec = BY_ID.get(id);
    if (!spec) return false;
    return !!opts.source?.(id)?.orders || (spec.kind === "aggregator" && !!opts.aggregatorsOn);
  };
}

export function buildChannels(
  entity: Entity,
  opts: {
    /** What we hold for a rail, if anything. */
    source?: (channelId: string) => ChannelSourceLike | undefined;
    /** The statement's one-tap aggregator flow, kept working. */
    aggregatorsOn?: boolean;
    /**
     * The reconstructed settlements, so the take rate is measured against the
     * SAME grosses the waterfall and the ledger use.
     *
     * Deriving gross here from the contracted rate — which is what this did
     * first — makes the take rate equal the contract by construction, so a
     * rail could read "27.8% kept · 27.8% contracted" while showing ₹58,900
     * charged above contract on the same row. Two calculations of one fact,
     * disagreeing in public.
     */
    grossBy?: Map<string, { gross: number; received: number; ads: number; excess: number }>;
  },
): ChannelState[] {
  const byId = new Map<string, Txn[]>();
  for (const t of entity.txns) {
    if (t.direction !== "credit") continue;
    const spec = channelFor(t.narration);
    if (!spec) continue;
    const list = byId.get(spec.id) ?? [];
    list.push(t);
    byId.set(spec.id, list);
  }

  const out: ChannelState[] = [];
  for (const [id, credits] of byId) {
    const spec = BY_ID.get(id)!;
    const received = credits.reduce((s, t) => s + t.amount, 0);
    const src = opts.source?.(id);
    const aggregator = spec.kind === "aggregator" && !!opts.aggregatorsOn;
    const connected = !!src?.settlement || aggregator;
    const hasOrders = !!src?.orders || aggregator;
    const sorted = [...credits].sort((a, b) => (a.date < b.date ? 1 : -1));

    // Gross is only knowable where the report is in hand. Inferring one for a
    // card settlement would be the Suspense mistake in reverse: a confident
    // number where we have none.
    const settled = opts.grossBy?.get(id);
    const canSeeGross = spec.verifiable === "report" && connected && !!settled;
    const take = contractedTake(spec) + (spec.tcs52 ? 0.01 : 0) + (spec.tds194O ? 0.01 : 0);
    const gross = canSeeGross ? settled!.gross : null;

    out.push({
      spec,
      credits: sorted,
      received,
      gross,
      // Measured against the settled credits only — a rail whose latest week
      // has not settled yet would otherwise read as if the platform kept it.
      kept: gross === null ? null : gross - settled!.received,
      takeRatePct: gross === null ? null : ((gross - settled!.received) / gross) * 100,
      contractedPct: take * 100,
      /* The gap over contract, split by who it belongs to. Ads are the
         platform's to net off; only what was charged above the slab is a claim.
         Reporting the whole gap as "above contract" inflated a real finding
         with a legitimate deduction. */
      adsPct: gross === null ? null : (settled!.ads / gross) * 100,
      excessPct: gross === null ? null : (settled!.excess / gross) * 100,
      lastCredit: sorted[0]?.date ?? null,
      connected,
      hasOrders,
      method: src?.method ?? (aggregator ? "agent" : null),
      lastRun: src ? (src.lastRun ?? src.since) : null,
    });
  }

  // Biggest rail first: it is the one they came to look at (serial position).
  return out.sort((a, b) => b.received - a.received);
}
