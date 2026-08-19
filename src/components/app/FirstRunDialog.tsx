"use client";

// The first run, over the workspace instead of in front of it.
//
// Sign-in is now two questions and a business picker: mobile, OTP, which
// business. Everything that used to follow — the consent, the analysis, the
// findings — happens here, as one card on the loaded app.
//
// Why: those three screens were the product's whole argument, and they were
// spent in a place where nothing was clickable and everything not acted on
// right then was gone. Behind this card the app is already there, so leaving
// the card leaves you somewhere.
//
// Three phases, and every one of them closes:
//
//   consent    asked over the workspace, not in front of it. It was briefly a
//              hard gate — no X, no Escape — and the backdrop was blurred to
//              obscurity to match. Both are gone: the owner wanted to see the
//              app they had just signed in to, so the blur is light enough to
//              read through and the card can be closed unanswered.
//   analysing  the real counts, revealed in stages. It ends on its own.
//   findings   the payoff, and the one with a primary action.
//
// Nothing is lost by closing any of them: the bell reopens this card, and it
// reopens at whichever phase is still outstanding — so consent that was skipped
// is asked again rather than quietly assumed.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, Eye, ShieldCheck, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { analyse, Analysis, Tone } from "@/lib/analysis";
import { plural } from "@/lib/format";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/lib/useDismissable";
import type { Entity } from "@/data/seed";
import { useStore } from "@/store/useStore";

type Phase = "consent" | "analysing" | "findings";

const TONE_BAR: Record<Tone, string> = {
  info: "bg-info",
  warn: "bg-warn",
  neg: "bg-neg",
  pos: "bg-pos",
};

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

export function FirstRunDialog({ entity, firstName }: { entity: Entity; firstName: string }) {
  const consented = !!useStore((s) => s.consented[entity.id]);
  const seen = !!useStore((s) => s.findingsSeen[entity.id]);
  const findingsOpen = useStore((s) => s.findingsOpen);
  const channelsConnected = useStore((s) => s.channelsConnected);

  // Whether the analysis has played out in this mounting. Switching workspaces
  // mid-session must not inherit the last business's finished state — that is
  // handled by KEYING this component on the entity in `AppShell`, because React
  // 19's lint (correctly) forbids resetting state from an effect.
  const [ran, setRan] = useState(false);

  // The same call Today and the bell make, so the card cannot quote a figure
  // the screens behind it disagree with — including after a rail is connected,
  // which changes what the findings ARE (a lump sum becomes a dispute).
  const analysis: Analysis = useMemo(
    () => analyse(entity, !!channelsConnected[entity.id]),
    [entity, channelsConnected],
  );

  // The workspace paints first, then the card arrives over it.
  //
  // Without the beat, the card is up on the first frame and this is the old
  // blocking step wearing a new shape: the owner never sees that there is an
  // app behind it, so answering it still feels like getting through a door.
  // Keyed on `seen` alone, NOT on consent. Closing the card at the consent step
  // has to mean "not now" — if it re-opened until consent was given, the X
  // would be decoration and this would be the hard gate again wearing a cross.
  const firstRun = !seen;
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!firstRun) return;
    const t = setTimeout(() => setArmed(true), 750);
    return () => clearTimeout(t);
  }, [firstRun]);

  if (!findingsOpen && !(firstRun && armed)) return null;

  const phase: Phase = !consented ? "consent" : seen || ran ? "findings" : "analysing";

  return (
    <Panel
      phase={phase}
      entity={entity}
      firstName={firstName}
      analysis={analysis}
      onAnalysed={() => setRan(true)}
    />
  );
}

/** Own component so `useDismissable` mounts and unmounts with the card. */
function Panel({
  phase,
  entity,
  firstName,
  analysis,
  onAnalysed,
}: {
  phase: Phase;
  entity: Entity;
  firstName: string;
  analysis: Analysis;
  onAnalysed: () => void;
}) {
  const router = useRouter();
  const giveConsent = useStore((s) => s.giveConsent);
  const closeFindings = useStore((s) => s.closeFindings);

  const close = () => closeFindings(entity.id);
  const ref = useDismissable<HTMLDivElement>(close);

  /** Acting on a finding closes the card: you are being taken to the thing. */
  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* One backdrop for all three phases. The consent step used to get its own
          `backdrop-blur-xl` (24px) so the statement could not be read before
          permission existed; at 7px the workspace stays legible behind the card,
          which is the point of having moved this out of sign-in at all. */}
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[7px]"
        onClick={close}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={phase === "findings" ? "What we found" : "Setting up"}
        className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface shadow-(--shadow-pop) animate-rise sm:rounded-[14px]"
      >
        {phase === "consent" && (
          <ConsentPhase
            entity={entity}
            onAllow={() => giveConsent(entity.id)}
            onClose={close}
          />
        )}
        {phase === "analysing" && (
          <AnalysingPhase analysis={analysis} onDone={onAnalysed} onClose={close} />
        )}
        {phase === "findings" && (
          <FindingsPhase
            analysis={analysis}
            firstName={firstName}
            onClose={close}
            onGo={go}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Eyebrow, title and the close button, in one place.
 *
 * Every phase gets the X from the same component rather than each drawing its
 * own — two of the three were shipped without one, which is exactly the kind of
 * thing a shared header makes impossible rather than merely unlikely.
 */
function PhaseHeader({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
        {children}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="-mr-1.5 shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ConsentPhase({
  entity,
  onAllow,
  onClose,
}: {
  entity: Entity;
  onAllow: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <PhaseHeader eyebrow="One more thing" title="One consent, in plain words" onClose={onClose}>
        <p className="mt-1.5 text-[13px] leading-5 text-ink-2">
          For <span className="font-medium text-ink">{entity.legalName}</span>, you&apos;re
          allowing {brand.productName} to:
        </p>
      </PhaseHeader>

      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5 py-3">
        {CONSENT_ITEMS.map((item) => (
          <div key={item.title} className="flex gap-3.5 py-3.5">
            <item.icon size={18} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-[13.5px] font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-5 text-ink-2">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* One button. Closing is possible — the X and the backdrop both do it —
          but it is not offered as an equal choice down here, because a product
          that reads nothing has nothing to tell you. */}
      <div className="border-t border-border px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <Button size="lg" full onClick={onAllow}>
          Allow and continue
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function AnalysingPhase({
  analysis,
  onDone,
  onClose,
}: {
  analysis: Analysis;
  onDone: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState(0);
  const done = useRef(false);

  const steps = [
    `Pulling ${plural(analysis.txnCount, "transaction")} from ${plural(analysis.accountCount, "account")} — last ${plural(analysis.daysCovered, "day")}`,
    `Naming counterparties — ${analysis.resolvedPct}% resolved automatically`,
    "Checking every credit against what you were owed",
    // Was `${n} things need your eyes`, which printed "1 things" on the first
    // screen a new customer ever saw.
    analysis.findings.length > 0
      ? `${plural(analysis.findings.length, "thing")} ${analysis.findings.length === 1 ? "needs" : "need"} your eyes`
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
    <>
      <PhaseHeader
        eyebrow="From your statement"
        title="Reading your statement…"
        onClose={onClose}
      >
        <p className="mt-1.5 text-[13px] text-ink-2">
          This is the real work — it takes a few seconds.
        </p>
      </PhaseHeader>
      <div className="space-y-3.5 px-5 pb-5 pt-5">
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
            <p className={cn("text-[13px]", i < stage ? "text-ink" : "text-ink-2")}>{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function FindingsPhase({
  analysis,
  firstName,
  onClose,
  onGo,
}: {
  analysis: Analysis;
  firstName: string;
  onClose: () => void;
  onGo: (href: string) => void;
}) {
  const [peak, ...rest] = analysis.findings;
  const empty = analysis.findings.length === 0;

  return (
    <>
      <PhaseHeader
        eyebrow="From your statement"
        title={empty ? `All clear, ${firstName}` : `Here's what we found, ${firstName}`}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-2">
        {/* Template literal, not JSX text: Turbopack eats the space after a
            `{expr}` that ends a line, and this rendered as "89days" on the
            first screen a new customer ever saw. */}
        <p className="text-[13px] leading-5 text-ink-2">
          {`${plural(analysis.txnCount, "transaction")} over the last ${plural(analysis.daysCovered, "day")} — read before you set up anything.`}
        </p>

        {empty ? (
          /* Emptiness is the good kind here, so it gets no CTA (law D1) */
          <div className="py-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-pos-soft text-pos">
              <Check size={20} strokeWidth={2.5} />
            </span>
            <p className="mt-3 text-[14px] font-medium text-ink">Every line is explained</p>
            <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-5 text-ink-2">
              We&apos;ll keep watching and tell you the moment something isn&apos;t.
            </p>
          </div>
        ) : (
          <>
            {/* The peak: one number at full weight with the working under it.
                Four findings of equal size is not a peak, it is a to-do list —
                and a to-do list is what every competitor already opens with.
                The rest stay, smaller, because they are true. */}
            <div className="mt-4 rounded-(--radius-card) bg-surface-2 p-4">
              <Money value={peak.amount} size="xl" compact={peak.amount >= 10_00_000} />
              <p className="mt-1.5 text-[14.5px] font-medium leading-6 text-ink">{peak.title}</p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink-2">{peak.body}</p>
              <p className="mt-1.5 text-[11px] text-ink-3">{peak.evidence}</p>
            </div>

            {rest.length > 0 && (
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Also worth knowing
              </p>
            )}
            <div className="mt-2 space-y-2.5 stagger">
              {rest.map((f) => (
                <div
                  key={f.kind}
                  className="relative rounded-(--radius-card) border border-border p-3.5 pl-4.5"
                >
                  <span
                    className={cn(
                      "absolute left-0 top-3.5 bottom-3.5 w-0.5 rounded-full",
                      TONE_BAR[f.tone],
                    )}
                    aria-hidden
                  />
                  <p className="text-[14px] leading-6 text-ink">
                    <Money
                      value={f.amount}
                      size="md"
                      className="mr-1.5"
                      compact={f.amount >= 10_00_000}
                    />
                    <span className="font-medium">{f.title}</span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-5 text-ink-2">{f.body}</p>
                  <p className="mt-1 text-[11px] text-ink-3">{f.evidence}</p>
                  <div className="mt-2.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap"
                      onClick={() => onGo(f.href)}
                    >
                      {f.action}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pinned outside the scroll area: the one action, and the sentence
          saying what closing costs you, can never scroll out of sight.
          pb clears the home indicator — as a bottom sheet the last line sits on
          the edge of the screen, and it is the line that says closing is free. */}
      <div className="border-t border-border px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {!empty && (
          <>
            <Button size="lg" full onClick={() => onGo(analysis.primaryCta.href)}>
              {analysis.primaryCta.label}
              <ArrowRight size={15} />
            </Button>
            <p className="mt-1.5 text-center text-[11.5px] text-ink-3">
              {analysis.primaryCta.sub}
            </p>
          </>
        )}
        <Button variant="ghost" full className={cn(!empty && "mt-1.5")} onClick={onClose}>
          {empty ? "Start looking around" : "Look around first"}
        </Button>
        {!empty && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-ink-3">
            <Bell size={11} />
            These stay in your alerts — nothing is lost by closing this.
          </p>
        )}
      </div>
    </>
  );
}
