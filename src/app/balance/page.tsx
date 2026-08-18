"use client";

// Balance — the "where is my money" screen.
//
// Built to the reference laws: no in-content H1 (the top bar owns it) ·
// actions before data · the account list IS the balance sheet, so you never
// need the detail pane to answer the question · the chart answers shape and
// the number answers value · money is never coloured · routing code shows
// in clear, the account number is masked behind a reveal, because that
// asymmetry matches the real risk.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Landmark,
  ScrollText,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { BalanceChart } from "@/components/money/BalanceChart";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AccountSource } from "@/components/balance/AccountSource";
import { Money } from "@/components/ui/Money";
import { buildBalance } from "@/lib/balance";
import { sweepOffer } from "@/lib/conversion";
import { SweepInOffer } from "@/components/money/SweepIn";
import { detectRera } from "@/lib/rera";
import { addDays, formatINR, maskAccount } from "@/lib/format";
import { ANCHOR_DATE } from "@/data/seed";

/* When the other banks' accounts were consented.
   Seeded rather than stored: they were linked before this session began, and a
   consent date invented per render would move every time the page loaded. */
const LINKED_SINCE = addDays(ANCHOR_DATE, -74);
import { useEntity, useStore } from "@/store/useStore";
import { cn } from "@/lib/cn";

const WINDOWS = [30, 60, 90];

export default function BalancePage() {
  const router = useRouter();
  const entity = useEntity();
  const sweepMandates = useStore((s) => s.sweepMandate);
  const setSweepMandate = useStore((s) => s.setSweepMandate);
  const cancelSweepMandate = useStore((s) => s.cancelSweepMandate);
  const [days, setDays] = useState(90);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const aaLinks = useStore((s) => s.aaLinks);
  const syncLinked = useStore((s) => s.syncLinked);
  const revokeLinked = useStore((s) => s.revokeLinked);
  const [syncing, setSyncing] = useState<string | null>(null);

  const view = useMemo(() => (entity ? buildBalance(entity, days) : null), [entity, days]);
  const offer = useMemo(() => (entity ? sweepOffer(entity) : null), [entity]);

  if (!entity || !view) return <AppShell />;

  const mandate = sweepMandates[entity.id];

  const active = view.accounts.find((a) => a.account.masked === selected) ?? view.accounts[0];

  // verbs adapt to what this entity can actually do
  const verbs = [
    { label: "Pay someone", icon: ArrowUpRight, href: "/payouts" },
    { label: "Get paid", icon: ArrowDownLeft, href: "/collections" },
    { label: "Open the statement", icon: ScrollText, href: "/statement" },
    ...(detectRera(entity)
      ? [{ label: "Project account", icon: Landmark, href: "/project" }]
      : []),
  ];

  return (
    <AppShell>
      <p className="text-[13px] text-ink-3">
        What you hold, and how it moved.
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {verbs.map((v) => (
          <button
            key={v.label}
            onClick={() => router.push(v.href)}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 shadow-(--shadow-ctl) transition-shadow hover:shadow-(--shadow-ctl-hover) hover:text-ink cursor-pointer"
          >
            <v.icon size={14} className="text-ink-3" />
            {v.label}
          </button>
        ))}
      </div>

      {/* the number, then its shape */}
      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Total across {view.accounts.length} account{view.accounts.length > 1 ? "s" : ""}
            </p>
            <Money value={view.total} size="hero" className="mt-1 block" />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              In {formatINR(view.moneyIn, { compact: true })} · out{" "}
              {formatINR(view.moneyOut, { compact: true })} over {view.days} days
            </p>
          </div>
          {/* scoped to the chart it governs, not to the page */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Chart window"
            className="rounded-md bg-surface px-2 py-1 text-[12.5px] text-ink-2 shadow-(--shadow-ctl) focus:outline-none cursor-pointer"
          >
            {WINDOWS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>

        {view.trustworthy ? (
          <>
            <BalanceChart
              series={view.series}
              low={view.low}
              high={view.high}
              className="mt-4"
            />
            <p className="mt-2 border-t border-border pt-2.5 text-[12px] text-ink-3">
              Never below{" "}
              <span className="tnum font-medium text-ink-2">
                {formatINR(view.low, { compact: true })}
              </span>{" "}
              in this window — the floor a lender prices on.
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-lg bg-surface-2 px-3.5 py-3 text-[12.5px] leading-5 text-ink-3">
            {`Not enough visible movement to walk back ${view.days} days`}
          </p>
        )}
      </Card>

      {/* Rung 5 — earned only when money we can see sits where we can't use it */}
      {offer && (
        <SweepInOffer
          offer={offer}
          mandate={mandate}
          onSet={(m) => setSweepMandate(entity.id, m)}
          onCancel={() => cancelSweepMandate(entity.id)}
        />
      )}

      {/* the list IS the balance sheet — no drill-in needed to answer the question */}
      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Your accounts</h2>
          <Card pad="none" className="mt-2.5">
            {view.accounts.map((a) => {
              const isActive = a.account.masked === active.account.masked;
              return (
                <button
                  key={a.account.masked}
                  onClick={() => setSelected(a.account.masked)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 cursor-pointer",
                    isActive ? "bg-surface-2" : "hover:bg-surface-2/60",
                  )}
                >
                  {/* the account's own name leads — two accounts at one bank
                      must not render identically */}
                  <Avatar name={a.account.label} own={a.own} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-ink">
                        {a.account.label}
                      </span>
                      {a.account.readOnly && <Badge>View only</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                      {a.account.bank} {maskAccount(a.account.masked)} · {a.note}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Money value={a.account.balance} size="sm" className="block" />
                    <span className="mt-0.5 block text-[10.5px] text-ink-3 tnum">
                      {Math.round(a.share)}%
                    </span>
                  </span>
                </button>
              );
            })}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3">
            {`Showing ${view.accounts.length} account${view.accounts.length > 1 ? "s" : ""}`}
          </p>
        </div>

        {/* detail for the selected account */}
        <aside>
          <h2 className="text-[13px] font-semibold text-ink">{active.account.label}</h2>
          <Card className="mt-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {active.account.bank}
            </p>
            <Money value={active.account.balance} size="xl" className="mt-1 block" />

            <div className="mt-3.5 space-y-2.5 border-t border-border pt-3">
              <Field label="Account number">
                <span className="flex items-center gap-1.5">
                  <span className="tnum">
                    {revealed === active.account.masked
                      ? active.fullNumber.replace(/(\d{4})(?=\d)/g, "$1 ")
                      : maskAccount(active.account.masked)}
                  </span>
                  <button
                    onClick={() =>
                      setRevealed(revealed === active.account.masked ? null : active.account.masked)
                    }
                    aria-label={
                      revealed === active.account.masked
                        ? "Hide account number"
                        : "Show account number"
                    }
                    className="rounded p-0.5 text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
                  >
                    {revealed === active.account.masked ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </span>
              </Field>
              {/* routing code is public information; the account number is not */}
              <Field label="IFSC">
                <span className="tnum">{active.ifsc}</span>
              </Field>
              <Field label="Held with">{active.account.bank}</Field>
              <Field label="Share of your cash">{Math.round(active.share)}%</Field>
            </div>

            <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-5 text-ink-3">
              {active.note}.
            </p>
            {/* Not "its lines" — transactions are not tagged to an account
                yet, so the statement cannot scope to one. Promising a filter
                we do not apply is worse than a plain link. */}
            <button
              onClick={() => router.push("/statement")}
              className="mt-2.5 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
            >
              Open the statement →
            </button>
          </Card>

          {/* An account at another bank is here on a consent, and until now the
              screen said only "View only" — no provenance, no freshness, no way
              out. */}
          {active.account.readOnly &&
            (aaLinks[`${entity.id}/${active.account.masked}`]?.revoked ? (
              <Card className="mt-3">
                <p className="text-[12.5px] font-medium text-ink">Consent revoked</p>
                <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
                  {`${active.account.bank} stops sharing from today. The balance above is the last one read.`}
                </p>
              </Card>
            ) : (
              <AccountSource
                bank={active.account.bank}
                lastSync={aaLinks[`${entity.id}/${active.account.masked}`]?.lastSync ?? ANCHOR_DATE}
                since={LINKED_SINCE}
                refreshing={syncing === active.account.masked}
                onRefresh={() => {
                  setSyncing(active.account.masked);
                  setTimeout(() => {
                    syncLinked(entity.id, active.account.masked, ANCHOR_DATE);
                    setSyncing(null);
                  }, 1200);
                }}
                onRevoke={() => revokeLinked(entity.id, active.account.masked)}
              />
            ))}
        </aside>
      </section>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}
