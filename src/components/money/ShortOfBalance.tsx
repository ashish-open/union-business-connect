"use client";

// Not enough in the account to send this.
//
// The payment flow had no balance check of any kind: a business holding ₹7.4L
// could confirm ₹50L and the screen would congratulate it. The bank would
// bounce it, and the owner would find out from the bank rather than from us —
// on the one screen that had every number needed to know in advance.
//
// It states the shortfall rather than only refusing, because "insufficient
// funds" is the bank's sentence and it tells you nothing you can act on. The
// gap, and where the rest of the money is sitting, are what decide whether you
// pay part of it now, sweep from the other account, or wait for a settlement.

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { formatINR } from "@/lib/format";

export function ShortOfBalance({
  short,
  available,
  /** Read-only balances we can see but not move — the sweep-in case. */
  elsewhere,
}: {
  short: number;
  available: number;
  elsewhere?: number;
}) {
  return (
    <div className="mt-3 rounded-[10px] border border-neg/30 bg-neg-soft px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-neg">
        <TriangleAlert size={13} className="shrink-0" />
        <span>
          Short by <Money value={short} size="sm" className="!text-neg" />
        </span>
      </p>
      <p className="mt-1 text-[11.5px] leading-5 text-ink-2">
        {`You can send up to ${formatINR(available)} from the accounts payments run from.`}
        {elsewhere && elsewhere > 0
          ? ` Another ${formatINR(elsewhere)} sits in a linked account — visible, not movable.`
          : ""}
      </p>
      {elsewhere && elsewhere > 0 ? (
        <Link
          href="/balance"
          className="mt-1.5 inline-block text-[11.5px] font-medium text-accent hover:underline"
        >
          Pull it across first
        </Link>
      ) : null}
    </div>
  );
}
