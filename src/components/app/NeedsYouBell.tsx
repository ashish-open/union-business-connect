"use client";

// The bell had a count and nothing behind it.
//
// It was labelled "Notifications: 6", drew a badge, and its entire behaviour
// was `router.push("/today")` — so from Today, the screen it pushes to, it did
// nothing at all. A counter you cannot open is a claim you cannot check.
//
// It opens now, and it reads the SAME `buildQueue` that Today renders, so the
// badge and the list can never disagree about what needs you. Rows go to
// wherever the item is actually settled; items with no deep link go to Today,
// where they are resolved in place.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { buildQueue } from "@/lib/today";
import { draftToQueueItem, useVoiceDrafts } from "@/lib/voice/queue";
import { formatINR } from "@/lib/format";
import { useDismissable } from "@/lib/useDismissable";
import { cn } from "@/lib/cn";
import type { Entity } from "@/data/seed";
import { useStore } from "@/store/useStore";

export function NeedsYouBell({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const resolved = useStore((s) => s.resolved);
  const channelsConnected = useStore((s) => s.channelsConnected);

  // Voice requests must be counted here too. The comment above says the badge
  // and the list can never disagree about what needs you — that only stays true
  // if both read the same sources.
  const voice = useVoiceDrafts(entity.id);
  const voiceItems = useMemo(
    () => voice.drafts.filter((d) => d.state === "collecting" || d.state === "ready").map(draftToQueueItem),
    [voice.drafts],
  );

  const items = useMemo(
    () =>
      buildQueue(entity, !!channelsConnected[entity.id], voiceItems).filter(
        (i) => !resolved[`${entity.id}/${i.id}`],
      ),
    [entity, resolved, channelsConnected, voiceItems],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          items.length === 0 ? "Nothing needs you" : `${items.length} things need you`
        }
        className="relative rounded-md p-2 text-ink-2 transition-colors hover:bg-surface-2 cursor-pointer"
      >
        <Bell size={16} />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-semibold text-white tnum">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <Panel onClose={() => setOpen(false)}>
            <div className="flex items-baseline justify-between gap-3 px-3 pb-2 pt-2.5">
              <p className="text-[12.5px] font-semibold text-ink">Needs you</p>
              {items.length > 0 && (
                <span className="text-[11px] text-ink-3 tnum">{items.length}</span>
              )}
            </div>

            {items.length === 0 ? (
              /* Emptiness is the good kind here, so it gets no CTA (law D1) */
              <div className="px-3 pb-4 pt-1 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-pos-soft text-pos">
                  <Check size={16} strokeWidth={2.5} />
                </span>
                <p className="mt-2 text-[13px] font-medium text-ink">Nothing needs you</p>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  Every line is explained and no approval is waiting.
                </p>
              </div>
            ) : (
              <div className="max-h-[min(60vh,420px)] overflow-y-auto border-t border-border">
                {items.map((i) => (
                  <Link
                    key={i.id}
                    href={i.href ?? "/today"}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 border-b border-border px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        i.tone === "neg"
                          ? "bg-neg"
                          : i.tone === "warn"
                            ? "bg-warn"
                            : "bg-info",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] leading-4 text-ink">
                        {i.amount > 0 && (
                          <span className="font-semibold tnum">{formatINR(i.amount)} </span>
                        )}
                        {i.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-3">{i.sub}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <Link
              href="/today"
              onClick={() => setOpen(false)}
              className="block border-t border-border px-3 py-2 text-[12px] font-medium text-accent hover:underline"
            >
              Open Today
            </Link>
          </Panel>
        </>
      )}
    </div>
  );
}

/** Its own component so the dismiss hook mounts and unmounts with the panel. */
function Panel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="Needs you"
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(340px,calc(100vw-1.5rem))] rounded-xl bg-surface shadow-(--shadow-pop) animate-scale-in"
    >
      {children}
    </div>
  );
}
