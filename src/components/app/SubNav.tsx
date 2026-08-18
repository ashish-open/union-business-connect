"use client";

// The second column — Brex's own pattern on Reports and Settings.
//
// It exists so the rail does not have to grow by eleven document types. A
// section owns one rail item; everything inside it lives here. On mobile it
// becomes a horizontal scroller above the content, because a phone has no
// room for a column and a hidden sub-nav is a hidden feature.

import Link from "next/link";
import { cn } from "@/lib/cn";

export interface SubNavItem {
  label: string;
  href: string;
  /** Rendered right-aligned — a count, never a badge. */
  meta?: string;
}

export function SubNav({
  title,
  items,
  active,
}: {
  title: string;
  items: SubNavItem[];
  active: string;
}) {
  return (
    <>
      {/* desktop column */}
      <nav className="hidden w-48 shrink-0 lg:block">
        <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {title}
        </p>
        {items.map((i) => {
          const on = active === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "mb-0.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                on
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-ink-3 transition-colors hover:bg-surface-2/60 hover:text-ink-2",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {i.meta && <span className="shrink-0 text-[11px] text-ink-3 tnum">{i.meta}</span>}
            </Link>
          );
        })}
      </nav>

      {/* mobile scroller */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
        <div className="flex w-max gap-1.5">
          {items.map((i) => {
            const on = active === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px]",
                  on ? "bg-surface-2 font-medium text-ink" : "text-ink-3",
                )}
              >
                {i.label}
                {i.meta && <span className="ml-1.5 text-ink-3 tnum">{i.meta}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Section shell: sub-nav column beside the content. */
export function SectionLayout({
  title,
  items,
  active,
  children,
}: {
  title: string;
  items: SubNavItem[];
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex lg:gap-7">
      <SubNav title={title} items={items} active={active} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
