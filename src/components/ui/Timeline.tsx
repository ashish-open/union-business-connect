"use client";

// A sequence of steps with a marker, a rail and where it has got to.
//
// Written because there were two of these. The account-application tracker had
// one and the payment record grew another within a day, and they had already
// diverged: one drew icon markers with a connecting rail and knew about a step
// still to come, the other drew bare dots and could only describe the past. That
// is the shape this codebase keeps meeting — two implementations of one fact,
// drifting — and the fix each previous time was to have one.
//
// Four states, because a sequence can be behind you, where you are, ahead of
// you, or gone wrong:
//
//   done  it happened
//   now   it is happening, and nothing after it has
//   todo  it has not happened, and the row says so rather than implying it did
//   bad   it happened and it failed — a return, a rejection
//
// `bad` is not `todo` in red. A returned payment DID leave, and a timeline that
// renders the failure as an unreached step would say the money never moved.

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type TimelineState = "done" | "now" | "todo" | "bad";

export interface TimelineStep {
  label: string;
  /** The evidence for this step — a date, a reference, a reason. */
  detail?: string;
  state: TimelineState;
}

export function Timeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
          {/* The rail joins the markers so the steps read as one thread rather
              than four unrelated rows. Absent on the last, or it hangs. */}
          {i < steps.length - 1 && (
            <span className="absolute left-[10px] top-6 bottom-0 w-px bg-border" aria-hidden />
          )}
          <Marker state={s.state} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-[13.5px]",
                s.state === "todo" ? "text-ink-2" : "font-medium text-ink",
              )}
            >
              {s.label}
            </p>
            {s.detail && (
              <p
                className={cn(
                  "mt-0.5 text-[12.5px] leading-5",
                  s.state === "bad" ? "text-neg" : "text-ink-3",
                )}
              >
                {s.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Marker({ state }: { state: TimelineState }) {
  return (
    <span
      className={cn(
        "relative z-[1] flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full",
        state === "done"
          ? "bg-pos-soft text-pos"
          : state === "bad"
            ? "bg-neg-soft text-neg"
            : state === "now"
              ? "bg-accent-soft text-accent"
              : "border border-border-strong bg-surface",
      )}
    >
      {state === "done" && <Check size={12} strokeWidth={3} />}
      {state === "bad" && <X size={12} strokeWidth={3} />}
      {state === "now" && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
      )}
    </span>
  );
}
