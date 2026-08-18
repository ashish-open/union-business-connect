// Supplier bills that have arrived but are not yet paid.
//
// Paid supplier debits are already in the statement and already post to
// Purchases, so seeding those again would double-count. What the books are
// missing is the other half: bills sitting in the drawer. That is what makes
// Creditors a real number and what the Payouts screen should be paying.
//
// Every supplier here is one the statement already names, so nothing arrives
// from nowhere.

export interface SeedBillLine {
  itemId: string | null;
  description: string;
  qty: number;
  rate: number;
  taxPct: number;
}

export interface SeedBill {
  number: string;
  party: string;
  /** Days before the anchor date the bill was raised. */
  daysAgo: number;
  /** Days after the bill date it falls due. */
  terms: number;
  lines: SeedBillLine[];
  /** Part payments already made against it. */
  paid?: number;
}

const RAJESH: SeedBill[] = [
  {
    number: "BILL-241",
    party: "Shree Timber Mart",
    daysAgo: 11,
    terms: 30,
    lines: [{ itemId: "ply-18", description: "Plywood 18mm BWP", qty: 40, rate: 2480, taxPct: 18 }],
  },
  {
    // 52 days old and unpaid: the 43B(h) case. Without one bill past the line
    // the rule could never fire for anybody, which is the same trap the empty
    // document types were.
    number: "BILL-238",
    party: "Sleek Kitchen Fittings",
    daysAgo: 52,
    terms: 30,
    lines: [{ itemId: "kit-fit", description: "Kitchen fitting set", qty: 6, rate: 9200, taxPct: 18 }],
  },
  {
    number: "BILL-242",
    party: "Greenlam distributor",
    daysAgo: 6,
    terms: 15,
    lines: [{ itemId: "lam-1mm", description: "Laminate 1mm", qty: 60, rate: 1080, taxPct: 18 }],
  },
  {
    number: "BILL-243",
    party: "Ebco Hardware Point",
    daysAgo: 3,
    terms: 30,
    lines: [
      { itemId: "hw-hinge", description: "Soft-close hinge", qty: 200, rate: 215, taxPct: 18 },
      { itemId: "hw-channel", description: "Telescopic channel", qty: 40, rate: 520, taxPct: 18 },
    ],
  },
];

const NADI: SeedBill[] = [
  {
    number: "BILL-1188",
    party: "Freshpoint Agro",
    daysAgo: 5,
    terms: 15,
    lines: [{ itemId: "veg-mix", description: "Vegetables (mixed)", qty: 900, rate: 62, taxPct: 0 }],
  },
  {
    number: "BILL-1189",
    party: "Kannan Packaging",
    daysAgo: 9,
    terms: 30,
    lines: [
      { itemId: "pack-box", description: "Delivery box (medium)", qty: 6000, rate: 9, taxPct: 18 },
    ],
  },
];

const COMMISSARY: SeedBill[] = [
  {
    number: "BILL-556",
    party: "Metro Cash And Carry",
    daysAgo: 4,
    terms: 21,
    lines: [{ itemId: "grain-bulk", description: "Grain (bulk)", qty: 1200, rate: 52, taxPct: 5 }],
  },
];

const VISTARA: SeedBill[] = [
  {
    number: "BILL-7714",
    party: "UltraTech",
    daysAgo: 8,
    terms: 30,
    lines: [{ itemId: "cement-opc", description: "OPC 53 cement", qty: 2000, rate: 395, taxPct: 28 }],
  },
  {
    number: "BILL-7715",
    party: "JSW",
    daysAgo: 15,
    terms: 45,
    lines: [{ itemId: "steel-tmt", description: "TMT bar 12mm", qty: 18, rate: 58400, taxPct: 18 }],
    paid: 500000,
  },
];

const ARKA: SeedBill[] = [
  {
    number: "BILL-302",
    party: "Freshpoint Agro",
    daysAgo: 7,
    terms: 15,
    lines: [{ itemId: "veg-mix", description: "Vegetables (mixed)", qty: 300, rate: 62, taxPct: 0 }],
  },
];

export const BILLS: Record<string, SeedBill[]> = {
  "rajesh-interiors": RAJESH,
  "nadi-foods": NADI,
  "nadi-commissary": COMMISSARY,
  "vistara-projects": VISTARA,
  "arka-kitchen": ARKA,
};

export function billsFor(entityId: string): SeedBill[] {
  return BILLS[entityId] ?? [];
}

/* ------------------------------------------------------------------ */
/* what the 2B and the MSME register say about a supplier              */
/* ------------------------------------------------------------------ */

export interface SupplierMeta {
  /** Registered micro or small — the 45-day clock under 43B(h) applies. */
  msme: boolean;
  /**
   * Whether they filed GSTR-1 for the period. A bank statement cannot know
   * this; only the 2B can. Seeded here because that is where the real product
   * reads it, and every screen using it says so.
   */
  filedGstr1: boolean;
}

const SUPPLIERS: Record<string, SupplierMeta> = {
  "Shree Timber Mart": { msme: true, filedGstr1: true },
  "Greenlam distributor": { msme: true, filedGstr1: false },
  "Ebco Hardware Point": { msme: true, filedGstr1: true },
  "Sleek Kitchen Fittings": { msme: true, filedGstr1: false },
  "Asian Paints dealer": { msme: false, filedGstr1: true },
  "Freshpoint Agro": { msme: true, filedGstr1: true },
  "Kannan Packaging": { msme: true, filedGstr1: false },
  "Metro Cash And Carry": { msme: false, filedGstr1: true },
  UltraTech: { msme: false, filedGstr1: true },
  JSW: { msme: false, filedGstr1: true },
};

/** Unknown suppliers are treated as filed and not MSME — never invent a risk. */
export function supplierMeta(name: string): SupplierMeta {
  return SUPPLIERS[name] ?? { msme: false, filedGstr1: true };
}
