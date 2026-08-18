"use client";

// One way to build the books, for every screen that reads them.
//
// Ten pages each assembled their own options bag by hand — the same seven
// lines, copied. That was survivable while the bag was static, but connecting
// a channel now changes what the ledger records, and a page that forgot to
// pass it would quietly report a different Sales figure from the page beside
// it. That is the "two calculations of one fact" shape this codebase has been
// bitten by four times.
//
// So the bag is assembled once, here, from the store.

import { useMemo } from "react";
import type { Entity } from "@/data/seed";
import { Books, buildBooks, scopedExplained, scopedFlags } from "@/lib/books";
import { cashJournals } from "@/lib/cash";
import { useStore } from "@/store/useStore";

export function useBooks(entity: Entity | undefined): Books | undefined {
  const explainedLines = useStore((s) => s.explainedLines);
  const manualEntries = useStore((s) => s.manualEntries);
  const cashEntries = useStore((s) => s.cashEntries);
  const sessionDocs = useStore((s) => s.docs);
  const confirmedMatches = useStore((s) => s.confirmedMatches);
  const rejectedMatches = useStore((s) => s.rejectedMatches);
  const channelsConnected = useStore((s) => s.channelsConnected);

  return useMemo(() => {
    if (!entity) return undefined;
    return buildBooks(entity, {
      explained: scopedExplained(entity.id, explainedLines),
      /* Cash joins the ledger through the same channel a hand-written journal
         entry does — it IS one, just typed through a smaller form. Folding it
         in here rather than in `buildBooks` means every screen that reads the
         books gets it without knowing cash exists. */
      manual: [...(manualEntries[entity.id] ?? []), ...cashJournals(cashEntries[entity.id])],
      docs: sessionDocs[entity.id],
      confirmed: scopedExplained(entity.id, confirmedMatches),
      rejected: scopedFlags(entity.id, rejectedMatches),
      connected: !!channelsConnected[entity.id],
    });
  }, [
    entity,
    explainedLines,
    manualEntries,
    cashEntries,
    sessionDocs,
    confirmedMatches,
    rejectedMatches,
    channelsConnected,
  ]);
}
