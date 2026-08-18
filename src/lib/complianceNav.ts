// The compliance sub-nav, in one place so the GST page and the exposure views
// cannot drift out of step with each other.

import { filesAsIndividual } from "@/lib/incometax";
/**
 * The exposures this business actually has.
 *
 * Income tax is the one item here that depends on what the business IS. A
 * proprietorship has no separate existence, so its profit is the owner's income
 * and lands in their ITR; a company and an LLP file their own returns on their
 * own rules. Showing either of those an individual's slab table would be the
 * wrong-entity error the rest of this module is careful to avoid, so the item
 * is not merely disabled — it is absent, the way /project is for a business
 * that is not a developer.
 */
export function complianceItemsFor(constitution?: string) {
  return [
    { label: "GST", href: "/compliance" },
    { label: "TDS", href: "/compliance/tds" },
    ...(filesAsIndividual(constitution ?? "")
      ? [{ label: "Income tax", href: "/compliance/income-tax" }]
      : []),
    { label: "Payroll", href: "/compliance/payroll" },
    { label: "Credit at risk", href: "/compliance/itc-risk" },
    { label: "Micro suppliers", href: "/compliance/msme" },
  ];
}

/** The list without an entity to ask. Kept so existing callers still compile. */
export const complianceItems = complianceItemsFor();

/** The accountant on this business, however they got there. */
export function accountantFor(
  entity: { id: string; secondUser?: string },
  invites: Record<string, { name: string; role: string }>,
): string | null {
  const invited = invites[entity.id];
  if (invited && invited.role === "Accountant") return invited.name;
  const second = entity.secondUser?.toLowerCase() ?? "";
  return second.includes("accountant") || second.includes("ca")
    ? (entity.secondUser as string)
    : null;
}
