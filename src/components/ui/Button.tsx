import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Primary keeps the fixed brand gradient in both themes — like Stripe's
// purple, it IS the identity. Secondary is white with a hairline ring shadow.
const VARIANTS: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(180deg,var(--brand-grad-a),var(--brand-grad-b))] shadow-(--shadow-btn) hover:brightness-110 active:translate-y-px",
  secondary:
    "bg-surface text-ink shadow-(--shadow-ctl) hover:shadow-(--shadow-ctl-hover) hover:bg-surface-2/60 active:translate-y-px",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-neg-soft text-neg shadow-(--shadow-ctl) hover:brightness-97 active:translate-y-px",
};

/* Heights are the DESIGN heights. Law H's 44px minimum on a coarse pointer is
   enforced once, globally, in `globals.css` — adding `pointer-coarse:h-11`
   here would be a second rule for one fact, drifting the moment one of them
   changed. Measured 28px in a desktop browser at 375px because that browser
   reports a fine pointer, not because the rule is missing. */
const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] rounded-md gap-1.5",
  md: "h-9 px-3.5 text-[13.5px] rounded-(--radius-ctl) gap-2",
  lg: "h-11 px-4 text-[14.5px] rounded-[10px] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:pointer-events-none cursor-pointer whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}
