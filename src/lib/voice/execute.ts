/*
 * Turning an approved draft into the records the dashboard already understands.
 *
 * Note what this file does NOT do: it does not write anything. It maps slot
 * values onto a `Doc` or a `SessionPayee` and hands them back, so the component
 * calls the same `saveDoc` / `addPayee` the manual forms call.
 *
 * That is deliberate and it answers "do we need creation APIs for the agent?" —
 * no. There is no create endpoint on the voice surface at all. If Simran could
 * call one, the approval step would be decorative. The browser creates the
 * record, after a human has read it, through the identical path a hand-typed
 * invoice takes. So a voice invoice and a typed invoice are the same object, and
 * nothing downstream has to know which it was.
 */

import type { Doc } from "@/lib/docs";
import { legalNameFor } from "@/lib/payments";
import type { SlotValue } from "./slots";

export interface Payee {
  name: string;
  account: string;
  ifsc: string;
  /** What the bank calls the account — see `legalNameFor`. */
  legalName?: string;
}

function val(values: SlotValue[], key: string): string | number | null {
  return values.find((v) => v.key === key)?.value ?? null;
}

function nextNumber(prefix: string, existing: number): string {
  return `${prefix}-${String(existing + 1).padStart(4, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Built as `status: "open"`, not `"draft"`.
 *
 * The voice draft *was* the draft stage — a human has now read every field and
 * pressed Execute. Landing it as a document draft would make them approve the
 * same thing twice, and `books.ts` excludes drafts, so the invoice would be
 * invisible in the books it is supposed to appear in.
 */
export function toInvoice(
  values: SlotValue[],
  opts: { issueDate: string; existingCount: number },
): Doc {
  const amount = Number(val(values, "amount") ?? 0);
  const qty = Number(val(values, "qty") ?? 1) || 1;
  const dueDays = Number(val(values, "dueDays") ?? 30) || 30;
  const description = String(val(values, "item") ?? "Services");

  return {
    id: `voice-${Date.now().toString(36)}`,
    kind: "invoice",
    number: nextNumber("INV", opts.existingCount),
    party: String(val(values, "party") ?? ""),
    date: opts.issueDate,
    dueDate: addDays(opts.issueDate, dueDays),
    lines: [
      {
        itemId: null,
        description,
        qty,
        // The caller said a total, not a unit price. Dividing keeps the line
        // arithmetic honest so `docTotals` reproduces the figure they agreed to.
        rate: Math.round(amount / qty),
        taxPct: 0,
      },
    ],
    status: "open",
    paid: 0,
    // Rates carry no tax: the caller quoted a number and that number is the
    // invoice total. Adding GST on top would silently change what they approved.
    taxInclusive: true,
    note: "Raised from a phone call",
  };
}

export function toPayee(values: SlotValue[]): Payee {
  const name = String(val(values, "party") ?? "");
  return {
    name,
    account: String(val(values, "account") ?? ""),
    ifsc: String(val(values, "ifsc") ?? "").toUpperCase(),
    /* A payee approved from the voice queue carries the same bank name a payee
       added by hand does, so the payment screen has it either way. */
    legalName: legalNameFor(name),
  };
}

/** What the row says once the record exists. Consequence, not "success". */
export function executedLine(kind: string, created: string): string {
  if (kind === "invoice") return `Created ${created} · it's in Sales`;
  if (kind === "beneficiary") return `${created} saved · you can pay them now`;
  return `Created ${created}`;
}
