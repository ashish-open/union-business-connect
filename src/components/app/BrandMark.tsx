import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { UnionMark } from "./marks/UnionMark";

// The bank's real device, not a monogram.
//
// The previous tenant cropped its device out of a master raster with three
// hand-measured ratios in CSS. That worked, but it meant the next bank had to
// re-measure them against a different lockup, and at 26px in the rail a
// cropped raster goes soft. The device is now an inline SVG component: it
// scales to every size we ask for, and swapping tenants is an import.
//
// The wordmark stays as text, because at 13px a rasterised one would be soft
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
        className={cn("brand-mark", onDark && "brand-mark--on-dark")}
        style={{ "--mark": `${MARK[size]}px` } as React.CSSProperties}
      >
        <UnionMark title={`${brand.bankShort} ${brand.productName}`} />
      </span>
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
