"use client";

// Journey A: existing bank customer. Mobile → OTP → which business → in.
// Bank-shaped, not fintech-shaped: no "create account" form, KYC is read-only
// from the bank record, and we never ask for net-banking credentials.
//
// Sign-in ENDS at the OTP (or at the picker, for someone who runs more than one
// business). The consent, the analysis and the findings all used to live here
// as three more steps; they are now one card over the loaded workspace
// (`components/app/FirstRunDialog`). Reason: they were the product's whole
// argument, spent on screens where nothing was clickable and anything not acted
// on in that minute was gone.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Lock } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";
import { StatementLine } from "@/components/statement/StatementLine";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, OtpInput } from "@/components/ui/Input";
import { brand } from "@/config/brand";
import { findCustomer, Entity } from "@/data/seed";
import { cn } from "@/lib/cn";
import { maskAccount } from "@/lib/format";
import { useCustomer, useStore } from "@/store/useStore";

type Step = "phone" | "otp" | "entity";

/**
 * The one line that must not be on screen in front of the bank.
 *
 * "Demo: any 6 digits work." is true and useful in a prototype and reads as a
 * security hole in a review. It survives behind an explicit env flag so the
 * demo keeps working and a build for anyone else does not carry it.
 */
const DEMO_HINT =
  process.env.NEXT_PUBLIC_DEMO === "off" ? "Six digits" : "Demo: any 6 digits work.";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const customer = useCustomer();
  const { signIn, selectEntity, finishOnboarding } = useStore();

  function handlePhoneVerified() {
    setStep("otp");
  }

  function handleOtp() {
    const c = customer;
    if (!c) return;
    // Asking "which business" of someone who has one is a question with one
    // answer, so it is not asked.
    if (c.entities.length > 1) {
      setStep("entity");
      return;
    }
    enterWorkspace(c.entities[0].id);
  }

  /**
   * The last thing sign-in does.
   *
   * `selectEntity` before the push, not after: `AppShell` redirects back here
   * when there is no entity, so navigating first would bounce straight out.
   * Zustand's `set` is synchronous, so by the time the route changes the
   * workspace has a business.
   */
  function enterWorkspace(entityId: string) {
    selectEntity(entityId);
    finishOnboarding();
    router.push("/today");
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
            <EntityStep entities={customer.entities} onPick={enterWorkspace} />
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
// preview — built from the same StatementLine component the app ships, not a
// mock. The panel follows the theme (see --hero-* in globals.css): a pale
// wash by default, the deep aurora for anyone who chose dark.
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-(--hero-base) lg:flex lg:flex-col lg:justify-between lg:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute -left-1/4 -top-1/3 h-4/5 w-4/5 rounded-full bg-(--hero-glow-1) blur-[110px]" />
        <div className="animate-drift absolute -bottom-1/3 -right-1/4 h-3/4 w-3/4 rounded-full bg-(--hero-glow-2) blur-[100px] [animation-delay:-7s]" />
        <div className="animate-drift absolute right-[8%] top-[12%] h-2/5 w-2/5 rounded-full bg-(--hero-accent) blur-[90px] [animation-delay:-3s]" />
      </div>

      <div className="relative">
        <BrandMark size="lg" onHero />
      </div>

      <div className="relative max-w-md">
        <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
          Banking that explains your money back to you.
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-ink-2">
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

      <p className="relative text-[12.5px] text-ink-3">
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
          {/* First, and deliberately: this is the number the phone line answers
              on (`VOICE_ALLOWED_CALLERS`), so it is the one a demo reaches for
              most and the one that should need no hunting. */}
          <button
            onClick={() => setValue("8907173502")}
            className="w-fit rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer tnum"
          >
            89071 73502 — Deepa · voice demo caller
          </button>
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
