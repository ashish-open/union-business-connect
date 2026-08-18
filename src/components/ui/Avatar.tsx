// Identity anchor for a row.
//
// A name rendered as text alone forces the eye to READ every row; a
// monogram is recognised pre-attentively, so a list becomes scannable at a
// glance. Colour here is deterministic from the name and carries no
// meaning — it is an identity aid, deliberately low-saturation so it never
// competes with the semantic palette (status, lateness, the one accent).
//
// `own` marks money that belongs to this business (our accounts, internal
// transfers) in solid ink — everyone else gets a tint. That single contrast
// answers "is this us or them" without a word, the way the reference does.

import { cn } from "@/lib/cn";

const TINTS = [
  "bg-[#eef1f6] text-[#516089]",
  "bg-[#f3eef6] text-[#6b5182]",
  "bg-[#eef5f2] text-[#3f6f5c]",
  "bg-[#f6f0ec] text-[#8a5f45]",
  "bg-[#f0f2ee] text-[#5c6b4d]",
  "bg-[#f6eef1] text-[#8a4a60]",
];

function initials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 &]/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable index from the name so a counterparty keeps its colour forever. */
function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({
  name,
  size = "md",
  own,
  className,
}: {
  name: string;
  size?: "sm" | "md";
  /** the business's own money — rendered in ink, not a tint */
  own?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "h-5 w-5 text-[8.5px]" : "h-7 w-7 text-[10.5px]",
        own ? "bg-ink text-ink-invert" : tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
