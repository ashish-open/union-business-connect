"use client";

// Reconcile — the human in the loop.
//
// Everything the engine was sure about is already posted. What lands here is
// only what it could not decide: payments that look like a document but are
// not certain, and lines nobody can name. Clearing the second list is the same
// act as emptying Suspense, which is what unblocks the close.

import { useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { resolveCounterparty } from "@/lib/analysis";
import { ACCOUNTS } from "@/lib/coa";
import { docTotals } from "@/lib/docs";
import { Txn } from "@/data/seed";
import { fmtDate, formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";
import { JournalSheet } from "@/components/books/JournalSheet";

export default function ReconcilePage() {
  const entity = useEntity();
  const explainLine = useStore((s) => s.explainLine);
  const confirmMatch = useStore((s) => s.confirmMatch);
  const rejectMatch = useStore((s) => s.rejectMatch);
  const addJournalEntry = useStore((s) => s.addJournalEntry);
  const [explaining, setExplaining] = useState<Txn | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  const books = useBooks(entity);

  if (!entity || !books) return <AppShell />;

  const open = books.gap.lines;
  const txnById = new Map(entity.txns.map((t) => [t.id, t]));
  const suggestions = books.matched.suggested;
  const done = suggestions.length === 0 && open.length === 0;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* "These need you" is a promise about the list below it, so it cannot be
            printed when the list is empty — it sat directly above the card that
            says nothing does. */}
        <p className="text-[12.5px] text-ink-3">
          {done
            ? `${books.matched.byTxn.size} matched on their own.`
            : `${books.matched.byTxn.size} matched on their own. These need you.`}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setJournalOpen(true)}>
          <Plus size={13} /> Journal entry
        </Button>
      </div>

      {books.gap.count > 0 && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
          <div>
            <p className="text-[12.5px] font-medium text-ink">
              {`${formatINR(books.gap.gross)} sitting in Suspense`}
            </p>
            <p className="text-[11.5px] text-ink-3">The close stays blocked until this is nil</p>
          </div>
          <Badge tone="warn">Blocking</Badge>
        </Card>
      )}

      {done && (
        <Card className="mt-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Check size={14} className="text-pos" /> Nothing needs you here
          </p>
          {/*
            States the two conditions of `done` and nothing beyond them. It used
            to claim "every payment is matched", which is a different and larger
            claim than this screen checks: the demo account reaches this card with
            12 customer credits matched to no document at all, because a named
            counterparty is what empties Suspense and a document is what evidences
            revenue. /close counts those 12 as still needing eyes, so the old copy
            put "Nothing needs you" beside "12 of 18 lines still need your eyes".
          */}
          <p className="mt-1 text-[12.5px] text-ink-3">
            Every line is named, and no payment is waiting on a match decision.
          </p>
        </Card>
      )}

      {/* payments that look like a document but are not certain */}
      {suggestions.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-ink">
            Might settle a document
          </h2>
          <Card pad="none" className="mt-2.5">
            {suggestions.map((m) => {
              const txn = txnById.get(m.txnId);
              const doc = books.docs.find((d) => d.number === m.docNumber);
              if (!txn || !doc) return null;
              /* Who the money actually came from, when that is not who the
                 document is addressed to.
                 The row leads with the document's party and the reason can read
                 "different name" — so it was asking "does this settle INV-0039?"
                 while withholding the only fact that answers it. A proprietor
                 settling his company's bill from a personal account is the
                 commonest case there is, and the name is how you recognise it. */
              const payer = resolveCounterparty(txn.narration).name;
              const under = payer && payer !== doc.party ? ` — ${payer}` : "";
              return (
                <div
                  key={`${m.txnId}-${m.docNumber}`}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-ink">
                        {doc.party}
                      </span>
                      <Badge tone="info">{Math.round(m.confidence * 100)}% match</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-3 tnum">
                      {`${fmtDate(txn.date)} · ${m.reason}${under} · ${doc.number} is ${formatINR(docTotals(doc).outstanding)} open`}
                    </span>
                  </span>
                  <Money value={txn.amount} size="sm" className="shrink-0" />
                  <span className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => confirmMatch(entity.id, m.txnId, m.docNumber)}
                    >
                      <Check size={12} /> It does
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Not ${doc.number}`}
                      onClick={() => rejectMatch(entity.id, m.txnId)}
                    >
                      <X size={12} />
                    </Button>
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* lines nobody can name */}
      {open.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-ink">Nobody can name these</h2>
          <Card pad="none" className="mt-2.5">
            {open.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {t.narration}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-3 tnum">
                    {`${fmtDate(t.date)} · ${t.mode} · in Suspense`}
                  </span>
                </span>
                <Money value={t.amount} size="sm" className="shrink-0" />
                <Button size="sm" variant="secondary" onClick={() => setExplaining(t)}>
                  Explain
                </Button>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3">
            {`${plural(open.length, "line")} · pick a head and Suspense clears`}
          </p>
        </section>
      )}

      {explaining && (
        <ExplainSheet
          txn={explaining}
          onClose={() => setExplaining(null)}
          onPick={(acc) => {
            explainLine(entity.id, explaining.id, acc);
            setExplaining(null);
          }}
        />
      )}

      {journalOpen && (
        <JournalSheet
          onClose={() => setJournalOpen(false)}
          onSave={(je) => {
            addJournalEntry(entity.id, je);
            setJournalOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

function ExplainSheet({
  txn,
  onClose,
  onPick,
}: {
  txn: Txn;
  onClose: () => void;
  onPick: (account: string) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  // A debit is a cost or an asset; a credit is income or a liability. Offering
  // the other half would only invite a wrong posting.
  const options = ACCOUNTS.filter((a) =>
    txn.direction === "debit"
      ? a.type === "expense" || a.type === "asset" || a.type === "equity"
      : a.type === "income" || a.type === "liability",
  ).filter((a) => a.name !== "Bank" && a.name !== "Suspense");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-ink">{txn.narration}</p>
            <p className="text-[11.5px] text-ink-3 tnum">
              {`${fmtDate(txn.date)} · ${formatINR(txn.amount)} ${txn.direction === "debit" ? "out" : "in"}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {options.map((a) => (
            <button
              key={a.code}
              onClick={() => onPick(a.name)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2/60 cursor-pointer"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.name}</span>
              <span className="shrink-0 text-[11px] text-ink-3">{a.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
