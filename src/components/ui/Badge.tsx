import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "pos" | "warn" | "neg" | "info" | "accent" | "gold";

// Two species, and the difference is load-bearing:
//   filled  = a LIFECYCLE STATE — where this thing is in its life
//             (Invited, In progress, Returned, Part paid)
//   outline = an ATTRIBUTE — a classification that never changes on its own
//             (Owner, Accountant, Verified, RERA project)
// A glance should tell you whether a chip is about health or about kind,
// which only works if the two never borrow each other's styling.
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  pos: "bg-pos-soft text-pos",
  warn: "bg-warn-soft text-warn",
  neg: "bg-neg-soft text-neg",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  gold: "bg-gold-soft text-gold",
};

const OUTLINE: Record<BadgeTone, string> = {
  neutral: "border border-border-strong text-ink-2",
  pos: "border border-pos/30 text-pos",
  warn: "border border-warn/30 text-warn",
  neg: "border border-neg/30 text-neg",
  info: "border border-info/30 text-info",
  accent: "border border-accent/30 text-accent",
  gold: "border border-gold/40 text-gold",
};

export function Badge({
  tone = "neutral",
  variant = "filled",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  variant?: "filled" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        variant === "outline" ? OUTLINE[tone] : TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
