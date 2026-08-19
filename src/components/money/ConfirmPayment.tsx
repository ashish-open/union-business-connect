"use client";

// The last thing you read before money leaves.
//
// The payment flow used to commit on the amount step: you typed a figure, the
// button said "Pay ₹45,000 · IMPS", and pressing it moved the money. There was
// no point at which the four facts that decide whether this is a mistake were
// on screen together, and the name you saw throughout was the nickname you
// typed yourself — never the name the bank has for the account.
//
// This is the one piece of friction the product should have. Everything it
// shows is a RESTATEMENT, not a summary: same amount, same legal name from the
// same penny drop, same rail and arrival sentence the picker promised. A
// summary that paraphrases is a second version of the facts, and two versions
// is how they drift.
//
// It also says what happens next, and it distinguishes the two cases honestly:
// a payment that goes straight out cannot be recalled, and one that will sit in
// an approval queue has not moved at all yet. Telling someone a queued payment
// is irreversible would be a lie, and the reverse would be worse.

import { Check, Landmark, ShieldCheck, TriangleAlert } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { maskAccount } from "@/lib/format";
import { nameMatches } from "@/lib/payments";
import { cn } from "@/lib/cn";

export function ConfirmPayment({
  amount,
  payeeName,
  legalName,
  masked,
  ifsc,
  mode,
  lands,
  tag,
  /** Present when a second person has to clear it before anything moves. */
  approvalNote,
  /** Who accepted a name that did not match, if that happened when adding. */
  mismatchAcceptedBy,
}: {
  amount: number;
  payeeName: string;
  legalName: string;
  masked: string;
  ifsc: string;
  mode: string;
  lands: string;
  tag?: string;
  approvalNote?: string;
  mismatchAcceptedBy?: string;
}) {
  const agrees = nameMatches(payeeName, legalName);

  return (
    <div className="animate-rise">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        You are about to send
      </p>
      <div className="mt-1">
        <Money value={amount} size="xl" />
      </div>

      {/* The bank's name leads, and the nickname is demoted to a note under it.
          This is the whole reason the step exists: the last name you read
          before committing should be the one the BANK has, not the one you
          typed. */}
      <div className="mt-4 rounded-[10px] bg-surface-2 px-4 py-3">
        <p className="text-[11.5px] text-ink-2">The bank says this account belongs to</p>
        <p className="mt-0.5 text-[15px] font-semibold leading-5 text-ink">{legalName}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-3 tnum">
          <Landmark size={11} className="shrink-0" />
          {maskAccount(masked)} · {ifsc}
        </p>
        {agrees ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-pos">
            <Check size={11} strokeWidth={2.5} /> Matches “{payeeName}”, the name you have for them
          </p>
        ) : (
          /* Not a green tick with the difference tucked away. The names do not
             agree, the payment is still allowed, and the screen says both
             things rather than choosing one. */
          <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-medium text-warn">
            <TriangleAlert size={11} className="mt-px shrink-0" />
            <span>
              {`You have them as “${payeeName}”`}
              {mismatchAcceptedBy ? ` · you accepted this difference when you added them` : ""}
            </span>
          </p>
        )}
      </div>

      <dl className="mt-3 divide-y divide-border rounded-[10px] border border-border">
        <Row label="Arrives">
          <span className="font-medium text-ink">{mode}</span>
          <span className="text-ink-3"> · {lands}</span>
        </Row>
        <Row label="For">
          {tag ? (
            <span className="text-ink">{tag}</span>
          ) : (
            /* Optional, so its absence is stated rather than left blank — an
               untagged payment is the one nobody can explain at close. */
            <span className="text-ink-3">Untagged — it will need a head at close</span>
          )}
        </Row>
      </dl>

      <p
        className={cn(
          "mt-3 flex items-start gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[12px]",
          approvalNote ? "bg-info-soft text-ink" : "bg-surface-2 text-ink-2",
        )}
      >
        <ShieldCheck size={13} className="mt-px shrink-0" />
        <span>
          {approvalNote ?? "Once sent, it cannot be recalled."}
        </span>
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="text-right text-[12.5px]">{children}</dd>
    </div>
  );
}
