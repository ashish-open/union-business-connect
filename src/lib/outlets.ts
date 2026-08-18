// The outlet dimension — derived from narrations, never asked (§2 of the
// plan: "multiple outlets in narrations → outlet dimension"). Rent lines
// carry the outlet name; shared costs (one salary batch, one power bill)
// are reported honestly as shared, not fake-allocated.

import { Entity } from "@/data/seed";

export interface Outlet {
  name: string; // "HSR Layout", title-cased from the narration
  rentMonthly: number;
  lines: number; // rent lines seen in the window
}

export interface OutletView {
  outlets: Outlet[];
  rentMonthlyTotal: number;
  /** monthly total of costs billed as one lump across outlets */
  sharedMonthly: number;
  sharedLabels: string[]; // e.g. ["Salaries — one batch", "Electricity — one bill"]
}

const RENT_RE = /RENT ([A-Z ]+?)-LEASE/;

function titleCase(s: string): string {
  // short tokens are area abbreviations (HSR, MG) — keep them uppercase
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/** ≥2 distinct rent narrations ⇒ the business runs outlets. */
export function detectOutlets(entity: Entity): OutletView | null {
  const rentByOutlet = new Map<string, { total: number; lines: number }>();
  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    const m = t.narration.match(RENT_RE);
    if (!m) continue;
    const name = titleCase(m[1].trim());
    const e = rentByOutlet.get(name) ?? { total: 0, lines: 0 };
    e.total += t.amount;
    e.lines += 1;
    rentByOutlet.set(name, e);
  }
  if (rentByOutlet.size < 2) return null;

  const outlets: Outlet[] = [...rentByOutlet.entries()]
    .map(([name, v]) => ({ name, rentMonthly: Math.round(v.total / v.lines), lines: v.lines }))
    .sort((a, b) => b.rentMonthly - a.rentMonthly);

  // shared lumps: one salary batch / one utility bill covering all outlets
  const shared = new Map<string, { total: number; lines: number; label: string }>();
  for (const t of entity.txns) {
    if (t.direction !== "debit") continue;
    if (/SALARY BATCH/.test(t.narration)) {
      const e = shared.get("salary") ?? { total: 0, lines: 0, label: "Salaries — paid as one batch" };
      e.total += t.amount;
      e.lines += 1;
      shared.set("salary", e);
    } else if (/BESCOM/.test(t.narration)) {
      const e = shared.get("power") ?? { total: 0, lines: 0, label: "Electricity — one bill, all outlets" };
      e.total += t.amount;
      e.lines += 1;
      shared.set("power", e);
    }
  }
  const sharedMonthly = [...shared.values()].reduce(
    (s, v) => s + (v.lines ? Math.round(v.total / v.lines) : 0),
    0,
  );

  return {
    outlets,
    rentMonthlyTotal: outlets.reduce((s, o) => s + o.rentMonthly, 0),
    sharedMonthly,
    sharedLabels: [...shared.values()].filter((v) => v.lines > 0).map((v) => v.label),
  };
}
