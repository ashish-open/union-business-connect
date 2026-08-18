"use client";

// Journey A: existing bank customer. Mobile → OTP → entity → one consent
// screen → analysing (real work, revealed in stages) → the 60-second aha.
// Bank-shaped, not fintech-shaped: no "create account" form, KYC is read-only
// from the bank record, and we never ask for net-banking credentials.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, Landmark, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";
import { StatementLine } from "@/components/statement/StatementLine";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, OtpInput } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { brand } from "@/config/brand";
import { findCustomer, Entity } from "@/data/seed";
import { analyse, Analysis, Tone } from "@/lib/analysis";
import { cn } from "@/lib/cn";
import { maskAccount } from "@/lib/format";
import { useCustomer, useEntity, useStore } from "@/store/useStore";

type Step = "phone" | "otp" | "entity" | "consent" | "analysing" | "findings";

/**
 * The one line that must not be on screen in front of the bank.
 *
 * "Demo: any 6 digits work." is true and useful in a prototype and reads as a
 * security hole in a review. It survives behind an explicit env flag so the
 * demo keeps working and a build for anyone else does not carry it.
 */
const DEMO_HINT =
  process.env.NEXT_PUBLIC_DEMO === "off" ? "Six digits" : "Demo: any 6 digits work.";

const TONE_BAR: Record<Tone, string> = {
  info: "bg-info",
  warn: "bg-warn",
  neg: "bg-neg",
  pos: "bg-pos",
};

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const customer = useCustomer();
  const entity = useEntity();
  const { signIn, selectEntity, finishOnboarding } = useStore();

  function handlePhoneVerified() {
    setStep("otp");
  }

  function handleOtp() {
    const c = customer;
    if (!c) return;
    if (c.entities.length > 1) {
      setStep("entity");
    } else {
      selectEntity(c.entities[0].id);
      setStep("consent");
    }
  }

  function enterWorkspace(dest = "/today") {
    finishOnboarding();
    router.push(dest);
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.08fr_1fr]">
      <BrandPanel />

      <main className="flex min-h-dvh flex-col items-center px-5 py-8 sm:py-12 lg:min-h-dvh lg:justify-center lg:overflow-y-auto">
        <div className="mb-10 lg:hidden">
          <BrandMark size="lg" />
        </div>

        <div className="w-full max-w-md flex-1 lg:flex-none">
          {step === "phone" && <PhoneStep onVerified={handlePhoneVerified} signIn={signIn} />}
          {step === "otp" && customer && (
            <OtpStep mobile={customer.mobile} onDone={handleOtp} />
          )}
          {step === "entity" && customer && (
            <EntityStep
              entities={customer.entities}
              onPick={(id) => {
                selectEntity(id);
                setStep("consent");
              }}
            />
          )}
          {step === "consent" && entity && (
            <ConsentStep entity={entity} onAllow={() => setStep("analysing")} />
          )}
          {step === "analysing" && entity && (
            <AnalysingStep entity={entity} onDone={() => setStep("findings")} />
          )}
          {step === "findings" && entity && customer && (
            <FindingsStep
              firstName={customer.firstName}
              entity={entity}
              onEnter={enterWorkspace}
            />
          )}
        </div>

        <p className="mt-10 flex items-center gap-1.5 text-xs text-ink-3">
          <Lock size={12} />
          We never ask for your net-banking password or PIN.
        </p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

// The brand moment: an aurora in the bank's colours with a real product
// preview —
// built from the same StatementLine component the app ships, not a mock.
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-(--hero-base) lg:flex lg:flex-col lg:justify-between lg:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute -left-1/4 -top-1/3 h-4/5 w-4/5 rounded-full bg-(--hero-glow-1) opacity-50 blur-[110px]" />
        <div className="animate-drift absolute -bottom-1/3 -right-1/4 h-3/4 w-3/4 rounded-full bg-(--hero-glow-2) opacity-70 blur-[100px] [animation-delay:-7s]" />
        <div className="animate-drift absolute right-[8%] top-[12%] h-2/5 w-2/5 rounded-full bg-(--hero-accent) opacity-[0.13] blur-[90px] [animation-delay:-3s]" />
      </div>

      <div className="relative">
        <BrandMark size="lg" onDark />
      </div>

      <div className="relative max-w-md">
        <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
          Banking that explains your money back to you.
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-white/65">
          {`Sign in, and within a minute ${brand.productName} reads your statement and tells you something you didn't know — before you set up anything.`}
        </p>

        <div className="mt-8 overflow-hidden rounded-(--radius-card) bg-surface shadow-(--shadow-pop)">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink-2">Smart Statement</p>
            <span className="text-[10.5px] uppercase tracking-wide text-ink-3">preview</span>
          </div>
          <StatementLine
            date="2026-07-22"
            name="Swiggy"
            narration="NEFT CR-BUNDL TECHNOLOGIES-SWIGGY WKLY SETL"
            amount={371900}
            direction="credit"
            recon={{ state: "matched", to: "Settlement 13–19 Jul" }}
          />
          <StatementLine
            date="2026-07-16"
            name="Zomato"
            narration="NEFT CR-ZOMATO LIMITED-WKLY SETL"
            amount={261900}
            direction="credit"
            recon={{ state: "short", by: 26800 }}
          />
          <StatementLine
            date="2026-07-20"
            name="Meta Ads"
            narration="CARD PUR-META PLATFORMS INDIA-AD SPEND"
            amount={92400}
            direction="debit"
            recon={{ state: "suggested", confidence: 88 }}
          />
        </div>
      </div>

      <p className="relative text-[12.5px] text-white/50">
        On the trusted rails of {brand.bankName}. Free for your business, forever.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function PhoneStep({
  onVerified,
  signIn,
}: {
  onVerified: () => void;
  signIn: (mobile: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const digits = value.replace(/\D/g, "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = findCustomer(digits);
    if (!c) {
      setError(`No ${brand.bankShort} record found for that number — check and try again.`);
      return;
    }
    signIn(digits);
    onVerified();
  }

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Sign in with your mobile number
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        The one registered with {brand.bankName}. Your accounts and KYC come straight from the
        bank — nothing to set up.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="flex gap-2">
          <span className="flex h-12 items-center rounded-xl border border-border-strong bg-surface-2 px-3.5 text-[15px] text-ink-2 tnum">
            +91
          </span>
          <Input
            autoFocus
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.replace(/\D/g, "").slice(0, 10));
              setError(null);
            }}
            className="tnum"
          />
        </div>
        {error && (
          <p className="text-[13px] text-neg">
            {error}{" "}
            <a href="/try" className="font-medium text-accent hover:underline">
              Bank elsewhere? Start with a statement instead.
            </a>
          </p>
        )}
        <Button type="submit" size="lg" full disabled={digits.length !== 10}>
          Continue
        </Button>
      </form>

      <div className="mt-8 rounded-xl border border-dashed border-border-strong p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Demo sign-ins
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            onClick={() => setValue("9845012345")}
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer tnum"
          >
            98450 12345 — Vikram · multi-outlet QSR
          </button>
          <button
            onClick={() => setValue("9812345678")}
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer tnum"
          >
            98123 45678 — Rajesh · interiors, sole prop
          </button>
          <button
            onClick={() => setValue("9877001122")}
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer tnum"
          >
            98770 01122 — Sudhir · RERA developer
          </button>
          <button
            onClick={() => setValue("9611204488")}
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer tnum"
          >
            96112 04488 — Ananya · D2C on five platforms
          </button>
          <a
            href="/bank"
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer"
          >
            Bank console — the view {brand.bankShort} renews on
          </a>
        </div>
      </div>

      <p className="mt-6 text-xs leading-5 text-ink-3">
        Bank somewhere else?{" "}
        <a href="/try" className="font-medium text-accent hover:underline">
          Upload a statement and see what we find
        </a>{" "}
        — free, no sign-in.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OtpStep({ mobile, onDone }: { mobile: string; onDone: () => void }) {
  const [verifying, setVerifying] = useState(false);

  function complete() {
    setVerifying(true);
    setTimeout(onDone, 550);
  }

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Enter the code</h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        Sent by SMS to <span className="tnum font-medium text-ink">+91 {mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}</span>
      </p>
      <div className="mt-6">
        <OtpInput onComplete={complete} disabled={verifying} />
      </div>
      <p className={cn("mt-4 text-[13px] text-ink-3", verifying && "animate-pulse-soft")}>
        {verifying ? "Verifying…" : DEMO_HINT}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EntityStep({
  entities,
  onPick,
}: {
  entities: Entity[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a business</h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        This number holds current accounts for {entities.length} businesses.
      </p>
      <div className="mt-6 space-y-3 stagger">
        {entities.map((e) => (
          <button key={e.id} onClick={() => onPick(e.id)} className="block w-full text-left cursor-pointer group">
            <Card className="transition-all group-hover:border-accent group-hover:shadow-(--shadow-pop)">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{e.legalName}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    {e.constitution} · {e.city}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="accent">From bank KYC</Badge>
                    {e.accounts
                      .filter((a) => !a.readOnly)
                      .map((a) => (
                        <Badge key={a.masked} className="tnum">
                          <Landmark size={11} /> {maskAccount(a.masked)}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CONSENT_ITEMS = [
  {
    icon: Eye,
    title: "Read your statements and balances",
    body: "Last 12 months, then ongoing — so every credit and debit can be explained.",
  },
  {
    icon: ShieldCheck,
    title: "Prepare payments for your approval",
    body: "Nothing ever moves without your explicit approval and OTP.",
  },
  {
    icon: Undo2,
    title: "Revocable anytime",
    /* Was "Withdraw consent in Settings and the connection is closed." There
       is no Settings screen. Revocation is real now, but it lives per account
       on /balance — so the promise names where it actually is. */
    body: "Revoke it per account on Balance, and the reading stops that day.",
  },
];

function ConsentStep({ entity, onAllow }: { entity: Entity; onAllow: () => void }) {
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">One consent, in plain words</h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        For <span className="font-medium text-ink">{entity.legalName}</span>, you&apos;re allowing{" "}
        {brand.productName} to:
      </p>
      <Card className="mt-6 divide-y divide-border" pad="none">
        {CONSENT_ITEMS.map((item) => (
          <div key={item.title} className="flex gap-3.5 p-4">
            <item.icon size={18} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{item.body}</p>
            </div>
          </div>
        ))}
      </Card>
      <Button size="lg" full className="mt-6" onClick={onAllow}>
        Allow and continue
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AnalysingStep({ entity, onDone }: { entity: Entity; onDone: () => void }) {
  const analysis = useMemo(() => analyse(entity), [entity]);
  const [stage, setStage] = useState(0);
  const done = useRef(false);

  const steps = [
    `Pulling ${analysis.txnCount} transactions from ${analysis.accountCount} account${analysis.accountCount > 1 ? "s" : ""} — last ${analysis.daysCovered} days`,
    `Naming counterparties — ${analysis.resolvedPct}% resolved automatically`,
    "Checking every credit against what you were owed",
    analysis.findings.length > 0
      ? `${analysis.findings.length} things need your eyes`
      : "All clear — nothing needs your eyes",
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Reading your statement…
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        This is the real work — it takes a few seconds.
      </p>
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

function FindingsStep({
  firstName,
  entity,
  onEnter,
}: {
  firstName: string;
  entity: Entity;
  onEnter: (dest?: string) => void;
}) {
  const analysis: Analysis = useMemo(() => analyse(entity), [entity]);
  const [peak, ...rest] = analysis.findings;


  if (analysis.findings.length === 0) {
    return (
      <div className="animate-rise pt-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pos-soft text-pos">
          <Check size={22} strokeWidth={2.5} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
          All clear, {firstName}
        </h1>
        {/* Template literal, not JSX text: Turbopack eats the space after a
            `{expr}` that ends a line, and this rendered as "the last 89days"
            on the first screen a new customer ever sees. */}
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-2">
          {`${analysis.txnCount} transactions over the last ${analysis.daysCovered} days, and every one of them is explained. We'll watch and tell you the moment something isn't.`}
        </p>
        <Button size="lg" className="mt-8" onClick={() => onEnter()}>
          Go to your workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Here&apos;s what we found, {firstName}
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        {`From ${analysis.txnCount} transactions over the last ${analysis.daysCovered} days — before you set up anything.`}
      </p>

      {/* The peak: one number, at full weight, with the working under it.
          Four findings of equal size is not a peak — it is a to-do list, and a
          to-do list is the thing every competitor already opens with. The rest
          stay, smaller, because they are true and worth knowing; they are just
          not what this moment is for. */}
      <div className="mt-6 rounded-(--radius-card) bg-surface p-5 shadow-(--shadow-card) animate-rise">
        <Money value={peak.amount} size="hero" compact={peak.amount >= 10_00_000} />
        <p className="mt-1.5 text-[15px] font-medium leading-6 text-ink">{peak.title}</p>
        <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{peak.body}</p>
        <p className="mt-2 text-[11px] text-ink-3">{peak.evidence}</p>
      </div>

      {rest.length > 0 && (
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {`Also worth knowing`}
        </p>
      )}
      <div className="mt-2 space-y-3 stagger">
        {rest.map((f) => (
          <div
            key={f.kind}
            className="relative rounded-(--radius-card) bg-surface p-4 pl-5 shadow-(--shadow-card)"
          >
            <span
              className={cn("absolute left-0 top-4 bottom-4 w-0.5 rounded-full", TONE_BAR[f.tone])}
              aria-hidden
            />
            <p className="text-[15px] leading-6 text-ink">
              <Money value={f.amount} size="lg" className="mr-1.5" compact={f.amount >= 10_00_000} />
              <span className="font-medium">{f.title}</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{f.body}</p>
            <p className="mt-1.5 text-[11px] text-ink-3">{f.evidence}</p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                className="whitespace-nowrap"
                onClick={() => onEnter(f.href)}
              >
                {f.action}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* The end. One action, and it is the one that pays off the number
          above — not a different errand, and not a dashboard. The escape sits
          under it rather than beside it (F4), so leaving is possible without
          being the obvious click. */}
      <div className="mt-8">
        <Button size="lg" full onClick={() => onEnter(analysis.primaryCta.href)}>
          {analysis.primaryCta.label}
          <ArrowRight size={15} />
        </Button>
        <p className="mt-2 text-center text-xs text-ink-3">{analysis.primaryCta.sub}</p>
        <Button variant="ghost" full className="mt-2" onClick={() => onEnter()}>
          Later — take me to my statement
        </Button>
      </div>
    </div>
  );
}
