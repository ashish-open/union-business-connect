// Every text token, against every surface it actually lands on.
//
// `--ink-3` shipped at 3.12:1 on white for months. It is the evidence line under
// nearly every row — the dates, counts and reasons that justify the numbers
// above them — and it was the least readable thing in the product. Nothing
// caught it because contrast is invisible to a type checker and to a reviewer
// who already knows what the line says.
//
// The pairs are declared rather than scraped. A scraper would have to resolve
// Tailwind classes back to tokens through the cascade, and would go quiet the
// first time it failed to resolve one — a probe that passes because it stopped
// looking is worse than no probe.

import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

/** Pull a token's value out of a block, so the probe reads what ships. */
function token(name: string, from: number): string {
  const m = css.slice(from).match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
}

const LIGHT = 0;
const DARK = css.indexOf('[data-theme="dark"]') >= 0 ? css.indexOf('[data-theme="dark"]') : css.length;

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 4.5 is the AA floor for normal text, and everything here IS normal text —
 * the product's smallest type is 11px, which is nowhere near the 18.66px that
 * would let a pair off with 3.0.
 */
const AA = 4.5;

interface Pair {
  fg: string;
  bg: string;
  /** Where this combination actually appears, so a failure names a screen. */
  where: string;
}

const PAIRS: Pair[] = [
  { fg: "ink", bg: "surface", where: "every headline" },
  { fg: "ink", bg: "surface-2", where: "table header rows" },
  { fg: "ink-2", bg: "surface", where: "secondary copy" },
  { fg: "ink-3", bg: "surface", where: "the evidence line under every row" },
  { fg: "ink-3", bg: "surface-2", where: "meta inside grouped rows" },
  { fg: "ink-3", bg: "bg", where: "meta outside a card" },
  { fg: "pos", bg: "pos-soft", where: "matched / recovered badges" },
  { fg: "warn", bg: "warn-soft", where: "deadlines — the most consequential state" },
  { fg: "neg", bg: "neg-soft", where: "short settlements, claims" },
  { fg: "info", bg: "info-soft", where: "informational badges" },
  { fg: "accent", bg: "surface", where: "links and the active nav item" },
];

let fail = 0;
for (const [theme, at] of [
  ["light", LIGHT],
  ["dark", DARK],
] as const) {
  console.log(`\n${theme}`);
  for (const p of PAIRS) {
    let fg: string, bg: string;
    try {
      fg = token(p.fg, at);
      bg = token(p.bg, at);
    } catch {
      // A token that does not exist in this theme block is not a failure —
      // the dark block only redefines what changes.
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= AA;
    if (!ok) fail++;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${p.fg}/${p.bg}`.padEnd(30) +
        `${r.toFixed(2)}  ${p.where}`,
    );
  }
}

console.log(fail === 0 ? "\nCONTRAST OK" : `\n${fail} PAIR(S) BELOW AA`);
process.exit(fail ? 1 : 0);
