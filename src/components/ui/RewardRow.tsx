"use client";

// One row for everything a queue is NOT asking of you.
//
// A review queue only ever shows the exceptions, which is right — but read
// alone it says the books are nothing but problems. The work that came out
// correct is the larger number every time, and stating it is what makes the
// short list credible: forty-one matched themselves, these two need a person.
//
// It sits at the FOOT of the list, not above it. Above, it is a headline you
// read instead of the queue; below, it is what you are left with — and the last
// thing read is remembered as much as the first.
//
// One row, deliberately. The temptation is a bordered block with an eyebrow, a
// headline and a progress bar, and stacked at the bottom of every screen that
// becomes chrome the eye learns to skip — which is the opposite of the point.

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function RewardRow({
  /** What is already fine, in the terms the user would have checked themselves. */
  title,
  /** Why it is fine. Optional — a count often needs no gloss. */
  detail,
  action,
  className,
}: {
  title: string;
  detail?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] bg-pos-soft px-3.5 py-2.5",
        className,
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pos/15 text-pos">
        <Check size={11} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-ink">{title}</span>
        {detail && <span className="mt-0.5 block text-[11.5px] text-ink-2">{detail}</span>}
      </span>
      {action?.href ? (
        <Link
          href={action.href}
          className="shrink-0 text-[11.5px] font-medium text-accent hover:underline"
        >
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <button
          onClick={action.onClick}
          className="shrink-0 text-[11.5px] font-medium text-accent hover:underline cursor-pointer"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
