"use client";

// How much of the business the books can see, and what is missing.
//
// Deliberately no progress bar. A bar here would re-encode the percentage
// printed beside it and fill with the part that needs no work — the exact
// defect the statement's green bar was replaced for. The number states the
// state; the tiers state what to do about it.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { useDismissable } from "@/lib/useDismissable";
import { ANCHOR_DATE } from "@/data/seed";
import { CASH_IN_HEADS, CASH_OUT_HEADS, type CashEntry } from "@/lib/cash";
import { completenessCaveat, type Completeness, type SourceRow } from "@/lib/completeness";
import { formatINR, plural } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CompletenessView({
  data,
  onLogCash,
}: {
  data: Completeness;
  onLogCash: (entry: CashEntry) => void;
}) {
  const [logging, setLogging] = useState(false);

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tnum text-3xl font-semibold tracking-[-0.03em] text-ink">{`${data.pct}%`}</p>
            {/* The caveat is not a footnote. A bank-only view cannot describe a
                business that takes cash, and the percentage must never be read
                without that sentence attached to it. */}
            <p className="mt-1 text-[12.5px] text-ink-2">{completenessCaveat(data)}</p>
          </div>
          {data.atRisk > 0 && (
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Cannot be stood behind
              </p>
              <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                {formatINR(data.atRisk)}
              </p>
            </div>
          )}
        </div>
      </Card>

      {data.tiers.map((t) => (
        <section key={t.n} className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2 tnum">
                {t.n}
              </span>
              {t.title}
            </h3>
            <p className="text-[11.5px] text-ink-3">{t.note}</p>
          </div>

          {t.rows.length === 0 ? (
            <Card className="mt-2 !py-3">
              <p className="text-[12.5px] text-ink-3">Nothing here for this business</p>
            </Card>
          ) : (
            <Card pad="none" className="mt-2">
              {t.rows.map((r) => (
                <Row key={r.label} row={r} onLogCash={() => setLogging(true)} />
              ))}
            </Card>
          )}
        </section>
      ))}

      {logging && (
        <CashSheet
          onClose={() => setLogging(false)}
          onSave={(e) => {
            onLogCash(e);
            setLogging(false);
          }}
        />
      )}
    </>
  );
}

function Row({ row, onLogCash }: { row: SourceRow; onLogCash: () => void }) {
  const done = row.state === "auto" || row.state === "connected";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
        !done && "border-l-2 border-l-warn",
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-ink">
          {done && <Check size={12} strokeWidth={2.5} className="shrink-0 text-pos" />}
          {row.label}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">{row.detail}</p>
      </div>
      {row.action &&
        // Cash is the one gap with nowhere to send you — it is typed here.
        (row.action.href === "/reports" ? (
          <Button size="sm" variant="secondary" onClick={onLogCash}>
            <Plus size={12} /> {row.action.label}
          </Button>
        ) : (
          <Link href={row.action.href}>
            <Button size="sm" variant="secondary">
              {row.action.label} <ArrowRight size={12} />
            </Button>
          </Link>
        ))}
      {done && !row.action && <Badge tone="pos">Complete</Badge>}
    </div>
  );
}

/**
 * The smallest form that can post a real double entry.
 *
 * Four fields, because every extra one is a reason not to bother — and an
 * unlogged cash sale is worth more to the books than a perfectly categorised
 * one that never gets typed.
 */
function CashSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (e: CashEntry) => void;
}) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [head, setHead] = useState<string>(CASH_IN_HEADS[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(ANCHOR_DATE);

  const heads = direction === "in" ? CASH_IN_HEADS : CASH_OUT_HEADS;
  const value = Math.round(Number(amount.replace(/[^\d.]/g, "")) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[16px] bg-surface shadow-(--shadow-pop) animate-rise sm:rounded-[14px]"
      >
        <div className="px-5 pb-3 pt-5">
          <p className="text-[15px] font-semibold text-ink">Log cash</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Money that never touched the bank
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
          <div className="flex gap-2">
            {(["in", "out"] as const).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDirection(d);
                  setHead(d === "in" ? CASH_IN_HEADS[0] : CASH_OUT_HEADS[0]);
                }}
                className={cn(
                  "flex-1 rounded-[10px] px-3 py-2 text-[12.5px] font-medium transition-shadow cursor-pointer",
                  direction === d
                    ? "bg-accent-soft text-accent shadow-(--shadow-ctl)"
                    : "text-ink-2 shadow-(--shadow-ctl) hover:shadow-(--shadow-ctl-hover)",
                )}
              >
                {d === "in" ? "Received" : "Paid out"}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Amount
            </span>
            <Input
              autoFocus
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {direction === "in" ? "What earned it" : "What it paid for"}
            </span>
            <select
              value={head}
              onChange={(e) => setHead(e.target.value)}
              className="w-full rounded-(--radius-ctl) bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) focus:outline-none focus:shadow-(--shadow-focus) cursor-pointer"
            >
              {heads.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Date
              </span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Note
              </span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Counter sale"
              />
            </label>
          </div>

          {value > 0 && (
            /* The posting, before it posts. A double entry typed by someone who
               does not think in debits should still be visible to someone who
               does — and it is the only way to see the entry is balanced. */
            <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[11.5px] leading-5 text-ink-2 tnum">
              {direction === "in"
                ? `Dr Cash in hand ${formatINR(value)} · Cr ${head} ${formatINR(value)}`
                : `Dr ${head} ${formatINR(value)} · Cr Cash in hand ${formatINR(value)}`}
            </p>
          )}
        </div>

        <SheetFooter
          retreat={{ label: "Not now", onClick: onClose }}
          advance={{
            label: "Post it",
            disabled: value <= 0,
            onClick: () =>
              onSave({
                id: `${Date.now()}`,
                date,
                direction,
                amount: value,
                head,
                note: note.trim(),
              }),
          }}
          hint={value <= 0 ? "Enter an amount to post." : undefined}
        />
      </div>
    </div>
  );
}

/** Shown on /close, where the blockers already live. */
export function CompletenessLine({ data }: { data: Completeness }) {
  const gaps = data.tiers.flatMap((t) => t.rows.filter((r) => r.state === "missing"));
  if (gaps.length === 0) return null;
  return (
    <p className="text-[12px] text-ink-3">
      {`${data.pct}% ${completenessCaveat(data)} · ${plural(gaps.length, "gap")}`}
    </p>
  );
}

/**
 * The qualification, above every report built from the ledger.
 *
 * A balance sheet that foots is internally consistent, and a reader — a CA
 * especially — will take it as "these books are right". They are not, while a
 * marketplace posts at net and its commission never appears, or a line sits in
 * Suspense, or the cash drawer has never been opened. The report cannot be
 * trusted further than its inputs, and until now nothing on it said so.
 *
 * It names the largest gap rather than listing them all: one concrete thing the
 * reader can weigh, and a door to the rest. Nine reports each carrying the full
 * gap list would be the same apparatus nine times.
 */
export function CompletenessBand({ data }: { data: Completeness }) {
  const gaps = data.tiers
    .flatMap((t) => t.rows.filter((r) => r.state === "missing"))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

  if (gaps.length === 0) {
    return (
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          <Check size={12} strokeWidth={2.5} className="shrink-0 text-pos" />
          {`${data.pct}% — everything here rests on evidence`}
        </p>
      </Card>
    );
  }

  const largest = gaps[0];
  return (
    <Card className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 border-l-warn !py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-ink tnum">
          {`${data.pct}% ${completenessCaveat(data)}`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          {data.atRisk > 0
            ? `${formatINR(data.atRisk)} not evidenced · largest: ${largest.label}`
            : `Largest gap: ${largest.label}`}
        </p>
      </div>
      <Link href="/reports/completeness">
        <Button size="sm" variant="secondary">
          {plural(gaps.length, "gap")} <ArrowRight size={12} />
        </Button>
      </Link>
    </Card>
  );
}
