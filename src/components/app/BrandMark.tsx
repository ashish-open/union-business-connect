import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

// The bank's real device, not a monogram.
//
// This used to draw a maroon tile with the letters "BC" and a gold dot in the
// corner — a stand-in that outlived its reason, since the actual PNB Business
// Connect lockup was sitting in the previous prototype the whole time. The
// dot meant nothing, and inventing a mark for a bank that has one is the kind
// of detail that tells a client you did not look.
//
// The device comes out of the lockup by CSS (see `.pnb-mark` in globals.css);
// the wordmark stays as text, because at 13px a rasterised one would be soft
// and it could not follow the theme.

const MARK: Record<"sm" | "md" | "lg", number> = { sm: 26, md: 30, lg: 40 };

export function BrandMark({
  size = "md",
  withName = true,
  /** On the brand gradient: white wordmark, and the device gets a white chip. */
  onDark,
  /** Say which bank. The rail does not — the device already says it. */
  withBank = true,
}: {
  size?: "sm" | "md" | "lg";
  withName?: boolean;
  onDark?: boolean;
  withBank?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn("pnb-mark", onDark && "pnb-mark--on-dark")}
        style={{ "--mark": `${MARK[size]}px` } as React.CSSProperties}
        role="img"
        aria-label={`${brand.bankShort} ${brand.productName}`}
      />
      {withName && (
        <span className="min-w-0 leading-none">
          <span
            className={cn(
              "block truncate font-semibold tracking-[-0.01em]",
              onDark ? "text-white" : "text-ink",
              size === "lg" ? "text-[17px]" : "text-[13.5px]",
            )}
          >
            {brand.productName}
          </span>
          {withBank && (
            <span
              className={cn(
                "block truncate",
                onDark ? "text-white/60" : "text-ink-3",
                size === "lg" ? "mt-1.5 text-xs" : "mt-1 text-[10.5px]",
              )}
            >
              {brand.bankName}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
