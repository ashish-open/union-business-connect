"use client";

// "Send this to your accountant" — the one idea worth taking from Open.money's
// GST app, put where it belongs.
//
// Theirs is the PRIMARY action on an empty return archive: the banner reads
// "invite your Tax Consultant and let them manage your accounting &
// compliance", which is a product telling you it cannot answer the question.
// Ours only appears BESIDE a computed figure, because handing someone a number
// they can act on is a different act from handing them the problem.
//
// So it never renders when there is nothing to send.

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useDismissable } from "@/lib/useDismissable";
import { TeamInvite } from "@/store/useStore";

export function AccountantStrip({
  /** What they would be receiving. Named, so the ask is concrete. */
  what,
  accountant,
  onInvite,
  onSend,
}: {
  what: string;
  /** Already on the account — then this is a send, not an invite. */
  accountant: string | null;
  onInvite: (invite: TeamInvite) => void;
  onSend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (accountant) {
    return (
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="min-w-0">
          {/* This said "Sent to {accountant}" and "They have the working" —
              but the button downloads a CSV to your machine and nothing
              leaves the app. The invite is what gives them sight of it; the
              file is for you to attach. Say the thing that happened. */}
          <p className="text-[12.5px] font-medium text-ink">
            {sent ? "Working downloaded" : `${accountant} can see this`}
          </p>
          <p className="text-[11.5px] text-ink-3">
            {sent
              ? `${accountant} can already open it here.`
              : "Read-only, including the working."}
          </p>
        </div>
        {sent ? (
          <Badge tone="pos">
            <Check size={11} strokeWidth={2.5} /> Saved
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onSend();
              setSent(true);
            }}
          >
            <Send size={12} /> Download {what}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">No accountant on this account</p>
          <p className="text-[11.5px] text-ink-3">
            {`They would see ${what} and the lines behind it, read-only.`}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Add one
        </Button>
      </Card>
      {open && (
        <InviteSheet
          what={what}
          onClose={() => setOpen(false)}
          onInvite={(i) => {
            onInvite(i);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function InviteSheet({
  what,
  onClose,
  onInvite,
}: {
  what: string;
  onClose: () => void;
  onInvite: (i: TeamInvite) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6">
      <div
        ref={dismissRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md rounded-t-(--radius-card) bg-surface p-5 shadow-(--shadow-pop) animate-rise sm:rounded-(--radius-card)"
      >
        <p className="text-[15px] font-semibold text-ink">Add your accountant</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {`They get ${what}, the working, and every line it came from.`}
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Their name
          </span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" />
        </label>

        <p className="mt-3 text-[11.5px] leading-5 text-ink-3">
          Read-only. They can prepare and file; releasing money stays with you.
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            size="md"
            full
            disabled={!name.trim()}
            onClick={() => onInvite({ name: name.trim(), role: "Accountant" })}
          >
            Send the invite
          </Button>
          <Button size="md" variant="secondary" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
