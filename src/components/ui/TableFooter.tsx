"use client";

// Law C11 — the footer triad: how many there are on the left in the list's own
// noun, the pager centred, the page size on the right.
//
// The count is the part that earns its space. A table that just ends leaves you
// guessing whether you have seen everything, so the range is stated in full
// ("51–100 of 214 lines") rather than as a bare total. On one page there is no
// range to state and no pager to render, so both disappear — a pager with one
// page is furniture.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";

/** `null` means "no limit" — the option people reach for before exporting. */
export type PageSize = number | null;

export function TableFooter({
  noun,
  total,
  first,
  last,
  page,
  pages,
  pageSize,
  sizes = [25, 50, 100],
  note,
  onPage,
  onPageSize,
}: {
  /**
   * A footnote about the table itself — how it was built, not what it says.
   * Sits under the triad because it is a trust signal read once, not a figure
   * anyone scans. The statement's "53 of 61 matched automatically by 12 rules"
   * was at the top of the page in hero position, where it competed with the
   * money for attention and restated a count printed three other places.
   */
  note?: React.ReactNode;
  /** The entity's own noun, singular: "line", "vendor", "bill". */
  noun: string;
  total: number;
  /** 1-indexed, inclusive — what the reader sees, not what the array does. */
  first: number;
  last: number;
  /** 0-indexed. */
  page: number;
  pages: number;
  pageSize: PageSize;
  sizes?: number[];
  onPage: (p: number) => void;
  onPageSize: (s: PageSize) => void;
}) {
  const paged = pages > 1;

  return (
    <div className="border-t border-border">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:grid sm:grid-cols-3">
      <p className="text-[11.5px] text-ink-3 tnum">
        {paged ? `${first}–${last} of ${plural(total, noun)}` : plural(total, noun)}
      </p>

      {paged ? (
        <div className="flex items-center justify-center gap-1">
          <PagerButton label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
            <ChevronLeft size={14} />
          </PagerButton>
          <span className="min-w-[5.5rem] text-center text-[11.5px] text-ink-2 tnum">
            {`Page ${page + 1} of ${pages}`}
          </span>
          <PagerButton
            label="Next page"
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight size={14} />
          </PagerButton>
        </div>
      ) : (
        <span aria-hidden />
      )}

      <label className="flex items-center justify-end gap-1.5 text-[11.5px] text-ink-3">
        <span className="hidden sm:inline">Per page</span>
        <select
          value={pageSize === null ? "all" : pageSize}
          onChange={(e) => onPageSize(e.target.value === "all" ? null : Number(e.target.value))}
          className="rounded-md bg-surface px-1.5 py-1 text-[11.5px] text-ink-2 shadow-(--shadow-ctl) focus:outline-none focus:shadow-(--shadow-focus) cursor-pointer"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {/* No "All". This table paginates rather than virtualising, which is
              a fair trade until one option hands a user 1,247 rows in a single
              commit. The largest page size is a page size. */}
        </select>
      </label>
    </div>
      {note && <div className="px-4 pb-2 text-[11.5px] text-ink-3">{note}</div>}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        // Disabled in place (D5). The reason needs no words here: you are at the
        // end, and the page indicator beside it already says so.
        disabled
          ? "cursor-not-allowed text-ink-3/40"
          : "text-ink-2 hover:bg-surface-2 cursor-pointer",
      )}
    >
      {children}
    </button>
  );
}
