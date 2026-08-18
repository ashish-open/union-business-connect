"use client";

// Parties — already filled in.
//
// Vyapar's first screen after install is "add a party". Ours opens with every
// customer and supplier the statement has already named, their balances taken
// from real invoices rather than a go-live keying exercise.

import { useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { buildParties, Party, partyTotals } from "@/lib/parties";
import { fmtDate, formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity } from "@/store/useStore";
import { cn } from "@/lib/cn";

type Filter = "all" | "customer" | "supplier" | "owes";

export default function PartiesPage() {
  const router = useRouter();
  const entity = useEntity();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Party | null>(null);
  const books = useBooks(entity);
  const parties = useMemo(
    () => (entity && books ? buildParties(entity, books.docs) : []),
    [entity, books],
  );

  if (!entity) return <AppShell />;

  const t = partyTotals(parties);
  const visible = parties.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "customer") return p.role !== "supplier";
    if (filter === "supplier") return p.role !== "customer";
    if (filter === "owes") return p.receivable > 0;
    return true;
  });

  return (
    <AppShell>
      <p className="text-[12.5px] text-ink-3">
        Everyone the statement has named. Nothing to add.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Owed to you" value={formatINR(t.receivable)} sub={plural(t.overdue, "party", "parties") + " overdue"} />
        <Stat label="Customers" value={String(t.customers)} sub={plural(t.suppliers, "supplier")} />
        <Stat label="TDS withheld" value={formatINR(t.tdsHeld)} sub="Verify against 26AS" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-(--shadow-ctl)">
          <Search size={14} className="shrink-0 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a party"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        {(["all", "customer", "supplier", "owes"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
              filter === f ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-surface-2",
            )}
          >
            {f === "all" ? "All" : f === "owes" ? "Owed to you" : f === "customer" ? "Customers" : "Suppliers"}
          </button>
        ))}
      </div>

      <Card pad="none" className="mt-3">
        {visible.map((p) => (
          <button
            key={p.name}
            onClick={() => setOpen(p)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
          >
            <Avatar name={p.name} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                <Badge variant="outline">
                  {p.role === "both" ? "Customer & supplier" : p.role === "customer" ? "Customer" : "Supplier"}
                </Badge>
                {p.oldestOverdue > 0 && <Badge tone="warn">{p.oldestOverdue}d late</Badge>}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                {p.lastActivity ? `Last ${fmtDate(p.lastActivity)} · ${plural(p.txnCount, "line")}` : "No bank activity"}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {p.receivable > 0 ? (
                <>
                  <Money value={p.receivable} size="sm" className="block" />
                  <span className="mt-0.5 block text-[10.5px] text-ink-3">owed to you</span>
                </>
              ) : (
                <>
                  <Money value={p.paidToThem || p.receivedFromThem} size="sm" className="block" />
                  <span className="mt-0.5 block text-[10.5px] text-ink-3">
                    {p.paidToThem ? "paid" : "received"}
                  </span>
                </>
              )}
            </span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-6 text-center text-[12.5px] text-ink-3">Nobody matches that.</p>
        )}
      </Card>
      <p className="mt-2 text-[11.5px] text-ink-3">
        {`Showing ${visible.length} of ${plural(parties.length, "party", "parties")}`}
      </p>

      {open && <PartySheet party={open} onClose={() => setOpen(null)} onLines={() => router.push(`/statement?q=${encodeURIComponent(open.name)}`)} />}
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.025em] text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{sub}</p>
    </Card>
  );
}

function PartySheet({
  party,
  onClose,
  onLines,
}: {
  party: Party;
  onClose: () => void;
  onLines: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const rows: Array<[string, string]> = [
    ["Role", party.role === "both" ? "Customer & supplier" : party.role === "customer" ? "Customer" : "Supplier"],
    ["Owed to you", formatINR(party.receivable)],
    ["You paid them", formatINR(party.paidToThem)],
    ["They paid you", formatINR(party.receivedFromThem)],
    ...(party.tdsHeld > 0 ? ([["TDS withheld", formatINR(party.tdsHeld)]] as Array<[string, string]>) : []),
    ["Bank lines", String(party.txnCount)],
    ["Last activity", party.lastActivity ? fmtDate(party.lastActivity) : "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={party.name} />
            <p className="truncate text-[14px] font-semibold text-ink">{party.name}</p>
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
            onClick={onLines}
            className="text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
          >
            See their lines in the statement →
          </button>
        </div>
      </div>
    </div>
  );
}
