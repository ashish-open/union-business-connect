// Seeded documents beyond invoices and bills.
//
// Without these, eight of the eleven document types open empty — a sub-nav
// full of screens that have never had a row in them. An empty list is an
// honest state when a business genuinely has none; it is a dead demo when
// every business has none.
//
// So each persona carries the documents its trade actually raises: an
// interiors contractor quotes and delivers, a commissary raises purchase
// orders, a restaurant rings up cash memos.

import { DocKind } from "@/lib/docs";

export interface SeedDocLine {
  itemId: string | null;
  description: string;
  qty: number;
  rate: number;
  taxPct: number;
}

export interface SeedDoc {
  kind: DocKind;
  number: string;
  party: string;
  daysAgo: number;
  terms?: number;
  lines: SeedDocLine[];
  paid?: number;
  convertedFrom?: string;
  /** Fully settled on the spot — a cash memo, not a debt. */
  settled?: boolean;
}

const RAJESH: SeedDoc[] = [
  {
    kind: "quotation",
    number: "QT-88",
    party: "Prakash Shetty",
    daysAgo: 6,
    lines: [
      { itemId: "kit-fit", description: "Kitchen fitting set", qty: 3, rate: 12800, taxPct: 18 },
      { itemId: "lam-1mm", description: "Laminate 1mm", qty: 24, rate: 1450, taxPct: 18 },
    ],
  },
  {
    kind: "salesOrder",
    number: "SO-42",
    party: "Urbannest Developers LLP",
    daysAgo: 13,
    lines: [{ itemId: "ply-18", description: "Plywood 18mm BWP", qty: 30, rate: 3250, taxPct: 18 }],
  },
  {
    kind: "deliveryChallan",
    number: "DC-31",
    party: "Urbannest Developers LLP",
    daysAgo: 9,
    convertedFrom: "SO-42",
    lines: [{ itemId: "ply-18", description: "Plywood 18mm BWP", qty: 30, rate: 3250, taxPct: 18 }],
  },
  {
    // Posts and moves stock — this is what makes Item P&L and COGS real.
    kind: "cashMemo",
    number: "CM-17",
    party: "Renjith Pillai",
    daysAgo: 4,
    settled: true,
    lines: [
      { itemId: "hw-hinge", description: "Soft-close hinge", qty: 24, rate: 340, taxPct: 18 },
      { itemId: "paint-emul", description: "Emulsion paint 20L", qty: 2, rate: 6400, taxPct: 18 },
    ],
  },
  {
    kind: "creditNote",
    number: "CN-9",
    party: "Anita Menon",
    daysAgo: 2,
    lines: [{ itemId: "lam-1mm", description: "Laminate returned — damaged", qty: 4, rate: 1450, taxPct: 18 }],
  },
  {
    kind: "purchaseOrder",
    number: "PO-119",
    party: "Sleek Kitchen Fittings",
    daysAgo: 5,
    lines: [{ itemId: "kit-fit", description: "Kitchen fitting set", qty: 10, rate: 9200, taxPct: 18 }],
  },
  {
    kind: "receiptNote",
    number: "GRN-77",
    party: "Asian Paints dealer",
    daysAgo: 3,
    lines: [{ itemId: "paint-emul", description: "Emulsion paint 20L", qty: 8, rate: 4950, taxPct: 18 }],
  },
  {
    kind: "debitNote",
    number: "DN-6",
    party: "Shree Timber Mart",
    daysAgo: 1,
    lines: [{ itemId: "ply-18", description: "Plywood returned — warped", qty: 5, rate: 2480, taxPct: 18 }],
  },
];

const NADI: SeedDoc[] = [
  {
    kind: "quotation",
    number: "QT-310",
    party: "Prestige Tech Park FM",
    daysAgo: 5,
    lines: [{ itemId: "cat-event", description: "Event catering (per head)", qty: 220, rate: 640, taxPct: 5 }],
  },
  {
    kind: "salesOrder",
    number: "SO-208",
    party: "Zerodha Broking Ltd",
    daysAgo: 8,
    lines: [{ itemId: "cat-thali", description: "Corporate thali", qty: 400, rate: 260, taxPct: 5 }],
  },
  {
    kind: "purchaseOrder",
    number: "PO-902",
    party: "Freshpoint Agro",
    daysAgo: 3,
    lines: [{ itemId: "veg-mix", description: "Vegetables (mixed)", qty: 1200, rate: 62, taxPct: 0 }],
  },
];

const VISTARA: SeedDoc[] = [
  {
    kind: "purchaseOrder",
    number: "PO-4410",
    party: "UltraTech",
    daysAgo: 6,
    lines: [{ itemId: "cement-opc", description: "OPC 53 cement", qty: 1500, rate: 395, taxPct: 28 }],
  },
  {
    kind: "receiptNote",
    number: "GRN-2201",
    party: "JSW",
    daysAgo: 4,
    lines: [{ itemId: "steel-tmt", description: "TMT bar 12mm", qty: 12, rate: 58400, taxPct: 18 }],
  },
];

const COMMISSARY: SeedDoc[] = [
  {
    kind: "purchaseOrder",
    number: "PO-88",
    party: "Metro Cash And Carry",
    daysAgo: 5,
    lines: [{ itemId: "grain-bulk", description: "Grain (bulk)", qty: 800, rate: 52, taxPct: 5 }],
  },
];

export const SEED_DOCS: Record<string, SeedDoc[]> = {
  "rajesh-interiors": RAJESH,
  "nadi-foods": NADI,
  "vistara-projects": VISTARA,
  "nadi-commissary": COMMISSARY,
  "arka-kitchen": [],
};

export function seedDocsFor(entityId: string): SeedDoc[] {
  return SEED_DOCS[entityId] ?? [];
}
