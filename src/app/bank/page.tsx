"use client";

// The bank console — the artifact that renews the contract. A different
// audience from the SME: the program owner and RM leadership. Page one
// answers what they are measured on: attributable deposits, activation,
// loans formed on reconciled cashflow, and the leads their branches get.
// (Production: RM SSO. Demo: open surface.)

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { brand } from "@/config/brand";
import { BANK_CUSTOMERS } from "@/data/seed";
import {
  AGENTS,
  AUDIT_LOG,
  CONSOLE_PERIOD,
  FUNNEL,
  HEADLINE,
  PORTFOLIO_STATIC,
  PortfolioRow,
  RM_LEADS,
} from "@/data/bankSeed";
import { balanceFootprint } from "@/lib/insights";
import { buildStatement } from "@/lib/statement";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";

export default function BankConsolePage() {
  const [assigned, setAssigned] = useState<Record<string, true>>({});

  // the two demo businesses appear here with LIVE computed numbers —
  // the SME app and the console read the same engines
  const liveRows = useMemo<PortfolioRow[]>(() => {
    const rows: PortfolioRow[] = [];
    for (const c of BANK_CUSTOMERS) {
      for (const e of c.entities) {
        if (e.txns.length < 30) continue;
        const stmt = buildStatement(e, { connected: true, resolutions: {}, days: 28 });
        rows.push({
          name: e.name,
          segment: e.constitution === "Proprietorship" ? "Services · sole prop" : "HORECA",
          branch: e.city,
          mab: balanceFootprint(e, 28)?.avg ?? e.accounts.reduce((s, a) => s + a.balance, 0),
          explainedPct: stmt.explainedPct,
          modules: ["Recon", "Payouts", "Collections", "Close"].slice(0, e.invoices.length > 3 ? 3 : 4),
          live: true,
        });
      }
    }
    return rows;
  }, []);

  const valueRunRate =
    (HEADLINE.attributedCA * HEADLINE.costOfDepositsPct) / 100 +
    (HEADLINE.loansBook * HEADLINE.loanSpreadPct) / 100;
  const breakEvenPct = Math.round((valueRunRate / HEADLINE.licence) * 100);

  return (
    <div className="min-h-dvh bg-bg pb-16">
      {/* console chrome — same family, different audience */}
      <header className="border-b-2 border-accent bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-mark text-[13px] font-semibold text-white">
              BC
            </div>
            <div className="leading-none">
              <p className="text-sm font-semibold text-ink">
                {brand.productName} <span className="font-normal text-ink-3">· Bank console</span>
              </p>
              <p className="mt-0.5 text-[10.5px] text-ink-3">
                {brand.bankName} · tenant 1 · {CONSOLE_PERIOD}
              </p>
            </div>
          </div>
          <Link href="/signin" className="flex items-center gap-1 text-[12.5px] text-ink-3 transition-colors hover:text-ink">
            <ArrowLeft size={13} /> SME app
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5">
        {/* the renewal arithmetic */}
        <section className="mt-8">
          <SectionTitle>What the platform returned</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Attributed CA balance"
              value={formatINR(HEADLINE.attributedCA, { compact: true })}
              sub={`+${formatINR(HEADLINE.attributedCADeltaMonth, { compact: true })} in July`}
            />
            <Stat
              label="Businesses activated"
              value={String(HEADLINE.activated)}
              sub={`of ${HEADLINE.breakEvenAccounts.toLocaleString("en-IN")} at deposit break-even`}
            />
            <Stat
              label="Loans on reconciled cashflow"
              value={formatINR(HEADLINE.loansBook, { compact: true })}
              sub={`${HEADLINE.loansCount} loans · underwritten on verified flows`}
            />
            <Stat
              label={`Settlements now landing at ${brand.bankShort}`}
              value={`${formatINR(HEADLINE.settlementsRedirectedMonthly, { compact: true })}/mo`}
              sub={`${HEADLINE.settlementSwitchers} businesses switched`}
            />
          </div>

          <Card className="mt-3 !p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13.5px] text-ink">
                Value run-rate{" "}
                <span className="tnum font-semibold">{formatINR(valueRunRate, { compact: true })}/yr</span>
                <span className="text-ink-3">
                  {" "}
                  — deposits at {HEADLINE.costOfDepositsPct}% cost saved + loan spread at{" "}
                  {HEADLINE.loanSpreadPct}%
                </span>
              </p>
              <p className="text-[12.5px] text-ink-2 tnum">
                {breakEvenPct}% of the {formatINR(HEADLINE.licence, { compact: true })} licence · month 4
              </p>
            </div>
            <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="rounded-full bg-accent" style={{ width: `${Math.min(100, breakEvenPct)}%` }} />
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Break-even projected around month 9 at the current activation trend. SMEs recovered{" "}
              {formatINR(HEADLINE.disputesRecovered, { compact: true })} across {HEADLINE.disputePacks} dispute
              packs — the reason they stay.
            </p>
          </Card>
        </section>

        {/* funnel */}
        <section className="mt-10">
          <SectionTitle>Activation funnel · pilot cohort</SectionTitle>
          <Card pad="none" className="mt-3">
            {FUNNEL.map((f, i) => {
              const pct = (f.count / FUNNEL[0].count) * 100;
              const conv = i > 0 ? Math.round((f.count / FUNNEL[i - 1].count) * 100) : null;
              return (
                <div key={f.stage} className="border-b border-border px-4 py-2.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] text-ink">{f.stage}</p>
                    <p className="tnum text-[13px] font-semibold text-ink">
                      {f.count.toLocaleString("en-IN")}
                      {conv !== null && <span className="ml-2 font-normal text-ink-3">{conv}%</span>}
                    </p>
                  </div>
                  <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="rounded-full bg-accent/80" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        {/* RM lead queue */}
        <section className="mt-10">
          <SectionTitle>
            Branch lead queue{" "}
            <span className="font-normal normal-case tracking-normal text-ink-3">
              — signals no campaign can buy, from consented connected-account data
            </span>
          </SectionTitle>
          <Card pad="none" className="mt-3">
            {RM_LEADS.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">
                    {l.business} <span className="font-normal text-ink-3">· {l.branch}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-2">{l.signal}</p>
                </div>
                <p className="tnum text-[13px] font-semibold text-ink">{l.value}</p>
                {assigned[l.id] ? (
                  <Badge tone="pos">
                    <Check size={11} strokeWidth={2.5} /> Assigned to RM
                  </Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setAssigned((s) => ({ ...s, [l.id]: true }))}>
                    <UserCheck size={13} /> Assign to RM
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </section>

        {/* portfolio */}
        <section className="mt-10">
          <SectionTitle>Portfolio sample</SectionTitle>
          <Card pad="none" className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
                  <th className="px-4 py-2 font-medium">Business</th>
                  <th className="px-4 py-2 font-medium">Segment</th>
                  <th className="px-4 py-2 font-medium">Branch</th>
                  <th className="px-4 py-2 text-right font-medium">Avg balance</th>
                  <th className="px-4 py-2 text-right font-medium">Explained</th>
                  <th className="px-4 py-2 font-medium">Modules</th>
                </tr>
              </thead>
              <tbody>
                {[...liveRows, ...PORTFOLIO_STATIC].map((row) => (
                  <tr key={row.name} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {row.name}
                      {row.live && (
                        <Badge tone="accent" className="ml-2">
                          live demo data
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{row.segment}</td>
                    <td className="px-4 py-2.5 text-ink-2">{row.branch}</td>
                    <td className="tnum px-4 py-2.5 text-right text-ink">{formatINR(row.mab, { compact: true })}</td>
                    <td className={cn("tnum px-4 py-2.5 text-right", row.explainedPct >= 95 ? "text-pos" : "text-ink")}>
                      {row.explainedPct}%
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.modules.map((m) => (
                          <Badge key={m}>{m}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {/* agent governance */}
        <section className="mt-10">
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-accent" /> Supervised AI — governance
            </span>
          </SectionTitle>
          <p className="mt-1.5 text-[12.5px] text-ink-2">
            Agents propose and draft; humans approve anything that moves money. Every run logged.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {AGENTS.map((a) => (
              <Card key={a.name} className="!p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13.5px] font-semibold text-ink">{a.name}</p>
                  <p className="tnum text-[11.5px] text-ink-3">{a.activity}</p>
                </div>
                <p className="mt-1.5 text-[12px] leading-4.5 text-ink-2">
                  <span className="font-medium text-pos">Does:</span> {a.does}
                </p>
                <p className="mt-1 text-[12px] leading-4.5 text-ink-2">
                  <span className="font-medium text-neg">Never:</span> {a.never}
                </p>
              </Card>
            ))}
          </div>

          <Card pad="none" className="mt-3">
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-[12px] font-semibold text-ink">Audit trail · latest</p>
            </div>
            {AUDIT_LOG.map((e) => (
              <div key={e.at} className={cn("border-b border-border px-4 py-2.5 last:border-b-0", e.refusal && "bg-warn-soft/40")}>
                <p className="text-[12px] leading-5 text-ink-2">
                  <span className="tnum mr-2 text-ink-3">{e.at}</span>
                  {e.refusal && (
                    <Badge tone="warn" className="mr-1.5">
                      guardrail held
                    </Badge>
                  )}
                  {e.entry}
                </p>
              </div>
            ))}
          </Card>
        </section>

        <p className="mt-10 text-[11.5px] leading-5 text-ink-3">
          This console is tenant-scoped — {brand.bankName} is tenant 1; a second bank is a
          configuration, not a rewrite. Attribution is evidence-grade: every number traces to
          consented account data and platform events. Production access via bank SSO with
          role-based views (program owner · zonal · branch RM).
        </p>
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</h2>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="!p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="tnum mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{sub}</p>
    </Card>
  );
}
