// One fact, every screen that states it.
//
// This codebase's recurring bug is not a wrong calculation — it is two
// calculations of one fact, drifting. It has happened at least six times: the
// take rate measured against a gross derived from the contracted rate; the
// dispute pack quoting a literal 24% beside a rate card saying 25.7%;
// `bankOnlySuspicion` gated one way and `suspicionsFor` another, so the channels
// overview showed nothing where the rail page showed ₹1.26L; the composition bar
// totalling a figure the card above it did not print; the sub-nav counting rails
// while the register counted claims; a hardcoded "22%" fixed on the dispute pack
// and missed on the statement.
//
// Every one was found by a person opening two screens. None was found by a type
// checker, a linter, or a probe that examines one derivation at a time —
// because each side was internally correct.
//
// So this probe does the only thing that catches them: it computes a figure the
// way one screen computes it, computes it again the way another does, and
// asserts they agree. Where a screen renders the number into a sentence, the
// sentence is what gets parsed — that string is what the reader compares.
//
// When it fails, the message names both screens, because the fix is almost
// always to delete one of the two computations rather than nudge it into line.

import { ANCHOR_DATE, BANK_CUSTOMERS, GUEST_ENTITY, type Entity } from "@/data/seed";
import { buildBooks } from "@/lib/books";
import { buildStatement } from "@/lib/statement";
import { buildClose } from "@/lib/close";
import { profitAndLoss } from "@/lib/reports";
import { incomeTaxFor } from "@/lib/incometax";
import { completenessOf } from "@/lib/completeness";
import { leaksFor, openClaims } from "@/lib/leaks";
import { ordersHeld, reportHeld } from "@/lib/channels";
import { buildBalance } from "@/lib/balance";
import { balance as spokenBalance } from "@/lib/voice/reads";
import { formatINR } from "@/lib/format";

const ents = [...BANK_CUSTOMERS.flatMap((c) => c.entities), GUEST_ENTITY];
let fail = 0;

/** The first rupee figure in a rendered sentence — what the reader compares. */
function rupeesIn(text: string): number | null {
  const m = text.match(/₹([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

function agree(entity: string, fact: string, a: [string, number], b: [string, number]) {
  if (a[1] === b[1]) return;
  console.log(
    `      ↑ ${entity} · ${fact}\n` +
      `          ${a[0].padEnd(30)} ${formatINR(a[1])}\n` +
      `          ${b[0].padEnd(30)} ${formatINR(b[1])}`,
  );
  fail++;
}

for (const e of ents) {
  const connected = true;
  const hasReport = reportHeld({ aggregatorsOn: connected });
  const books = buildBooks(e, { connected });

  /* Suspense — the money the books cannot explain.
     /reconcile heads a list with it, /close blocks on it, and it is tier 1 of
     the completeness gap list. Three screens, and the close states it inside a
     sentence, so the sentence is parsed.

     Note what is NOT compared here: `books.tb.suspense`. That is the ledger
     BALANCE of the same lines, and it nets an unnamed credit against an unnamed
     debit. It is the right figure for a trial balance and the wrong one for any
     sentence about how much is unexplained. This probe used to assert the two
     were equal, which held only because every persona then in the seed had
     unnamed debits and nothing else; the demo account, which has both
     directions, is what proved the assertion false. The relationship that is
     actually invariant is asserted below. */
  const close = buildClose(e, { connected, resolutions: {}, resolved: {}, books });
  const item = close.items.find((i) => i.id === "suspense");
  const stated = item ? rupeesIn(item.detail) : null;
  if (stated !== null) {
    agree(
      e.name,
      "Suspense",
      ["/reconcile · the banner", books.gap.gross],
      ["/close · the sentence", stated],
    );
  }

  /* The gap against the ledger balance it is derived from. Gross magnitudes can
     only exceed their own net, and the two coincide exactly when every unnamed
     line falls the same way. A gross BELOW the net would mean the Suspense
     account holds a posting `unexplainedLines` cannot see. */
  if (books.gap.gross < Math.abs(books.tb.suspense)) {
    console.log(
      `      ↑ ${e.name} · Suspense gross is below its own ledger balance\n` +
        `          gap · gross                    ${formatINR(books.gap.gross)}\n` +
        `          trial balance · net            ${formatINR(Math.abs(books.tb.suspense))}`,
    );
    fail++;
  }

  /* The close gate. It must key on whether any line is unnamed, never on the
     balance: unnamed credits offsetting unnamed debits net to zero, and a gate
     reading that balance would print "Every line is posted to a real head" over
     a book where nothing had been posted at all. */
  if (item && item.done !== (books.gap.count === 0)) {
    console.log(
      `      ↑ ${e.name} · /close gate disagrees with the unnamed-line count\n` +
        `          close · done                   ${item.done}\n` +
        `          lines nobody can name          ${books.gap.count}`,
    );
    fail++;
  }

  const rows = buildStatement(e, { connected, resolutions: {}, days: 3650, hasReport }).rows;
  const comp = completenessOf(e, {
    rows,
    matched: books.matched,
    explained: {},
    hasReport,
    aggregatorsOn: connected,
    cashEntries: 0,
  });
  const tier1 = comp.tiers[0].rows.find((r) => r.state === "missing");
  if (tier1?.at !== undefined) {
    agree(
      e.name,
      "Suspense",
      ["/reconcile · the banner", books.gap.gross],
      ["completeness · tier 1", tier1.at],
    );
  }

  /* The completeness headline against its own gap list.
     "₹15.1L not evidenced" sits above rows that name where it is. If the
     headline and the rows stop summing, the band is asserting a total the list
     under it does not support — the same shape as a bar that does not add up
     to the figure it decomposes. */
  const gapSum = comp.tiers
    .flatMap((t) => t.rows)
    .reduce((s, r) => s + (r.at ?? 0), 0);
  agree(e.name, "Not evidenced", ["completeness headline", comp.atRisk], ["its own gap rows", gapSum]);

  /* Profit — the P&L's bottom line is what the income-tax projection annualises.
     Drift here means the tax figure is computed on a number no report shows. */
  const pl = profitAndLoss(books.tb);
  const tax = incomeTaxFor(pl.net, { booksFrom: books.from });
  agree(
    e.name,
    "Profit for the period",
    ["/reports/profit-and-loss", pl.net],
    ["income tax · profit to date", tax.profitToDate],
  );

  /* Claims — the channels overview sums per rail, the register lists them flat,
     and the sub-nav counts them. This exact pair once read "₹37,180" against
     "Disputes · 2" while the register said "5 claims". */
  const leaks = leaksFor(e, { hasReport, hasOrders: ordersHeld({ aggregatorsOn: connected }) });
  if (leaks.length > 0) {
    const open = openClaims(leaks, () => false);
    const byRail = new Map<string, number>();
    for (const l of open) byRail.set(l.channelId, (byRail.get(l.channelId) ?? 0) + l.amount);
    agree(
      e.name,
      "Claimable",
      ["/channels · summed per rail", [...byRail.values()].reduce((s, v) => s + v, 0)],
      ["/channels/disputes · listed", open.reduce((s, l) => s + l.amount, 0)],
    );
  }

  /* Balance — the one figure that reaches the caller through a different medium.
     Simran speaks it down a phone line where nothing can be cross-checked, and
     /balance renders it as the hero on the first screen the caller opens after
     hanging up. Two media, one fact, and the phone is the half that cannot be
     re-read, so this is the disagreement with the least forgiving consequence.

     It did disagree, on three of the seven personas. `voice/reads.ts` summed
     only the transactable accounts while the screen totals every account, so a
     caller heard one number and then saw a larger one. On the guest persona,
     whose single account is AA-linked view-only, there were no transactable
     accounts at all and Simran said a business holding ₹11.6L had "nothing". */
  agree(
    e.name,
    "Balance",
    ["/balance · the hero", buildBalance(e).total],
    ["what Simran speaks", spokenBalance(e).data.balance as number],
  );
}

/*
 * One synthetic persona, for the case the seed no longer covers.
 *
 * Every check above runs against the fixtures, which is the right default — a
 * probe over invented data tests the probe. This one is the exception, because
 * the bug it guards was found by a fixture that has since been fixed: the demo
 * account had unnamed lines in both directions, which is what made the netted
 * Suspense balance visibly disagree with the gross. Now that its narrations
 * resolve, every persona has unnamed debits and nothing else, and net and gross
 * coincide again for all seven. The regression would be invisible.
 *
 * So the shape is pinned here instead: one unnamed credit, one unnamed debit,
 * equal and opposite, which is the case that nets to exactly zero. A close gate
 * reading the balance would call this book finished with nothing posted at all.
 */
const bothWays: Entity = {
  id: "probe-both-directions",
  name: "Both Directions (probe)",
  legalName: "Both Directions",
  constitution: "Proprietorship",
  city: "Bengaluru",
  accounts: [{ bank: "Union Bank of India", masked: "••0000", label: "Current account", balance: 0 }],
  txns: [
    // Narrations no alias can resolve, so both land in Suspense.
    { id: "bd1", date: ANCHOR_DATE, amount: 50000, direction: "credit", narration: "NEFT/QQZZUNKNOWNPARTY/1", mode: "NEFT", ref: "BD1" },
    { id: "bd2", date: ANCHOR_DATE, amount: 50000, direction: "debit", narration: "NEFT/QQZZUNKNOWNOTHER/2", mode: "NEFT", ref: "BD2" },
  ],
  invoices: [],
  approvals: [],
  returned: [],
  suggested: [],
};

{
  const books = buildBooks(bothWays, { connected: false });
  const close = buildClose(bothWays, {
    connected: false,
    resolutions: {},
    resolved: {},
    books,
  });
  const item = close.items.find((i) => i.id === "suspense");

  if (books.tb.suspense !== 0) {
    console.log(
      `      ↑ ${bothWays.name} · the fixture no longer nets to zero, so it guards nothing\n` +
        `          trial balance · net            ${formatINR(books.tb.suspense)}`,
    );
    fail++;
  }
  agree(
    bothWays.name,
    "Suspense",
    ["both lines, summed", 100000],
    ["the gap · gross", books.gap.gross],
  );
  if (item?.done !== false) {
    console.log(
      `      ↑ ${bothWays.name} · /close called the month finished over 2 unnamed lines\n` +
        `          close · done                   ${item?.done}\n` +
        `          it read the netted balance, which is ${formatINR(books.tb.suspense)}`,
    );
    fail++;
  }
}

/*
 * An approval's headline against the payments it is made of.
 *
 * `count` and `total` used to be the only thing a pending approval knew, so the
 * screen could offer to clear six payments it was unable to name. Now the lines
 * exist and two figures describe one batch — which is this file's whole subject.
 */
for (const e of ents) {
  for (const a of e.approvals) {
    agree(
      e.name,
      `approval ${a.id} · what the batch says vs what is in it`,
      ["count on the approval", a.count],
      ["payments listed", a.lines.length],
    );
    agree(
      e.name,
      `approval ${a.id} · total vs the lines`,
      ["total on the approval", a.total],
      ["lines, summed", a.lines.reduce((sum, l) => sum + l.amount, 0)],
    );
  }
}

console.log(
  fail === 0
    ? `\nEVERY SCREEN AGREES  ·  ${ents.length} personas + 1 probe fixture`
    : `\n${fail} FIGURE(S) DISAGREE ACROSS SCREENS`,
);
process.exit(fail ? 1 : 0);
