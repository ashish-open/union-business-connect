// Acceptance test for the books: run after every phase, not at the end.
import { ANCHOR_DATE, BANK_CUSTOMERS, GUEST_ENTITY } from "@/data/seed";
import { addDays } from "@/lib/format";
import { buildBooks } from "@/lib/books";
import { buildBatches } from "@/lib/settlements";
import { leaksFor } from "@/lib/leaks";
import { buildStatement, compositionOf } from "@/lib/statement";
import { cashJournals } from "@/lib/cash";
import { completenessOf } from "@/lib/completeness";
import { filesAsIndividual, incomeTaxFor } from "@/lib/incometax";
import { bankOnlySuspicion, suspicionsFor } from "@/lib/settlements";
import { channelFor, channelSpec } from "@/lib/channels";

/** The probe checks batch ARITHMETIC, so it asks for every rail deliberately. */
const ALL_REPORTS = () => true;
/** And checks that asking for none yields none. */
const NO_REPORTS = () => false;
import { docTotals } from "@/lib/docs";
import { buildParties, partyTotals } from "@/lib/parties";
import { balanceSheet, profitAndLoss } from "@/lib/reports";
import { A } from "@/lib/coa";
import { formatINR } from "@/lib/format";

const ents = [...BANK_CUSTOMERS.flatMap((c) => c.entities), GUEST_ENTITY];
let fail = 0;

for (const e of ents) {
  const books = buildBooks(e);
  const { entries, tb } = books;

  // Every settlement's own arithmetic, before it is allowed near the ledger:
  // gross must equal what they kept plus what they sent. This is the channel
  // equivalent of "every document totals its invoice", and it is the gate on
  // the whole waterfall — a batch that does not tie would post a balanced but
  // wrong entry, which is the failure mode this codebase keeps meeting.
  for (const b of buildBatches(e, ALL_REPORTS)) {
    const kept = b.deductions.reduce((s, d) => s + d.amount, 0);
    if (b.gross !== kept + b.expectedNet) {
      console.log(`      ↑ ${b.id} gross ${b.gross} ≠ deductions ${kept} + net ${b.expectedNet}`);
      fail++;
    }
    if (b.variance > 0 && b.orders.reduce((s, o) => s + o.short, 0) !== b.variance) {
      console.log(`      ↑ ${b.id} order evidence does not sum to the variance`);
      fail++;
    }
  }

  // And with the report in hand the books must still tie — the waterfall adds
  // five postings to every settlement, so this is where it would show.
  const wired = buildBooks(e, { connected: true });
  if (!wired.tb.balanced) {
    console.log(`      ↑ ${e.name} does not balance once channels are connected`);
    fail++;
  }

  // A parked document posts nothing. Not one paisa, not one stock move — so
  // the trial balance with a draft in it must be identical to the one without.
  // "draft" was a declared DocStatus that nothing produced and nothing
  // excluded, which meant the first one ever saved would have been booked as
  // revenue and filed in a GST return.
  const withDraft = buildBooks(e, {
    docs: [
      {
        id: "probe-draft",
        kind: "invoice",
        number: "PROBE-DRAFT",
        party: "Probe Party",
        date: e.txns[0]?.date ?? "2026-07-01",
        status: "draft",
        paid: 0,
        lines: [{ itemId: null, description: "probe", qty: 1, rate: 100000, taxPct: 18 }],
      },
    ],
  });
  if (JSON.stringify(withDraft.tb) !== JSON.stringify(tb)) {
    console.log(`      ↑ ${e.name}: a parked draft moved the trial balance`);
    fail++;
  }
  if (withDraft.docs.some((d) => d.status === "draft")) {
    console.log(`      ↑ ${e.name}: a draft reached books.docs`);
    fail++;
  }
  if (withDraft.drafts.length !== 1) {
    console.log(`      ↑ ${e.name}: the draft is not in books.drafts`);
    fail++;
  }
  if (withDraft.stock.value !== books.stock.value) {
    console.log(`      ↑ ${e.name}: a parked draft moved stock`);
    fail++;
  }

  /*
   * The take rate has to be a MEASUREMENT.
   *
   * Gross was reconstructed as `expectedNet / (1 − contractedTake − 0.03)`, so
   * every rail landed on the contracted rate plus a constant, in every period,
   * on every persona. The feature's hero number — "what did this platform
   * actually keep" — was arithmetic that could not answer its own question.
   * A flat spread across a rail's own settlements is that bug returning.
   */
  const byRail = new Map<string, ReturnType<typeof buildBatches>>();
  for (const b of buildBatches(e, ALL_REPORTS)) {
    byRail.set(b.channelId, [...(byRail.get(b.channelId) ?? []), b]);
  }
  for (const [id, list] of byRail) {
    /* CLEAN settlements only. A first version of this checked every batch and
       passed on the broken code, because the short-settled period lifts the
       take on its own — so the assertion measured the dip it already knew
       about rather than the constant it was written to catch. The periods that
       came in exactly as expected are the ones that were all identical. */
    const clean = list.filter((b) => b.variance === 0);
    if (clean.length < 3) continue;
    const takes = clean.map((b) => (b.gross - b.received) / b.gross);
    const spread = Math.max(...takes) - Math.min(...takes);
    if (spread < 0.003) {
      console.log(
        `      ↑ ${e.name}/${id}: take rate flat across ${clean.length} clean settlements (${(spread * 100).toFixed(2)}pt)`,
      );
      fail++;
    }
  }

  /*
   * Nothing is claimable without the report it was read from.
   *
   * `buildBatches` used to reconstruct settlements from bank credits alone, so a
   * business that had connected nothing was offered a printable claim letter
   * carrying its GSTIN, a real UTR and dozens of fabricated order IDs. The gate
   * is now a required argument; this is the assertion that it stays one.
   */
  const ungated = buildBatches(e, NO_REPORTS);
  if (ungated.length > 0) {
    console.log(`      ↑ ${e.name}: ${ungated.length} batches exist with no report held`);
    fail++;
  }
  const orders = ungated.reduce((s, b) => s + b.orders.length, 0);
  if (orders > 0) {
    console.log(`      ↑ ${e.name}: ${orders} order rows exist with no report held`);
    fail++;
  }
  // And the books must not post a settlement waterfall it cannot read.
  const ungatedBooks = buildBooks(e, { connected: true, hasReport: NO_REPORTS });
  if (JSON.stringify(ungatedBooks.tb) !== JSON.stringify(buildBooks(e).tb)) {
    console.log(`      ↑ ${e.name}: the ledger moved on settlements with no report`);
    fail++;
  }

  /*
   * The leak taxonomy.
   *
   * One settlement can carry two claims that go to different desks on different
   * clocks. Splitting a variance into typed leaks is only an improvement if the
   * split conserves rupees and the clocks actually differ — otherwise it is
   * three labels on one number, which is worse than one honest number.
   */
  const leaks = leaksFor(e, { hasReport: ALL_REPORTS, hasOrders: () => true });
  for (const b of buildBatches(e, ALL_REPORTS)) {
    if (b.variance <= 0) continue;
    const mine = leaks.filter((l) => l.id.startsWith(`${b.id}-`));
    const summed = mine.reduce((s, l) => s + l.amount, 0);
    if (summed !== b.variance) {
      console.log(
        `      ↑ ${b.id}: leaks sum to ${formatINR(summed)}, variance is ${formatINR(b.variance)}`,
      );
      fail++;
    }
    // The reason the split exists. Two kinds off one settlement must not share
    // a deadline — that identity is the bug the taxonomy was built to kill.
    const kinds = new Set(mine.map((l) => l.kind));
    if (kinds.size > 1 && new Set(mine.map((l) => l.daysLeft)).size === 1) {
      console.log(`      ↑ ${b.id}: ${kinds.size} claim types share one window`);
      fail++;
    }
  }
  for (const l of leaks) {
    if (l.amount <= 0 || l.orders <= 0) {
      console.log(`      ↑ ${l.id}: ${formatINR(l.amount)} across ${l.orders} orders`);
      fail++;
    }
    // "N days left" on money that is already past its window is the promise
    // with nothing behind it, one level down from a fabricated order ID.
    if (l.evidence.trim() === l.title.trim()) {
      console.log(`      ↑ ${l.id}: evidence restates the title`);
      fail++;
    }
  }
  /*
   * A suspicion needs comparable periods.
   *
   * "Below its own trailing median" is a real signal for a weekly batch of
   * hundreds of orders and pure noise for a T+1 gateway, where each credit is
   * one day's takings and half of them sit under the median by construction.
   * Razorpay was reporting ₹1,26,100 across 39 of 90 credits — the largest
   * number on its page, manufactured from ordinary variance.
   *
   * The two callers also disagreed: `suspicionsFor` gated on the rail being
   * report-verifiable and `bankOnlySuspicion` did not, so the overview showed
   * nothing where the rail's own page showed ₹1.26L.
   */
  for (const id of new Set(e.txns.map((t) => channelFor(t.narration)?.id).filter(Boolean))) {
    const spec = channelSpec(id!);
    const direct = bankOnlySuspicion(e, id!);
    const listed = suspicionsFor(e).find((r) => r.channelId === id)?.amount ?? 0;
    if (direct.amount !== listed) {
      console.log(`      ↑ ${e.name}/${id}: rail page says ${direct.amount}, overview says ${listed}`);
      fail++;
    }
    if (spec && spec.verifiable !== "report" && direct.amount > 0) {
      console.log(
        `      ↑ ${e.name}/${id}: ${formatINR(direct.amount)} suspected on a rail that settles net`,
      );
      fail++;
    }
  }

  /*
   * The composition bars must add up to the figure printed above them.
   *
   * Each slice is a share of a total shown in ink at hero weight, and the tail
   * is folded rather than dropped — fold it wrongly and the bar quietly
   * understates spending while looking complete, which is the failure a chart
   * makes hardest to notice. Own transfers are excluded from the denominator by
   * design, so they are checked separately rather than assumed to be zero.
   */
  const stmt = buildStatement(e, { connected: true, resolutions: {} });
  for (const dir of ["credit", "debit"] as const) {
    const mix = compositionOf(stmt.rows, dir);
    const summed = mix.segments.reduce((s, x) => s + x.amount, 0);
    if (summed !== mix.total) {
      console.log(
        `      ↑ ${e.name}/${dir}: slices sum to ${formatINR(summed)}, total is ${formatINR(mix.total)}`,
      );
      fail++;
    }
    /* The slices must decompose the figure the CARD prints, not some subset of
       it. An earlier version excluded own transfers from the denominator, so
       the bar quietly described a different total than the ₹7.2L above it. */
    const shown = dir === "credit" ? stmt.moneyIn : stmt.moneyOut;
    if (mix.total !== shown) {
      console.log(
        `      ↑ ${e.name}/${dir}: bar totals ${formatINR(mix.total)}, the card prints ${formatINR(shown)}`,
      );
      fail++;
    }
    if (mix.segments.some((x) => x.pct <= 0 || x.amount <= 0)) {
      console.log(`      ↑ ${e.name}/${dir}: a slice with no width`);
      fail++;
    }
  }

  /*
   * Cash posts a real double entry, or it does not go in at all.
   *
   * `Cash in hand` sat in the chart of accounts for the life of this project
   * with nothing ever posting to it. The moment something does, the trial
   * balance is the thing at risk: a one-sided cash entry would balance the
   * books by accident today and by nothing tomorrow.
   */
  const cashed = buildBooks(e, {
    manual: cashJournals([
      { id: "probe", date: ANCHOR_DATE, direction: "in", amount: 7777, head: "Sales", note: "probe" },
    ]),
  });
  if (!cashed.tb.balanced) {
    console.log(`      ↑ ${e.name}: a cash entry unbalanced the trial balance`);
    fail++;
  }
  if (cashed.tb.totalDebit !== tb.totalDebit + 7777) {
    console.log(
      `      ↑ ${e.name}: cash moved debits by ${cashed.tb.totalDebit - tb.totalDebit}, not 7777`,
    );
    fail++;
  }

  /*
   * Completeness cannot read 100 on a bank-only view.
   *
   * The prototype this came from prints "87% complete" and implies 100 is
   * reachable while the whole picture is the bank feed. A business taking cash
   * is not complete because its bank lines are tidy, and a hero percentage is
   * louder than any caveat printed under it.
   */
  const stmtRows = buildStatement(e, {
    connected: true,
    resolutions: {},
    days: 3650,
    hasReport: ALL_REPORTS,
  }).rows;
  const noCash = completenessOf(e, {
    rows: stmtRows,
    matched: books.matched,
    explained: {},
    hasReport: ALL_REPORTS,
    aggregatorsOn: true,
    cashEntries: 0,
  });
  if (noCash.pct >= 100) {
    console.log(`      ↑ ${e.name}: books read ${noCash.pct}% complete with cash untracked`);
    fail++;
  }
  if (noCash.atRisk > 0 && noCash.evidenced + noCash.atRisk !== noCash.total) {
    console.log(`      ↑ ${e.name}: evidenced + at-risk ≠ the money the books cover`);
    fail++;
  }

  /*
   * Advance tax, and who it belongs to.
   *
   * Two ways this goes wrong quietly. The four instalments are cumulative
   * percentages of one figure, so a rounding slip leaves the schedule adding up
   * to something other than the year's tax — a table that looks precise and
   * asks for the wrong money. And a proprietorship is not a separate taxpayer
   * while an LLP is: showing an LLP an individual's slab table tells it
   * something untrue about itself, which is the wrong-entity error the rest of
   * the compliance module is careful to avoid.
   */
  const tax = incomeTaxFor(profitAndLoss(tb).net, { booksFrom: books.from });
  const scheduled = tax.instalments.reduce((s, i) => s + i.amount, 0);
  if (scheduled !== tax.total) {
    console.log(
      `      ↑ ${e.name}: instalments sum to ${formatINR(scheduled)}, the year's tax is ${formatINR(tax.total)}`,
    );
    fail++;
  }
  if (tax.instalments.some((i) => i.amount < 0)) {
    console.log(`      ↑ ${e.name}: a negative advance-tax instalment`);
    fail++;
  }
  if (filesAsIndividual(e.constitution) !== (e.constitution === "Proprietorship")) {
    console.log(`      ↑ ${e.name}: ${e.constitution} routed to the wrong return`);
    fail++;
  }
  // Under the rebate there is no liability, so there is no schedule to show.
  if (tax.rebated && tax.total !== 0) {
    console.log(`      ↑ ${e.name}: rebated but still carrying ${formatINR(tax.total)}`);
    fail++;
  }

  /*
   * Another bank's money must never reach these books.
   *
   * AA-visible lines are deliberately NOT in `entity.txns`, because twenty
   * files in lib/ read that array — the ledger, GST, payroll, RERA, parties,
   * the close — and every one would have absorbed them silently. This is the
   * assertion that keeps them apart: the trial balance, the P&L and every
   * total must be identical whether or not the entity carries external lines.
   *
   * It is also the honesty gate on the prompt beside them. A read-only consent
   * gives the line and nothing behind it, so no external row may claim to be
   * matched, short, or anything else that implies we checked it.
   */
  const ext = e.externalTxns ?? [];
  if (ext.length > 0) {
    /* Not "do two builds agree" — both would carry the leak and agree with each
       other. The question is whether any external line reached a posting, so
       the ledger is searched for their ids and refs directly. A first version
       compared `buildBooks({...e, externalTxns: []})` against `buildBooks(e)`
       and passed happily while the lines were merged into `txns`, which is the
       same "assertion measuring the wrong thing" that let a flat take rate
       through earlier in this file. */
    const extIds = new Set(ext.map((t) => t.id));
    const extRefs = new Set(ext.map((t) => t.ref));
    const leaked = buildBooks(e, { connected: true }).entries.filter(
      (j) => (j.txnId && extIds.has(j.txnId)) || (j.ref && extRefs.has(j.ref)),
    );
    if (leaked.length > 0) {
      console.log(
        `      ↑ ${e.name}: ${leaked.length} journal entr${leaked.length === 1 ? "y" : "ies"} posted from another bank's lines`,
      );
      fail++;
    }
    if (e.txns.some((t) => extIds.has(t.id))) {
      console.log(`      ↑ ${e.name}: external lines are inside entity.txns`);
      fail++;
    }
    const extTotal = ext.reduce((s, t) => s + t.amount, 0);
    const stmtExt = buildStatement(e, { connected: true, resolutions: {}, days: 3650 });
    if (stmtExt.externalIn + stmtExt.externalOut !== extTotal) {
      console.log(`      ↑ ${e.name}: external money in the statement ≠ what the seed carries`);
      fail++;
    }
    const rows = stmtExt.rows.filter((r) => r.recon.state === "external");
    if (rows.length !== ext.length) {
      console.log(`      ↑ ${e.name}: ${ext.length} external lines, ${rows.length} marked external`);
      fail++;
    }
    // The primary figures must describe the primary account and nothing else.
    const ownIn = e.txns
      .filter((t) => t.direction === "credit" && t.date >= addDays(ANCHOR_DATE, -3650))
      .reduce((s, t) => s + t.amount, 0);
    if (stmtExt.moneyIn !== ownIn) {
      console.log(`      ↑ ${e.name}: "Money in" absorbed another bank's credits`);
      fail++;
    }
  }

  const coldLeaks = leaksFor(e, { hasReport: NO_REPORTS, hasOrders: () => false });
  if (coldLeaks.length > 0) {
    console.log(`      ↑ ${e.name}: ${coldLeaks.length} claims exist with nothing connected`);
    fail++;
  }

  const bankRow = tb.rows.find((r) => r.account === A.bank);
  const own = e.accounts.filter((a) => !a.readOnly);
  const owned = (own.length ? own : e.accounts).reduce((s, a) => s + a.balance, 0);
  const bankOk = (bankRow?.balance ?? 0) === owned;

  const ok = tb.balanced && bankOk;
  if (!ok) fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${e.name.padEnd(18)} entries=${String(entries.length).padStart(4)}` +
      `  Dr=${formatINR(tb.totalDebit).padStart(14)}  Cr=${formatINR(tb.totalCredit).padStart(14)}` +
      `  bank=${formatINR(bankRow?.balance ?? 0).padStart(13)} vs ${formatINR(owned).padStart(13)}` +
      `  suspense=${formatINR(tb.suspense)}` +
      `  profit=${formatINR(profitAndLoss(tb).net)}`,
  );
  // a document must total the invoice it came from
  for (const d of books.docs) {
    const seeded = e.invoices.find((i) => i.number === d.number);
    if (seeded && docTotals(d).total !== seeded.total) {
      console.log(`      ↑ ${d.number} totals ${docTotals(d).total} but invoice says ${seeded.total}`);
      fail++;
    }
  }
  // debtors must agree across the ledger, the parties screen and the documents
  const debtors = tb.rows.find((r) => r.account === A.debtors)?.balance ?? 0;
  const partyAR = partyTotals(buildParties(e, books.docs)).receivable;
  const docAR =
    books.docs.filter((d) => d.kind === "invoice").reduce((s, d) => s + docTotals(d).outstanding, 0) -
    books.docs.filter((d) => d.kind === "creditNote").reduce((s, d) => s + docTotals(d).total, 0);
  if (debtors !== partyAR || partyAR !== docAR) {
    console.log(
      `      ↑ debtors ${formatINR(debtors)} / parties ${formatINR(partyAR)} / docs ${formatINR(docAR)}`,
    );
    fail++;
  }
  // the balance sheet must actually balance, profit included
  const bs = balanceSheet(tb);
  if (!bs.balanced) {
    console.log(
      `      ↑ assets ${formatINR(bs.totalAssets)} ≠ liabilities + equity ${formatINR(bs.totalClaims)}`,
    );
    fail++;
  }
  // creditors must equal what the open bills say is owed
  const creditors = tb.rows.find((r) => r.account === A.creditors)?.balance ?? 0;
  const billAP =
    books.docs.filter((d) => d.kind === "bill").reduce((s, d) => s + docTotals(d).outstanding, 0) -
    books.docs.filter((d) => d.kind === "debitNote").reduce((s, d) => s + docTotals(d).total, 0);
  if (creditors !== billAP) {
    console.log(`      ↑ creditors ${formatINR(creditors)} ≠ open bills ${formatINR(billAP)}`);
    fail++;
  }
  // stock on the books must equal stock on the shelf
  const stockRow = tb.rows.find((r) => r.account === A.stock);
  // must read the SAME books, not a second calculation — comparing the ledger
  // against an opening-only valuation is how this assertion lied once already
  const shelf = books.stock.value;
  if ((stockRow?.balance ?? 0) !== shelf) {
    console.log(`      ↑ stock ledger ${formatINR(stockRow?.balance ?? 0)} ≠ valuation ${formatINR(shelf)}`);
    fail++;
  }
  if (!bankOk) console.log(`      ↑ bank ledger ≠ account balances`);
}
console.log(fail === 0 ? "\nALL BOOKS TIE" : `\n${fail} PERSONA(S) DO NOT TIE`);
process.exit(fail ? 1 : 0);
