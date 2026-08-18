// Postel's law has a test, because the bug it fixes was invisible.
//
// `Number(x.replace(/\D/g, ""))` on the payment sheet turned ₹50,000.50 into
// ₹50,00,050 and looked completely normal doing it. Nothing downstream could
// have caught that — the books would have tied around the wrong number.
//
//   npx tsx scripts/parse-probe.ts

import { parseAmount, parseIfsc } from "../src/lib/format";

let failures = 0;

function amount(raw: string, expected: number | null, why: string) {
  const got = parseAmount(raw)?.value ?? null;
  const ok = got === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} parseAmount(${JSON.stringify(raw)}) → ${got} ${ok ? "" : `(expected ${expected})`} · ${why}`,
  );
}

function ifsc(raw: string, expected: string | null, why: string) {
  const got = parseIfsc(raw);
  const ok = got === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"} parseIfsc(${JSON.stringify(raw)}) → ${got} ${ok ? "" : `(expected ${expected})`} · ${why}`,
  );
}

console.log("\nAmounts — what people actually type\n");

amount("150000", 150000, "plain");
amount("1,50,000", 150000, "Indian grouping");
amount("150,000", 150000, "Western grouping");
amount("₹1,50,000", 150000, "with the symbol");
amount("Rs. 1,50,000", 150000, "with the word");
amount("  1,50,000  ", 150000, "pasted with whitespace");
amount("1.5L", 150000, "lakh shorthand");
amount("1.5 lakh", 150000, "spelled out");
amount("2Cr", 20000000, "crore shorthand");
amount("45k", 45000, "thousands");

console.log("\nThe bug this exists for\n");

// The old parser stripped every non-digit: "50000.50" became "5000050".
amount("50000.50", 50001, "THE BUG — paise round to the rupee, never ×100");
amount("1500.50", 1501, "same shape, journal entry");
amount("999.4", 999, "rounds down");

console.log("\nWhat it must refuse rather than guess\n");

amount("1.2.3", null, "two decimal points is not a number");
amount("abc", null, "not a number at all");
amount("", null, "empty — the caller shows nothing");
amount("   ", null, "whitespace only");
amount("-500", null, "negative is not an amount");
amount("0", null, "zero is not a payment");
amount("1.5X", null, "unknown suffix");

console.log("\nIFSC\n");

ifsc("PUNB0123400", "PUNB0123400", "as printed");
ifsc("punb0123400", "PUNB0123400", "lowercase");
ifsc("PUNB 0123400", "PUNB0123400", "pasted with a space");
ifsc("PUNB-0123400", "PUNB0123400", "pasted with a hyphen");
ifsc("PUNB0123", null, "THE BUG — `length >= 4` sent this to a penny drop");
ifsc("PUN80123400", null, "fifth character must be zero");
ifsc("PUNB1123400", null, "fifth character must be zero");
ifsc("", null, "empty");

console.log(
  failures === 0 ? "\nEVERY INPUT READ AS WRITTEN\n" : `\n${failures} FAILURE(S)\n`,
);
process.exit(failures === 0 ? 0 : 1);
