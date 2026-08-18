"use client";

// The seven derived reports. Every one reads the same books — none of them
// recomputes anything, which is the rule that keeps them agreeing.

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Books } from "@/lib/books";
import {
  aging,
  balanceSheet,
  cashFlow,
  itemMargins,
  partiesWithActivity,
  partyStatement,
  profitAndLoss,
  Section,
  signedIn,
} from "@/lib/reports";
import { LedgerRow } from "@/lib/ledger";
import { fmtDate, formatINR, plural } from "@/lib/format";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */

function Rows({
  sections,
  onOpen,
}: {
  sections: Section[];
  onOpen?: (a: string) => void;
}) {
  return (
    <>
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="bg-surface-2/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            {sec.title}
          </p>
          {sec.rows.map((r: LedgerRow) => (
            <button
              key={r.account}
              onClick={() => onOpen?.(r.account)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{r.account}</span>
              <span className="shrink-0 text-[12.5px] text-ink tnum">
                {formatINR(signedIn(r))}
              </span>
            </button>
          ))}
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <span className="flex-1 text-[11.5px] font-medium text-ink-2">{sec.title} total</span>
            <span className="text-[12.5px] font-medium text-ink tnum">{formatINR(sec.total)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5",
        strong ? "bg-surface-2" : "border-b border-border",
      )}
    >
      <span className={cn("flex-1 text-[12px]", strong ? "font-medium text-ink-2" : "text-ink-3")}>
        {label}
      </span>
      <Money value={value} size={strong ? "md" : "sm"} className="shrink-0" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function BalanceSheetView({ books, onOpen }: { books: Books; onOpen: (a: string) => void }) {
  const bs = balanceSheet(books.tb);
  return (
    <>
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="flex items-center gap-2">
          {/* Neutral, not a green pass — see the note on the trial balance.
              A balance sheet that foots is a balance sheet that foots; whether
              it describes the business is the completeness band's question, and
              the two were being answered by one badge. */}
          <Badge tone={bs.balanced ? "neutral" : "neg"}>
            {bs.balanced
              ? "Assets = liabilities + equity"
              : `Out by ${formatINR(Math.abs(bs.totalAssets - bs.totalClaims))}`}
          </Badge>
          <span className="text-[12.5px] text-ink-3 tnum">{formatINR(bs.totalAssets)} each side</span>
        </div>
        <span className="text-[12.5px] text-ink-3">
          {`Profit for the period ${formatINR(bs.net)}`}
        </span>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">What you own</h3>
          <Card pad="none" className="mt-2">
            <Rows sections={bs.assets} onOpen={onOpen} />
            <Total label="Total assets" value={bs.totalAssets} strong />
          </Card>
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">What you owe</h3>
          <Card pad="none" className="mt-2">
            <Rows sections={bs.liabilities} onOpen={onOpen} />
            <Rows sections={bs.equity} onOpen={onOpen} />
            <Total label="Profit for the period" value={bs.net} />
            <Total label="Total liabilities and equity" value={bs.totalClaims} strong />
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function ProfitLossView({ books, onOpen }: { books: Books; onOpen: (a: string) => void }) {
  const pl = profitAndLoss(books.tb);
  const marginPct = pl.totalIncome > 0 ? Math.round((pl.net / pl.totalIncome) * 100) : null;
  return (
    <>
      <Card className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {pl.net >= 0 ? "Profit" : "Loss"}
        </p>
        <Money value={Math.abs(pl.net)} size="hero" className="mt-1 block" />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          {marginPct !== null
            ? `${formatINR(pl.totalIncome)} in, ${formatINR(pl.totalExpense)} out · ${marginPct}% margin`
            : `${formatINR(pl.totalExpense)} out, nothing in yet`}
        </p>
      </Card>

      <Card pad="none" className="mt-4">
        <Rows sections={pl.income} onOpen={onOpen} />
        <Total label="Total income" value={pl.totalIncome} />
        <Rows sections={pl.expenses} onOpen={onOpen} />
        <Total label="Total costs" value={pl.totalExpense} />
        <Total label={pl.net >= 0 ? "Profit" : "Loss"} value={pl.net} strong />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function AgingView({ books }: { books: Books }) {
  const [side, setSide] = useState<"sales" | "purchase">("sales");
  const buckets = aging(books.docs, side);
  const total = buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <>
      <div className="mt-4 flex gap-1.5">
        {(["sales", "purchase"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
              side === s ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-surface-2",
            )}
          >
            {s === "sales" ? "Owed to you" : "You owe"}
          </button>
        ))}
      </div>

      <Card pad="none" className="mt-3">
        {buckets.map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink">{b.label}</span>
              <span className="mt-0.5 block text-[11px] text-ink-3">
                {plural(b.count, "document")}
              </span>
            </span>
            {total > 0 && (
              <span className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-surface-2 sm:block">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    b.label === "Not due" ? "bg-pos" : "bg-warn",
                  )}
                  style={{ width: `${Math.round((b.amount / total) * 100)}%` }}
                />
              </span>
            )}
            <Money value={b.amount} size="sm" className="w-28 shrink-0 text-right" />
          </div>
        ))}
        <Total label="Total open" value={total} strong />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function PartyStatementView({ books }: { books: Books }) {
  const parties = partiesWithActivity(books);
  const [party, setParty] = useState(parties[0] ?? "");
  const lines = party ? partyStatement(books, party) : [];
  const closing = lines[lines.length - 1]?.running ?? 0;

  if (parties.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-[13px] font-medium text-ink">No documents yet</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          A statement appears once a party has been billed or paid.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={party}
          onChange={(e) => setParty(e.target.value)}
          className="rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) outline-none cursor-pointer"
        >
          {parties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-ink-3">
          {closing >= 0 ? "Owed to you" : "You owe"}{" "}
          <span className="font-medium text-ink tnum">{formatINR(Math.abs(closing))}</span>
        </span>
      </div>

      <Card pad="none" className="mt-3">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Detail
          </span>
          <span className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Billed
          </span>
          <span className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Paid
          </span>
          <span className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Balance
          </span>
        </div>
        {lines.map((l, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-ink">{l.detail}</span>
              <span className="mt-0.5 block text-[11px] text-ink-3 tnum">{fmtDate(l.date)}</span>
            </span>
            <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
              {l.debit ? formatINR(l.debit) : ""}
            </span>
            <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
              {l.credit ? formatINR(l.credit) : ""}
            </span>
            <span className="w-24 shrink-0 text-right text-[12.5px] text-ink-2 tnum">
              {formatINR(l.running)}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function CashFlowView({ books }: { books: Books }) {
  const cf = cashFlow(books.entries);
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">In</p>
          <Money value={cf.in} size="xl" className="mt-1 block" />
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Out</p>
          <Money value={cf.out} size="xl" className="mt-1 block" />
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Net</p>
          <Money value={cf.in - cf.out} size="xl" className="mt-1 block" />
        </Card>
      </div>

      <Card pad="none" className="mt-4">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Head
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            In
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Out
          </span>
        </div>
        {cf.rows.map((r) => (
          <div
            key={r.account}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{r.account}</span>
            <span className="w-28 shrink-0 text-right text-[12.5px] text-ink tnum">
              {r.inflow ? formatINR(r.inflow) : ""}
            </span>
            <span className="w-28 shrink-0 text-right text-[12.5px] text-ink tnum">
              {r.outflow ? formatINR(r.outflow) : ""}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function StockSummaryView({ books }: { books: Books }) {
  const goods = books.stock.rows.filter((r) => !r.item.service);
  return (
    <Card pad="none" className="mt-4 overflow-x-auto">
      <div className="min-w-[40rem]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="min-w-[9rem] flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Item
        </span>
        {["Opening", "In", "Out", "On hand", "Value"].map((h) => (
          <span
            key={h}
            className="w-20 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3"
          >
            {h}
          </span>
        ))}
      </div>
      {goods.map((r) => (
        <div
          key={r.item.id}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <span className="min-w-[9rem] flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[12.5px] text-ink">{r.item.name}</span>
              {r.low && <Badge tone="warn">Low</Badge>}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-3">{r.item.unit}</span>
          </span>
          {[r.openingQty, r.inQty, r.outQty, r.closingQty].map((n, i) => (
            <span key={i} className="w-20 shrink-0 text-right text-[12.5px] text-ink tnum">
              {n || "—"}
            </span>
          ))}
          <span className="w-20 shrink-0 text-right text-[12.5px] text-ink tnum">
            {formatINR(r.value)}
          </span>
        </div>
      ))}
      <Total label="Stock at cost" value={books.stock.value} strong />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ItemPLView({ books }: { books: Books }) {
  const rows = itemMargins(books);
  if (rows.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-[13px] font-medium text-ink">Nothing sold with an item on it yet</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Margin appears once an invoice carries items rather than a lump sum.
        </p>
      </Card>
    );
  }
  return (
    <Card pad="none" className="mt-4 overflow-x-auto">
      <div className="min-w-[40rem]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="min-w-[10rem] flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Item
        </span>
        {["Sold", "Revenue", "Cost", "Margin"].map((h) => (
          <span
            key={h}
            className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3"
          >
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.item.id}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <span className="min-w-[10rem] flex-1 truncate text-[12.5px] text-ink">{r.item.name}</span>
          <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
            {`${r.soldQty} ${r.item.unit}`}
          </span>
          <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
            {formatINR(r.revenue)}
          </span>
          <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
            {formatINR(r.cost)}
          </span>
          <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
            {formatINR(r.margin)}
            {r.marginPct !== null && (
              <span className="ml-1 text-[10.5px] text-ink-3">{r.marginPct}%</span>
            )}
          </span>
        </div>
      ))}
      </div>
    </Card>
  );
}
