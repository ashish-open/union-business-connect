"use client";

// Today — the daily 30-second beat. Three answers, one screen:
//   what do I have (balance) · what's wrong (Needs you, actionable inline)
//   · what's coming (settlements + obligations, detected from their rhythm).
// Every number is computed from the seed transactions and payment activity.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookCheck,
  Check,
  Landmark,
  ListChecks,
  Plug,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Tone } from "@/lib/analysis";
import { payable } from "@/lib/balance";
import { VoiceDraftPanel } from "@/components/today/VoiceDraftPanel";
import { draftToQueueItem, useVoiceDrafts } from "@/lib/voice/queue";
import { executedLine, toInvoice, toPayee } from "@/lib/voice/execute";
import type { Draft } from "@/lib/voice/store";
import {
  buildQueue,
  buildUpcoming,
  relativeLabel,
  upcomingNet,
  QueueItem,
  UpcomingItem,
} from "@/lib/today";
import { exposures } from "@/lib/statutory";
import { ExposureList } from "@/components/books/ExposureList";
import { buildRera, detectRera } from "@/lib/rera";
import { buildStatement } from "@/lib/statement";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateFull, formatINR, maskAccount } from "@/lib/format";
import { ANCHOR_DATE } from "@/data/seed";
import { useBooks } from "@/lib/useBooks";
import { channelView } from "@/lib/channelNav";
import { ConnectPrompt } from "@/components/channels/ConnectPrompt";
import { useCustomer, useEntity, useStore } from "@/store/useStore";

const TONE_DOT: Record<Tone, string> = {
  info: "bg-info",
  warn: "bg-warn",
  neg: "bg-neg",
  pos: "bg-pos",
};

/** Dismissal keyed like any other resolved item, so it persists. */
const PROMPT_KEY = "connect-channels-prompt";

export default function TodayPage() {
  const router = useRouter();
  const customer = useCustomer();
  const entity = useEntity();
  const resolved = useStore((s) => s.resolved);
  const channelSources = useStore((s) => s.channelSources);
  const resolveItem = useStore((s) => s.resolveItem);
  const channelsConnected = useStore((s) => s.channelsConnected);

  // Statutory exposure is not a queue item — the bell counts things waiting on
  // a decision, and this is money already leaking. It sits above the queue
  // because it is the more expensive news.
  const books = useBooks(entity);
  const exposed = useMemo(
    () => (entity && books ? exposures(entity, books) : []),
    [entity, books],
  );

  /* The rails whose reports we do not hold. Same `channelView` the channels
     pages use, so the prompt cannot name a platform the rail page would
     disagree about.

     It used to compute the shortfall too, and the prompt printed it — the same
     figure the queue item below already reports. The queue owns that number. */
  const unconnected = useMemo(() => {
    if (!entity) return [];
    const { rails } = channelView(entity, channelSources, !!channelsConnected[entity.id]);
    return rails.filter((r) => !r.connected && r.spec.verifiable === "report");
  }, [entity, channelSources, channelsConnected]);

  const promptGone = !!entity && !!resolved[`${entity.id}/${PROMPT_KEY}`];

  // Voice requests join the same queue rather than getting their own screen or
  // nav item. NeedsYouBell reads the same buildQueue, so the count in the shell
  // and the list here still cannot disagree.
  const voice = useVoiceDrafts(entity?.id);
  /*
   * Requests this browser has just finished, by queue id.
   *
   * The list itself only refreshes on the 20s poll, so approving something
   * would leave the "N open" count stale for up to twenty seconds — on the very
   * screen that just told you it acted. The row reports upward the moment the
   * execute returns; the poll catches up later.
   */
  const [justDone, setJustDone] = useState<Record<string, true>>({});

  /*
   * What still needs a person, plus whatever this session just did.
   *
   * The filter used to be `state !== "rejected"`, which reads as "hide what was
   * cancelled" and means "show every request this business has ever made". That
   * is invisible in dev, where the draft store is a Map in one process and
   * starts empty — but in production the drafts live in Upstash and are never
   * deleted, so a queue built that way only ever grows. It is why Today showed
   * eight rows, six of them finished weeks ago with no way to clear them, while
   * the bell — which has always counted `collecting`/`ready` only — said three.
   *
   * `justDone` is the deliberate exception: an executed draft stays on screen
   * for the session that executed it, so the green "it's in Sales" line is
   * still the reward for approving it. Next session it is simply history, and
   * history belongs in Sales, not in a list called Needs you.
   */
  const voiceItems = useMemo(
    () =>
      voice.drafts
        .filter(
          (d) =>
            d.state === "collecting" || d.state === "ready" || justDone[`voice-${d.ref}`],
        )
        .map(draftToQueueItem)
        .filter((i) => !entity || !resolved[`${entity.id}/${i.id}`]),
    [voice.drafts, resolved, entity, justDone],
  );

  const queue = useMemo(
    () => (entity ? buildQueue(entity, !!channelsConnected[entity.id], voiceItems) : []),
    [entity, channelsConnected, voiceItems],
  );
  const upcoming = useMemo(() => (entity ? buildUpcoming(entity) : []), [entity]);
  const recent = useMemo(
    () =>
      entity
        ? buildStatement(entity, {
            connected: !!channelsConnected[entity.id],
            resolutions: {},
            days: 30,
          }).rows.slice(0, 6)
        : [],
    [entity, channelsConnected],
  );
  const caSigned = useStore((s) => (entity ? !!s.reraCaSigned[entity.id] : false));
  const sessionWithdrawn = useStore((s) => (entity ? (s.reraWithdrawn[entity.id] ?? 0) : 0));
  const rera = useMemo(
    () =>
      entity && detectRera(entity) ? buildRera(entity, { caSigned, sessionWithdrawn }) : null,
    [entity, caSigned, sessionWithdrawn],
  );

  if (!entity) return <AppShell />;

  /* A request executed this session is done even though nobody pressed its
     action here — otherwise the count treats the thing it just created as
     still waiting on you. */
  const isDone = (item: QueueItem) =>
    !!resolved[`${entity.id}/${item.id}`] || !!justDone[item.id];
  const openCount = queue.filter((i) => !isDone(i)).length;
  const total = entity.accounts.reduce((s, a) => s + a.balance, 0);
  const pay = payable(entity);
  const payableCount = entity.accounts.filter((a) => !a.readOnly).length;

  // Actions before data. The verbs a person actually arrives wanting are
  // one click from the landing page, not three — and the row is derived
  // from this entity's own state, so nothing offered here can fail.
  const verbs: Array<{ label: string; icon: typeof Check; href: string }> = [
    { label: "Pay someone", icon: ArrowUpRight, href: "/payouts" },
  ];
  if (entity.invoices.some((i) => i.received < i.total))
    verbs.push({ label: "Chase a payment", icon: ArrowDownLeft, href: "/collections" });
  // Derived from the rails this business actually has, not a narration regex
  // that only knew two aggregators — and it goes to /channels, not the connect
  // modal the statement used to own.
  //
  // It appears only once the strip below has been dismissed. Both offer the same
  // thing, and the strip does it better: it names the platform and the amount.
  // Keeping the chip means the way in survives the dismissal without the screen
  // asking twice.
  if (unconnected.length > 0 && promptGone)
    verbs.push({ label: "Connect channels", icon: Plug, href: "/channels" });
  if (rera) verbs.push({ label: "Withdraw from project", icon: Landmark, href: "/project" });
  verbs.push({ label: "Close the month", icon: BookCheck, href: "/close" });

  return (
    <AppShell>
      <p className="text-xs text-ink-3">{fmtDateFull(ANCHOR_DATE)}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink">
        Good morning, {customer?.firstName ?? ""}
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {verbs.map((v) => (
          <button
            key={v.label}
            onClick={() => router.push(v.href)}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 shadow-(--shadow-ctl) transition-shadow hover:shadow-(--shadow-ctl-hover) hover:text-ink cursor-pointer"
          >
            <v.icon size={14} className="text-ink-3" />
            {v.label}
          </button>
        ))}
      </div>

      {/* The verification code used to sit here, above everything, on the
          reasoning that a caller mid-call needs it more than anything else on
          the page. That was right about the moment and wrong about the other
          twenty-three hours: the card is the first thing on Today whether or not
          a call is happening, and it asks to be read aloud, which is the one
          habit this product should not be teaching.

          It belongs next to the agent — surfaced when someone reaches for
          Simran, not standing on the home screen waiting. VoiceCodeCard is kept
          intact for that; only this call site is gone. */}

      {/* project mode — derived from the designated account, never asked */}
      {rera && (
        <button
          onClick={() => router.push("/project")}
          className="mt-5 flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-(--radius-card) bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-pop) cursor-pointer"
        >
          {/* a classification, not a lifecycle state — outlined */}
          <Badge tone="gold" variant="outline">
            RERA project
          </Badge>
          <span className="text-sm font-medium text-ink">{rera.project.name}</span>
          <span className="text-[12.5px] text-ink-2">
            {rera.project.progressPct}% certified · you can withdraw{" "}
            <span className="tnum font-semibold text-ink">
              {formatINR(rera.eligibleToday, { compact: true })}
            </span>{" "}
            today
          </span>
          <span className="ml-auto text-[12.5px] font-medium text-accent">Open the project →</span>
        </button>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Needs you */}
        <section className="order-2 min-w-0 lg:order-1">
          {/* Above the queue because it is not part of it: the queue is
              decisions only this person can make, and connecting a rail is an
              unlock that changes what every other number on the page knows. */}
          {!promptGone && unconnected.length > 0 && (
            <div className="mb-4">
              <ConnectPrompt
                rails={unconnected}
                onDismiss={() => resolveItem(entity.id, PROMPT_KEY)}
              />
            </div>
          )}
          <h2 className="text-[13px] font-semibold text-ink">
            Needs you
            {queue.length > 0 && (
              <span className="font-normal text-ink-3">
                {" "}
                · {openCount > 0 ? `${openCount} open` : "all done"}
              </span>
            )}
          </h2>
          <Card pad="none" className="mt-2.5">
            {queue.length === 0 && (
              // An explanatory empty state, not a promotional one: nothing is
              // required of the user, so it gets an icon tile, a noun-negation
              // title and one line saying what the absence means — never a CTA.
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
                  <ListChecks size={20} />
                </span>
                <p className="mt-3 text-[15px] font-semibold text-ink">Nothing needs you</p>
                <p className="mt-1 max-w-xs text-[12.5px] leading-5 text-ink-3">
                  Everything is explained. Anything needing a decision lands here.
                </p>
              </div>
            )}
            {queue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                done={isDone(item)}
                draft={
                  item.draftRef ? voice.drafts.find((d) => d.ref === item.draftRef) : undefined
                }
                entityId={entity.id}
                onResolve={() =>
                  item.href ? router.push(item.href) : resolveItem(entity.id, item.id)
                }
                onDismiss={() => resolveItem(entity.id, item.id)}
                onExecuted={() => setJustDone((d) => ({ ...d, [item.id]: true }))}
              />
            ))}
          </Card>

          {/* A failed poll must never render as "nothing needs you" — someone who
              just spoke an invoice would conclude nothing is waiting, which is
              exactly the trust failure this surface exists to prevent. */}
          {!voice.ok && (
            <p className="mt-2 px-1 text-[11.5px] text-warn">
              Couldn’t check for new requests from your calls just now — this list may be
              incomplete.
            </p>
          )}

          {/* An empty queue must not leave half the page dead: fall back to
              what actually happened, so the beat still answers "what moved". */}
          {queue.length === 0 && recent.length > 0 && (
            <div className="mt-5">
              <h2 className="text-[13px] font-semibold text-ink">Recently on your account</h2>
              <Card pad="none" className="mt-2.5">
                {recent.map((r) => (
                  <div
                    key={r.txn.id}
                    className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    <Avatar name={r.name} size="sm" own={r.kind === "internal"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">{r.name}</p>
                      <p className="text-[11px] text-ink-3">{fmtDate(r.txn.date)}</p>
                    </div>
                    <Money
                      value={r.txn.direction === "debit" ? -r.txn.amount : r.txn.amount}
                      size="sm"
                      signed={r.txn.direction === "credit"}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </Card>
              <button
                onClick={() => router.push("/statement")}
                className="mt-2 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
              >
                See the full statement →
              </button>
            </div>
          )}
          {/* Below the queue, not above it.
              Both are work, but they answer different questions: the queue is
              what today is for, and the close list is what this month still
              owes. Sitting first, the close list pushed four decisions with
              names and amounts under the fold behind one line about TDS — a
              deadline outranking the work is only true in the last week of the
              month, and this page is opened on all the other days too. */}
          {exposed.length > 0 && (
            <div className="mt-5">
              <ExposureList exposed={exposed} onOpen={(x) => router.push(x.href)} />
            </div>
          )}
        </section>

        {/* Balance + Coming up */}
        <aside className="order-1 space-y-5 lg:order-2">
          <Card>
            {/* One account: the label names it, because "Across 1 account
                ₹18,42,600" over a row reading "Union Bank of India ••7734
                ₹18,42,600" is the same figure twice and a list of one. */}
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {entity.accounts.length === 1
                ? `${entity.accounts[0].bank} ${maskAccount(entity.accounts[0].masked)}`
                : `Across ${entity.accounts.length} accounts`}
            </p>
            <Money value={total} size="xl" className="mt-2 block" />
            {/* The total is right and, alone, overstates capacity: part of it can
                sit where we can see it and cannot move it.

                But this line only earns its place when the payable figure is not
                already on the screen. With one payable account it IS the row
                below — Nadi Foods showed ₹6,84,510 twice, six lines apart, which
                is the very thing this pass is about. Two or more, and the sum is
                genuinely nowhere else.

                Honest caveat: no seed persona has 2+ payable accounts AND a
                read-only one, so this branch is reasoned, not seen. It guards a
                real shape — two current accounts plus an AA-linked one — and the
                copy probe models the same condition. */}
            {pay !== null && pay !== total && payableCount > 1 && (
              <p className="mt-1 text-[11.5px] text-ink-3">
                {`${formatINR(pay)} available to pay`}
              </p>
            )}
            {entity.accounts.length > 1 && (
            <div className="mt-3.5 divide-y divide-border border-t border-border">
              {entity.accounts.map((a) => (
                <div key={a.masked} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[12.5px] text-ink">
                      {a.bank} <span className="tnum text-ink-3">{maskAccount(a.masked)}</span>
                    </p>
                    {a.readOnly && <Badge>Read-only</Badge>}
                  </div>
                  <Money value={a.balance} size="sm" />
                </div>
              ))}
            </div>
            )}
            {/* A read-only sole account still has to say so — it is the whole
                reason the sweep offer exists on the balance screen. */}
            {entity.accounts.length === 1 && entity.accounts[0].readOnly && (
              <div className="mt-2">
                <Badge>Read-only</Badge>
              </div>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card pad="none">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-[13px] font-semibold text-ink">Coming up</h2>
                {/* This said "Detected from your own payment rhythm" — how the
                    feature works, which is our business, not theirs. What they
                    need is that these are guesses, so nobody reads ₹4.2L of
                    salaries as already queued. */}
                <p className="mt-0.5 text-[11px] text-ink-3">Predicted, not scheduled</p>
              </div>
              {upcoming.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink">{u.label}</p>
                    <p className="text-[11px] text-ink-3">{relativeLabel(u.date)}</p>
                  </div>
                  {/* money is never coloured — the sign carries direction */}
                  <p className="tnum shrink-0 text-[13px] font-medium text-ink">
                    {u.approx ? "≈ " : ""}
                    {u.direction === "in" ? "+" : "−"}
                    {formatINR(u.amount, { compact: true })}
                  </p>
                </div>
              ))}
              {/* The total the card was asking you to work out yourself. It sums
                  the rows above rather than the entity, so it cannot disagree
                  with them, and it inherits their ≈ because they are guesses. */}
              <UpcomingFooter items={upcoming} payable={pay} />
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

/**
 * Net of what is listed, and whether the money on hand covers it.
 *
 * The coverage line appears only when there is something to cover — net positive
 * means nothing is at stake, and "covered" beside an inflow is reassurance about
 * a question nobody asked. Where every account is read-only there is no payable
 * balance, so it makes no claim at all rather than a false one.
 */
function UpcomingFooter({ items, payable }: { items: UpcomingItem[]; payable: number | null }) {
  const { net } = upcomingNet(items);
  const short = payable !== null && net < 0 ? payable + net : null;

  return (
    <div className="border-t border-border px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] text-ink-3">{`Net of these ${items.length}`}</p>
        <p className="tnum shrink-0 text-[13px] font-medium text-ink">
          {`≈ ${net < 0 ? "−" : "+"}${formatINR(Math.abs(net), { compact: true })}`}
        </p>
      </div>
      {/* States what is LEFT, not what is available — that figure is already in
          the card above, and "Covered by ₹6.8L available" printed it a second
          time in compact form. Same number twice is the thing this pass is for. */}
      {short !== null && (
        <p className={cn("mt-1 text-[11.5px]", short < 0 ? "text-neg" : "text-ink-3")}>
          {short < 0
            ? `≈ ${formatINR(-short, { compact: true })} short`
            : `≈ ${formatINR(short, { compact: true })} left after these`}
        </p>
      )}
    </div>
  );
}

function QueueRow({
  item,
  done,
  onResolve,
  draft,
  entityId,
  onDismiss,
  onExecuted,
}: {
  item: QueueItem;
  done: boolean;
  onResolve: () => void;
  draft?: Draft;
  entityId?: string;
  /** Voice rows only: take this request off the list. */
  onDismiss?: () => void;
  /** Voice rows only: it became a record, so stop counting it as open. */
  onExecuted?: () => void;
}) {
  // Voice rows expand in place rather than navigating. The fields have to be
  // editable before anything is created, and losing your position in the queue to
  // read four fields is a bad trade.
  if (draft && entityId) {
    return (
      <VoiceRow
        item={item}
        draft={draft}
        entityId={entityId}
        onDismiss={onDismiss ?? (() => {})}
        onExecuted={onExecuted ?? (() => {})}
      />
    );
  }
  return (
    <div
      className={cn(
        "border-b border-border px-4 py-3 transition-opacity duration-300 last:border-b-0",
        done && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-5 text-ink">
            <Money
              value={item.amount}
              size="sm"
              className="mr-1 font-semibold"
              compact={item.amount >= 10_00_000}
            />
            {item.title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{item.sub}</p>
          {done && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-pos">
              <Check size={12} strokeWidth={2.5} />
              {item.done}
            </p>
          )}
        </div>
        {!done && (
          <span className="hidden shrink-0 sm:block">
            <Button size="sm" variant="secondary" onClick={onResolve}>
              {item.action}
            </Button>
          </span>
        )}
      </div>
      {!done && (
        <div className="mt-2.5 pl-[18px] sm:hidden">
          <Button size="sm" variant="secondary" onClick={onResolve}>
            {item.action}
          </Button>
        </div>
      )}
    </div>
  );
}

/*
 * A voice request in the queue: collapsed summary, expandable body.
 *
 * Execute deliberately goes through the SAME store mutations the manual forms
 * use — `saveDoc` for an invoice, `addPayee` for a beneficiary. There is no
 * create endpoint on the voice surface at all, so a spoken invoice and a typed
 * one are the same object and nothing downstream has to know which it was.
 */
function VoiceRow({
  item,
  draft,
  entityId,
  onDismiss,
  onExecuted,
}: {
  item: QueueItem;
  draft: Draft;
  entityId: string;
  onDismiss: () => void;
  onExecuted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(draft);
  const saveDoc = useStore((s) => s.saveDoc);
  const addPayee = useStore((s) => s.addPayee);
  // The same hook the page uses, so the invoice number continues the entity's
  // own sequence rather than starting a parallel one.
  const entity = useEntity();

  const call = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/voice/drafts/${draft.ref}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; draft?: Draft };
      if (json.ok && json.draft) setLocal(json.draft);
      return json;
    },
    [draft.ref],
  );

  const isExecuted = local.state === "executed";

  const onExecute = async () => {
    setBusy(true);
    try {
      // Server first. It owns the "already executed" check, so a double click
      // is refused there rather than creating a second record here.
      const marked = await call({ op: "execute", executedAs: "pending" });
      if (!marked.ok) return;

      if (local.kind === "invoice" && entity) {
        const doc = toInvoice(local.values, {
          issueDate: ANCHOR_DATE,
          existingCount: entity.invoices.length,
        });
        saveDoc(entityId, doc);
        setLocal((d) => ({ ...d, executedAs: doc.number }));
      } else if (local.kind === "beneficiary") {
        const payee = toPayee(local.values);
        addPayee(entityId, payee);
        setLocal((d) => ({ ...d, executedAs: payee.name }));
      }
      onExecuted();
    } finally {
      setBusy(false);
    }
  };

  /*
   * Cancel, and it means two different things.
   *
   * Executed: the request is finished and its record is in Sales — clearing the
   * row throws nothing away, so it goes quietly.
   * Still pending: this is a real cancellation, so the draft is rejected on the
   * server too. Dismissing it locally alone would bring it back on the next
   * 20-second poll, which is worse than having no button at all.
   */
  const dismiss = async () => {
    if (!isExecuted) await call({ op: "reject" });
    onDismiss();
  };

  return (
    <div
      className={cn(
        "border-b border-border px-4 py-3 last:border-b-0",
        isExecuted && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-5 text-ink">
            {item.amount > 0 && (
              <Money value={item.amount} size="sm" className="mr-1 font-semibold" />
            )}
            {item.title}
          </p>
          {isExecuted ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-pos">
              <Check size={12} strokeWidth={2.5} />
              {executedLine(local.kind, local.executedAs ?? "record")}
            </p>
          ) : (
            <p className="mt-0.5 text-[11.5px] text-ink-3">{item.sub}</p>
          )}

          {open && !isExecuted && (
            <VoiceDraftPanel
              draft={local}
              busy={busy}
              onEdit={(key, value) => void call({ op: "edit", key, value })}
              onExecute={() => void onExecute()}
              onDiscard={() => void call({ op: "reject" })}
            />
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {!isExecuted && (
            <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? "Close" : "Review"}
            </Button>
          )}
          {/* On the row, not only inside the expanded panel. A finished request
              had no control at all and simply accumulated; a pending one hid
              its Discard behind Review, so cancelling something you never
              wanted meant first opening it. */}
          <button
            onClick={() => void dismiss()}
            disabled={busy}
            aria-label={isExecuted ? "Dismiss this request" : "Cancel this request"}
            title={isExecuted ? "Dismiss" : "Cancel this request"}
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 cursor-pointer"
          >
            <X size={14} />
          </button>
        </span>
      </div>
    </div>
  );
}
