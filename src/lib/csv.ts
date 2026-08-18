// One CSV writer, because there were three.
//
// The blob-and-anchor dance was copy-pasted into the reports page, the dispute
// pack and the close screen — and two of the three quoted their cells while
// the third did not, so a party called `Sharma, Sons & Co` silently shifted
// every column to its right in that one file. Escaping IS the job of a CSV
// writer; it does not get to live in three places with two opinions.

import type { StatementRow } from "@/lib/statement";

/** RFC 4180: quote only when the cell carries a delimiter, quote or newline. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8 rather than Latin-1, so
  // a ₹ or a name with a matra arrives as itself instead of as mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Statement lines as a spreadsheet — the shape an accountant asks for.
 *
 * Amounts are raw numbers in two columns, never a formatted `₹1,20,000`: the
 * point of an export is that the other end can add it up.
 */
export function statementCsv(rows: StatementRow[]): string {
  return toCsv(
    ["date", "counterparty", "category", "narration", "reference", "debit", "credit", "status"],
    rows.map((r) => [
      r.txn.date,
      r.name,
      r.kind,
      r.txn.narration,
      r.txn.ref,
      r.txn.direction === "debit" ? r.txn.amount : "",
      r.txn.direction === "credit" ? r.txn.amount : "",
      r.recon.state,
    ]),
  );
}
