// Item masters — what each business actually buys and sells.
//
// Kept small and real per persona rather than a generic catalogue: an
// interiors contractor stocks ply and laminate, a commissary stocks grain and
// oil, a developer stocks cement and steel. Opening stock is the quantity on
// hand at the start of the window the books cover; its value lands on the
// balance sheet as Stock in hand.
//
// HSN and GST% are carried because GSTR-1 needs an HSN summary, and because a
// rate on the item is a rate nobody has to remember on the invoice.

export interface Item {
  id: string;
  name: string;
  unit: string;
  hsn: string;
  gstPct: number;
  /** What we sell it for. */
  rate: number;
  /** What it costs us — drives stock valuation and item margin. */
  cost: number;
  openingQty: number;
  /** Below this, the item is flagged low. */
  reorder: number;
  /** Services carry no stock; only goods move quantity. */
  service?: boolean;
}

/* ------------------------------------------------------------------ */

const RAJESH: Item[] = [
  { id: "ply-18", name: "Plywood 18mm BWP", unit: "sheet", hsn: "4412", gstPct: 18, rate: 3250, cost: 2480, openingQty: 145, reorder: 40 },
  { id: "lam-1mm", name: "Laminate 1mm", unit: "sheet", hsn: "4823", gstPct: 18, rate: 1450, cost: 1080, openingQty: 210, reorder: 60 },
  { id: "hw-hinge", name: "Soft-close hinge", unit: "pc", hsn: "8302", gstPct: 18, rate: 340, cost: 215, openingQty: 620, reorder: 200 },
  { id: "hw-channel", name: "Telescopic channel", unit: "pair", hsn: "8302", gstPct: 18, rate: 780, cost: 520, openingQty: 180, reorder: 60 },
  { id: "paint-emul", name: "Emulsion paint 20L", unit: "can", hsn: "3209", gstPct: 18, rate: 6400, cost: 4950, openingQty: 34, reorder: 40 },
  { id: "kit-fit", name: "Kitchen fitting set", unit: "set", hsn: "7324", gstPct: 18, rate: 12800, cost: 9200, openingQty: 22, reorder: 8 },
  { id: "svc-design", name: "Design & supervision", unit: "job", hsn: "9954", gstPct: 18, rate: 45000, cost: 0, openingQty: 0, reorder: 0, service: true },
];

const NADI: Item[] = [
  { id: "veg-mix", name: "Vegetables (mixed)", unit: "kg", hsn: "0709", gstPct: 0, rate: 0, cost: 62, openingQty: 340, reorder: 120 },
  { id: "rice-sona", name: "Sona Masoori rice", unit: "kg", hsn: "1006", gstPct: 5, rate: 0, cost: 58, openingQty: 900, reorder: 300 },
  { id: "oil-sun", name: "Sunflower oil", unit: "L", hsn: "1512", gstPct: 5, rate: 0, cost: 142, openingQty: 260, reorder: 100 },
  { id: "pack-box", name: "Delivery box (medium)", unit: "pc", hsn: "4819", gstPct: 18, rate: 0, cost: 9, openingQty: 12400, reorder: 4000 },
  { id: "dairy-milk", name: "Milk", unit: "L", hsn: "0401", gstPct: 0, rate: 0, cost: 54, openingQty: 180, reorder: 200 },
  { id: "cat-thali", name: "Corporate thali", unit: "plate", hsn: "9963", gstPct: 5, rate: 260, cost: 138, openingQty: 0, reorder: 0, service: true },
  { id: "cat-event", name: "Event catering (per head)", unit: "head", hsn: "9963", gstPct: 5, rate: 640, cost: 310, openingQty: 0, reorder: 0, service: true },
];

const COMMISSARY: Item[] = [
  { id: "grain-bulk", name: "Grain (bulk)", unit: "kg", hsn: "1006", gstPct: 5, rate: 64, cost: 52, openingQty: 2400, reorder: 800 },
  { id: "dairy-bulk", name: "Dairy (bulk)", unit: "L", hsn: "0401", gstPct: 0, rate: 60, cost: 49, openingQty: 640, reorder: 200 },
  { id: "spice-mix", name: "Spice mix", unit: "kg", hsn: "0910", gstPct: 5, rate: 420, cost: 305, openingQty: 180, reorder: 60 },
  { id: "oil-bulk", name: "Cooking oil (bulk)", unit: "L", hsn: "1512", gstPct: 5, rate: 156, cost: 138, openingQty: 520, reorder: 200 },
];

const VISTARA: Item[] = [
  { id: "cement-opc", name: "OPC 53 cement", unit: "bag", hsn: "2523", gstPct: 28, rate: 0, cost: 395, openingQty: 3200, reorder: 1000 },
  { id: "steel-tmt", name: "TMT bar 12mm", unit: "tonne", hsn: "7214", gstPct: 18, rate: 0, cost: 58400, openingQty: 46, reorder: 15 },
  { id: "sand-msand", name: "M-sand", unit: "cu.m", hsn: "2505", gstPct: 5, rate: 0, cost: 1850, openingQty: 380, reorder: 400 },
  { id: "block-aac", name: "AAC block", unit: "pc", hsn: "6810", gstPct: 18, rate: 0, cost: 58, openingQty: 14200, reorder: 5000 },
];

const ARKA: Item[] = [
  { id: "veg-mix", name: "Vegetables (mixed)", unit: "kg", hsn: "0709", gstPct: 0, rate: 0, cost: 62, openingQty: 120, reorder: 60 },
  { id: "pack-box", name: "Delivery box (medium)", unit: "pc", hsn: "4819", gstPct: 18, rate: 0, cost: 9, openingQty: 3200, reorder: 1500 },
  { id: "dairy-milk", name: "Milk", unit: "L", hsn: "0401", gstPct: 0, rate: 0, cost: 54, openingQty: 60, reorder: 40 },
  { id: "cat-thali", name: "Cloud-kitchen thali", unit: "plate", hsn: "9963", gstPct: 5, rate: 240, cost: 128, openingQty: 0, reorder: 0, service: true },
];

// A D2C label ships physical goods it does not make: the contract
// manufacturer fills, Packman prints, and everything moves through a
// marketplace. Rates are the MRP the storefront lists; cost is the landed
// cost per unit from the filler.
const KAAYA: Item[] = [
  { id: "serum-vitc", name: "Vitamin C serum 30ml", unit: "pc", hsn: "3304", gstPct: 18, rate: 899, cost: 214, openingQty: 1840, reorder: 600 },
  { id: "oil-hair", name: "Bhringraj hair oil 200ml", unit: "pc", hsn: "3305", gstPct: 18, rate: 549, cost: 138, openingQty: 2260, reorder: 800 },
  { id: "cream-face", name: "Ubtan day cream 50g", unit: "pc", hsn: "3304", gstPct: 18, rate: 649, cost: 171, openingQty: 420, reorder: 500 },
  { id: "soap-neem", name: "Neem soap bar 100g", unit: "pc", hsn: "3401", gstPct: 18, rate: 149, cost: 38, openingQty: 5400, reorder: 2000 },
  { id: "box-mailer", name: "Mailer carton (small)", unit: "pc", hsn: "4819", gstPct: 18, rate: 0, cost: 11, openingQty: 6800, reorder: 3000 },
];

/** Entity id → its item master. Ids match `seed.ts`. */
export const ITEMS: Record<string, Item[]> = {
  "rajesh-interiors": RAJESH,
  "nadi-foods": NADI,
  "nadi-commissary": COMMISSARY,
  "vistara-projects": VISTARA,
  "arka-kitchen": ARKA,
  "kaaya-naturals": KAAYA,
};

export function itemsFor(entityId: string): Item[] {
  return ITEMS[entityId] ?? [];
}
