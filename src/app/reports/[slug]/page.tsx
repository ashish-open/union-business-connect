"use client";

// Reports — one route, the sub-nav switches the view.
//
// Density law G throughout: a row is label | number, a header is label | value.
// The only prose on these screens is the one-line report subtitle.

import { useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, TriangleAlert } from "lucide-react";
import { downloadCsv, toCsv } from "@/lib/csv";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { accountLedger, JournalEntry, LedgerRow } from "@/lib/ledger";
import { GROUP_ORDER } from "@/lib/coa";
import { reportBySlug, reportItems } from "@/lib/reports";
import {
  AgingView,
  BalanceSheetView,
  CashFlowView,
  ItemPLView,
  PartyStatementView,
  ProfitLossView,
  StockSummaryView,
} from "@/components/books/ReportViews";
import { CompletenessBand, CompletenessView } from "@/components/books/CompletenessView";
import { completenessOf } from "@/lib/completeness";
import { buildStatement } from "@/lib/statement";
import { reportHeld } from "@/lib/channels";
import { fmtDate, formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";
import { cn } from "@/lib/cn";

export default function ReportPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const entity = useEntity();
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const channelSources = useStore((s) => s.channelSources);
  const channelsConnected = useStore((s) => s.channelsConnected);
  const cashEntries = useStore((s) => s.cashEntries);
  const addCashEntry = useStore((s) => s.addCashEntry);

  const books = useBooks(entity);

  /* Derived once for the page: the band above the report and the completeness
     report itself must not compute this twice and disagree. */
  const completeness = useMemo(() => {
    if (!entity || !books) return null;
    const hasReport = reportHeld({
      source: (id) => channelSources[`${entity.id}/${id}`],
      aggregatorsOn: !!channelsConnected[entity.id],
    });
    /* The full history, not a 30-day window — the books cover everything, and a
       completeness figure over a shorter period would describe a different set
       of lines than the ledger it qualifies. */
    const rows = buildStatement(entity, {
      connected: !!channelsConnected[entity.id],
      resolutions: {},
      days: 3650,
      hasReport,
    }).rows;
    return completenessOf(entity, {
      rows,
      matched: books.matched,
      explained: {},
      hasReport,
      source: (id) => channelSources[`${entity.id}/${id}`],
      aggregatorsOn: !!channelsConnected[entity.id],
      cashEntries: (cashEntries[entity.id] ?? []).length,
    });
  }, [entity, books, channelSources, channelsConnected, cashEntries]);

  if (!entity || !books) return <AppShell />;

  const def = reportBySlug(params.slug);
  if (!def) {
    return (
      <AppShell>
        <SectionLayout title="Reports" items={reportItems} active={`/reports/${params.slug}`}>
          <Card>
            <p className="text-[13px] font-medium text-ink">No such report</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              Pick one from the list beside this.
            </p>
          </Card>
        </SectionLayout>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SectionLayout title="Reports" items={reportItems} active={`/reports/${def.slug}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{def.label}</h2>
            <p className="text-[12.5px] text-ink-3">{def.sub}</p>
          </div>
          {def.live && (
            <Button size="sm" variant="secondary" onClick={() => downloadReport(entity.id, def.slug, books.tb.rows, books.journal)}>
              <Download size={13} /> CSV
            </Button>
          )}
        </div>

        {/* The qualification, above every report built from the ledger.
            Aging, party statements and stock come from documents and items, so
            the ledger's coverage is not the thing that limits them; these five
            are the ledger, restated. */}
        {completeness &&
          ["trial-balance", "day-book", "balance-sheet", "profit-and-loss", "cash-flow"].includes(
            def.slug,
          ) && <CompletenessBand data={completeness} />}

        {def.slug === "completeness" ? (
          completeness && (
            <CompletenessView
              data={completeness}
              onLogCash={(e) => addCashEntry(entity.id, e)}
            />
          )
        ) : def.slug === "balance-sheet" ? (
          <BalanceSheetView books={books} onOpen={setOpenAccount} />
        ) : def.slug === "profit-and-loss" ? (
          <ProfitLossView books={books} onOpen={setOpenAccount} />
        ) : def.slug === "aging" ? (
          <AgingView books={books} />
        ) : def.slug === "party-statement" ? (
          <PartyStatementView books={books} />
        ) : def.slug === "cash-flow" ? (
          <CashFlowView books={books} />
        ) : def.slug === "stock-summary" ? (
          <StockSummaryView books={books} />
        ) : def.slug === "item-pl" ? (
          <ItemPLView books={books} />
        ) : def.slug === "trial-balance" ? (
          <TrialBalanceView
            rows={books.tb.rows}
            totalDebit={books.tb.totalDebit}
            totalCredit={books.tb.totalCredit}
            balanced={books.tb.balanced}
            suspense={books.tb.suspense}
            onOpen={setOpenAccount}
            onFix={() => router.push("/statement?filter=issues")}
          />
        ) : (
          <DayBookView entries={books.journal} onOpen={setOpenAccount} />
        )}
      </SectionLayout>

      {openAccount && (
        <AccountSheet
          account={openAccount}
          entries={books.entries}
          onClose={() => setOpenAccount(null)}
          onTxn={() => router.push("/statement")}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function TrialBalanceView({
  rows,
  totalDebit,
  totalCredit,
  balanced,
  suspense,
  onOpen,
  onFix,
}: {
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  suspense: number;
  onOpen: (a: string) => void;
  onFix: () => void;
}) {
  const groups = GROUP_ORDER.filter((g) => rows.some((r) => r.group === g));

  return (
    <>
      {/* the proof, stated once */}
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="flex items-center gap-2">
          {/* Demoted from a green pass to a neutral technical note.
              "Balanced" answers "does the journal foot" — an internal
              consistency check that is true of any double-entry system, and
              says nothing about whether the books describe the business. Green
              made it read as a verdict, directly above figures that can be
              understated by every unconnected marketplace. The completeness
              band above now carries the claim; this carries the arithmetic. */}
          {balanced ? (
            <Badge>
              <Check size={11} strokeWidth={2.5} className="text-ink-3" /> Debits = credits
            </Badge>
          ) : (
            <Badge tone="neg">
              <TriangleAlert size={11} /> Out by {formatINR(Math.abs(totalDebit - totalCredit))}
            </Badge>
          )}
          <span className="text-[12.5px] text-ink-3 tnum">
            {formatINR(totalDebit)} each side
          </span>
        </div>
        {suspense !== 0 && (
          <Button size="sm" variant="secondary" onClick={onFix}>
            {`${formatINR(Math.abs(suspense))} in Suspense`}
          </Button>
        )}
      </Card>

      <Card pad="none" className="mt-4">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Account
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Debit
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Credit
          </span>
        </div>

        {groups.map((g) => (
          <div key={g}>
            <p className="bg-surface-2/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {g}
            </p>
            {rows
              .filter((r) => r.group === g)
              .map((r) => (
                <button
                  key={r.account}
                  onClick={() => onOpen(r.account)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                    {r.account}
                    {r.account === "Suspense" && (
                      <Badge tone="warn" className="ml-1.5">
                        Unexplained
                      </Badge>
                    )}
                  </span>
                  <span className="w-28 text-right text-[12.5px] text-ink tnum">
                    {r.debit ? formatINR(r.debit) : ""}
                  </span>
                  <span className="w-28 text-right text-[12.5px] text-ink tnum">
                    {r.credit ? formatINR(r.credit) : ""}
                  </span>
                </button>
              ))}
          </div>
        ))}

        <div className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
          <span className="flex-1 text-[12px] font-medium text-ink-2">Total</span>
          <span className="w-28 text-right text-[13px] font-semibold text-ink tnum">
            {formatINR(totalDebit)}
          </span>
          <span className="w-28 text-right text-[13px] font-semibold text-ink tnum">
            {formatINR(totalCredit)}
          </span>
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

function DayBookView({
  entries,
  onOpen,
}: {
  entries: JournalEntry[];
  onOpen: (a: string) => void;
}) {
  const SOURCE: Record<string, string> = { bank: "Bank", doc: "Document", manual: "Manual" };
  return (
    <Card pad="none" className="mt-4">
      {entries.slice(0, 120).map((e) => {
        const amount = e.postings.reduce((s, p) => s + p.debit, 0);
        return (
          <div key={e.id} className="border-b border-border px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-[11.5px] text-ink-3 tnum">{fmtDate(e.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">{e.narration}</span>
                  {e.source !== "bank" && (
                    <Badge variant="outline">{SOURCE[e.source]}</Badge>
                  )}
                </span>
              </span>
              <Money value={amount} size="sm" className="shrink-0" />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-[68px]">
              {e.postings.map((p, i) => (
                <button
                  key={i}
                  onClick={() => onOpen(p.account)}
                  className="text-[11.5px] text-ink-3 transition-colors hover:text-accent cursor-pointer"
                >
                  {p.debit ? "Dr" : "Cr"} {p.account}{" "}
                  <span className="tnum">{formatINR(p.debit || p.credit)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {entries.length > 120 && (
        <p className="px-4 py-2.5 text-[11.5px] text-ink-3">
          {`Showing 120 of ${plural(entries.length, "entry", "entries")}`}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function AccountSheet({
  account,
  entries,
  onClose,
  onTxn,
}: {
  account: string;
  entries: JournalEntry[];
  onClose: () => void;
  onTxn: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const rows = accountLedger(entries, account);
  const closing = rows[0]?.running ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[14px] font-semibold text-ink">{account}</p>
            <p className="text-[11.5px] text-ink-3 tnum">
              {`${plural(rows.length, "entry", "entries")} · closing ${formatINR(closing)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map(({ entry, debit, credit, running }) => (
            <button
              key={entry.id}
              onClick={entry.txnId ? onTxn : undefined}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border px-5 py-2.5 text-left last:border-b-0",
                entry.txnId && "transition-colors hover:bg-surface-2/60 cursor-pointer",
              )}
            >
              <span className="w-12 shrink-0 text-[11px] text-ink-3 tnum">
                {fmtDate(entry.date)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                {entry.narration}
              </span>
              <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
                {debit ? formatINR(debit) : `(${formatINR(credit)})`}
              </span>
              <span className="w-24 shrink-0 text-right text-[11.5px] text-ink-3 tnum">
                {formatINR(running)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function downloadReport(
  entityId: string,
  slug: string,
  rows: LedgerRow[],
  journal: JournalEntry[],
) {
  const csv =
    slug === "trial-balance"
      ? toCsv(
          ["account", "group", "debit", "credit"],
          rows.map((r) => [r.account, r.group, r.debit, r.credit]),
        )
      : toCsv(
          ["date", "narration", "source", "ref", "account", "debit", "credit"],
          journal.flatMap((e) =>
            e.postings.map((p) => [
              e.date,
              e.narration,
              e.source,
              e.ref ?? "",
              p.account,
              p.debit,
              p.credit,
            ]),
          ),
        );
  downloadCsv(`${entityId}-${slug}.csv`, csv);
}
