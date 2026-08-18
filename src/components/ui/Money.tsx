import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";

type Size = "sm" | "md" | "lg" | "xl" | "hero";

const SIZES: Record<Size, string> = {
  sm: "text-[13.5px] font-medium",
  md: "text-[15px] font-semibold tracking-[-0.01em]",
  lg: "text-xl font-semibold tracking-[-0.02em]",
  xl: "text-[28px] font-semibold tracking-[-0.025em] leading-none",
  hero: "text-[38px] sm:text-[44px] font-semibold tracking-[-0.03em] leading-[1.05]",
};

export function Money({
  value,
  size = "md",
  tone,
  compact,
  signed,
  className,
}: {
  value: number;
  size?: Size;
  tone?: "pos" | "neg" | "muted";
  compact?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const color =
    tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "muted" ? "text-ink-2" : "text-ink";
  return (
    <span className={cn("tnum", SIZES[size], color, className)}>
      {formatINR(value, { compact, sign: signed })}
    </span>
  );
}
