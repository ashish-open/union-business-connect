"use client";

// How a view-only account got here, and how to get rid of it.
//
// The other banks' accounts have always been in this product — badged "View
// only" and otherwise unexplained. Nothing said how they arrived, under what
// consent, when they were last read, or how to stop. That is the same defect
// the channels feature had: a state you can enter and cannot leave, on a
// screen that is asking to be trusted with an account at another bank.
//
// A competitor prototype makes this the hero of its dashboard — "3 accounts
// found across 3 banks", the RBI framework named, a lock beside every external
// row. The framework is the reassuring part and it costs nothing to say, so it
// is said here: read-only, revocable, no credentials.
//
// What this deliberately does NOT do is offer to link a new bank. The accounts
// here come from the seed with real balances; a flow that "discovers" an
// account would have to invent a balance for it, and an invented balance on the
// screen that answers "where is my money" is the worst possible place for one.

import { useState } from "react";
import { Lock, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDismissable } from "@/lib/useDismissable";
import { ANCHOR_DATE } from "@/data/seed";
import { addDays, daysBetween, fmtDateFull, plural } from "@/lib/format";
import { cn } from "@/lib/cn";

/** How long an AA consent runs before it has to be given again. */
const CONSENT_MONTHS = 12;

export function AccountSource({
  bank,
  lastSync,
  since,
  onRefresh,
  onRevoke,
  refreshing,
}: {
  bank: string;
  /** ISO date this account was last read. */
  lastSync: string;
  /** ISO date consent was given. */
  since: string;
  onRefresh: () => void;
  onRevoke: () => void;
  refreshing: boolean;
}) {
  const [explaining, setExplaining] = useState(false);
  const stale = daysBetween(lastSync, ANCHOR_DATE);
  const expires = addDays(since, CONSENT_MONTHS * 30);

  return (
    <>
      <Card className="mt-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          <Lock size={12} className="shrink-0 text-ink-3" />
          Linked through Account Aggregator
        </p>
        {/* Read and current are different facts — the same distinction the
            channel pages had to learn. An account linked in March still reads
            "linked" in August. */}
        <p className={cn("mt-1 text-[11.5px] tnum", stale > 2 ? "text-warn" : "text-ink-3")}>
          {refreshing
            ? "Reading the latest balance…"
            : stale <= 0
              ? "Read today"
              : `Read ${plural(stale, "day")} ago`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          {`Consent runs to ${fmtDateFull(expires)}`}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" disabled={refreshing} onClick={onRefresh}>
            <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
            {refreshing ? "Reading" : "Read now"}
          </Button>
          <button
            onClick={() => setExplaining(true)}
            className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
          >
            What {bank} shares
          </button>
          {/* The way out, below the happy path rather than beside it (F4). */}
          <button
            onClick={onRevoke}
            className="ml-auto rounded-md px-1.5 py-1 text-[11.5px] text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
          >
            Revoke
          </button>
        </div>
      </Card>

      {explaining && <ConsentPanel bank={bank} onClose={() => setExplaining(false)} />}
    </>
  );
}

/**
 * What the consent actually covers.
 *
 * Read once, at the moment access is being judged — which is exactly where a
 * full sentence is the right shape and the word budget does not apply.
 */
function ConsentPanel({ bank, onClose }: { bank: string; onClose: () => void }) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  const facts: Array<[string, string]> = [
    ["Balance and transactions", `${bank} sends what it would print on a statement. Nothing else.`],
    ["Read-only, always", "Nothing here can move money in that account, or change anything in it."],
    ["No password, ever", "Consent is given at your bank. Business Connect never sees a credential."],
    ["Yours to revoke", "Revoke here or at your bank, and the reading stops that day."],
    ["RBI's framework", "Account Aggregators are licensed and regulated by the Reserve Bank."],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-t-[16px] bg-surface p-5 shadow-(--shadow-pop) animate-rise sm:rounded-[14px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">{`What ${bank} shares`}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {facts.map(([label, body]) => (
            <div key={label}>
              <p className="text-[12.5px] font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-ink-3">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
