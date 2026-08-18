"use client";

// Ask, from anywhere — now anchored to the bottom of the screen.
//
// It lived in the top bar, borrowed from Brex, where a search field means
// "filter a list". Ours does not filter, it ANSWERS and shows its working, and
// every conversational product a business owner already uses — ChatGPT, Gemini,
// Perplexity, Copilot — puts that input at the bottom. Jakob's law: the shape
// should match what the thing is, not where a different pattern keeps it.
//
// It is also a Fitts win. On a 90-day statement the eye is six hundred pixels
// down the page and the old trigger was a 32px icon pinned to the top-right
// corner — the longest, most precise trip on the screen, for the one feature the
// product is built around.
//
// Placement differs by breakpoint because the bottom does:
//   · desktop — a floating pill, centred, nothing else down there
//   · mobile  — the CENTRE SLOT of the existing tab bar, because the thumb zone
//               is already the nav. A floating pill above it would have covered
//               a strip of content on the smallest screen, permanently.
// The mobile trigger lives in AppShell's nav; this component owns the panel, so
// `open` is controlled from there and both triggers drive the same state.

"use no memo";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { Entity } from "@/data/seed";
import { ask, askSuggestions, AskResult } from "@/lib/ask";
import { buildStatement } from "@/lib/statement";
import { buildBatches } from "@/lib/settlements";
import { reportHeld } from "@/lib/channels";
import { fmtDate } from "@/lib/format";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/cn";

const WINDOW_DAYS = 90;

export function AskAnywhere({
  entity,
  open,
  onOpenChange,
}: {
  entity: Entity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const connected = useStore((s) => !!s.channelsConnected[entity.id]);
  const lineResolutions = useStore((s) => s.lineResolutions);

  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  /* The suggestions surface waits for the field.
     Opening the mark gets you the field and nothing else; the card arrives when
     you actually put a cursor in it. Two stages, so the first click is a small
     answerable thing rather than a wall of suggestions you did not ask for. */
  const [cardOpen, setCardOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const resolutions = useMemo(() => {
    const out: Record<string, "accepted" | "rejected"> = {};
    for (const [k, v] of Object.entries(lineResolutions)) {
      const [eid, txnId] = k.split("/");
      if (eid === entity.id) out[txnId] = v;
    }
    return out;
  }, [lineResolutions, entity.id]);

  const data = useMemo(
    () => buildStatement(entity, { connected, resolutions, days: WINDOW_DAYS }),
    [entity, connected, resolutions],
  );
  const channelSources = useStore((s) => s.channelSources);
  const batches = useMemo(
    () =>
      buildBatches(
        entity,
        reportHeld({
          source: (id) => channelSources[`${entity.id}/${id}`],
          aggregatorsOn: connected,
        }),
      ),
    [entity, channelSources, connected],
  );
  const chips = useMemo(
    () => askSuggestions(data.rows, connected, entity),
    [data.rows, connected, entity],
  );

  /* Every close goes through here, so the two stages reset together and the
     next open starts clean rather than resuming a stale answer. Kept as a
     handler rather than an effect on `open`: resetting state from an effect
     runs a render late, and it is the rule this codebase lints against. */
  const close = useCallback(() => {
    setCardOpen(false);
    setAnswer(null);
    setQ("");
    onOpenChange(false);
  }, [onOpenChange]);

  // ⌘K / ctrl-K from anywhere, Esc to leave — a keyboard user should never
  // have to reach for the mouse to ask a question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // The one path that skips the first stage: reaching for a shortcut is
        // already a decision to type, so it opens the field focused — which
        // brings the card with it, through the same onFocus everything uses.
        onOpenChange(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // `panelRef` is the whole Ask region — card AND bar — so a click on
      // either keeps it open. The tab-bar trigger is exempt too: it would close
      // here and immediately reopen in its own handler.
      if (panelRef.current?.contains(t) || t.closest("[data-ask-trigger]")) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  function run(text: string) {
    setQ(text);
    setAnswer(ask(text, data.rows, entity, { days: WINDOW_DAYS, connected, batches }));
  }

  const matches = answer?.match ? data.rows.filter(answer.match).slice(0, 4) : [];
  /* Once a question has been answered the card has to stay, whatever focus is
     doing — clicking a suggestion inside it moves focus out of the field. */
  const showCard = open && (cardOpen || !!answer);

  return (
    /* Right-anchored, so the box's RIGHT edge is what phase one moves and phase
       two pins. Growing width then extends leftward on its own, which is the
       whole drag: the mark pulls the left edge out behind it. */
    <div
      ref={panelRef}
      className={cn(
        "group fixed z-40 right-3 md:right-6",
        "bottom-[5.25rem] md:bottom-6",
        open && "ask-open",
        // On a phone the tab bar is the resting control, so there is nothing to
        // show down here until it is opened.
        !open && "hidden md:block",
      )}
    >
      {/* Phase one. `−50vw + 334px` lands the right edge exactly on
          `50vw + 310` — half the viewport plus half the finished 620px bar — so
          the bar ends centred without anything having to measure it.

          Desktop only: on a phone the finished bar is already 12px from each
          edge at this anchor, so there is nothing to travel. */}
      <div
        className={cn(
          "ask-travel relative",
          open ? "md:translate-x-[calc(-50vw+334px)]" : "translate-x-0",
        )}
      >
      {/* A SEPARATE surface, floating above the bar with a gap — not one welded
          box with a field boxed inside it. It animates in and out rather than
          mounting, so closing is as smooth as opening. */}
      <div
        aria-hidden={!showCard}
        className={cn(
          "absolute bottom-full right-0 mb-2.5 w-[min(620px,calc(100vw-1.5rem))] origin-bottom-right rounded-[22px] bg-surface p-2.5 shadow-(--shadow-pop) transition-all duration-250 ease-out",
          showCard
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-[0.97] opacity-0",
        )}
      >
        <div className="max-h-[52vh] overflow-y-auto px-1 py-0.5">
          {answer ? (
            <div className="animate-fade">
              <p className="text-[13.5px] leading-6 text-ink">{answer.answer}</p>
              <p className="mt-1 text-[11.5px] leading-4 text-ink-3">{answer.detail}</p>
              {matches.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-[14px] border border-border">
                  {matches.map((r) => (
                    <div
                      key={r.txn.id}
                      className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
                    >
                      <span className="w-12 shrink-0 text-[11px] text-ink-3 tnum">
                        {fmtDate(r.txn.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                        {r.name}
                      </span>
                      <span className="shrink-0 text-[12.5px] text-ink tnum">
                        {r.txn.direction === "credit" ? "+" : "−"}₹
                        {r.txn.amount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Carries the question, so the statement re-answers it and lands
                  on these rows. It used to push a bare `/statement` and leave
                  you on the unfiltered page — the promise in the label, unkept. */}
              <button
                onClick={() => {
                  const asked = q;
                  close();
                  router.push(`/statement?ask=${encodeURIComponent(asked)}`);
                }}
                className="mt-3 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
              >
                See it in the statement →
              </button>
            </div>
          ) : (
            <>
              <p className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Try
              </p>
              <div className="mt-1.5 flex flex-col">
                {chips.map((c) => (
                  <button
                    key={c}
                    tabIndex={showCard ? 0 : -1}
                    onClick={() => run(c)}
                    className="rounded-[12px] px-2 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="mt-2 border-t border-border px-1 pt-2 text-[11px] leading-4 text-ink-3">
                {`Computed from your own ${WINDOW_DAYS}-day statement · every answer shows its working`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* An icon alone does not say what it does. Rather than carry a permanent
          label, the mark names itself on hover — same reveal-on-use rule as the
          glow. Hidden while open, where the placeholder says it instead. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-2.5 right-14 hidden items-center gap-2 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-[12px] text-ink-2 shadow-(--shadow-pop) transition-opacity duration-150 md:flex",
          open ? "opacity-0" : "opacity-0 group-hover:opacity-100",
        )}
      >
        Ask about your money
        <kbd className="rounded border border-border-strong px-1 text-[10px] text-ink-3">⌘K</kbd>
      </span>

      {/* The bar. Its width is phase two of the drag — the right edge is already
          pinned by then, so growing it extends the left edge out under the mark. */}
      {/* The rim lives on a wrapper: the bar clips its own overflow so the
          cross-fading contents do not spill during the morph, and that clip
          would eat a glow drawn 2px outside it. */}
      <div className="ask-glow ml-auto w-fit rounded-full">
      <div
        className={cn(
          "ask-morph relative flex h-12 items-center overflow-hidden rounded-full bg-surface shadow-(--shadow-pop)",
          open ? "w-[min(620px,calc(100vw-1.5rem))]" : "w-12",
        )}
      >
        {/* The content sits clear of the mark and arrives once the stretch is
            underway — it should look like it was pulled out along with the bar,
            not like it was waiting inside a bar that opened around it. */}
        <div
          className={cn(
            "flex h-full w-full items-center gap-2 pl-[3.75rem] pr-2 transition-opacity duration-200",
            open ? "opacity-100 delay-[380ms]" : "pointer-events-none opacity-0 delay-0",
          )}
        >
          <input
            ref={inputRef}
            value={q}
            tabIndex={open ? 0 : -1}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value) setAnswer(null);
            }}
            onFocus={() => setCardOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && run(q)}
            placeholder="What did labour cost? Who paid me short?"
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
          />
          {q.trim() ? (
            <button
              onClick={() => run(q)}
              aria-label="Ask"
              className="shrink-0 rounded-full bg-accent p-2 text-white transition-opacity hover:opacity-90 cursor-pointer"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              onClick={close}
              aria-label="Close"
              tabIndex={open ? 0 : -1}
              className="shrink-0 rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* The mark. Pinned to the bar's left edge at a constant size, so as the
            bar stretches leftward the mark rides that edge — it is not a button
            that dissolves into a bar, it is the thing dragging the bar open, and
            it stays as the logo once it arrives. */}
        <button
          onClick={() => !open && onOpenChange(true)}
          aria-label="Ask about your money"
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          className={cn(
            "absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--brand-grad-a),var(--brand-grad-b))] text-white",
            open ? "pointer-events-none" : "cursor-pointer",
          )}
        >
          <Sparkles size={18} strokeWidth={2} />
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}
