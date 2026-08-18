"use client";

// The channel prompt on Today, for anyone who skipped the handover.
//
// It is NOT a queue item, and it used to be one. A queue item is a decision
// only you can make, and it clears when you make it — its resolved line read
// "Noted — we'll keep tracking it", which is untrue here: noting a rail does
// not connect it. This is an unlock, so it lives on its own and stays until
// the thing is actually done.
//
// Dismissible, and led by their own number rather than an offer, because a
// strip that cannot be closed is a banner and banners are the thing people
// have learned to look past (Selective Attention).

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatINR, plural } from "@/lib/format";
import type { ChannelState } from "@/lib/channels";

export function ConnectPrompt({
  rails,
  onDismiss,
}: {
  /** Only the rails whose reports we do not hold — biggest first. */
  rails: ChannelState[];
  onDismiss: () => void;
}) {
  if (rails.length === 0) return null;
  const names = rails.map((r) => r.spec.name);
  const total = rails.reduce((s, r) => s + r.received, 0);

  return (
    <Card className="!py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Their money first, never the offer (B1, and the nudge rule).
              It used to add "and we cannot see the fees inside it" — fifteen
              words, and the product talking about its own eyesight rather than
              their fee. */}
          <p className="text-[13px] font-medium text-ink">
            {`${formatINR(total, { compact: true })} from ${list(names)} · fees not visible`}
          </p>
          {/* This line reported the shortfall — the same ₹1,11,800 the queue
              item eight rows down already reports, twice on one screen against
              the one-fact-per-screen rule. The queue owns that number; this
              strip owns the reason to connect, which nothing else says. */}
          <p className="mt-1 text-[12px] leading-5 text-ink-3">
            Their reports show the fee · its GST is claimable
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/channels/${rails[0].spec.id}`}>
          <Button size="sm">
            {`Connect ${names[0]}`} <ArrowRight size={12} />
          </Button>
        </Link>
        {rails.length > 1 && (
          <Link
            href="/channels"
            className="rounded-md px-1.5 py-1 text-[12px] text-ink-3 transition-colors hover:text-ink-2"
          >
            {`All ${plural(rails.length, "rail")}`}
          </Link>
        )}
      </div>
    </Card>
  );
}

function list(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
