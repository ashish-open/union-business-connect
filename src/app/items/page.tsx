"use client";

// Items — the catalogue and what is on the shelf.
//
// Valued at cost, never at selling rate: valuing stock at what you hope to get
// for it is how a balance sheet starts lying. Services are listed but carry no
// quantity and no value, which is why the totals say "goods" and not "items".

import { useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { StockRow } from "@/lib/stock";
import { formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity } from "@/store/useStore";
import { cn } from "@/lib/cn";

export default function ItemsPage() {
  const router = useRouter();
  const entity = useEntity();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState<StockRow | null>(null);

  // Stock comes from the books, not a second calculation. Two sources of
  // truth for what is on the shelf is exactly how they drift.
  const books = useBooks(entity);
  const stock = books?.stock;

  if (!entity || !stock) return <AppShell />;

  if (stock.rows.length === 0) {
    return (
      <AppShell>
        <Card className="mt-1">
          <p className="text-[13px] font-medium text-ink">No items yet</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            They arrive with your first bill or invoice.
          </p>
        </Card>
      </AppShell>
    );
  }

  const visible = stock.rows.filter((r) => {
    if (lowOnly && !r.low) return false;
    return !q || r.item.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <AppShell>
      <p className="text-[12.5px] text-ink-3">What you stock, and what it is worth.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Stock value
          </p>
          <Money value={stock.value} size="xl" className="mt-1 block" />
          <p className="mt-1.5 text-[11.5px] text-ink-3">At cost, on the balance sheet</p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Goods</p>
          <p className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.025em] text-ink">
            {stock.goodsCount}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            {plural(stock.rows.length - stock.goodsCount, "service")}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Running low
          </p>
          <p
            className={cn(
              "tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.025em]",
              stock.lowCount > 0 ? "text-warn" : "text-ink",
            )}
          >
            {stock.lowCount}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-3">At or below reorder level</p>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-(--shadow-ctl)">
          <Search size={14} className="shrink-0 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find an item"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
            lowOnly ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-surface-2",
          )}
        >
          Running low
        </button>
      </div>

      <Card pad="none" className="mt-3">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Item
          </span>
          <span className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            On hand
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Value
          </span>
        </div>
        {visible.map((r) => (
          <button
            key={r.item.id}
            onClick={() => setOpen(r)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink">{r.item.name}</span>
                {r.item.service ? (
                  <Badge variant="outline">Service</Badge>
                ) : (
                  r.low && <Badge tone="warn">Low</Badge>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-ink-3 tnum">
                {`HSN ${r.item.hsn} · GST ${r.item.gstPct}% · cost ${formatINR(r.item.cost)}/${r.item.unit}`}
              </span>
            </span>
            <span className="w-24 shrink-0 text-right text-[12.5px] text-ink tnum">
              {r.item.service ? "—" : `${r.closingQty} ${r.item.unit}`}
            </span>
            <span className="w-28 shrink-0 text-right">
              {r.item.service ? (
                <span className="text-[12.5px] text-ink-3">—</span>
              ) : (
                <Money value={r.value} size="sm" />
              )}
            </span>
          </button>
        ))}
      </Card>
      <p className="mt-2 text-[11.5px] text-ink-3">
        {`Showing ${visible.length} of ${plural(stock.rows.length, "item")}`}
      </p>

      {open && (
        <ItemSheet row={open} onClose={() => setOpen(null)} onStock={() => router.push("/reports/stock-summary")} />
      )}
    </AppShell>
  );
}

function ItemSheet({
  row,
  onClose,
  onStock,
}: {
  row: StockRow;
  onClose: () => void;
  onStock: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const i = row.item;
  const margin = i.rate > 0 ? Math.round(((i.rate - i.cost) / i.rate) * 100) : null;
  const rows: Array<[string, string]> = [
    ["Unit", i.unit],
    ["HSN / SAC", i.hsn],
    ["GST", `${i.gstPct}%`],
    ["Cost", formatINR(i.cost)],
    ...(i.rate > 0 ? ([["Selling rate", formatINR(i.rate)]] as Array<[string, string]>) : []),
    ...(margin !== null ? ([["Margin", `${margin}%`]] as Array<[string, string]>) : []),
    ...(i.service
      ? []
      : ([
          ["Opening", `${row.openingQty} ${i.unit}`],
          ["In / out", `${row.inQty} / ${row.outQty}`],
          ["On hand", `${row.closingQty} ${i.unit}`],
          ["Reorder at", `${i.reorder} ${i.unit}`],
          ["Value at cost", formatINR(row.value)],
        ] as Array<[string, string]>)),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{i.name}</p>
            {row.low && !i.service && (
              <p className="text-[11.5px] text-warn">At or below reorder level</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        <div className="space-y-2.5 px-5 py-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="shrink-0 text-ink-3">{k}</span>
              <span className="min-w-0 text-right text-ink tnum">{v}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-3">
          <button
            onClick={onStock}
            className="text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
          >
            See it in the stock summary →
          </button>
        </div>
      </div>
    </div>
  );
}
