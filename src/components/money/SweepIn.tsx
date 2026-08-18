"use client";

// Rung 5 — sweep-in. An eNACH mandate against an external bank, plus the
// rule that decides when it pulls.
//
// The offer is earned: it exists only because money we can SEE is sitting
// where we cannot USE it, and the floor we suggest is their own committed
// outflow, not a number we invented. If either fact is missing, the caller
// gets null and nothing is shown.
//
// Nothing moves without a human: the mandate is authorised once, and the
// default rule pulls only the shortfall, only when the floor is breached.

import { useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { ArrowDownToLine, Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { Card } from "@/components/ui/Card";

import { NudgeCard } from "@/components/cards/NudgeCard";
import { SWEEP_CADENCES, SweepCadence, SweepOffer } from "@/lib/conversion";
import { formatINR, maskAccount } from "@/lib/format";
import { SweepMandate } from "@/store/useStore";
import { cn } from "@/lib/cn";

export function SweepInOffer({
  offer,
  mandate,
  onSet,
  onCancel,
}: {
  offer: SweepOffer;
  mandate?: SweepMandate;
  onSet: (m: SweepMandate) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (mandate) {
    return <ActiveMandate offer={offer} mandate={mandate} onCancel={onCancel} onPull={onSet} />;
  }
  if (dismissed) return null;

  const where = offer.sources.map((s) => `${s.bank} ${maskAccount(s.masked)}`).join(" and ");

  return (
    <>
      <div className="mt-5">
        <NudgeCard
          fact={`${formatINR(offer.idle, { compact: true })} is idle at another bank`}
          body={`It's in ${where}. One mandate pulls it into ${offer.destination.bank} ${maskAccount(offer.destination.masked)} — on tap, or below a floor you set.`}
          action="Set up a pull mandate"
          onAction={() => setOpen(true)}
          onDismiss={() => setDismissed(true)}
          onSnooze={() => setDismissed(true)}
        />
      </div>
      {open && <SweepSheet offer={offer} onClose={() => setOpen(false)} onSet={onSet} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function SweepSheet({
  offer,
  onClose,
  onSet,
}: {
  offer: SweepOffer;
  onClose: () => void;
  onSet: (m: SweepMandate) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [source, setSource] = useState(offer.sources[0].masked);
  const [floor, setFloor] = useState(offer.suggestedFloor);
  const [cadence, setCadence] = useState<SweepCadence>("floor");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-(--radius-card) bg-surface shadow-(--shadow-pop) animate-rise sm:rounded-(--radius-card)"
        ref={dismissRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Four decisions and a consent line, so "Authorise the mandate" was
            the first thing to scroll away on a phone. Pinned now (E8). */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-[15px] font-semibold text-ink">Pull money in automatically</p>
            <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">
              One authorisation, then it works on the rule you choose.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {offer.sources.length > 1 && (
            <div className="mt-4">
              <p className="text-[12.5px] font-medium text-ink">Which account should it pull from?</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {offer.sources.map((s) => (
                  <button
                    key={s.masked}
                    onClick={() => setSource(s.masked)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[13px] transition-colors cursor-pointer",
                      source === s.masked
                        ? "bg-surface-2 font-medium text-ink"
                        : "text-ink-2 shadow-(--shadow-ctl) hover:text-ink",
                    )}
                  >
                    {s.bank} {maskAccount(s.masked)}
                    <span className="ml-1.5 tnum text-ink-3">
                      {formatINR(s.balance, { compact: true })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* the floor — defaulted to their own committed outflow */}
          <div className="mt-4">
            <p className="text-[12.5px] font-medium text-ink">
              What balance should {offer.destination.bank} never fall below?
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[offer.suggestedFloor, offer.suggestedFloor * 2, offer.suggestedFloor * 3].map((f) => (
                <button
                  key={f}
                  onClick={() => setFloor(f)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-[13px] tnum transition-colors cursor-pointer",
                    floor === f
                      ? "bg-surface-2 font-medium text-ink"
                      : "text-ink-2 shadow-(--shadow-ctl) hover:text-ink",
                  )}
                >
                  {formatINR(f, { compact: true })}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-4 text-ink-3">
              {offer.committed30d > 0 ? (
                <>
                  {`${formatINR(offer.suggestedFloor, { compact: true })} covers the ${formatINR(offer.committed30d, { compact: true })} already committed over 30 days — bills, salaries, standing instructions`}
                </>
              ) : (
                <>Suggested from what usually leaves this account in a month.</>
              )}
            </p>
          </div>

          {/* the rule — a consequence stated per option */}
          <div className="mt-4">
            <p className="text-[12.5px] font-medium text-ink">When should it pull?</p>
            <div className="mt-1.5 space-y-1.5">
              {SWEEP_CADENCES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCadence(c.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg p-3 text-left transition-shadow cursor-pointer",
                    cadence === c.id
                      ? "bg-surface-2 shadow-(--shadow-focus)"
                      : "shadow-(--shadow-ctl) hover:shadow-(--shadow-ctl-hover)",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      cadence === c.id ? "bg-accent text-white" : "border border-border-strong",
                    )}
                  >
                    {cadence === c.id && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{c.label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-4 text-ink-3">{c.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[11.5px] leading-5 text-ink-3">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Pulls between your own accounts only. Cancel any time.
          </p>
        </div>

        <SheetFooter
          retreat={{ label: "Money", onClick: onClose }}
          advance={{
            label: "Authorise the mandate",
            onClick: () => onSet({ source, floor, cadence, pulled: 0 }),
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ActiveMandate({
  offer,
  mandate,
  onCancel,
  onPull,
}: {
  offer: SweepOffer;
  mandate: SweepMandate;
  onCancel: () => void;
  onPull: (m: SweepMandate) => void;
}) {
  const source = offer.sources.find((s) => s.masked === mandate.source) ?? offer.sources[0];
  const rule = SWEEP_CADENCES.find((c) => c.id === mandate.cadence);
  const available = Math.max(0, source.balance - mandate.pulled);

  return (
    <Card className="mt-5 !p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <ArrowDownToLine size={14} className="text-ink-3" />
            Pull mandate active
          </p>
          <p className="mt-1 text-[12.5px] leading-5 text-ink-2">
            From {source.bank} {maskAccount(source.masked)} into {offer.destination.bank}{" "}
            {maskAccount(offer.destination.masked)} · keeping{" "}
            <span className="tnum">{formatINR(mandate.floor, { compact: true })}</span> as the
            floor.
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{rule?.label}. {rule?.detail}</p>
          {mandate.pulled > 0 && (
            // the tick carries the good news; the amount stays ink (money is
            // never coloured), and the string is templated because a JSX
            // space after an interpolation gets eaten in this build
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <Check size={12} strokeWidth={2.5} className="text-pos" />
              {`${formatINR(mandate.pulled, { compact: true })} pulled — it's in your account`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {available > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPull({ ...mandate, pulled: mandate.pulled + available })}
            >
              {`Pull ${formatINR(available, { compact: true })} now`}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
