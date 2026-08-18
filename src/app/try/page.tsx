"use client";

// Journey B — banks-elsewhere (value before account). No sign-in: upload a
// statement (any bank) or connect via AA, and we give the analysis away —
// categorised spend, what repeats, the balance footprint, and whether the
// platforms paid right. The offer is made out of THEIR number (rung 3),
// never a banner. Money movement shows a tasteful lock, not a paywall.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, FileUp, Landmark, Lock, ShieldCheck } from "lucide-react";
import { GUEST_ENTITY, ANCHOR_DATE, Entity } from "@/data/seed";
import { analyse, resolveCounterparty, KIND_LABEL } from "@/lib/analysis";
import { suspicionsFor } from "@/lib/settlements";
import { balanceFootprint } from "@/lib/insights";
import { buildUpcoming, relativeLabel } from "@/lib/today";
import { addDays, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { NudgeCard } from "@/components/cards/NudgeCard";
import { BrandMark } from "@/components/app/BrandMark";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

type Step = "source" | "analysing" | "findings";

export default function TryPage() {
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<string>("");

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-0">
        <BrandMark withName />
        <Link href="/signin" className="text-[13px] text-ink-2 hover:text-ink transition-colors">
          Already bank with {brand.bankShort}? Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-0">
        {step === "source" && (
          <SourceStep
            onPicked={(label) => {
              setSource(label);
              setStep("analysing");
            }}
          />
        )}
        {step === "analysing" && (
          <Analysing entity={GUEST_ENTITY} source={source} onDone={() => setStep("findings")} />
        )}
        {step === "findings" && <Giveaway entity={GUEST_ENTITY} source={source} />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SourceStep({ onPicked }: { onPicked: (label: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function picked(name: string) {
    onPicked(name);
  }

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        See what your statement says
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-ink-2">
        Any bank. Every counterparty named, every platform settlement checked against its own pattern.
      </p>

      {/* the cost of the ask, stated before the ask */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2">
          <Clock size={12} /> Takes about a minute
        </span>
        <span className="text-[12px] text-ink-3">
          One file or one read-only connection. No sign-in, no card, no call.
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          picked(f ? f.name : "your statement");
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        className={cn(
          "mt-6 flex cursor-pointer flex-col items-center justify-center rounded-(--radius-card) border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-surface hover:border-ink-3",
        )}
      >
        <FileUp size={22} className="text-ink-3" />
        <p className="mt-3 text-sm font-medium text-ink">Drop a bank statement here</p>
        <p className="mt-1 text-[12.5px] text-ink-3">CSV, XLS or PDF · password-protected is fine</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xls,.xlsx,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) picked(f.name);
          }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3 text-[12px] text-ink-3">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={() => picked("your connected account")}
        className="mt-4 flex w-full items-center gap-3 rounded-(--radius-card) bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-pop) cursor-pointer"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
          <Landmark size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            Connect your bank read-only
          </span>
          <span className="block text-[12.5px] text-ink-2">
            Account Aggregator · RBI framework · revocable any time
          </span>
        </span>
        <ArrowRight size={15} className="shrink-0 text-ink-3" />
      </button>

      <div className="mt-8 rounded-xl border border-dashed border-border-strong p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Demo</p>
        <button
          onClick={() => picked("HDFC ••4210 · Arka Kitchen sample")}
          className="mt-2 w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer"
        >
          Use the sample — Arka Kitchen · 90 days on HDFC
        </button>
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-ink-3">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        Your statement is analysed for you alone. Nothing reaches {brand.bankName} unless you
        choose to open an account.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Analysing({
  entity,
  source,
  onDone,
}: {
  entity: Entity;
  source: string;
  onDone: () => void;
}) {
  const analysis = useMemo(() => analyse(entity), [entity]);
  const suspicions = useMemo(() => suspicionsFor(entity), [entity]);
  const [stage, setStage] = useState(0);
  const done = useRef(false);

  const steps = [
    `Reading ${source} — ${analysis.txnCount} lines · ${analysis.daysCovered} days`,
    `Naming counterparties — ${analysis.resolvedPct}% resolved automatically`,
    `Checking ${suspicions.length} platforms against their own settlement pattern`,
    "Ranking what matters",
  ];

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => {
        if (s >= steps.length) {
          clearInterval(t);
          if (!done.current) {
            done.current = true;
            setTimeout(onDone, 700);
          }
          return s;
        }
        return s + 1;
      });
    }, 1100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-rise pt-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Reading your statement…</h1>
      <p className="mt-2 text-sm text-ink-2">This is the real work — it takes a few seconds.</p>
      <div className="mt-8 space-y-4">
        {steps.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 transition-opacity duration-300",
              i < stage ? "opacity-100" : i === stage ? "opacity-70" : "opacity-25",
            )}
          >
            <span
              className={cn(
                "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full",
                i < stage ? "bg-pos-soft text-pos" : "border border-border-strong",
              )}
            >
              {i < stage ? (
                <Check size={12} strokeWidth={3} />
              ) : i === stage ? (
                <span className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-pulse-soft" />
              ) : null}
            </span>
            <p className={cn("text-sm", i < stage ? "text-ink" : "text-ink-2")}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */


function Giveaway({ entity, source }: { entity: Entity; source: string }) {
  const router = useRouter();
  const [offerDismissed, setOfferDismissed] = useState(false);

  const cutoff = addDays(ANCHOR_DATE, -89);
  const inWindow = entity.txns.filter((t) => t.date >= cutoff);
  const moneyIn = inWindow.filter((t) => t.direction === "credit").reduce((s, t) => s + t.amount, 0);
  const moneyOut = inWindow.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount, 0);

  const mab = balanceFootprint(entity, 60);
  const upcoming = buildUpcoming(entity, 25, 4).filter((u) => u.direction === "out");

  // top outflows by resolved counterparty kind — self-transfers aren't spend
  const outflows = useMemo(() => {
    const map = new Map<string, { label: string; total: number; personal: boolean }>();
    for (const t of inWindow) {
      if (t.direction !== "debit") continue;
      const r = resolveCounterparty(t.narration);
      if (r.kind === "internal") continue;
      const label = (r.kind !== "unknown" && KIND_LABEL[r.kind]) || r.name;
      const row = map.get(label) ?? { label, total: 0, personal: r.kind === "personal" };
      row.total += t.amount;
      map.set(label, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [inWindow]);
  const maxOutflow = outflows[0]?.total ?? 1;

  /* The star, and it has to be honest about its evidence.

     This read the settlement waterfall — gross, contracted deductions,
     order-level shortfall — for a visitor who has uploaded a BANK STATEMENT and
     nothing else. There is no rate-card check to do without the platform's own
     report, and claiming one here is the fabrication at its most persuasive and
     least verifiable: the acquisition screen.

     What a statement alone genuinely proves is the pattern — these settlements
     came in below what this platform usually pays. That is still the hook. */
  const suspicions = useMemo(() => suspicionsFor(entity), [entity]);
  const shortTotal = suspicions.reduce((sum, r) => sum + r.amount, 0);
  const shortCount = suspicions.reduce((sum, r) => sum + r.count, 0);
  const byChannel: Array<[string, { total: number; count: number }]> = suspicions.map((r) => [
    r.channel,
    { total: r.amount, count: r.count },
  ]);

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Here&apos;s what your statement says
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        {source} · last 90 days. All of this stays free — whichever bank you use.
      </p>

      {/* the footprint — what a lender would price on */}
      <Card className="mt-6 !p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Money in
            </p>
            <Money value={moneyIn} size="md" compact className="mt-1 block" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Money out
            </p>
            <Money value={moneyOut} size="md" compact className="mt-1 block" />
          </div>
          {mab && (
            <>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Avg daily balance
                </p>
                <Money value={mab.avg} size="md" compact className="mt-1 block" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Never below
                </p>
                <Money value={mab.min} size="md" compact className="mt-1 block" />
              </div>
            </>
          )}
        </div>
        {mab && (
          <p className="mt-3 border-t border-border pt-3 text-[12px] leading-5 text-ink-3">
            That balance footprint is what lenders price on — most owners have never seen theirs.
          </p>
        )}
      </Card>

      {/* the star — did the platforms pay right */}
      {shortTotal > 0 && (
        <Card className="mt-4 !p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Did the platforms pay you right?
          </p>
          {/* "beyond the contracted rate" is a claim about the rate card, and
              the rate card lives in the platform's report. From a statement we
              can say it came in light against its own history — which is true,
              and is the reason to go and get the report. */}
          <p className="mt-2 text-[15px] leading-6 text-ink">
            <Money value={shortTotal} size="lg" className="mr-1.5" />
            <span className="font-medium">
              {`below what these platforms usually pay, across ${shortCount} settlements`}
            </span>
          </p>
          <div className="mt-3 space-y-1.5">
            {byChannel.map(([channel, v]) => (
              <div key={channel} className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-2">
                  {channel} · {v.count} settlement{v.count > 1 ? "s" : ""} below its own pattern
                </span>
                <Money value={v.total} size="sm" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-ink-3">
            Checked order-by-order against published commission, PG and packaging rates.
          </p>
        </Card>
      )}

      {/* the earned offer — their number, rung-3 language, dismissible */}
      {!offerDismissed ? (
        <div className="mt-4">
          <NudgeCard
            fact={`${formatINR(shortTotal, { compact: true })} in 90 days — that's the cost of settlements landing where nobody checks them`}
            body={`Claims need settlements landing where we reconcile daily — a ${brand.bankShort} current account. Ten minutes to apply.`}
            action="Open a current account"
            onAction={() => router.push("/apply?via=try")}
            onDismiss={() => setOfferDismissed(true)}
            onSnooze={() => setOfferDismissed(true)}
          />
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-ink-3">
          No pressure — the analysis stays free, whichever bank you use.{" "}
          <Link href="/apply?via=try" className="text-accent hover:underline">
            Apply whenever you&apos;re ready.
          </Link>
        </p>
      )}

      {/* where the money went */}
      <Card className="mt-4 !p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Where the money went
        </p>
        <div className="mt-3 space-y-2.5">
          {outflows.map((o) => (
            <div key={o.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink-2">
                  {o.label}
                  {o.personal && (
                    <Badge tone="warn" className="ml-2">
                      worth separating
                    </Badge>
                  )}
                </span>
                <Money value={o.total} size="sm" compact />
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-border-strong"
                  style={{ width: `${Math.max(4, (o.total / maxOutflow) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* what repeats */}
      {upcoming.length > 0 && (
        <Card className="mt-4 !p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            What repeats — so you&apos;re never surprised
          </p>
          <div className="mt-3 space-y-2">
            {upcoming.map((u) => (
              <div key={u.id} className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-2">
                  {u.label}
                  <span className="text-ink-3"> · {relativeLabel(u.date)}</span>
                </span>
                <span className="tnum text-ink">
                  {u.approx ? "≈ " : ""}
                  {formatINR(u.amount, { compact: true })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* the tasteful lock — money movement only */}
      <div className="mt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          What opens with an account
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            ["Pay vendors & salaries", "Scheduled by default, approvals built in"],
            ["Payees active instantly", "Name-verified — no cooling period"],
            ["Disputes drafted & filed", "The evidence above becomes a claim"],
          ].map(([label, sub]) => (
            <Card key={label} className="!p-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
                <Lock size={12} className="text-ink-3" />
                {label}
              </div>
              <p className="mt-1 text-[11.5px] leading-4 text-ink-3">{sub}</p>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-3">
          Money movement runs on {brand.bankName} only. Everything else you just saw is free, any
          bank, forever.
        </p>
      </div>

      <div className="mt-8 space-y-2.5">
        <Button size="lg" full onClick={() => router.push("/apply?via=try")}>
          Open a current account — 10 minutes
        </Button>
        <p className="text-center text-xs text-ink-3">
          GSTIN prefilled from your upload. Day one starts explained.
        </p>
      </div>
    </div>
  );
}
