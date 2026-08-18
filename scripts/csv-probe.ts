// The CSV writer now has three callers, so its escaping gets a gate.
//
// The bug this exists to prevent already shipped once: two of the three
// hand-rolled writers quoted their cells and the third did not, so a party
// called `Sharma, Sons & Co` shifted every column to its right in that one
// file — silently, because a CSV with the wrong number of columns still opens.

import { csvCell, statementCsv, toCsv } from "@/lib/csv";
import { buildStatement } from "@/lib/statement";
import { BANK_CUSTOMERS } from "@/data/seed";

let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (!ok) {
    console.log(`  ✗ ${name}${got === undefined ? "" : ` — got ${JSON.stringify(got)}`}`);
    fail++;
  }
};

// A cell is quoted only when it has to be, and doubling is the escape.
check("plain cell is not quoted", csvCell("Swiggy") === "Swiggy", csvCell("Swiggy"));
check("comma forces quotes", csvCell("Sharma, Sons") === '"Sharma, Sons"', csvCell("Sharma, Sons"));
check('quote is doubled', csvCell('He said "hi"') === '"He said ""hi"""', csvCell('He said "hi"'));
check("newline forces quotes", csvCell("a\nb") === '"a\nb"', csvCell("a\nb"));
check("zero survives", csvCell(0) === "0", csvCell(0));
check("null is empty, not 'null'", csvCell(null) === "", csvCell(null));

// Column count must be stable no matter what the cells contain — this is the
// property the old writers broke.
const nasty = toCsv(
  ["a", "b", "c"],
  [["plain", "with, comma", 'with "quote"'], ["", null, 0]],
);
for (const [i, line] of nasty.split("\r\n").entries()) {
  // Count delimiters outside quotes.
  let inQ = false;
  let commas = 0;
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') inQ = !inQ;
    else if (line[c] === "," && !inQ) commas++;
  }
  check(`row ${i} has 3 columns`, commas === 2, commas);
}

// And the real thing: every statement line becomes exactly one CSV row, with
// amounts as numbers a spreadsheet can add up.
for (const e of BANK_CUSTOMERS.flatMap((c) => c.entities)) {
  const rows = buildStatement(e, { connected: false, resolutions: {}, days: 90 }).rows;
  const out = statementCsv(rows).split("\r\n");
  check(`${e.id}: one row per line plus a header`, out.length === rows.length + 1, out.length);
  const debits = out
    .slice(1)
    .map((l) => l.split(",").length)
    .every((n) => n >= 8);
  check(`${e.id}: every row carries all 8 columns`, debits);
  check(`${e.id}: no formatted rupees leaked in`, !statementCsv(rows).includes("₹"));
}

console.log(fail === 0 ? "\nCSV OK" : `\n${fail} CSV CHECK(S) FAILED`);
process.exit(fail ? 1 : 0);
