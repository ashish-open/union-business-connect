// Bank-console seed — the pilot cohort as the bank sees it, month 4.
// Numbers are deliberately pilot-scale and internally consistent: the
// renewal arithmetic on this page is the pitch.

export const CONSOLE_PERIOD = "July 2026 · pilot month 4";

export const HEADLINE = {
  attributedCA: 38_60_00_000, // avg CA balance attributable to the platform
  attributedCADeltaMonth: 6_20_00_000,
  activated: 1187,
  breakEvenAccounts: 3700,
  loansBook: 14_20_00_000,
  loansCount: 96,
  settlementsRedirectedMonthly: 9_80_00_000,
  settlementSwitchers: 214,
  disputesRecovered: 18_40_000, // for SMEs — the stickiness proof
  disputePacks: 61,
  licence: 5_50_00_000,
  costOfDepositsPct: 5.0,
  loanSpreadPct: 3.0,
};

export const FUNNEL = [
  { stage: "Signed up", count: 2412 },
  { stage: "Activated within 7 days", count: 1187 },
  { stage: "Channel or bank connected", count: 486 },
  { stage: "Settlements land at Union Bank", count: 214 },
  { stage: "Credit drawn", count: 96 },
];

export interface RmLead {
  id: string;
  business: string;
  branch: string;
  signal: string;
  value: string; // the number that makes the RM call
}

export const RM_LEADS: RmLead[] = [
  {
    id: "l1",
    business: "Arjun Sweets & Snacks",
    branch: "Jayanagar",
    signal: "Zomato settlements land at HDFC — visible via connected account",
    value: "₹8.2L / month",
  },
  {
    id: "l2",
    business: "Kaveri Traders",
    branch: "Peenya",
    signal: "GST and vendor payments run from ICICI CA; only savings with Union Bank",
    value: "₹14.6L / month flows",
  },
  {
    id: "l3",
    business: "Blue Hills Pharma",
    branch: "Whitefield",
    signal: "Idle balance never below ₹28L for 6 months — FD/sweep candidate",
    value: "₹28L idle",
  },
  {
    id: "l4",
    business: "Nisha Boutique",
    branch: "HSR Layout",
    signal: "214 UPI credits a month on another bank's QR",
    value: "₹6.4L / month",
  },
  {
    id: "l5",
    business: "Ganga Hardware",
    branch: "Yeshwanthpur",
    signal: "Eligible for ₹12L OD on reconciled cashflow — never offered",
    value: "₹12L headroom",
  },
];

export interface PortfolioRow {
  name: string;
  segment: string;
  branch: string;
  mab: number;
  explainedPct: number;
  modules: string[];
  live?: boolean; // computed from the SME seed at render time
}

export const PORTFOLIO_STATIC: PortfolioRow[] = [
  { name: "Deccan Auto Spares", segment: "Trading", branch: "Peenya", mab: 11_40_000, explainedPct: 97, modules: ["Payouts", "Close"] },
  { name: "Mysore Silks Retail", segment: "Retail", branch: "Jayanagar", mab: 7_80_000, explainedPct: 94, modules: ["Collections", "QR"] },
  { name: "Everest Caterers", segment: "HORECA", branch: "Indiranagar", mab: 5_20_000, explainedPct: 96, modules: ["Recon", "Payouts", "Close"] },
  { name: "Shakti Engineering", segment: "Manufacturing", branch: "Peenya", mab: 22_60_000, explainedPct: 91, modules: ["Payouts", "Credit"] },
  { name: "Lotus Diagnostics", segment: "Healthcare", branch: "Whitefield", mab: 9_10_000, explainedPct: 98, modules: ["Collections", "Close"] },
  { name: "Cauvery Agro Exports", segment: "Exports", branch: "Yeshwanthpur", mab: 31_40_000, explainedPct: 89, modules: ["Payouts"] },
  { name: "Urban Nest Furnishing", segment: "D2C", branch: "HSR Layout", mab: 6_70_000, explainedPct: 95, modules: ["Recon", "Collections"] },
  { name: "Sri Devi Transport", segment: "Logistics", branch: "Peenya", mab: 4_30_000, explainedPct: 93, modules: ["Payouts"] },
];

export interface AgentRow {
  name: string;
  does: string;
  never: string;
  activity: string;
}

export const AGENTS: AgentRow[] = [
  {
    name: "Statement enrichment",
    does: "Names counterparties, tags every line at source, cites its rules",
    never: "Writes free-form values — deterministic rules only",
    activity: "1.2L lines tagged · 96% auto-matched",
  },
  {
    name: "Dispute filer",
    does: "Drafts order-level variance claims with evidence",
    never: "Files without a human — every pack needs the owner's approval",
    activity: "61 packs drafted · ₹18.4L recovered",
  },
  {
    name: "Receivables chaser",
    does: "Sends reminder ladders, stops the moment the bank credit lands",
    never: "Escalates tone or frequency beyond the owner's setting",
    activity: "3,804 reminders · ₹2.6 Cr collected",
  },
  {
    name: "Sweep & deposit advisor",
    does: "Proposes FD/sweep when a balance floor is observed for months",
    never: "Moves money — proposals only, owner approves",
    activity: "142 proposals · ₹4.1 Cr swept",
  },
];

export const AUDIT_LOG = [
  {
    at: "27 Jul · 14:02",
    entry:
      "Dispute filer requested auto-filing of 2 packs for Nadi Foods — BLOCKED: filing requires the owner's approval. Approved by the owner at 16:40.",
    refusal: true,
  },
  {
    at: "26 Jul · 09:15",
    entry: "Receivables chaser paused reminders to Anita Menon — part payment of ₹65,000 landed.",
    refusal: false,
  },
  {
    at: "24 Jul · 18:30",
    entry: "Statement enrichment proposed 3 new rules from repeated manual fixes; 2 accepted by owners.",
    refusal: false,
  },
  {
    at: "22 Jul · 11:08",
    entry: "Sweep advisor proposed ₹5L FD for Blue Hills Pharma (floor ₹28L, 6 months observed). Pending owner.",
    refusal: false,
  },
];
