// Chart of accounts — the small, opinionated one an Indian SME actually needs.
//
// Vyapar's own weakness against Tally is a thin account structure; Tally's is
// that a shopkeeper cannot navigate it. We take a middle line: a fixed chart
// nobody has to design, deep enough that a CA recognises every head, and
// mapped so the statement can post into it without asking anyone anything.
//
// Accounts are FIXED. A chart the owner has to build is the first chore, and
// this product's whole claim is that there are no chores.

export type AccountType = "asset" | "liability" | "income" | "expense" | "equity";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  /** Balance-sheet or P&L grouping, in the order a CA reads them. */
  group: string;
  /** Debit-positive accounts (assets, expenses) vs credit-positive. */
  normal: "debit" | "credit";
}

/** A `code` is stable and sortable; the UI never shows it, the CSV does. */
export const ACCOUNTS: Account[] = [
  // ---- assets -----------------------------------------------------------
  { code: "1000", name: "Bank", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1010", name: "Cash in hand", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1100", name: "Debtors", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1200", name: "Stock in hand", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1300", name: "Input GST", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1310", name: "TDS receivable", type: "asset", group: "Current assets", normal: "debit" },
  // §52 of CGST, collected by a marketplace on goods sold through it. A
  // different tax from 194-O under a different Act, so it gets its own head —
  // they are claimed on different returns and an accountant nets them nowhere.
  { code: "1315", name: "TCS receivable", type: "asset", group: "Current assets", normal: "debit" },
  { code: "1500", name: "Fixed assets", type: "asset", group: "Fixed assets", normal: "debit" },

  // The hinge. An unexplained bank line lands here, so "needs your eyes"
  // becomes an accounting fact rather than a UI state — and a non-zero
  // Suspense is what blocks the close.
  { code: "1900", name: "Suspense", type: "asset", group: "Current assets", normal: "debit" },

  // ---- liabilities ------------------------------------------------------
  { code: "2000", name: "Creditors", type: "liability", group: "Current liabilities", normal: "credit" },
  { code: "2100", name: "Output GST", type: "liability", group: "Current liabilities", normal: "credit" },
  { code: "2200", name: "TDS payable", type: "liability", group: "Current liabilities", normal: "credit" },
  { code: "2300", name: "Salaries payable", type: "liability", group: "Current liabilities", normal: "credit" },
  { code: "2400", name: "Inter-company", type: "liability", group: "Current liabilities", normal: "credit" },
  { code: "2500", name: "Loans", type: "liability", group: "Loans", normal: "credit" },

  // ---- equity -----------------------------------------------------------
  { code: "3000", name: "Capital", type: "equity", group: "Capital", normal: "credit" },
  { code: "3100", name: "Drawings", type: "equity", group: "Capital", normal: "debit" },
  { code: "3900", name: "Retained earnings", type: "equity", group: "Capital", normal: "credit" },

  // ---- income -----------------------------------------------------------
  { code: "4000", name: "Sales", type: "income", group: "Revenue", normal: "credit" },
  { code: "4100", name: "Other income", type: "income", group: "Revenue", normal: "credit" },

  // ---- expenses ---------------------------------------------------------
  { code: "5000", name: "Purchases", type: "expense", group: "Direct costs", normal: "debit" },
  { code: "5050", name: "Cost of goods sold", type: "expense", group: "Direct costs", normal: "debit" },
  { code: "5100", name: "Platform commission", type: "expense", group: "Direct costs", normal: "debit" },
  { code: "5200", name: "Freight and transport", type: "expense", group: "Direct costs", normal: "debit" },
  { code: "5300", name: "Site labour", type: "expense", group: "Direct costs", normal: "debit" },
  { code: "6000", name: "Salaries", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6100", name: "Rent", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6200", name: "Electricity and utilities", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6300", name: "Advertising", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6400", name: "Bank charges", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6500", name: "Professional fees", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "6900", name: "Other expenses", type: "expense", group: "Operating costs", normal: "debit" },
  { code: "7000", name: "Interest", type: "expense", group: "Finance costs", normal: "debit" },
];

const BY_NAME = new Map(ACCOUNTS.map((a) => [a.name, a]));
const BY_CODE = new Map(ACCOUNTS.map((a) => [a.code, a]));

export function account(name: string): Account {
  const a = BY_NAME.get(name);
  if (!a) throw new Error(`Unknown account: ${name}`);
  return a;
}

export function accountByCode(code: string): Account | undefined {
  return BY_CODE.get(code);
}

/** Balance-sheet groups top to bottom, then P&L — the order a CA reads. */
export const GROUP_ORDER = [
  "Current assets",
  "Fixed assets",
  "Current liabilities",
  "Loans",
  "Capital",
  "Revenue",
  "Direct costs",
  "Operating costs",
  "Finance costs",
];

/** Named constants for the accounts the posting rules reach for most. */
export const A = {
  bank: "Bank",
  cash: "Cash in hand",
  debtors: "Debtors",
  stock: "Stock in hand",
  inputGst: "Input GST",
  tdsReceivable: "TDS receivable",
  tcsReceivable: "TCS receivable",
  suspense: "Suspense",
  creditors: "Creditors",
  interCompany: "Inter-company",
  outputGst: "Output GST",
  capital: "Capital",
  drawings: "Drawings",
  sales: "Sales",
  otherIncome: "Other income",
  purchases: "Purchases",
  cogs: "Cost of goods sold",
  commission: "Platform commission",
  freight: "Freight and transport",
  labour: "Site labour",
  salaries: "Salaries",
  rent: "Rent",
  utilities: "Electricity and utilities",
  advertising: "Advertising",
  bankCharges: "Bank charges",
  otherExpenses: "Other expenses",
  interest: "Interest",
} as const;
