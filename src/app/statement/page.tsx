"use client";

// Smart Statement — the hero surface. Every line carries its recon state;
// "Unexplained" is the number the page exists to drive to zero. Connecting a
// channel is a state change you can watch: lump sums become matched
// settlements, and the short ones carry order-level evidence into a dispute.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Plug,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ExceptionCard } from "@/components/cards/ExceptionCard";
import { SettlementBadge } from "@/components/statement/StatementLine";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Avatar } from "@/components/ui/Avatar";
import { PageSize, TableFooter } from "@/components/ui/TableFooter";
import { downloadCsv, statementCsv } from "@/lib/csv";
import {
  filterLabel,
  filterMatches,
  filterOptions,
  replaceFilter,
  stateLabel,
  StatementFilter,
} from "@/lib/statementFilters";
import { settlementHome } from "@/lib/conversion";
import { ANCHOR_DATE } from "@/data/seed";
import { ALIASES } from "@/lib/analysis";
import { ask, AskResult } from "@/lib/ask";
import { buildInsights, Insight } from "@/lib/insights";
import { buildBatches, SettlementBatch } from "@/lib/settlements";
import { channelSpec, contractedTake } from "@/lib/channels";
import { channelFor, reportHeld } from "@/lib/channels";
import { buildStatement, compositionOf, needsAttention, StatementRow } from "@/lib/statement";
import { CompositionBar } from "@/components/statement/CompositionBar";
import { cn } from "@/lib/cn";
import { addDays, fmtDate, formatINR, maskAccount, parseAmount, plural } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";

type Filter = "all" | "in" | "out" | "issues";

/*
 * `useSearchParams` makes everything up to the nearest Suspense boundary
 * client-rendered, so per the Next docs the reader goes inside one. The fallback
 * is the app shell — the same frame the rest of the product paints on the first
 * frame, so nothing flashes empty while this resolves.
 */
export default function StatementPage() {
  return (
    <Suspense fallback={<AppShell />}>
      <StatementView />
    </Suspense>
  );
}

function StatementView() {
  const router = useRouter();
  const entity = useEntity();
  const channelsConnected = useStore((s) => s.channelsConnected);
  const lineResolutions = useStore((s) => s.lineResolutions);
  const resolveLine = useStore((s) => s.resolveLine);
  const connectChannels = useStore((s) => s.connectChannels);

  // Deep-link params: ?connect=1 opens the connect flow, ?filter=issues, and
  // ?q= scopes to one counterparty — three screens were already promising
  // "see THEIR lines" and landing on the unfiltered statement.
  //
  // These are the state's INITIAL values, not an effect that corrects them a
  // render later. The page renders nothing until the shell has hydrated, so
  // the unfiltered version is never on screen — it used to be, for a frame.
  const params = useMemo(
    () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
    [],
  );

  const [filter, setFilter] = useState<Filter>(() =>
    params.get("filter") === "issues" ? "issues" : "all",
  );
  const [days, setDays] = useState(30);
  /* `?ask=` carries the question, not the answer.

     The floating Ask panel matches rows with a predicate, and a predicate does
     not survive a URL. Re-running `ask()` here with the same text over the same
     rows reproduces it exactly — so "See it in the statement" lands on the lines
     the panel was showing, rather than on an unfiltered page that quietly hopes
     nobody checks. */
  /* Read REACTIVELY, unlike the initial-value params above.

     `window.location.search` inside a `[]`-dep memo is right for the params that
     only seed initial state, but it is read before a client-side push has
     updated the URL — so arriving here from the Ask panel produced no answer at
     all, while typing the same URL into the address bar worked. */
  const searchParams = useSearchParams();
  const askText = searchParams.get("ask") ?? "";
  // `?q=` lands in the table's own search box, not in the Ask bar. Those three
  // screens link here to say "see Sharma's lines" — that is a narrowing, and
  // dropping it into the question field left it looking like a question nobody
  // had answered.
  const [scoped, setScoped] = useState(() => params.get("q") ?? "");
  const [chips, setChips] = useState<StatementFilter[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  // Narrowing the set has to send you back to its first page, so the page
  // number is stored WITH the narrowing it belongs to and is only believed
  // while that still matches. An effect that reset it would fire after a render
  // that had already drawn page 5 of a 2-page list.
  const [pager, setPager] = useState({ sig: "", page: 0 });
  const [pageSize, setPageSize] = useState<PageSize>(50);
  /* Two sources, one answer.

     `?ask=` is derived, never stored — storing it would mean an effect syncing
     state to a URL, and that is how a stale answer outlives the question. The
     insight verbs on this page set one directly, so that case keeps state. */
  const [override, setOverride] = useState<AskResult | null>(null);
  const [cleared, setCleared] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(() => params.get("connect") === "1");
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  const connected = !!entity && !!channelsConnected[entity.id];

  const resolutions = useMemo(() => {
    if (!entity) return {};
    const out: Record<string, "accepted" | "rejected"> = {};
    for (const [key, val] of Object.entries(lineResolutions)) {
      const [eid, txnId] = key.split("/");
      if (eid === entity.id) out[txnId] = val;
    }
    return out;
  }, [entity, lineResolutions]);

  const channelSources = useStore((s) => s.channelSources);
  /* Per rail, not one global flag. The statement gated on `connected` — which
     is the aggregators' one-tap flow — so a D2C brand that had connected Amazon
     saw nothing, and a QSR that had connected nothing saw everything. */
  const hasReport = useMemo(
    () =>
      reportHeld({
        source: (id) => (entity ? channelSources[`${entity.id}/${id}`] : undefined),
        aggregatorsOn: connected,
      }),
    [entity, channelSources, connected],
  );
  const data = useMemo(
    () => (entity ? buildStatement(entity, { connected, resolutions, days, hasReport }) : null),
    [entity, connected, resolutions, days, hasReport],
  );
  const batches = useMemo(
    () => (entity ? buildBatches(entity, hasReport) : []),
    [entity, hasReport],
  );
  /* What each total is made of. Derived from the unfiltered window, never from
     what the chips have narrowed to — a breakdown that reshapes itself as you
     click its own slices is a control that argues with you. */
  const inMix = useMemo(
    () => (data ? compositionOf(data.rows, "credit") : { segments: [], total: 0 }),
    [data],
  );
  const outMix = useMemo(
    () => (data ? compositionOf(data.rows, "debit") : { segments: [], total: 0 }),
    [data],
  );
  const home = useMemo(
    () => (entity ? settlementHome(entity, connected) : null),
    [entity, connected],
  );
  /* The rails this business ACTUALLY has, in rupee order.
     This test was `/BUNDL|ZOMATO/i`, so the whole strip never rendered for a
     business selling on Amazon and Flipkart — the persona the channels feature
     exists for got no prompt at all — and the two it did show were named in
     the markup rather than read from the statement. */
  /* Carries the rail's ID, not just its name, because the strip has to ask
     `hasReport` per rail. It was reading one boolean — the statement's own
     aggregator toggle — so a rail connected on its own page still read
     "Amazon · not connected" here, on the screen whose whole job is to agree
     with the rest of the product. */
  const rails = useMemo(() => {
    if (!entity) return [];
    const by = new Map<string, { name: string; total: number }>();
    for (const t of entity.txns) {
      if (t.direction !== "credit") continue;
      const spec = channelFor(t.narration);
      if (!spec || spec.verifiable !== "report") continue;
      const acc = by.get(spec.id) ?? { name: spec.name, total: 0 };
      acc.total += t.amount;
      by.set(spec.id, acc);
    }
    return [...by.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, v]) => ({ id, name: v.name }));
  }, [entity]);
  const hasChannels = rails.length > 0;

  const insights = useMemo(
    () => (entity && data ? buildInsights(entity, data.rows, days) : []),
    [entity, data, days],
  );

  // the plain-language rules that produced the matches — the trust mechanic
  const rules = useMemo(() => {
    if (!data) return [];
    const hits = new Map<string, number>();
    for (const row of data.rows) {
      if (row.kind === "unknown") continue;
      hits.set(row.name, (hits.get(row.name) ?? 0) + 1);
    }
    return [...hits.entries()]
      .map(([name, count]) => {
        const alias = ALIASES.find((a) => a.name === name);
        return { name, count, pattern: alias?.match.source ?? name, kind: alias?.kind ?? "detected" };
      })
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (!entity || !data) return <AppShell />;

  const cutoff = addDays(ANCHOR_DATE, -days);
  const windowBatches = batches.filter((b) => b.creditDate >= cutoff);

  // Resolved with the same builder the panel used, over the same rows.
  const answer =
    override ??
    (askText && !cleared
      ? ask(askText, data.rows, entity, { days, connected, batches: windowBatches })
      : null);

  // Every narrowing composes. This used to `return answer.match(row)` early,
  // so asking a question silently threw away the filter you had set — and the
  // pill stayed lit, claiming otherwise.
  const q = scoped.trim().toLowerCase();
  const visible = data.rows.filter((row) => {
    if (filter === "in" && row.txn.direction !== "credit") return false;
    if (filter === "out" && row.txn.direction !== "debit") return false;
    if (filter === "issues" && !needsAttention(row)) return false;
    if (answer?.match && !answer.match(row)) return false;
    if (q && !row.name.toLowerCase().includes(q) && !row.txn.narration.toLowerCase().includes(q))
      return false;
    for (const c of chips) if (!filterMatches(c, row)) return false;
    return true;
  });

  const sig = [
    filter,
    q,
    days,
    answer?.answer ?? "",
    chips.map((c) => `${c.field}:${c.value}`).join(","),
  ].join("|");
  const pages = pageSize === null ? 1 : Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(pager.sig === sig ? pager.page : 0, pages - 1);
  const from = pageSize === null ? 0 : safePage * pageSize;
  const paged = pageSize === null ? visible : visible.slice(from, from + pageSize);
  const narrowed = q.length > 0 || chips.length > 0 || filter !== "all" || !!answer?.match;
  const options = filterOptions(data.rows);

  /* A slice of the composition bar goes into the SAME chip row a manual filter
     lands in, rather than a private highlight state of its own. The narrowing
     is then removable where every other narrowing is removable, and the table
     can say why it is short without the bar having to explain itself. */
  const kindFilter = chips.find((c) => c.field === "kind")?.value ?? null;
  function pickKind(kind: string | null) {
    setChips((cs) =>
      kind === null ? cs.filter((c) => c.field !== "kind") : replaceFilter(cs, { field: "kind", value: kind }),
    );
    // A breakdown of money in, narrowed by a pill that says "money out", is an
    // empty table you asked for by accident.
    setFilter("all");
  }

  function exportVisible() {
    downloadCsv(
      `${entity!.id}-statement-${days}d${narrowed ? "-filtered" : ""}.csv`,
      statementCsv(visible),
    );
  }

  const openBatch = openBatchId ? batches.find((b) => b.id === openBatchId) : null;
  const shortBatches = batches.filter((b) => b.variance > 0);
  /** The first rail still missing its report — what the strip offers to fix. */
  const unconnected = rails.find((r) => !hasReport(r.id));

  function handleInsightVerb(ins: Insight) {
    if (!ins.verb) return;
    if (ins.verb.kind === "bulk-personal") {
      for (const row of data!.rows) {
        if (ins.verb.match?.(row)) resolveLine(entity!.id, row.txn.id, "accepted");
      }
      return;
    }
    setOverride({ answer: ins.fact, detail: ins.sub, match: ins.verb.match });
    setFilter("all");
  }

  return (
    <AppShell>
      {/* no in-content H1 — the page title lives in the top bar and never
          scrolls; repeating it here would be dead pixels.

          The strapline that used to sit here — "Every rupee in and out,
          matched." — was a promise the next line contradicts: eight of these
          did not match. It also held a whole band open for one <select>, which
          now sits in the card whose window it governs. */}

      {/* The numbers that matter, and what each one is made of.
          Under these three there used to be one green bar filled to the share
          of lines the engine had already matched — a figure this screen also
          printed as a sentence, as a KPI and as a filter chip. It spent the
          most ink on the part needing no work, coloured it green directly
          beneath an amber count of the part that did, and spanned all three
          figures as though it described them. Each total now carries its own
          breakdown instead, and every slice filters the table below. */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <p className="text-[12.5px] text-ink-3">
            {`${plural(data.rows.length, "line")} · every rupee in and out`}
          </p>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Window"
            className="rounded-md bg-surface px-2 py-1 text-[12.5px] text-ink-2 shadow-(--shadow-ctl) focus:outline-none cursor-pointer"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Money in</p>
            <Money value={data.moneyIn} size="lg" className="mt-1 block" compact />
            <CompositionBar
              className="mt-2.5"
              segments={inMix.segments}
              selected={kindFilter}
              onPick={pickKind}
              emptyLabel="Nothing came in this window"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Money out</p>
            <Money value={data.moneyOut} size="lg" className="mt-1 block" compact />
            <CompositionBar
              className="mt-2.5"
              segments={outMix.segments}
              selected={kindFilter}
              onPick={pickKind}
              emptyLabel="Nothing went out this window"
            />
          </div>
          {/* A count you cannot act on is a count you scroll past. This slot
              held "8" in amber while the only control that did anything about
              it was a chip 400px lower down. */}
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Needs eyes
            </p>
            {data.needsEyes > 0 ? (
              <>
                <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-warn">
                  {data.needsEyes}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setFilter("issues");
                    setChips([]);
                  }}
                >
                  Review them <ArrowRight size={12} />
                </Button>
              </>
            ) : (
              /* Achievement, so nothing is invented to do about it (D1). */
              <>
                <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">0</p>
                <p className="mt-2 text-[11px] text-ink-3">Every line is accounted for</p>
              </>
            )}
          </div>
        </div>
        {/* Money at another bank, stated rather than folded into the figures
            above it. Those describe the PNB account; this is what AA can see
            and nothing here can reconcile. */}
        {data.externalIn + data.externalOut > 0 && (
          <p className="mt-3 border-t border-border pt-3 text-[11.5px] text-ink-3">
            {`${formatINR(data.externalIn)} more landed at another bank · visible, not reconcilable here`}
          </p>
        )}
      </Card>

      {/* channels — a compact strip, only when the business has them */}
      {hasChannels && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 !py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <p className="text-[13px] font-semibold text-ink">Channels</p>
            {rails.map((ch) => {
              const shorts = batches.filter((b) => b.channelId === ch.id && b.variance > 0).length;
              return hasReport(ch.id) ? (
                <Badge key={ch.id} tone="pos">
                  <Check size={11} strokeWidth={2.5} /> {ch.name}
                  {shorts > 0 && <span className="text-neg"> · {shorts} short</span>}
                </Badge>
              ) : (
                <Badge key={ch.id}>{ch.name} · not connected</Badge>
              );
            })}
            {/* "recoverable" was a promise this screen cannot keep. The total
                includes settlements past the platform's claim window — the
                channels overview says so on the same numbers — and whether a
                claim is still live depends on its TYPE, which is a channels
                fact. The statement states what the statement can see: these
                settlements came up short. */}
            {shortBatches.length > 0 && (
              <p className="text-[12.5px] text-ink-2">
                <Money
                  value={shortBatches.reduce((s, b) => s + b.variance, 0)}
                  size="sm"
                  className="mr-1 font-semibold"
                />
                {`short across ${plural(shortBatches.length, "settlement")}`}
              </p>
            )}
          </div>
          {/* One action, chosen by what is actually true of these rails:
              something to claim beats something to connect, and a fully
              connected set with nothing short earns no CTA at all (D1). */}
          {shortBatches.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setOpenBatchId(shortBatches[0].id)}>
              Review disputes <ArrowRight size={12} />
            </Button>
          ) : (
            unconnected && (
              /* Straight to the rail's own page, where all three ways in live
                 and where the platform is named correctly. The modal it used to
                 open was hardcoded to two aggregators. */
              <Link href="/channels">
                <Button size="sm">
                  <Plug size={13} /> {`Connect ${unconnected.name}`}
                </Button>
              </Link>
            )
          )}
          {/* Rung 3 — where the platform money lands is WHY we can reconcile
              it daily. Stated as a fact when it's already right; it becomes
              an offer only for a business whose settlements land elsewhere. */}
          {/* Only when it is WRONG.
              This ran on every visit: "Flipkart and Amazon settle ≈₹3.5L a week
              into Punjab National Bank ••7734 · read every morning, so shorts
              show the same day" — twenty words, the longest sentence on the
              page, spent telling an owner that a thing which is already correct
              is correct. An achievement needs no announcement (D1); a
              misdirected settlement account is worth every one of those words. */}
          {home && !home.reconcilable && (
            <p className="w-full border-t border-border pt-2 text-[11.5px] leading-5 text-ink-3">
              {`${home.platforms.join(" and ")} settle into ${home.landsIn.bank} ${maskAccount(home.landsIn.masked)}`}
              <span className="text-warn"> · not reconcilable — point it here to catch shorts</span>
            </p>
          )}
          {connected && windowBatches.length > 0 && (
            <FeeDragLine batches={windowBatches} />
          )}
        </Card>
      )}

      {/* what the agent noticed */}
      {insights.length > 0 && (
        <section className="mt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            <Sparkles size={12} className="text-gold" /> What I noticed
          </p>
          {/* Rows in one card, not a grid of cards.
              Two findings in two boxes cost 122px above a table that starts
              below the fold, and the second box padded an empty action slot
              with the words "TRACKED FOR YOU" — a label doing the job of a
              button, which is filler wearing a uniform. A finding with nothing
              to do about it simply has no verb. */}
          <Card pad="none" className="mt-2">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium leading-5 text-ink">{ins.fact}</p>
                  <p className="text-[11.5px] leading-4 text-ink-3">{ins.sub}</p>
                </div>
                {ins.verb && (
                  <Button size="sm" variant="secondary" onClick={() => handleInsightVerb(ins)}>
                    {ins.verb.label}
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* The in-page Ask bar is gone. It was here first — the answer engine was
          born on this screen — but Ask is now a fixed control on every page, and
          two ask inputs 400px apart on one screen is the same fact twice. The
          floating one is also the better of the two: it answers, cites its
          working, and links back into these lines. */}
      <section className="mt-5 min-w-0">
          {/* the computed answer, with its working */}
          {answer && (
            <Card className="mt-3 !p-4 animate-rise">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-2.5">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold leading-5 text-ink">{answer.answer}</p>
                    <p className="mt-1 text-[11.5px] text-ink-3">
                      {answer.detail}
                      {answer.match && " · showing those lines below"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOverride(null);
                    setCleared(true);
                  }}
                  aria-label="Clear answer"
                  className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </Card>
          )}

          {/* Tier 1 (C13) — the four slices worth a permanent home. */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All"],
                ["in", "Money in"],
                ["out", "Money out"],
                ["issues", `Didn't match · ${data.needsEyes}`],
              ] as Array<[Filter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
                  filter === key ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tier 2 — scoped search, the filter builder, and the way out to a
              spreadsheet. Low-contrast on purpose: tier 1 is the answer most
              days, and this row is for the day it isn't. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* D4: with nothing to search the input is REMOVED, not disabled.
                "Nothing to search" means the window itself is empty — a filter
                that matched nothing must keep its input, or there is no way to
                undo the filter that emptied it.

                It takes its own row on a phone: sharing one line with the
                builder and the export button left it 137px, which truncates the
                placeholder that says what you are searching. */}
            {data.rows.length > 0 && (
              <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  value={scoped}
                  onChange={(e) => setScoped(e.target.value)}
                  aria-label="Search these lines"
                  placeholder={`Search these ${plural(data.rows.length, "line")}`}
                  className="h-8 w-full rounded-md bg-surface pl-7.5 pr-7 text-[12.5px] text-ink shadow-(--shadow-ctl) placeholder:text-ink-3 focus:outline-none focus:shadow-(--shadow-focus)"
                />
                {scoped.length > 0 && (
                  <button
                    onClick={() => setScoped("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink-2 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setBuilderOpen((o) => !o)}
                aria-expanded={builderOpen}
                data-filter-toggle
                className="flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 cursor-pointer"
              >
                <Plus size={13} /> Add filter
              </button>
              {builderOpen && (
                <FilterBuilder
                  options={options}
                  onClose={() => setBuilderOpen(false)}
                  onAdd={(f) => {
                    setChips((cs) => replaceFilter(cs, f));
                    setBuilderOpen(false);
                  }}
                />
              )}
            </div>

            <button
              onClick={exportVisible}
              title={`Export the ${plural(visible.length, "line")} shown`}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.field}
                  className="flex items-center gap-1 rounded-md bg-surface-2 py-1 pl-2 pr-1 text-[11.5px] text-ink-2"
                >
                  {filterLabel(c)}
                  <button
                    onClick={() => setChips((cs) => cs.filter((x) => x.field !== c.field))}
                    aria-label={`Remove filter ${filterLabel(c)}`}
                    className="rounded p-0.5 text-ink-3 hover:text-ink cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {chips.length > 1 && (
                <button
                  onClick={() => setChips([])}
                  className="px-1 text-[11.5px] text-ink-3 hover:text-ink-2 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* list or exceptions.
              The exception list is deliberately NOT paged: it is a queue you
              clear, not a set you browse, and paging a queue means resolving
              the last card teleports you to an empty page. */}
          {filter === "issues" ? (
            <div className="mt-3 max-w-2xl space-y-3">
              {visible.length === 0 && (
                <Card className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pos-soft text-pos">
                    <Check size={13} strokeWidth={2.5} />
                  </span>
                  <p className="text-[13.5px] text-ink-2">Every line is explained. Nothing needs your eyes.</p>
                </Card>
              )}
              {visible.map((row) =>
                row.batchId ? (
                  <ShortSettlementCard
                    key={row.txn.id}
                    row={row}
                    onOpen={() => setOpenBatchId(row.batchId!)}
                  />
                ) : row.kind === "marketplace" ? (
                  <div key={row.txn.id} className="rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card)">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <SettlementBadge recon={row.recon} />
                        <p className="mt-2 text-sm font-medium text-ink">
                          {row.name} settlement · {fmtDate(row.txn.date)}
                        </p>
                        <p className="mt-1 text-xs text-ink-3">
                          A lump sum until the channel is connected — orders, fees and deductions invisible.
                        </p>
                      </div>
                      <Money value={row.txn.amount} size="lg" />
                    </div>
                    {/* Routes to THAT rail. This used to open a modal
                        hardcoded "Connect Swiggy & Zomato" — so a D2C brand
                        clicking "Connect Amazon" was offered two aggregators
                        it does not sell on, and connecting them would have
                        authorised the wrong platforms entirely. */}
                    <div className="mt-3">
                      <Link href={row.channelId ? `/channels/${row.channelId}` : "/channels"}>
                        <Button size="sm" variant="secondary">
                          <Plug size={13} /> Connect {row.name}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <ExceptionCard
                    key={row.txn.id}
                    reason={row.reason ?? "UNKNOWN_CREDIT"}
                    amount={row.txn.amount}
                    title={`${row.name} · ${fmtDate(row.txn.date)}`}
                    evidence={row.txn.narration}
                    onAction={(verb) => {
                      if (verb === "accept") resolveLine(entity.id, row.txn.id, "accepted");
                      if (verb === "reject") resolveLine(entity.id, row.txn.id, "rejected");
                    }}
                  />
                ),
              )}
            </div>
          ) : (
            <Card pad="none" className="mt-3 overflow-hidden">
              {/* D4 — the header row renders even with no rows under it. The
                  schema is information: it tells you what a line would say.
                  Only from sm up, because below that the row collapses to two
                  columns and there is no grid to describe. */}
              <div className="hidden border-b border-border bg-surface-2/40 px-4 py-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_7.5rem] sm:gap-x-3">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Counterparty
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Status
                </span>
                <span className="justify-self-end text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Amount
                </span>
              </div>

              {/* A filtered empty state is a dead end unless it offers the
                  way out — the filter is the cause, so it is also the fix. */}
              {visible.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-ink">Nothing in this filter</p>
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    {`${plural(data.rows.length, "line")} are here under “All”.`}
                  </p>
                  <button
                    onClick={() => {
                      setFilter("all");
                      setScoped("");
                      setChips([]);
                      setOverride(null);
                      setCleared(true);
                      // Clearing a filter normally puts you back where you
                      // were, which is the right behaviour for an undo. This
                      // button is not an undo — it means "show me everything",
                      // and everything starts at the top.
                      setPager({ sig: "", page: 0 });
                    }}
                    className="mt-2.5 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    Show all lines
                  </button>
                </div>
              )}
              {groupByDate(paged).map(([date, rows]) => (
                <div key={date}>
                  <div className="border-b border-border bg-surface-2/60 px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    {dateHeading(date)}
                  </div>
                  {rows.map((row) => (
                    <Row
                      key={row.txn.id}
                      row={row}
                      onOpen={row.batchId ? () => setOpenBatchId(row.batchId!) : undefined}
                      href={row.channelId ? `/channels/${row.channelId}` : undefined}
                    />
                  ))}
                </div>
              ))}

              {visible.length > 0 && (
                <TableFooter
                  noun="line"
                  total={visible.length}
                  first={from + 1}
                  last={from + paged.length}
                  page={safePage}
                  pages={pages}
                  pageSize={pageSize}
                  note={
                    /* Moved down here from hero position. It is a footnote
                       about how the table was built — worth saying once, worth
                       saying quietly. */
                    <button
                      onClick={() => setRulesOpen(true)}
                      className="transition-colors hover:text-accent cursor-pointer"
                    >
                      {`${data.rows.length - data.needsEyes} of ${data.rows.length} lines matched automatically by ${plural(rules.length, "rule")} — see how`}
                    </button>
                  }
                  onPage={(p) => setPager({ sig, page: p })}
                  onPageSize={(next) => {
                    setPageSize(next);
                    setPager({ sig, page: 0 });
                  }}
                />
              )}
            </Card>
          )}

          <p className="mt-3 text-[11.5px] text-ink-3">
            {filter === "issues"
              ? `${plural(visible.length, "line")} need your eyes.`
              : `${plural(visible.length, "line")} · every one showing the bank's own words.`}
          </p>
        </section>

      {connectOpen && (
        <ConnectModal
          onClose={() => setConnectOpen(false)}
          onDone={() => {
            connectChannels(entity.id);
            setConnectOpen(false);
          }}
        />
      )}

      {openBatch && (
        <BatchPanel
          batch={openBatch}
          account={maskAccount(entity.accounts.find((a) => !a.readOnly)?.masked ?? "")}
          onClose={() => setOpenBatchId(null)}
          onDispute={() => router.push(`/dispute/${openBatch.id}`)}
        />
      )}

      {rulesOpen && <RulesPanel rules={rules} onClose={() => setRulesOpen(false)} />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

// The tier-2 filter builder (C13). Three fields at most, and a field only
// appears when the window holds more than one of its values — narrowing to
// "UPI" on a statement where every line is UPI is a control that cannot change
// the answer, and offering it implies it can.
function FilterBuilder({
  options,
  onAdd,
  onClose,
}: {
  options: { states: string[]; modes: string[] };
  onAdd: (f: StatementFilter) => void;
  onClose: () => void;
}) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  const fields = [
    { id: "amount" as const, label: "Amount" },
    ...(options.states.length > 1 ? [{ id: "state" as const, label: "Status" }] : []),
    ...(options.modes.length > 1 ? [{ id: "mode" as const, label: "Method" }] : []),
  ];
  const [field, setField] = useState<"amount" | "state" | "mode">(fields[0].id);
  const [bound, setBound] = useState<"min" | "max">("min");
  const [raw, setRaw] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  // A pointerdown outside closes it. The toggle is exempt: it would otherwise
  // close here and immediately re-open in its own onClick.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-filter-toggle]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, onClose]);

  const list = field === "state" ? options.states : options.modes;
  const value = picked ?? list[0];
  const amount = parseAmount(raw);
  const ready = field === "amount" ? !!amount && amount.value > 0 : !!value;

  function add() {
    if (field === "amount") {
      if (amount && amount.value > 0) onAdd({ field: bound, value: amount.value });
      return;
    }
    onAdd({ field, value });
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Add a filter"
      tabIndex={-1}
      className="absolute left-0 top-full z-30 mt-1 w-64 rounded-[10px] bg-surface p-3 shadow-(--shadow-pop) animate-rise"
    >
      <select
        value={field}
        onChange={(e) => {
          setField(e.target.value as typeof field);
          setPicked(null);
        }}
        className="w-full rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) focus:outline-none focus:shadow-(--shadow-focus) cursor-pointer"
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      {field === "amount" ? (
        <div className="mt-2 flex gap-1.5">
          <select
            value={bound}
            onChange={(e) => setBound(e.target.value as "min" | "max")}
            className="rounded-md bg-surface px-1.5 py-1.5 text-[12px] text-ink-2 shadow-(--shadow-ctl) focus:outline-none focus:shadow-(--shadow-focus) cursor-pointer"
          >
            <option value="min">at least</option>
            <option value="max">at most</option>
          </select>
          <input
            autoFocus
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ready && add()}
            aria-label="Amount"
            placeholder="50,000 or 1L"
            className="min-w-0 flex-1 rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) placeholder:text-ink-3 focus:outline-none focus:shadow-(--shadow-focus) tnum"
          />
        </div>
      ) : (
        <select
          autoFocus
          value={value}
          onChange={(e) => setPicked(e.target.value)}
          className="mt-2 w-full rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) focus:outline-none focus:shadow-(--shadow-focus) cursor-pointer"
        >
          {list.map((v) => (
            <option key={v} value={v}>
              {field === "state" ? stateLabel(v) : v}
            </option>
          ))}
        </select>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-1 text-[12px] text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
        >
          Cancel
        </button>
        <Button size="sm" disabled={!ready} onClick={add}>
          Add
        </Button>
      </div>
      {field === "amount" && raw.trim().length > 0 && !amount && (
        <p className="mt-1.5 text-[11px] text-neg">Not a number we can read.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FeeDragLine({ batches }: { batches: SettlementBatch[] }) {
  const gross = batches.reduce((s, b) => s + b.gross, 0);
  const received = batches.reduce((s, b) => s + b.received, 0);
  if (gross <= 0) return null;
  const pct = Math.round(((gross - received) / gross) * 100);
  return (
    <p className="w-full border-t border-border pt-2.5 text-[12px] leading-5 text-ink-2">
      Platforms kept <span className="tnum font-semibold text-ink">{formatINR(gross - received)}</span> of{" "}
      {formatINR(gross, { compact: true })} gross this window — an effective {pct}% take.{" "}
      <span className="text-ink-3">Your PNB QR takings carry no fee.</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */

// The trust mechanic: every auto-match cites a deterministic, readable rule.
function RulesPanel({
  rules,
  onClose,
}: {
  rules: Array<{ name: string; count: number; pattern: string; kind: string }>;
  onClose: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="h-full w-full overflow-y-auto bg-surface shadow-(--shadow-pop) animate-rise sm:w-[420px]" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">How your statement was matched</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-3">
              Every match cites one of these.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer">
            <X size={15} />
          </button>
        </div>
        <div>
          {rules.map((r) => (
            <div key={r.name} className="border-b border-border px-5 py-3 last:border-b-0">
              <p className="text-[11.5px] text-ink-3">
                narration contains{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-[10.5px] text-ink-2">{r.pattern}</code>
              </p>
              <p className="mt-1 text-[13px] font-medium text-ink">
                → {r.name} <span className="font-normal text-ink-3">· {r.kind}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-ink-3 tnum">
                {r.count} line{r.count > 1 ? "s" : ""} this window
              </p>
            </div>
          ))}
        </div>
        <p className="px-5 py-4 text-[11.5px] leading-5 text-ink-3">
          Three identical fixes can become a rule.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

// One statement line. Matched is the normal state, so it stays quiet — a
// small gray check and muted context. Only lines that need eyes get color.
function Row({ row, onOpen, href }: { row: StatementRow; onOpen?: () => void; href?: string }) {
  const router = useRouter();
  const { txn, recon } = row;
  const matched = recon.state === "matched";
  // A line that arrived on a rail can open that rail. The settlement sheet
  // wins where there is one — it is the more specific answer to the same
  // question — and the rail page is the fallback.
  const go = onOpen ?? (href ? () => router.push(href) : undefined);
  return (
    <div
      title={txn.narration}
      onClick={go}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_auto_7.5rem]",
        go && "cursor-pointer",
      )}
    >
      {/* a monogram makes the row recognisable before it is read — the name
          is an identity anchor, the method line is the derived fact */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={row.name} size="sm" own={row.kind === "internal"} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-ink">
            {/* Which bank saw it. Absent on our own lines, because saying
                "PNB" on 244 of 248 rows would be noise; present here because
                it is the reason the row behaves differently. */}
            {row.externalBank && (
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.04em] text-ink-3">
                {row.externalBank.split(" ")[0]}
              </span>
            )}
            <span className="truncate">{row.name}</span>
            {matched && recon.to && (
              <span className="hidden shrink-0 text-[12.5px] text-ink-3 sm:inline"> · {recon.to}</span>
            )}
          </p>
          {/* The raw bank string, on the row.
              It lived in a `title=` attribute, which is provenance that does
              not exist: absent on touch, absent in a screenshot forwarded to a
              CA, and nobody hovers a line they already believe. It is wanted at
              exactly the moment the interpretation looks wrong — which is when
              a tooltip is least reachable. In a reconciliation product the ugly
              bank string IS the evidence, so it reads as evidence: mono, muted,
              under the name it produced. */}
          <p className="truncate font-mono text-[10.5px] leading-4 text-ink-3">
            {txn.narration}
          </p>
          {!matched && (
            <div className="mt-0.5 sm:hidden">
              <SettlementBadge recon={recon} />
            </div>
          )}
        </div>
      </div>
      <span className="hidden justify-self-end sm:block" aria-label={matched ? "Matched" : undefined}>
        {matched ? (
          <Check size={13} strokeWidth={2.5} className="text-ink-3/60" />
        ) : (
          <SettlementBadge recon={recon} />
        )}
      </span>
      <Money
        value={txn.direction === "debit" ? -txn.amount : txn.amount}
        size="sm"
        signed={txn.direction === "credit"}
        className="justify-self-end"
      />

      {/* The prompt, on the line that earns it.
          A settlement landing at another bank is the one thing this product can
          see and cannot do anything with: no report can be fetched against an
          account we do not hold, so no gross, no fee, no claim. That asymmetry
          is honest and it is worth naming — but only where the rail is
          identifiable from the narration. "Looks like" because that is what it
          is: a reading of a bank string, not a fact from a platform. */}
      {row.externalBank && row.channelId && (
        <p className="col-span-full mt-1.5 border-l-2 border-l-border-strong pl-2.5 text-[11.5px] leading-5 text-ink-3">
          {`Looks like a ${channelSpec(row.channelId)?.name ?? "marketplace"} settlement. `}
          <Link
            href={`/channels/${row.channelId}`}
            className="font-medium text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Point this payout at your PNB account
          </Link>
          {` to see the fee and check it against the rate card.`}
        </p>
      )}
    </div>
  );
}

function groupByDate(rows: StatementRow[]): Array<[string, StatementRow[]]> {
  const map = new Map<string, StatementRow[]>();
  for (const r of rows) {
    const list = map.get(r.txn.date) ?? [];
    list.push(r);
    map.set(r.txn.date, list);
  }
  return [...map.entries()]; // rows arrive sorted newest-first
}

function dateHeading(iso: string): string {
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso + "T00:00:00").getDay()];
  return `${wd} · ${fmtDate(iso)}`;
}

/* ------------------------------------------------------------------ */

function ShortSettlementCard({ row, onOpen }: { row: StatementRow; onOpen: () => void }) {
  const by = row.recon.state === "short" ? row.recon.by : 0;
  return (
    <div className="rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SettlementBadge recon={row.recon} />
          <p className="mt-2 text-sm font-medium text-ink">
            {row.name} settlement · {fmtDate(row.txn.date)}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Landed {formatINR(row.txn.amount)} against an expected {formatINR(row.txn.amount + by)}
          </p>
        </div>
        <Money value={by} size="lg" tone="neg" />
      </div>
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={onOpen}>
          See the waterfall <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CONNECT_STEPS = [
  "Authorising with the partner portals…",
  "Syncing 13 weeks of orders and settlement reports…",
  "Matching every settlement against your bank credits…",
];

function ConnectModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [step, setStep] = useState(-1); // -1 = intro

  useEffect(() => {
    if (step < 0) return;
    if (step >= CONNECT_STEPS.length) {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1300);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-(--shadow-pop) animate-scale-in sm:rounded-(--radius-card)" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Connect Swiggy &amp; Zomato</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer">
            <X size={15} />
          </button>
        </div>

        {step < 0 ? (
          <>
            <p className="mt-2 text-[13.5px] leading-6 text-ink-2">
              Read-only access to orders and settlement reports. Nothing about your bank
              account is shared.
            </p>
            <div className="mt-4 space-y-2">
              {["Swiggy partner portal", "Zomato partner portal"].map((p) => (
                <div key={p} className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  {p}
                </div>
              ))}
            </div>
            <Button size="lg" full className="mt-5" onClick={() => setStep(0)}>
              Authorise both
            </Button>
            <p className="mt-3 text-center text-[11px] text-ink-3">Demo: the authorisation is simulated.</p>
          </>
        ) : (
          <div className="mt-5 space-y-3.5 pb-2">
            {CONNECT_STEPS.map((label, i) => (
              <div key={label} className={cn("flex items-center gap-3 transition-opacity", i > step && "opacity-30")}>
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", i < step ? "bg-pos-soft text-pos" : "border border-border-strong")}>
                  {i < step ? <Check size={11} strokeWidth={3} /> : i === step ? <span className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-pulse-soft" /> : null}
                </span>
                <p className="text-[13px] text-ink-2">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BatchPanel({
  batch,
  account,
  onClose,
  onDispute,
}: {
  batch: SettlementBatch;
  account: string;
  onClose: () => void;
  onDispute: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const gap = batch.variance;
  const dedTotal = batch.deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="h-full w-full overflow-y-auto bg-surface shadow-(--shadow-pop) animate-rise sm:w-[460px]" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              {batch.channel} settlement · {fmtDate(batch.periodStart)}–{fmtDate(batch.periodEnd)}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-3 tnum">
              Credited {fmtDate(batch.creditDate)} · UTR {batch.ref}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="p-5">
          {/* proportion bar */}
          <div
            className="flex h-2.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Of ${formatINR(batch.gross)} gross, ${formatINR(batch.received)} landed, ${formatINR(dedTotal)} was deducted${gap > 0 ? `, ${formatINR(gap)} is unexplained` : ""}`}
          >
            <div className="bg-pos" style={{ width: `${(batch.received / batch.gross) * 100}%` }} />
            <div className="bg-border-strong" style={{ width: `${((dedTotal - gap) / batch.gross) * 100}%` }} />
            {gap > 0 && <div className="bg-neg" style={{ width: `${(gap / batch.gross) * 100}%` }} />}
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-ink-3">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-pos" /> Landed</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-border-strong" /> Contracted deductions</span>
            {gap > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-neg" /> Above contract</span>}
          </div>

          {/* waterfall rows */}
          <div className="mt-5 space-y-0">
            <WaterfallRow label={`Gross sales · ${batch.channel} order report`} amount={batch.gross} strong />
            {batch.deductions.map((d) => (
              <WaterfallRow key={d.label} label={d.label} amount={-d.amount} muted />
            ))}
            <div className="my-2 border-t border-border" />
            <WaterfallRow label="Should have landed" amount={batch.expectedNet} strong />
            <WaterfallRow label={`Landed in PNB ${account}`} amount={batch.received} pos />
          </div>

          {gap > 0 ? (
            <>
              <div className="mt-4 rounded-[10px] bg-neg-soft px-4 py-3">
                <p className="text-[13px] font-semibold text-neg">
                  {formatINR(gap)} kept above the contracted rate
                </p>
                {/* "Every order is listed below" pointed at the table directly
                    below it. The table is below. */}
                <p className="mt-0.5 text-[12px] leading-5 text-ink-2">
                  {/* The rate card, not a literal. `22% : 24%` by channel NAME was fixed
                      on the dispute pack and missed here — the same invented
                      number, still on screen, one drawer away from the letter
                      that quotes it. */}
                  {`Charged above your contracted ${((contractedTake(channelSpec(batch.channelId)!) || 0) * 100).toFixed(1)}% on ${plural(batch.orders.length, "order")}`}
                </p>
              </div>

              <div className="mt-4 max-h-56 overflow-y-auto rounded-[10px] shadow-(--shadow-ctl)">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-surface-2 text-left text-ink-3">
                    <tr>
                      <th className="px-3 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 text-right font-medium">Item total</th>
                      <th className="px-3 py-2 text-right font-medium">Contracted</th>
                      <th className="px-3 py-2 text-right font-medium">Charged</th>
                      <th className="px-3 py-2 text-right font-medium">Short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.orders.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-3 py-1.5 text-ink tnum">{o.id}</td>
                        <td className="px-3 py-1.5 text-right text-ink-2 tnum">{formatINR(o.itemTotal)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-2 tnum">{formatINR(o.contractedFee)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-2 tnum">{formatINR(o.chargedFee)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-neg tnum">{formatINR(o.short)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button size="lg" full className="mt-5" onClick={onDispute}>
                Open the dispute pack — evidence attached
              </Button>
            </>
          ) : (
            <div className="mt-4 flex items-center gap-2.5 rounded-[10px] bg-pos-soft px-4 py-3">
              <Check size={15} className="text-pos" strokeWidth={2.5} />
              <p className="text-[13px] text-ink">Fully explained — every deduction matches the contract.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaterfallRow({
  label,
  amount,
  strong,
  muted,
  pos,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  muted?: boolean;
  pos?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <p className={cn("text-[12.5px]", strong ? "font-medium text-ink" : muted ? "text-ink-3" : "text-ink-2")}>
        {label}
      </p>
      <p
        className={cn(
          "tnum text-[12.5px]",
          strong && "font-semibold text-ink",
          muted && "text-ink-3",
          pos && "font-semibold text-pos",
        )}
      >
        {amount < 0 ? `−${formatINR(-amount)}` : formatINR(amount)}
      </p>
    </div>
  );
}
