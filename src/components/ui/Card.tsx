import { cn } from "@/lib/cn";

// Cards get their edge from a ring shadow, never a border — hairlines live
// only between rows inside a card (divide-border).
export function Card({
  className,
  pad = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { pad?: "none" | "sm" | "md" | "lg" }) {
  const padding = { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-6 sm:p-8" }[pad];
  return (
    <div
      className={cn("bg-surface rounded-(--radius-card) shadow-(--shadow-card)", padding, className)}
      {...props}
    />
  );
}
