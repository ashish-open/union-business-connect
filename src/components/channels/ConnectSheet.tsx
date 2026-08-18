"use client";

// Three ways to get a platform's reports, and the honest cost of each.
//
// The choice is a real one — they differ in effort, in freshness, and in what
// the owner has to hand over — so the sheet states all three rather than
// picking for them. Recommended first (Hick's law #3), never more than three
// (Miller), each with its consequence beneath it (law E1).
//
// The agent route is the one worth reading twice: a browser agent runs on the
// OWNER'S OWN MACHINE and drives the portal with the session they are already
// signed into. No password is typed into our product and none is stored. That
// is the only shape in which a bank could ship "we log into your Amazon
// account", and it is why it is offered at all.

import { useState } from "react";
import { Check, Download, KeyRound, MonitorDown, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { Input } from "@/components/ui/Input";
import { useDismissable } from "@/lib/useDismissable";
import { checksUnlockedBy } from "@/lib/leaks";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ANCHOR_DATE } from "@/data/seed";
import type { ChannelSpec, ConnectMethod } from "@/lib/channels";
import type { ChannelSource } from "@/store/useStore";

const METHOD: Record<
  ConnectMethod,
  { label: string; sub: string; icon: typeof Upload; effort: string }
> = {
  upload: {
    label: "Upload the reports",
    sub: "Export from the portal, drop them here",
    icon: Upload,
    effort: "2 minutes · goes stale",
  },
  agent: {
    label: "Let a browser agent fetch them",
    sub: "Signed in as you, on your machine",
    icon: MonitorDown,
    effort: "One install · refreshes daily",
  },
  api: {
    label: "Connect the API",
    sub: "The platform sends the reports directly",
    icon: KeyRound,
    effort: "Needs keys · always current",
  },
};

/** Which of the two reports each route can actually bring. */
const BRINGS: Record<ConnectMethod, { settlement: boolean; orders: boolean }> = {
  // Whatever they drop in — both slots are offered.
  upload: { settlement: true, orders: true },
  // The agent can reach every page the owner can, so it gets both.
  agent: { settlement: true, orders: true },
  // A settlement API returns settlements. The order book lives in the seller's
  // own system, which is not on the other end of this key.
  api: { settlement: true, orders: false },
};

type Stage = "choose" | "upload" | "agent" | "api" | "working" | "done";

export function ConnectSheet({
  spec,
  unverified = 0,
  suspicion = 0,
  onClose,
  onConnected,
}: {
  spec: ChannelSpec;
  /** Estimated from the rate card — what this rail kept, unchecked. */
  unverified?: number;
  /** Visible from the bank alone: settlements below this rail's own history. */
  suspicion?: number;
  onClose: () => void;
  onConnected: (source: ChannelSource) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [stage, setStage] = useState<Stage>("choose");
  const [method, setMethod] = useState<ConnectMethod>(spec.methods[0]);
  const [files, setFiles] = useState({ settlement: false, orders: false });
  const [key, setKey] = useState("");

  function finish(m: ConnectMethod, brings: { settlement: boolean; orders: boolean }) {
    setStage("working");
    setTimeout(() => {
      setStage("done");
      setTimeout(
        () => onConnected({ method: m, ...brings, since: ANCHOR_DATE, lastRun: ANCHOR_DATE }),
        900,
      );
    }, 1500);
  }

  // What committing means on each route, and why it is refused when it is.
  // Disabled with the label it will carry when enabled (D5) — a button that
  // renames itself to "Add a file" tells you the state but not the outcome.
  const advance: { label: string; onClick: () => void; disabled?: boolean; hint?: string } | null =
    stage === "upload"
      ? {
          label: files.settlement && files.orders ? "Reconcile both" : "Reconcile",
          disabled: !files.settlement && !files.orders,
          onClick: () => finish("upload", files),
          hint:
            !files.settlement && !files.orders ? "Pick at least one of the two reports." : undefined,
        }
      : stage === "agent"
        ? { label: "Run it now", onClick: () => finish("agent", BRINGS.agent) }
        : stage === "api"
          ? {
              label: "Connect",
              disabled: key.trim().length < 8,
              onClick: () => finish("api", BRINGS.api),
              hint: key.trim().length < 8 ? "Paste the read-only key to continue." : undefined,
            }
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div
        ref={dismissRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[16px] bg-surface shadow-(--shadow-pop) animate-rise sm:rounded-[14px]"
      >
        {/* Header, scroll body, footer (E8). The commit used to live at the
            bottom of the scroll: on a phone the agent stage is an install box,
            three steps and a consent paragraph, so "Run it now" was below the
            fold of a sheet that already ended. */}
        <div className="px-5 pb-3 pt-5">
          <p className="text-[15px] font-semibold text-ink">{`Connect ${spec.name}`}</p>
          {/* What this is worth, at the moment it is being decided.
              The sheet described the two reports and never said what either one
              buys — a form asking for work with the payoff left to inference.
              The figure is the rate card applied to the credits, so it says
              "about"; where the bank can already see a dip, that is the
              stronger fact and it leads. */}
          <p className="mt-1 text-[12.5px] text-ink-3">
            {stage !== "choose"
              ? spec.reportSource
              : suspicion > 0
                ? `${formatINR(suspicion)} already looks light`
                : unverified > 0
                  ? `About ${formatINR(unverified, { compact: true })} kept, never checked`
                  : "What they say they paid you, and what you sold"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {stage === "choose" && (
            <div className="space-y-2">
              {spec.methods.map((m, i) => {
                const info = METHOD[m];
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m);
                      setStage(m);
                    }}
                    className="flex w-full items-start gap-3 rounded-[10px] p-3 text-left shadow-(--shadow-ctl) transition-shadow hover:shadow-(--shadow-ctl-hover) cursor-pointer"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                      <info.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                        {info.label}
                        {i === 0 && <Badge variant="outline">Recommended</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-4 text-ink-3">
                        {info.sub}
                      </span>
                      <span className="mt-1 block text-[11px] text-ink-3">{info.effort}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {stage === "upload" && (
            <>
              <div className="space-y-2">
                {/* Each slot names the checks it switches on, read from the
                    leak table itself — so the sheet cannot promise a check the
                    engine does not run, and a fourth leak kind updates this
                    copy by construction. */}
                <Slot
                  label="Settlement report"
                  hint="What they paid you, and every fee taken"
                  turnsOn={checksUnlockedBy("settlement")}
                  on={files.settlement}
                  onPick={() => setFiles((f) => ({ ...f, settlement: true }))}
                />
                <Slot
                  label="Order report"
                  hint="What you sold, in your own words"
                  turnsOn={checksUnlockedBy("orders")}
                  on={files.orders}
                  onPick={() => setFiles((f) => ({ ...f, orders: true }))}
                />
              </div>
              <p className="mt-3 text-[11.5px] leading-4 text-ink-3">
                {`CSV or Excel from ${spec.reportSource} · either one alone helps`}
              </p>
            </>
          )}

          {stage === "agent" && (
            <>
              <div className="rounded-[10px] bg-surface-2 p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  One-time install
                </p>
                <code className="mt-1.5 block text-[12px] text-ink tnum">
                  npm i -g agent-browser
                </code>
              </div>
              <ol className="mt-3 space-y-2">
                {[
                  `It opens ${spec.portalUrl} in your own browser`,
                  "You sign in exactly as you normally would",
                  "It downloads both reports",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-[12.5px] leading-5 text-ink-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-3 tnum">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              {/* The consent line, and the reason a bank can offer this at all.
                The only long sentence left in this sheet, deliberately: it is a
                privacy disclosure read once, at the moment access is handed
                over, which is exactly where law G2 stops applying. The method
                row above used to repeat its first clause — that was the
                duplication, not the paragraph. */}
              <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-5 text-ink-3">
                The agent runs on your machine, not ours. Your password is never typed into Business
                Connect and never leaves your computer.
              </p>
            </>
          )}

          {stage === "api" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  {spec.apiName ?? "API key"}
                </span>
                <Input
                  autoFocus
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste the key from the seller dashboard"
                />
              </label>
              <p className="mt-2 text-[11.5px] leading-5 text-ink-3">
                Read-only scope is enough. It cannot move money, change prices or touch your listings.
              </p>
              <p className="mt-2 text-[11.5px] leading-5 text-ink-3">
                {`Settlements only · ${spec.name} orders still need the report or the agent`}
              </p>
            </>
          )}

          {stage === "working" && (
            <div className="py-10 text-center">
              <p className="text-[13px] text-ink-2 animate-pulse-soft">
                {method === "agent"
                  ? `Signing in to ${spec.portalUrl} and pulling the reports…`
                  : method === "api"
                    ? "Authorising and fetching the last 90 days…"
                    : "Reading the files and matching them to your bank credits…"}
              </p>
            </div>
          )}

          {stage === "done" && (
            <div className="py-8 text-center animate-rise">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-pos-soft text-pos">
                <Check size={20} strokeWidth={2.5} />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-ink">{`${spec.name} connected`}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">Working out what they kept…</p>
            </div>
          )}

        </div>

        {/* On the choose stage the three methods ARE the advance, so there is
            nothing to pin but the way out. */}
        {stage === "choose" && (
          <div className="border-t border-border py-2.5 text-center">
            <button
              onClick={onClose}
              className="px-2 text-[12px] text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
            >
              Not now
            </button>
          </div>
        )}

        {advance && (
          <SheetFooter
            retreat={{ label: "Another way", onClick: () => setStage("choose") }}
            advance={advance}
            hint={advance.hint}
          />
        )}
      </div>
    </div>
  );
}

function Slot({
  label,
  hint,
  turnsOn,
  on,
  onPick,
}: {
  label: string;
  hint: string;
  /** The checks this report switches on, in the engine's own words. */
  turnsOn: string[];
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[10px] border border-dashed p-3 text-left transition-colors cursor-pointer",
        on ? "border-pos bg-pos-soft/40" : "border-border-strong hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          on ? "bg-pos-soft text-pos" : "bg-surface-2 text-ink-3",
        )}
      >
        {on ? <Check size={15} strokeWidth={2.5} /> : <Download size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-ink-3">
          {on ? "Added" : hint}
        </span>
        {!on &&
          turnsOn.map((c) => (
            <span key={c} className="mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-ink-2">
              <Check size={11} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink-3" />
              {c}
            </span>
          ))}
      </span>
    </button>
  );
}
