"use client";

/*
 * The expanded body of a voice request row.
 *
 * Three things this has to do that a normal queue row never does:
 *
 *  1. Show what was HEARD next to what it was matched to. That pair is the whole
 *     reason the edit step works — "Amal" heard, "Amul Distributors" matched. Show
 *     only the resolved value and you hide the exact error the human is here to
 *     catch.
 *  2. Say why Execute is locked. A greyed button with no reason is a dead end;
 *     "add the account number to enable" is an instruction.
 *  3. Say what happened afterwards in terms of consequence — "it's in Sales" —
 *     not "success", which tells the reader nothing they didn't already know.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SLOTS, type SlotSpec } from "@/lib/voice/slots";
import { spokenRef, type Draft } from "@/lib/voice/store";
import { cn } from "@/lib/cn";

export function VoiceDraftPanel({
  draft,
  onEdit,
  onExecute,
  onDiscard,
  busy,
}: {
  draft: Draft;
  onEdit: (key: string, value: string) => void;
  onExecute: () => void;
  onDiscard: () => void;
  busy?: boolean;
}) {
  const specs = SLOTS[draft.kind].filter((s) => s.required || valueOf(draft, s.key) !== null);
  const blockers = SLOTS[draft.kind].filter((s) => s.required && !valueOf(draft, s.key));
  const ready = blockers.length === 0;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {draft.transcriptExcerpt && (
        // The caller's own words, verbatim. This is the evidence line — every
        // other field on this panel is our interpretation of it.
        <p className="mb-3 font-mono text-[11.5px] text-ink-3">“{draft.transcriptExcerpt}”</p>
      )}

      {/*
        The reference Simran read out, in the form she read it.
        `spokenRef` collapses the hash to three digits for the ear, and the
        agent's closing line gives it to the caller — but nothing rendered it,
        so someone who wrote down "408" opened this screen and found no 408
        anywhere. A reference only one side of the handover can see is not a
        reference. The full ref stays out of the UI: it is an idempotency key,
        and nobody is going to read eight hex characters down a phone.
      */}
      <p className="mb-3 text-[11.5px] text-ink-3">
        Reference <span className="tnum font-medium text-ink-2">{spokenRef(draft.ref)}</span> · read
        out on the call
      </p>

      <div className="space-y-2">
        {specs.map((spec) => (
          <Field key={spec.key} draft={draft} spec={spec} onEdit={onEdit} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
        <Button size="sm" onClick={onExecute} disabled={!ready || busy}>
          {busy ? "Creating…" : "Execute"}
        </Button>
        {!ready && (
          <span className="text-[11.5px] text-ink-3">
            Add {blockers.map((b) => b.label.toLowerCase()).join(" and ")} to enable
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={onDiscard}
          disabled={busy}
          className="text-[12px] text-ink-3 hover:text-ink disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function valueOf(draft: Draft, key: string) {
  const v = draft.values.find((x) => x.key === key);
  return v?.value ?? null;
}

function Field({
  draft,
  spec,
  onEdit,
}: {
  draft: Draft;
  spec: SlotSpec;
  onEdit: (key: string, value: string) => void;
}) {
  const slot = draft.values.find((v) => v.key === spec.key);
  const [local, setLocal] = useState(slot?.value == null ? "" : String(slot.value));
  const substituted = Boolean(slot?.substituted);
  const heard = slot?.heard;

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="w-28 shrink-0 text-[12px] text-ink-2">{spec.label}</label>
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          // Committed on blur, not per keystroke: a half-typed account number is
          // not a value, and validating mid-typing tells someone they are wrong
          // before they have finished.
          onBlur={() => local !== String(slot?.value ?? "") && onEdit(spec.key, local)}
          className={cn(
            "h-8 flex-1 text-[13px]",
            (spec.kind === "account" || spec.kind === "ifsc") && "font-mono",
          )}
        />
      </div>

      {substituted && heard && heard !== String(slot?.value) && (
        <p className="mt-1 pl-[120px] text-[11.5px] text-warn">
          Heard “{heard}” — matched to this. Check it before executing.
        </p>
      )}
      {substituted && (!heard || heard === String(slot?.value)) && (
        <p className="mt-1 pl-[120px] text-[11.5px] text-warn">
          New to your account — check the spelling.
        </p>
      )}
      {!spec.viaVoice && (
        // Says why the field arrived empty, so it doesn't read as the agent
        // having forgotten to ask.
        <p className="mt-1 pl-[120px] text-[11.5px] text-ink-3">
          Typed here, never dictated — one wrong digit can’t be undone.
        </p>
      )}
      {slot?.source === "app" && (
        <p className="mt-1 flex items-center gap-1 pl-[120px] text-[11.5px] text-pos">
          <Check size={11} strokeWidth={2.5} /> You confirmed this
        </p>
      )}
    </div>
  );
}
