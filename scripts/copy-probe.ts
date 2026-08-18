// Law G2, enforced. The books had a probe and the copy had nothing, which is
// why Today drifted to 282 words without any single edit ever looking wrong.
//
// The rule only applies to rows that REPEAT. A sentence read once, at the moment
// it decides something — the consent screen, the browser-agent privacy line, an
// empty-state body, a disabled reason — is the right shape and is not checked
// here. What is checked is the copy that stacks five to twelve deep in one
// column, where the reader meets the same shape again and again.
//
// KNOWN BLIND SPOT: this reads the generators. Prose moved out of a generator
// and into a component's JSX would pass. Said out loud rather than implied.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BANK_CUSTOMERS, GUEST_ENTITY } from "@/data/seed";
import { buildBooks } from "@/lib/books";
import { exposures } from "@/lib/statutory";
import { buildQueue, buildUpcoming, upcomingNet } from "@/lib/today";
import { analyse } from "@/lib/analysis";
import { buildInsights } from "@/lib/insights";
import { buildStatement } from "@/lib/statement";
import { payable } from "@/lib/balance";
import { formatINR } from "@/lib/format";

// The budget counts PROSE words, not data. "from Swiggy and Zomato · fees not
// visible" is eight tokens and five words of prose; penalising it would be
// penalising the platform names, which are the useful part. A proper noun, a
// number and a percentage are facts; lowercase words are the writing.
const HEADLINE_MAX = 6;
const SUB_MAX = 7;

/** "we", "our", "us" — the product talking about itself instead of their money. */
const FIRST_PERSON = /\b(we|we'?re|we'?ll|our|ours|us)\b/i;

let fail = 0;
const bad = (what: string, detail: string) => {
  console.log(`  ✗ ${what} — ${detail}`);
  fail++;
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/**
 * The lowercase, digit-free tokens — the prose. Names, amounts, percentages,
 * document numbers and separators are data and cost nothing.
 *
 * A legitimately capitalised first word ("Due 7 Aug", "Micro supplier") is not
 * counted either, so this errs one word permissive at the start of a line.
 */
function proseWords(s: string): string[] {
  return words(s)
    .map((t) => t.replace(/[^A-Za-z0-9%₹.,'-]/g, ""))
    .filter((t) => t.length > 1 && !/[0-9]/.test(t) && t === t.toLowerCase());
}

/**
 * A sub-line must not restate its headline. Three consecutive shared words is
 * the signal — it is what caught "against your own weekly pattern" sitting over
 * "vs 13-week median" only after a human read them side by side.
 */
function restates(headline: string, sub: string): string | null {
  const norm = (s: string) =>
    words(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ")).filter((w) => w.length > 2);
  const h = norm(headline);
  const t = norm(sub);
  for (let i = 0; i + 2 < h.length; i++) {
    const tri = h.slice(i, i + 3).join(" ");
    if (t.join(" ").includes(tri)) return tri;
  }
  return null;
}

function checkRow(where: string, headline: string, sub: string) {
  const hw = proseWords(headline);
  const sw = proseWords(sub);
  if (hw.length > HEADLINE_MAX)
    bad(`${where} headline`, `${hw.length} prose words: "${headline}"`);
  if (sw.length > SUB_MAX) bad(`${where} sub`, `${sw.length} prose words: "${sub}"`);
  if (FIRST_PERSON.test(headline)) bad(`${where} headline`, `first person: "${headline}"`);
  if (FIRST_PERSON.test(sub)) bad(`${where} sub`, `first person: "${sub}"`);
  const echo = sub ? restates(headline, sub) : null;
  if (echo) bad(`${where}`, `sub restates headline ("${echo}"): "${headline}" / "${sub}"`);
}

const ents = [...BANK_CUSTOMERS.flatMap((c) => c.entities), GUEST_ENTITY];

for (const e of ents) {
  const books = buildBooks(e);

  for (const x of exposures(e, books)) checkRow(`${e.id} exposure:${x.kind}`, x.headline, x.because);
  for (const q of buildQueue(e, false)) checkRow(`${e.id} queue:${q.kind}`, q.title, q.sub);
  for (const f of analyse(e, false).findings)
    checkRow(`${e.id} finding:${f.kind}`, f.title, f.evidence);

  const rows = buildStatement(e, { connected: false, resolutions: {}, days: 30 }).rows;
  for (const i of buildInsights(e, rows, 30)) checkRow(`${e.id} insight:${i.id}`, i.fact, i.sub);
}

/*
 * One fact, once per screen.
 *
 * Honest about what this does and does not cover: the ₹1,11,800 that appeared
 * twice on Today — channel strip and queue item — was a JSX decision, and this
 * probe cannot read JSX. What prevents THAT bug now is structural: `ConnectPrompt`
 * no longer receives the shortfall at all, so it cannot print it. A removed prop
 * is a stronger guarantee than an assertion.
 *
 * What this loop does cover is the generators colliding with each other — two
 * builders independently reporting the same figure, which is the same bug one
 * layer down and the one nobody would notice by looking.
 *
 * It deliberately does NOT look at the recent-transactions list. A business on a
 * weekly rhythm really does pay ₹41,200 on the 17th and again on the 24th, and
 * the dates tell them apart: the same amount twice is not the same fact twice.
 */
for (const e of ents) {
  const books = buildBooks(e);
  // Keyed on the RAW rupee value, not the formatted string. Formatting hides a
  // collision: ₹6,84,510 in one card and "₹6.8L" in the next are the same figure
  // printed twice, and comparing display strings let exactly that through.
  const seen = new Map<number, string[]>();
  const note = (amount: number, where: string) => {
    if (amount <= 0) return;
    seen.set(amount, [...(seen.get(amount) ?? []), where]);
  };
  for (const x of exposures(e, books)) note(x.amount, `exposure:${x.kind}`);
  for (const q of buildQueue(e, false)) note(q.amount, `queue:${q.id}`);
  // The right rail: the two balances and the derived net/leftover.
  const total = e.accounts.reduce((s, a) => s + a.balance, 0);
  const pay = payable(e);
  const up = buildUpcoming(e);
  const net = upcomingNet(up);
  note(total, "rail: total across accounts");
  // Mirrors the render conditions exactly, or it would flag lines that do not
  // render and miss ones that do. With a single payable account the "available
  // to pay" figure IS the account row, so the line is suppressed; with a single
  // account full stop, the rows are suppressed in favour of the hero.
  const payableCount = e.accounts.filter((a) => !a.readOnly).length;
  if (pay !== null && pay !== total && payableCount > 1) note(pay, "rail: available to pay");
  if (e.accounts.length > 1)
    for (const a of e.accounts) note(a.balance, `rail: account ${a.masked}`);
  note(Math.abs(net.net), "rail: net of upcoming");
  if (pay !== null && net.net < 0) note(Math.abs(pay + net.net), "rail: left after upcoming");
  for (const u of up) note(u.amount, `rail: upcoming ${u.label}`);
  // The channel strip reports the rails' received total; the queue reports the
  // shortfall. If those two ever collide again, this is where it shows.
  for (const f of analyse(e, false).findings)
    if (f.kind === "channel_lump") note(f.amount, "channel strip");
  for (const [amount, wheres] of seen) {
    if (wheres.length > 1)
      bad(`${e.id} today`, `${formatINR(amount)} appears ${wheres.length}× → ${wheres.join(", ")}`);
  }
}

// Tracked, not felt.
console.log("\nwords of generated copy on Today, per persona:");
for (const e of ents) {
  const books = buildBooks(e);
  let n = 0;
  for (const x of exposures(e, books)) n += words(x.headline).length + words(x.because).length;
  for (const q of buildQueue(e, false)) n += words(q.title).length + words(q.sub).length;
  console.log(`  ${String(n).padStart(3)}  ${e.name}`);
}

/* ------------------------------------------------------------------ */
/* The blind spot, closed                                              */
/* ------------------------------------------------------------------ */

/*
 * Prose written straight into a component used to slip past this file entirely,
 * and a page-by-page browser sweep found ~30 long lines the generator checks
 * could never see — page subtitles restating their own titles, first person, and
 * pointers at content directly below.
 *
 * So the .tsx files get scanned too. It is a regex over source, which is coarser
 * than a parser: it reads string literals and plain JSX text, and it will miss
 * prose split across interpolations. Stated rather than implied.
 *
 * EXEMPT is not a snooze list. Each entry is a place where a sentence read ONCE,
 * at the moment it decides something, is the correct shape — and the reason is
 * written next to it so the next person can disagree with the reason rather than
 * guess at it.
 */
const EXEMPT: Array<{ match: RegExp; why: string }> = [
  { match: /^src\/app\/signin\//, why: "consent disclosure — legal text, read once, before agreeing" },
  { match: /^src\/app\/(try|apply)\//, why: "pre-customer flows — the pitch is the product here" },
  { match: /^src\/app\/bank\//, why: "internal bank console, not an SME screen — different reader, different register" },
  { match: /^src\/app\/design\//, why: "the design-system reference page documents itself" },
  { match: /^src\/app\/dispute\//, why: "a printable claim letter — it is a document, not a screen" },
  { match: /^src\/app\/close\/report\//, why: "a printable close report, same reason" },
  { match: /^src\/app\/project\/qpr\//, why: "a printable RERA QPR, same reason" },
  { match: /ExceptionCard\.tsx$/, why: "reason codes explain an exception at the point of resolving it" },
  { match: /lib\/docs\.ts$/, why: "empty-state bodies (D3) — what the missing thing would do for you" },
  { match: /app\/cards\/page\.tsx$/, why: "limit consequences at the issue control (E1)" },
];

/*
 * Exact strings that are walls by the count and correct by the law — every one
 * an empty-state body (D3: say what the missing thing would do for you) or a
 * "How this works" entry, which is precisely where the density rule says
 * reasoning belongs. Listed one by one rather than by file, so adding to this is
 * a decision somebody has to write a reason for.
 */
const ALLOWED: Array<{ text: string; why: string }> = [
  {
    text: "Restaurants supplying at 5% cannot claim credit on purchases. That is the condition of the rate.",
    why: "How-this-works entry — a tax rule, demoted behind the panel exactly as the law prescribes",
  },
  {
    text: "A limit is one month of matched inflow, after a few months of history.",
    why: "empty state (D3) — what would earn an offer, which is the only useful thing to say when there is none",
  },
  {
    text: "Each unit has its own virtual account — installments name their buyer and split on arrival.",
    why: "empty state (D3) — explains the mechanism that will fill this list",
  },
  {
    text: "The agent runs on your machine, not ours. Your password is never typed into Business Connect and never leaves your computer.",
    why: "privacy consent, read once, at the moment access is handed over — the only shape in which a bank can ship 'we log into your Amazon account', so it says all of it",
  },
];

function exemptFor(file: string): string | null {
  return EXEMPT.find((e) => e.match.test(file))?.why ?? null;
}

/*
 * A source scan cannot tell a repeating row from a one-time explanation, so it
 * does NOT apply the row budget — that would fight legitimate copy, like a "How
 * this works" panel or an achievement empty state, which the law explicitly
 * allows. It looks for WALLS: a paragraph where a line was needed. Twelve prose
 * words is roughly where a sentence stops being scannable.
 *
 * First person stays strict everywhere outside the exemptions. The product does
 * not need to talk about its own eyesight.
 */
const SOURCE_MAX = 12;

/*
 * No `s` flag and none needed: a negated character class already matches
 * newlines. That matters, because prettier wraps prose at 100 characters, so the
 * earlier line-anchored version could only ever see prose short enough NOT to
 * wrap — exactly backwards, and it is how a 21-word empty state sat unflagged.
 * Whitespace is collapsed before counting.
 */
// Anchored on `>` and a letter: starting at `}` too matched attribute soup
// between a closing brace and the next tag, which is code, not copy.
const JSX_TEXT = />([A-Za-z][^<>{}"`]{40,}?)</g;

/*
 * Quoted and backticked strings are matched WITHOUT a minimum length, then
 * filtered — and that ordering is the whole point.
 *
 * Putting `{40,}` inside the pattern silently broke pairing: a short literal
 * fails the length test, the scanner advances, and the next match runs from that
 * literal's CLOSING delimiter to the following literal's OPENING one. So the
 * capture is the JSX in between, and every long string whose opening delimiter
 * got eaten that way is never seen at all. It reported clean while missing a
 * 19-word explanation in the connect sheet.
 */
const LITERAL = /"([^"\n]*)"/g;
const TEMPLATE = /`([^`]*)`/g;

function scanSource(): void {
  const files = execSync(
    "find src/app src/components -name '*.tsx' | sort",
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");

  for (const file of files) {
    if (exemptFor(file)) continue;
    const src = readFileSync(file, "utf8");
    // Strip comments — they are for us, not the reader.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const seen = new Set<string>();
    for (const re of [JSX_TEXT, LITERAL, TEMPLATE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        const text = m[1].replace(/\$\{[^}]*\}/g, " ").trim().replace(/\s+/g, " ");
        if (text.length < 40) continue;
        if (seen.has(text)) continue;
        seen.add(text);
        if (/^(https?|\/|#)/.test(text)) continue;
        // class strings and prop soup are not prose
        // After `${...}` is stripped, real copy holds no braces, angles or
        // equals. Anything that still does is code — the template pattern can
        // span from the closing backtick of one literal to the opening backtick
        // of the next, and that gap is JSX, not prose.
        if (/[{}<>=]/.test(text)) continue;
        if (/[:;]|\bpx-|\btext-\[|rounded|flex |grid /.test(text)) continue;
        if (ALLOWED.some((a) => a.text === text)) continue;
        const n = proseWords(text).length;
        if (n > SOURCE_MAX) bad(`${file}`, `${n} prose words: "${text.slice(0, 78)}"`);
        if (FIRST_PERSON.test(text)) bad(`${file}`, `first person: "${text.slice(0, 78)}"`);
      }
    }
  }
}

scanSource();

/*
 * "Balanced" is not a verdict.
 *
 * A trial balance that foots is an internal consistency check, true of any
 * double-entry system. Shipped as a green pass above a P&L that can be
 * understated by every unconnected marketplace, it reads as "these books are
 * right" — to a CA especially, who is the reader the whole channel thesis
 * depends on. The word is gone from both reports; if it returns, so does the
 * claim, and the completeness band beside it becomes decoration.
 */
function scanVerdict() {
  for (const file of ["src/components/books/ReportViews.tsx", "src/app/reports/[slug]/page.tsx"]) {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    // The comments explaining the demotion may name it; rendered strings may not.
    const rendered = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/\bBalanced\b/.test(rendered)) {
      bad(file, `renders "Balanced" as a verdict — say what was checked instead`);
    }
  }
}

scanVerdict();

console.log(fail === 0 ? "\nCOPY OK" : `\n${fail} COPY CHECK(S) FAILED`);
process.exit(fail ? 1 : 0);
