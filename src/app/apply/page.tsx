"use client";

// Journey C — new current account. Entity type → checklist auto-derived →
// GSTIN prefill (confirm, don't type) → Aadhaar eKYC + a video-KYC slot →
// submitted. The tracker (/apply/track) owns the dead zone.

import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, ShieldCheck } from "lucide-react";
import { ANCHOR_DATE, GUEST_ENTITY } from "@/data/seed";
import { addDays, fmtDateFull } from "@/lib/format";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, OtpInput } from "@/components/ui/Input";
import { BrandMark } from "@/components/app/BrandMark";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

type Constitution = "Proprietorship" | "Private Limited" | "LLP";
type Step = "entity" | "gstin" | "kyc";

const CONSTITUTIONS: Array<{ id: Constitution; sub: string }> = [
  { id: "Proprietorship", sub: "You are the business — the shortest checklist" },
  { id: "Private Limited", sub: "Directors sign; we fetch the CIN for you" },
  { id: "LLP", sub: "Designated partners sign" },
];

// The checklist is DERIVED from the entity type — the applicant never
// discovers a missing document at the branch.
const CHECKLIST: Record<Constitution, Array<{ label: string; fetched?: string }>> = {
  Proprietorship: [
    { label: "PAN", fetched: "from your GSTIN" },
    { label: "GST registration", fetched: "from GSTN" },
    { label: "Aadhaar eKYC", fetched: "OTP, right here" },
    { label: "Video KYC", fetched: "pick a slot" },
  ],
  "Private Limited": [
    { label: "CIN & incorporation", fetched: "from MCA" },
    { label: "PAN", fetched: "from your GSTIN" },
    { label: "GST registration", fetched: "from GSTN" },
    { label: "Board resolution", fetched: "template provided" },
    { label: "Director Aadhaar eKYC", fetched: "OTP, right here" },
    { label: "Video KYC", fetched: "pick a slot" },
  ],
  LLP: [
    { label: "LLP deed & LLPIN", fetched: "from MCA" },
    { label: "PAN", fetched: "from your GSTIN" },
    { label: "GST registration", fetched: "from GSTN" },
    { label: "Designated-partner Aadhaar eKYC", fetched: "OTP, right here" },
    { label: "Video KYC", fetched: "pick a slot" },
  ],
};

const SLOTS = ["Today · 6:00 pm", "Tomorrow · 10:30 am", "Tomorrow · 4:30 pm"];

const STEP_ORDER: Step[] = ["entity", "gstin", "kyc"];

// The time cost and the work are declared BEFORE the first ask — the KYC and
// the call are disclosed here, not discovered two screens in.
const EXPECT: Array<{ label: string; promise: string }> = [
  {
    label: "Your GSTIN",
    promise:
      "we fetch the legal name, PAN and principal place from GSTN — you confirm them instead of typing them",
  },
  {
    label: "Aadhaar eKYC",
    promise: "one OTP matches your identity against that record — nothing to upload",
  },
  {
    label: "A video-KYC slot",
    promise:
      "you pick a time here; a bank officer calls you then for about ten minutes — no branch visit",
  },
];

export default function ApplyPage() {
  const router = useRouter();
  const submitApplication = useStore((s) => s.submitApplication);
  const application = useStore((s) => s.application);

  const mounted = useHydrated();

  // The ?via=try handoff, read as an initial value rather than set from an
  // effect. The page renders nothing until hydration, so there is no frame in
  // which the pre-handoff value could be shown — and a state that is only
  // ever computed once has no business being written twice.
  const viaTry = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("via") === "try",
    [],
  );

  const [step, setStep] = useState<Step>("entity");
  const [constitution, setConstitution] = useState<Constitution | null>(null);
  const [gstin, setGstin] = useState(() => (viaTry ? (GUEST_ENTITY.gstin ?? "") : ""));
  const [fetched, setFetched] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  // an application already exists — the tracker is the page now
  useEffect(() => {
    if (mounted && application) router.replace("/apply/track");
  }, [mounted, application, router]);

  if (!mounted || application) return null;

  const stepIndex = STEP_ORDER.indexOf(step);

  const gstnRecord =
    fetched && gstin.length === 15
      ? {
          legalName: viaTry ? GUEST_ENTITY.legalName.replace(" (Proprietorship)", "").toUpperCase() : "AS PER GSTN RECORD",
          tradeName: viaTry ? GUEST_ENTITY.name : "—",
          pan: gstin.slice(2, 12),
          city: viaTry ? GUEST_ENTITY.city : "Bengaluru",
          status: "Active",
        }
      : null;

  function submit() {
    if (!constitution || !slot) return;
    submitApplication({
      constitution,
      gstin,
      legalName: gstnRecord?.tradeName ?? "Your business",
      city: gstnRecord?.city ?? "Bengaluru",
      slot,
      submittedOn: ANCHOR_DATE,
      ref: `CA-${gstin.slice(2, 7) || "48812"}-207`,
      viaTry,
    });
    router.push("/apply/track");
  }

  return (
    <div className="min-h-dvh bg-bg">
      {/* the flow has no shell: the stepper takes the nav's slot, and the
          back-link names where it lands */}
      <header className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4 sm:px-0">
        <BrandMark withName />
        <div
          className="flex items-center gap-1.5"
          aria-label={`Step ${stepIndex + 1} of ${STEP_ORDER.length}`}
        >
          {STEP_ORDER.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1 w-7 rounded-full",
                i <= stepIndex ? "bg-ink" : "bg-border-strong",
              )}
            />
          ))}
        </div>
        <Link
          href={viaTry ? "/try" : "/signin"}
          className="shrink-0 text-[13px] text-ink-2 hover:text-ink transition-colors"
        >
          <ArrowLeft size={13} className="mr-1 inline" />
          {viaTry ? "Back to your analysis" : "Back to sign in"}
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-0">
        {step === "entity" && (
          <div className="animate-rise">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Open a {brand.bankShort} current account
            </h1>

            {/* the cost of the ask, stated before the ask */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2">
                <Clock size={12} /> Takes about 10 minutes
              </span>
              <span className="text-[12px] text-ink-3">
                Three steps, nothing to post, no branch visit.
              </span>
            </div>

            <Card className="mt-4 !p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                What to expect
              </p>
              <ol className="mt-2.5 space-y-2">
                {EXPECT.map((e, i) => (
                  <li key={e.label} className="flex gap-2.5">
                    <span className="mt-px flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-ink-2 tnum">
                      {i + 1}
                    </span>
                    <p className="text-[12.5px] leading-5 text-ink-2">
                      <span className="font-medium text-ink">{e.label}</span> — {e.promise}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>

            <p className="mt-6 text-sm leading-6 text-ink-2">
              What kind of business is it? Everything else derives from this.
            </p>

            <div className="mt-3 space-y-2.5">
              {CONSTITUTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConstitution(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-(--radius-card) bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow cursor-pointer",
                    constitution === c.id ? "shadow-(--shadow-focus)" : "hover:shadow-(--shadow-pop)",
                  )}
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">{c.id}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-2">{c.sub}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      constitution === c.id
                        ? "bg-accent text-white"
                        : "border border-border-strong",
                    )}
                  >
                    {constitution === c.id && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>

            {constitution && (
              <Card className="mt-4 !p-4 animate-fade">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Your checklist — most of it fetched for you
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {CHECKLIST[constitution].map((item) => (
                    <div key={item.label} className="flex items-baseline justify-between text-[13px]">
                      <span className="text-ink-2">{item.label}</span>
                      <span className="text-[12px] text-ink-3">{item.fetched}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button
              size="lg"
              full
              className="mt-6"
              disabled={!constitution}
              onClick={() => setStep("gstin")}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "gstin" && (
          <div className="animate-rise">
            {/* the label asks; the helper says what will happen */}
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              What&apos;s your GSTIN?
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              Fetching it pulls your legal name, PAN and principal place of business straight
              from GSTN — you confirm them, you never type them twice.
              {viaTry && " Prefilled from the statement you uploaded."}
            </p>

            <div className="mt-6 flex gap-2">
              <Input
                value={gstin}
                onChange={(e) => {
                  setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15));
                  setFetched(false);
                }}
                placeholder="15-character GSTIN"
                className="tnum flex-1"
              />
              <Button
                variant="secondary"
                disabled={gstin.length !== 15 || fetched}
                onClick={() => setFetched(true)}
              >
                Fetch
              </Button>
            </div>

            {gstnRecord && (
              <Card className="mt-4 !p-4 animate-fade">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    From GSTN — confirm, don&apos;t type
                  </p>
                  <Badge tone="pos">{gstnRecord.status}</Badge>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[13px]">
                  <Row label="Legal name" value={gstnRecord.legalName} />
                  <Row label="Trade name" value={gstnRecord.tradeName} />
                  <Row label="PAN" value={gstnRecord.pan} mono />
                  <Row label="Constitution" value={constitution ?? "—"} />
                  <Row label="Principal place" value={gstnRecord.city} />
                </div>
              </Card>
            )}

            <Button size="lg" full className="mt-6" disabled={!fetched} onClick={() => setStep("kyc")}>
              That&apos;s my business — continue
            </Button>
            <button
              onClick={() => setStep("kyc")}
              className="mt-3 w-full text-center text-[12.5px] text-ink-3 hover:text-ink-2 transition-colors cursor-pointer"
            >
              Not GST registered? Continue with PAN — two extra documents.
            </button>
          </div>
        )}

        {step === "kyc" && (
          <KycStep slot={slot} setSlot={setSlot} onSubmit={submit} />
        )}
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-3">{label}</span>
      <span className={cn("text-right font-medium text-ink", mono && "tnum")}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function KycStep({
  slot,
  setSlot,
  onSubmit,
}: {
  slot: string | null;
  setSlot: (s: string) => void;
  onSubmit: () => void;
}) {
  const [aadhaar, setAadhaar] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);

  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Verify it&apos;s you</h1>
      <p className="mt-2 text-sm leading-6 text-ink-2">
        Aadhaar OTP now, then a ten-minute video call at a time you pick.
      </p>

      <div className="mt-6">
        {/* the label asks; the helper states the consequence of pressing it */}
        <p className="text-[13px] font-medium text-ink">
          {verified ? "Aadhaar eKYC" : "Which Aadhaar should we verify?"}
        </p>
        {!verified ? (
          <>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-3">
              Checks the name and address against your GSTIN record. Nothing else is read.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                inputMode="numeric"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="12-digit Aadhaar number"
                className="tnum flex-1"
                disabled={otpSent}
              />
              <Button
                variant="secondary"
                disabled={aadhaar.length !== 12 || otpSent}
                onClick={() => setOtpSent(true)}
              >
                Send OTP
              </Button>
            </div>
            {otpSent && (
              <div className="mt-3 animate-fade">
                <p className="mb-2 text-[12.5px] text-ink-3">
                  Sent to the mobile number on your Aadhaar. Any 6 digits work in this demo.
                </p>
                <OtpInput onComplete={() => setVerified(true)} />
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-pos-soft px-3.5 py-2.5 text-[13px] text-pos animate-fade">
            <ShieldCheck size={15} />
            Verified — name and address on record match your GSTIN.
          </div>
        )}
      </div>

      {verified && (
        <div className="mt-6 animate-fade">
          <p className="text-[13px] font-medium text-ink">When can you take the video call?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-[13px] transition-colors cursor-pointer",
                  slot === s
                    ? "bg-accent text-white"
                    : "bg-surface text-ink-2 shadow-(--shadow-ctl) hover:text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            Expected to open by {fmtDateFull(addDays(ANCHOR_DATE, 2))} once the call is done.
          </p>
        </div>
      )}

      <Button size="lg" full className="mt-8" disabled={!verified || !slot} onClick={onSubmit}>
        Submit application
      </Button>
    </div>
  );
}
