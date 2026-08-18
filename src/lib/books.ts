// One entry point for the books, so every report reads the same journal.
//
// Pages must never assemble entries themselves — a report that builds its own
// journal is a report that can disagree with the trial balance, which is the
// one thing a set of books may not do.

import { Entity } from "@/data/seed";
import { Doc, seedDocs, seedOtherDocs, seedPurchaseDocs, stockMovesFrom } from "@/lib/docs";
import { buildBatches } from "@/lib/settlements";
import { reportHeld, type HasReport } from "@/lib/channels";
import { matchLines, suspenseGap, MatchResult, type SuspenseGap } from "@/lib/bookrecon";
import { buildStock, StockView } from "@/lib/stock";
import {
  bankJournal,
  dayBook,
  JournalEntry,
  openingEntry,
  openingStockEntry,
  docEntries,
  stockEntries,
  trialBalance,
  TrialBalance,
} from "@/lib/ledger";

export interface BooksOpts {
  /** Documents created this session, on top of the seeded ones. */
  docs?: Doc[];
  /** Which rails' reports are in hand — a waterfall posts only where one exists. */
  hasReport?: HasReport;
  /** txnId → document number the owner confirmed a match to. */
  confirmed?: Record<string, string>;
  /** txnId → the owner said this is not a document payment. */
  rejected?: Record<string, true>;
  /** Lines the owner explained by hand: txnId → account name. */
  explained?: Record<string, string>;
  /** Journal entries the owner wrote themselves. */
  manual?: JournalEntry[];
  /**
   * Whether the channel portals are authorised.
   *
   * This changes the BOOKS, not just a screen: with the settlement report in
   * hand a platform credit posts at its gross, with the commission, the GST on
   * it and the statutory credits broken out. Without it we only know what
   * landed, and posting a reconstructed gross would be inventing revenue.
   */
  connected?: boolean;
}

export interface Books {
  entries: JournalEntry[];
  /** What the bank lines were matched to, and what still needs a human. */
  matched: MatchResult;
  /** Seeded documents plus anything created this session. */
  /** Issued documents — everything the ledger, GST and aging are built from. */
  docs: Doc[];
  /** Parked, unissued documents. In no total anywhere; only the list shows them. */
  drafts: Doc[];
  stock: StockView;
  /** Newest first — the day book order. */
  journal: JournalEntry[];
  tb: TrialBalance;
  /**
   * The money the books cannot explain, computed once here.
   *
   * On `Books` rather than recomputed per screen because it depends on the same
   * `explained` these books were built with, and a screen that passed a
   * different one would state a gap its own ledger disagrees with. `tb.suspense`
   * is the ledger BALANCE of the same lines and nets opposite directions off;
   * see `suspenseGap` for why that must never reach a reader as the gap.
   */
  gap: SuspenseGap;
  /** First date the books cover. */
  from: string;
}

export function buildBooks(entity: Entity, opts: BooksOpts = {}): Books {
  const explained = opts.explained ?? {};
  const from = entity.txns.reduce((m, t) => (t.date < m ? t.date : m), "9999-12-31");

  const all = [
    ...seedDocs(entity),
    ...seedPurchaseDocs(entity),
    ...seedOtherDocs(entity),
    ...(opts.docs ?? []),
  ];
  /*
   * A parked document is a note to yourself. It has a number and a party, and
   * it posts NOTHING: no journal entry, no stock movement, no receivable, no
   * output GST. So it is kept out of `docs` entirely rather than filtered by
   * each of the seven places that read them — aging, the party statement, the
   * GST return and the close would each have had to remember, and one of them
   * would eventually not have, which is how a half-typed invoice ends up in a
   * filed return.
   */
  const docs = all.filter((d) => d.status !== "draft");
  const drafts = all.filter((d) => d.status === "draft");
  const matched = matchLines(entity, docs, {
    confirmed: opts.confirmed,
    rejected: opts.rejected,
  });
  const opening = openingEntry(entity, from, explained);
  const stockOpening = openingStockEntry(entity, from);
  const entries: JournalEntry[] = [
    ...(opening ? [opening] : []),
    ...(stockOpening ? [stockOpening] : []),
    ...bankJournal(entity, {
      explained,
      matched: matched.byTxn,
      settled: opts.connected
        ? new Map(
            buildBatches(
              entity,
              opts.hasReport ?? reportHeld({ aggregatorsOn: opts.connected }),
            ).map((b) => [b.ref, b] as const),
          )
        : undefined,
    }),
    ...docEntries(docs, matched.byDoc),
    ...stockEntries(entity, docs),
    ...(opts.manual ?? []),
  ];

  return {
    entries,
    docs,
    drafts,
    matched,
    stock: buildStock(entity, stockMovesFrom(docs)),
    journal: dayBook(entries),
    tb: trialBalance(entries),
    gap: suspenseGap(entity, matched, explained),
    from,
  };
}

/** Session-store keys are entity-scoped; unwrap them for one entity. */
export function scopedFlags(entityId: string, all: Record<string, true>): Record<string, true> {
  const out: Record<string, true> = {};
  for (const key of Object.keys(all)) {
    const [eid, txnId] = key.split("/");
    if (eid === entityId) out[txnId] = true;
  }
  return out;
}


export function scopedExplained(
  entityId: string,
  all: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(all)) {
    const [eid, txnId] = key.split("/");
    if (eid === entityId) out[txnId] = val;
  }
  return out;
}
