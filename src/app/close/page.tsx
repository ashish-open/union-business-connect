"use client";

// Close — the month-end ritual. A checklist that must reach zero, then a
// button that turns the month into files. Rituals create habit; dashboards
// create bounce.

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Download, FileText, Lock, Receipt } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { buildClose, CloseItem, CLOSE_PERIOD } from "@/lib/close";
import { downloadCsv, statementCsv } from "@/lib/csv";
import { formatINR, plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";

export default function ClosePage() {
  const router = useRouter();
  const entity = useEntity();
  const resolved = useStore((s) => s.resolved);
  const resolveItem = useStore((s) => s.resolveItem);
  const channelsConnected = useStore((s) => s.channelsConnected);
  const lineResolutions = useStore((s) => s.lineResolutions);
  const closedPeriods = useStore((s) => s.closedPeriods);
  const closePeriod = useStore((s) => s.closePeriod);

  const resolutions = useMemo(() => {
    if (!entity) return {};
    const out: Record<string, "accepted" | "rejected"> = {};
    for (const [key, val] of Object.entries(lineResolutions)) {
      const [eid, txnId] = key.split("/");
      if (eid === entity.id) out[txnId] = val;
    }
    return out;
  }, [entity, lineResolutions]);

  const books = useBooks(entity);

  const close = useMemo(
    () =>
      entity
        ? buildClose(entity, {
            connected: !!channelsConnected[entity.id],
            resolutions,
            resolved,
            books,
          })
        : null,
    [entity, channelsConnected, resolutions, resolved, books],
  );

  if (!entity || !close) return <AppShell />;

  const isClosed = !!closedPeriods[`${entity.id}/${close.period}`];
  const openItems = close.items.filter((i) => !i.done);
  const doneItems = close.items.filter((i) => i.done);
  const openCount = openItems.length;
  const firstOpen = openItems[0];

  return (
    <AppShell>
      {/* the title lives in the top bar — this line answers the page instead.
          Once the month is closed the section below says so at full weight,
          so this one steps aside rather than saying it twice. */}
      {!isClosed && (
        <p className="text-[12.5px] text-ink-3">
          {`What must be true before ${close.period} closes.`}
        </p>
      )}

      {/* How far along you are. The goal-gradient effect is the whole reason
          a checklist beats a dashboard — people move faster as the end comes
          into view — and this page used to compute the open count and spend
          it only on a disabled button's subtitle. */}
      {!isClosed && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium text-ink tnum">
              {doneItems.length} of {close.items.length} done
            </span>
            <span className="text-ink-3">
              {openCount === 0 ? "Ready to close" : `${openCount} left`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={doneItems.length}
            aria-valuemin={0}
            aria-valuemax={close.items.length}
            aria-label={`${close.period} close`}
            className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(doneItems.length / close.items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* What is left. Done rows move out from between them, so the remainder
          visibly shrinks as you work — but they collapse rather than vanish,
          because a checklist that silently deletes its own history stops
          being evidence. */}
      <Card pad="none" className="mt-3">
        {(isClosed ? close.items : openItems).map((item) => (
          <ChecklistRow key={item.id} item={item} onAck={(k) => resolveItem(entity.id, k)} />
        ))}
        {!isClosed && openCount === 0 && (
          <p className="px-4 py-3.5 text-[13.5px] text-ink">Everything is explained.</p>
        )}
      </Card>

      {!isClosed && doneItems.length > 0 && (
        <details className="mt-2 group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 text-[12.5px] text-ink-3 transition-colors hover:text-ink-2">
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
            {`${doneItems.length} done`}
          </summary>
          <Card pad="none" className="mt-2">
            {doneItems.map((item) => (
              <ChecklistRow key={item.id} item={item} onAck={(k) => resolveItem(entity.id, k)} />
            ))}
          </Card>
        </details>
      )}

      {/* GST runs on its own clock — due on the 20th, not at close — so it
          gets a door here rather than a checklist row that would block a
          month for a deadline three weeks away */}
      <Link
        href="/compliance"
        className="mt-3 flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink-2"
      >
        <Receipt size={13} className="shrink-0" />
        <span className="min-w-0">
          {`${close.period} GST return · worked out from these lines`}
        </span>
        <ArrowRight size={12} className="ml-auto shrink-0" />
      </Link>

      {/* the close */}
      {!isClosed ? (
        <div className="mt-5">
          <Button
            size="lg"
            disabled={!close.ready}
            onClick={() => closePeriod(entity.id, close.period)}
          >
            {close.ready ? (
              <>Close {close.period}</>
            ) : (
              <>
                <Lock size={14} /> Close {close.period}
              </>
            )}
          </Button>
          <p className="mt-2 text-[11.5px] text-ink-3">
            {close.ready
              ? "Everything is explained — closing generates your files."
              : `Blocked by ${openCount} item${openCount > 1 ? "s" : ""} — starting with “${firstOpen?.label}”.`}
          </p>
        </div>
      ) : (
        <section className="animate-rise">
          {/* The end of the journey, and it used to be three grey cards.
              People judge an experience by its peak and its end, and this is
              both — so the month states what it came to, once, at full
              weight. A number rather than a celebration: it is the only kind
              of delight this product is allowed, and it is also the strongest
              thing we can say. */}
          <p className="text-[19px] font-semibold tracking-tight text-ink">
            {close.period} is closed.
          </p>
          <p className="mt-1 text-[13px] text-ink-2 tnum">
            {`${formatINR(close.moneyIn, { compact: true })} in · ${formatINR(close.moneyOut, { compact: true })} out · ${plural(close.rows.length, "line")}, every one explained.`}
          </p>

          <h2 className="mt-6 text-[13px] font-semibold text-ink">Your files</h2>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <Card className="flex flex-col justify-between gap-3 !p-4">
              <div>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <FileText size={14} className="text-accent" /> Close report · {close.period}
                </p>
                <p className="mt-1 text-[11.5px] leading-4 text-ink-3">
                  Categories, channel take, TDS credits, balance footprint.
                </p>
              </div>
              <Button size="sm" variant="secondary" className="self-start" onClick={() => router.push("/close/report")}>
                Open report
              </Button>
            </Card>
            <Card className="flex flex-col justify-between gap-3 !p-4">
              <div>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <Receipt size={14} className="text-accent" /> GST working · {close.period}
                </p>
                <p className="mt-1 text-[11.5px] leading-4 text-ink-3">
                  What you owe, what you can claim, and the lines behind each.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => router.push("/compliance")}
              >
                Open the return
              </Button>
            </Card>
            <Card className="flex flex-col justify-between gap-3 !p-4">
              <div>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <Download size={14} className="text-accent" /> CA pack · CSV
                </p>
                {/* It said "Tally-ready ledger … imports into Tally". There is
                    no Tally XML writer in this tree — the button emits
                    `statementCsv`. A CA tries the import once, it fails, and the
                    referral motion that claim was supposed to start dies with
                    it. Say what the file is until the writer exists. */}
                <p className="mt-1 text-[11.5px] leading-4 text-ink-3">
                  Counterparty, category, reference and status — one row per line.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => downloadLedger(entity.id, close.rows)}
              >
                Download CSV
              </Button>
            </Card>
          </div>
          <p className="mt-3 text-[11.5px] text-ink-3">
            Every number traces to a bank line.
          </p>
        </section>
      )}
    </AppShell>
  );
}

function ChecklistRow({ item, onAck }: { item: CloseItem; onAck: (key: string) => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          item.done ? "bg-pos-soft text-pos" : "border border-border-strong",
        )}
      >
        {item.done && <Check size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px] text-ink", !item.done && "font-medium")}>{item.label}</p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">{item.detail}</p>
        {/* A tax position is not something this product can clear for you, so
            the escape hatch sits below the happy path rather than beside it. */}
        {item.ack && (
          <button
            onClick={() => onAck(item.ack!)}
            className="mt-1.5 text-[11.5px] text-ink-3 underline underline-offset-2 transition-colors hover:text-ink-2 cursor-pointer"
          >
            I&apos;m handling this outside
          </button>
        )}
      </div>
      {!item.done && item.href && (
        <Link href={item.href}>
          <Button size="sm" variant="secondary">
            {item.verb} <ArrowRight size={12} />
          </Button>
        </Link>
      )}
    </div>
  );
}

function downloadLedger(entityId: string, rows: Parameters<typeof statementCsv>[0]) {
  downloadCsv(
    `${entityId}-${CLOSE_PERIOD.toLowerCase().replace(" ", "-")}-ledger.csv`,
    statementCsv(rows),
  );
}
