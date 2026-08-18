"use client";

// A manual journal entry — the escape hatch every set of books needs.
//
// The only rule enforced is the one that cannot be broken: it must balance.
// The Save button stays dead until it does, and the difference is shown while
// it does not, because "unbalanced" without a number is a puzzle, not an error.

import { useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { ArrowLeft, Plus, X } from "lucide-react";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { ACCOUNTS } from "@/lib/coa";
import { entry, JournalEntry, Posting } from "@/lib/ledger";
import { ANCHOR_DATE } from "@/data/seed";
import { cn } from "@/lib/cn";
import { formatINR, parseAmount } from "@/lib/format";

// The row holds the TEXT that was typed, and the number is derived from it.
// The other way round loses the decimal point: the old field stripped every
// non-digit, so "1500.50" posted as ₹1,50,050 to a ledger that then tied.
// Keeping the text here also means clearing one side actually clears what is
// on screen, which a field owning its own draft state could not do.
interface Row {
  account: string;
  debit: string;
  credit: string;
}

const BLANK: Row = { account: "", debit: "", credit: "" };

/** Whole rupees, 0 for anything we cannot read — which then cannot balance. */
const num = (s: string) => parseAmount(s)?.value ?? 0;
const unreadable = (s: string) => s.trim().length > 0 && !parseAmount(s);

export function JournalSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (je: JournalEntry) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [narration, setNarration] = useState("");
  const [date, setDate] = useState(ANCHOR_DATE);
  const [rows, setRows] = useState<Row[]>([
    { ...BLANK, account: ACCOUNTS[0].name },
    { ...BLANK, account: ACCOUNTS[1].name },
  ]);

  const totalDr = rows.reduce((s, r) => s + num(r.debit), 0);
  const totalCr = rows.reduce((s, r) => s + num(r.credit), 0);
  const diff = totalDr - totalCr;
  const anyUnreadable = rows.some((r) => unreadable(r.debit) || unreadable(r.credit));
  const valid = totalDr > 0 && diff === 0 && narration.trim().length > 0 && !anyUnreadable;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const postings: Posting[] = rows
      .filter((r) => num(r.debit) > 0 || num(r.credit) > 0)
      .map((r) => ({ account: r.account, debit: num(r.debit), credit: num(r.credit) }));
    onSave(
      entry(`je-manual-${date}-${totalDr}`, date, narration.trim(), "manual", postings, {
        ref: "MANUAL",
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <p className="text-[14px] font-semibold text-ink">Journal entry</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              What is it for
            </span>
            <input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Depreciation for July"
              className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) outline-none placeholder:text-ink-3"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) outline-none tnum"
            />
          </label>

          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Postings
          </p>
          {rows.map((r, i) => (
            <div key={i} className="mt-2 flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[10.5px] text-ink-3">Account</span>
                <select
                  value={r.account}
                  onChange={(e) => setRow(i, { account: e.target.value })}
                  className="w-full rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) outline-none cursor-pointer"
                >
                  {ACCOUNTS.map((a) => (
                    <option key={a.code} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <AmountField
                label="Debit"
                value={r.debit}
                onChange={(v) => setRow(i, { debit: v, credit: num(v) > 0 ? "" : r.credit })}
              />
              <AmountField
                label="Credit"
                value={r.credit}
                onChange={(v) => setRow(i, { credit: v, debit: num(v) > 0 ? "" : r.debit })}
              />
              {rows.length > 2 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label={`Remove posting ${i + 1}`}
                  className="mb-1 shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => setRows((rs) => [...rs, { ...BLANK, account: ACCOUNTS[0].name }])}
            className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
          >
            <Plus size={13} /> Add a posting
          </button>
        </div>

        {/* Retreat and advance, and deliberately NO park: nothing in the books
            holds an unbalanced journal entry, and a "Save as draft" that had
            nowhere to save to would be the same empty promise as the bell. */}
        <SheetFooter
          retreat={{ label: "Books", onClick: onClose }}
          advance={{ label: "Post entry", disabled: !valid, onClick: save }}
          hint={
            diff !== 0
              ? `Out by ${formatINR(Math.abs(diff))} — a journal entry has to balance.`
              : totalDr === 0
                ? "Enter the two sides."
                : narration.trim().length === 0
                  ? "Say what it is for."
                  : "Balanced."
          }
        >
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-ink-3">Debit / credit</span>
            <span className="text-ink tnum">
              {formatINR(totalDr)} / {formatINR(totalCr)}
            </span>
          </div>
        </SheetFooter>
      </div>
    </div>
  );
}

// Shows exactly what was typed. Text we cannot read turns red and counts as
// zero, so the entry stops balancing and the sheet's own rule keeps Save dead
// — this field only has to be honest about what it understood.
function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const bad = unreadable(value);
  return (
    <label className="w-24 shrink-0">
      <span className="mb-0.5 block text-[10.5px] text-ink-3">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        aria-invalid={bad}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-md bg-surface px-2 py-1.5 text-right text-[12.5px] shadow-(--shadow-ctl) outline-none tnum",
          bad ? "text-neg" : "text-ink",
        )}
      />
    </label>
  );
}
