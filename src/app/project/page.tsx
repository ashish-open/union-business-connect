"use client";

// The RERA project workspace — reached from Today's project card, derived
// from the designated account (never configured). One question, one number:
// "how much can I withdraw today?" — and the certificate workflow that
// releases it. Deterministic rules, human sign-off, full audit trail.

import { useEffect, useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, FileText, Lock, ShieldCheck } from "lucide-react";
import { buildRera, detectRera } from "@/lib/rera";
import { fmtDate, formatINR } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/cn";

export default function ProjectPage() {
  const router = useRouter();
  const entity = useEntity();
  const caSigned = useStore((s) => (entity ? !!s.reraCaSigned[entity.id] : false));
  const sessionWithdrawn = useStore((s) => (entity ? (s.reraWithdrawn[entity.id] ?? 0) : 0));
  const signReraCert = useStore((s) => s.signReraCert);
  const withdrawRera = useStore((s) => s.withdrawRera);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [justWithdrew, setJustWithdrew] = useState(0);
  useEffect(() => {
    if (entity && !detectRera(entity)) router.replace("/today");
  }, [entity, router]);

  const rera = useMemo(
    () => (entity ? buildRera(entity, { caSigned, sessionWithdrawn }) : null),
    [entity, caSigned, sessionWithdrawn],
  );

  if (!entity || !rera) return <AppShell />;

  const allSigned = rera.certificates.every((c) => c.seeded === "signed");

  return (
    <AppShell>
      <button
        onClick={() => router.push("/today")}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer"
      >
        <ArrowLeft size={13} />
        Today
      </button>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* the bar owns the H1 ("Project"); this names WHICH project — a titled
            object, so it stays prominent but stops competing as a second H1 */}
        <h2 className="text-xl font-semibold tracking-tight text-ink">{rera.project.name}</h2>
        {/* a classification, not a lifecycle state — outlined, never filled */}
        <Badge variant="outline">RERA project</Badge>
        <span className="tnum text-[11px] text-ink-3">{rera.project.rera}</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-ink-2">
        {rera.project.unitsSold} of {rera.project.unitsTotal} units sold ·{" "}
        {rera.project.progressPct}% construction certified ({fmtDate(rera.project.progressAsOf)}) ·
        designated account {rera.designatedMasked}
      </p>

      {/* the one number */}
      <Card className="mt-6 !p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          You can withdraw today
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <Money value={rera.eligibleToday} size="hero" compact />
          {/* the amount stays ink; only the status word carries colour */}
          {justWithdrew > 0 && (
            <span className="text-[13px] text-ink-2 animate-fade">
              <span className="tnum text-ink">
                {formatINR(justWithdrew, { compact: true })}
              </span>{" "}
              withdrawn to ops — <span className="text-pos">done</span>
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-[12.5px] text-ink-2">
          <p>
            Collections to date <span className="tnum font-medium text-ink">{formatINR(rera.lifetimeCollections, { compact: true })}</span>{" "}
            × {rera.project.progressPct}% certified ={" "}
            <span className="tnum">{formatINR(Math.round(rera.lifetimeCollections * rera.project.progressPct / 100), { compact: true })}</span>
          </p>
          <p>
            Already withdrawn <span className="tnum">−{formatINR(rera.withdrawnToDate, { compact: true })}</span> · designated balance{" "}
            <span className="tnum">{formatINR(rera.designatedBalance, { compact: true })}</span>
          </p>
          <p className="text-ink-3">
            Section 4(2)(l)(D) — the maximum, never a rupee past it.
          </p>
        </div>
        <div className="mt-4">
          {allSigned ? (
            <Button
              size="lg"
              disabled={rera.eligibleToday <= 0}
              onClick={() => setWithdrawOpen(true)}
            >
              {rera.eligibleToday > 0 ? "Withdraw to ops account" : "Nothing eligible right now"}
            </Button>
          ) : (
            <>
              <Button size="lg" disabled>
                <Lock size={14} />
                Withdraw to ops account
              </Button>
              <p className="mt-2 text-[12.5px] text-ink-3">
                Blocked until Forms 1, 2 and 3 are signed.
              </p>
            </>
          )}
        </div>
      </Card>

      {/* certificates — humans stay in charge */}
      <section className="mt-6">
        <h3 className="text-base font-semibold text-ink">Certificates for this withdrawal</h3>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {rera.certificates.map((c) => (
            <Card key={c.form} className="!p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink">{c.form}</p>
                {c.seeded === "signed" ? (
                  <Badge tone="pos">Signed{c.date ? ` · ${fmtDate(c.date)}` : ""}</Badge>
                ) : (
                  <Badge tone="warn">Awaiting</Badge>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-5 text-ink-2">
                {c.role} · {c.name}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-4 text-ink-3">{c.attests}</p>
              {c.seeded === "awaiting" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2.5"
                  onClick={() => signReraCert(entity.id)}
                >
                  Request sign-off
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* buyer collections, auto-split */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-ink">Buyer collections — split on arrival</h3>
          <span className="text-[12px] text-ink-3 tnum">
            {formatINR(rera.collections90d, { compact: true })} · last 90 days
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-ink-2">
          70% stays designated, 30% moves to ops the same day.
        </p>
        <Card className="mt-3 !p-0 overflow-hidden">
          {rera.splits.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-ink">No buyer installments</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-ink-3">
                Each unit has its own virtual account — installments name their buyer and split on arrival.
              </p>
            </div>
          )}
          {rera.splits.slice(0, 6).map((s) => (
            <div
              key={`${s.unit}-${s.date}`}
              className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <span className="w-14 shrink-0 tnum text-[11px] text-ink-3">{fmtDate(s.date)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">
                  Unit {s.unit} · {s.buyer}
                </p>
                <p className="text-[11px] text-ink-3 tnum">
                  70% designated {formatINR(s.amount - s.opsShare, { compact: true })} · 30% ops{" "}
                  {formatINR(s.opsShare, { compact: true })}
                </p>
              </div>
              <Money value={s.amount} size="sm" compact className="shrink-0" />
              <Check size={13} strokeWidth={2.5} className="shrink-0 text-pos" />
            </div>
          ))}
        </Card>
      </section>

      {/* cost heads + the guardrail that held */}
      <section className="mt-6">
        <h3 className="text-base font-semibold text-ink">Spend by permitted cost head</h3>
        <Card className="mt-3 !p-0 overflow-hidden">
          {rera.costHeads.map((h) => (
            <div
              key={h.head}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  h.permitted ? "bg-surface-2 text-ink-2" : "bg-warn-soft text-warn",
                )}
              >
                {h.permitted ? <FileText size={13} /> : <Ban size={13} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{h.head}</p>
                <p className="text-[11.5px] text-ink-3">{h.evidence}</p>
              </div>
              <Money value={h.spent} size="sm" compact className="shrink-0" />
            </div>
          ))}
        </Card>
        <div className="mt-3 flex items-start gap-2.5 rounded-(--radius-card) bg-surface p-3.5 shadow-(--shadow-card)">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-pos" />
          <p className="text-[12.5px] leading-5 text-ink-2">
            <span className="font-medium text-ink">A guardrail held on {fmtDate(rera.guardrail.when)}.</span>{" "}
            {rera.guardrail.text}{" "}
            <span className="text-ink-3">Compliance score {rera.score}/100.</span>
          </p>
        </div>
      </section>

      {/* the quarterly artifact */}
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card)">
        <div>
          <p className="text-sm font-medium text-ink">Quarterly progress report — drafted</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Collections, spend by head, certified progress — assembled from this ledger. Review
            with {entity.secondUser ?? "your CA"} before the portal upload.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => router.push("/project/qpr")}>
          Open the QPR draft
        </Button>
      </section>

      {withdrawOpen && (
        <WithdrawSheet
          amount={rera.eligibleToday}
          masked={rera.designatedMasked}
          onClose={() => setWithdrawOpen(false)}
          onConfirm={() => {
            withdrawRera(entity.id, rera.eligibleToday);
            setJustWithdrew(rera.eligibleToday);
            setWithdrawOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function WithdrawSheet({
  amount,
  masked,
  onClose,
  onConfirm,
}: {
  amount: number;
  masked: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-(--radius-card) bg-surface p-5 shadow-(--shadow-pop) animate-rise sm:rounded-(--radius-card)" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Withdraw from {masked}
        </p>
        <Money value={amount} size="xl" compact className="mt-1 block" />
        <div className="mt-3 space-y-1.5 text-[12.5px] leading-5 text-ink-2">
          <p className="flex items-start gap-2">
            <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-pos" />
            Forms 1, 2 and 3 signed — attached to this withdrawal.
          </p>
          <p className="flex items-start gap-2">
            <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-pos" />
            Lands in ops today. Certificates, arithmetic and approver go to the QPR.
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <Button full onClick={onConfirm}>
            Confirm withdrawal
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
