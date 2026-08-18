/*
 * The draft store — the one piece of shared state the whole design needs.
 *
 * A draft is spoken on a phone and approved in a browser. Reads are genuinely
 * stateless, but that hand-off is not: a Sarvam tool call hits a stateless
 * function and Zustand lives in one browser tab, so something has to sit between
 * them. This module is that something, and it is the only place in the voice
 * surface that writes.
 *
 * Default is an in-process Map. Honest about what that means:
 *   - `next dev` is a single process, so a laptop demo is completely reliable.
 *   - On Vercel, concurrent requests may land on different instances, so a draft
 *     created by a tool call is *usually* but not always visible to the browser.
 *
 * The fix is ten lines of Upstash behind the same four functions — see
 * 05_VOICE_AGENT_PLAN.md §4. Deliberately isolated so that swap touches nothing
 * else. This is also the first thing to replace if this stops being a prototype.
 */

import { createHash } from "node:crypto";
import { kvGet, kvSet } from "./kv";
import type { DraftKind, SlotValue } from "./slots";
import { executable } from "./slots";

export type DraftState = "collecting" | "ready" | "executed" | "rejected";

export interface Draft {
  /** Short, speakable reference. Simran reads it out; the caller can quote it. */
  ref: string;
  kind: DraftKind;
  entityId: string;
  /** Who asked for it, for the approval screen's provenance line. */
  requestedBy: string;
  callId: string;
  values: SlotValue[];
  state: DraftState;
  createdAt: string;
  decidedAt?: string;
  /** What the caller actually said, kept as the evidence line. */
  transcriptExcerpt?: string;
  /** Set when executing produced a record, so the screen can link to it. */
  executedAs?: string;
}

/**
 * Deterministic reference, which is also the idempotency key.
 *
 * Derived rather than random so the same utterance in the same call produces the
 * same ref — a caller repeating themselves, or the agent re-calling a tool after
 * a timeout, must not create a second queue item. Normalisation matters more
 * than the hash: "fifty thousand" and "50,000" have to land on the same key or
 * the collapse never fires.
 */
export function refFor(callId: string, kind: DraftKind, values: SlotValue[]): string {
  const norm = values
    .filter((v) => v.value !== null && v.value !== "")
    .map((v) => `${v.key}=${String(v.value).toLowerCase().replace(/[\s,]/g, "")}`)
    .sort()
    .join("|");
  return createHash("sha256").update(`${callId}|${kind}|${norm}`).digest("hex").slice(0, 8);
}

/** Three digits the agent can say without spelling: "reference four-seven-two". */
export function spokenRef(ref: string): string {
  return String(parseInt(ref.slice(0, 6), 16) % 1000).padStart(3, "0");
}

const drafts = new Map<string, Draft>();

export function putDraft(d: Omit<Draft, "ref" | "createdAt" | "state"> & { ref?: string }): Draft {
  const ref = d.ref ?? refFor(d.callId, d.kind, d.values);
  const existing = drafts.get(ref);

  // Idempotent by construction: a repeat of the same request returns the record
  // that already exists rather than adding a duplicate.
  if (existing && existing.state !== "rejected") {
    // Late-arriving slots still merge in — the caller may have answered a probe
    // after the first partial draft was written.
    const merged = new Map(existing.values.map((v) => [v.key, v]));
    for (const v of d.values) merged.set(v.key, v);
    existing.values = [...merged.values()];
    existing.state = executable(existing.kind, existing.values) ? "ready" : "collecting";
    return existing;
  }

  const draft: Draft = {
    ...d,
    ref,
    createdAt: new Date().toISOString(),
    state: executable(d.kind, d.values) ? "ready" : "collecting",
  };
  drafts.set(ref, draft);
  return draft;
}

export function listDrafts(entityId: string): Draft[] {
  return [...drafts.values()]
    .filter((d) => d.entityId === entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDraft(ref: string): Draft | undefined {
  return drafts.get(ref);
}

/**
 * The edit path. This is what makes "Amal" correctable to "Amul" before anything
 * is created — and it records that a human touched the field, so the approval
 * screen stops flagging it as an unverified substitution.
 */
export function editDraft(ref: string, key: string, value: string | number): Draft | undefined {
  const d = drafts.get(ref);
  if (!d || d.state === "executed") return undefined;

  const next = d.values.filter((v) => v.key !== key);
  next.push({ key, value, source: "app", substituted: false });
  d.values = next;
  d.state = executable(d.kind, d.values) ? "ready" : "collecting";
  return d;
}

/**
 * Execute is guarded twice: the draft must be `ready` (every required slot
 * filled, including the ones the app owns), and it must not already be executed.
 * The second check is what makes a double-tap harmless.
 */
export function execute(ref: string, executedAs: string): Draft | undefined {
  const d = drafts.get(ref);
  if (!d || d.state !== "ready") return undefined;
  d.state = "executed";
  d.executedAs = executedAs;
  d.decidedAt = new Date().toISOString();
  return d;
}

export function reject(ref: string): Draft | undefined {
  const d = drafts.get(ref);
  if (!d || d.state === "executed") return undefined;
  d.state = "rejected";
  d.decidedAt = new Date().toISOString();
  return d;
}

/** Count for the nav badge. Only things a human still has to look at. */
export function pendingCount(entityId: string): number {
  return listDrafts(entityId).filter((d) => d.state === "collecting" || d.state === "ready").length;
}

/* ------------------------------------------------------------------ */
/* Live calls                                                          */
/* ------------------------------------------------------------------ */

/*
 * Tracked, not inferred.
 *
 * The first instinct was to infer a live call from a fresh draft, which is wrong
 * in the one moment that matters: verification happens BEFORE any draft exists,
 * so the code would appear only after the caller no longer needed it.
 *
 * Recorded at session_start and cleared at session_end, with a ceiling so a
 * dropped call cannot leave a code on screen indefinitely — Sarvam allows 25
 * minute calls, and an on_end hook that never fires must not mean a permanently
 * visible PIN.
 */
const MAX_CALL_MS = 26 * 60 * 1000;
const liveCalls = new Map<string, { entityId: string; startedAt: number }>();

export function markCallStarted(callId: string, entityId: string, now = Date.now()): void {
  liveCalls.set(callId, { entityId, startedAt: now });
}

export function markCallEnded(callId: string): void {
  liveCalls.delete(callId);
}

export function callLive(entityId: string, now = Date.now()): boolean {
  for (const [callId, c] of liveCalls) {
    if (now - c.startedAt > MAX_CALL_MS) {
      liveCalls.delete(callId);
      continue;
    }
    if (c.entityId === entityId) return true;
  }
  return false;
}

/** Test seam. */
export function resetStore(): void {
  drafts.clear();
  liveCalls.clear();
}

/* ------------------------------------------------------------------ */
/* Sharing the two maps across serverless instances                    */
/* ------------------------------------------------------------------ */

/*
 * The maps above stay synchronous, and the sharing happens at the request
 * boundary instead: hydrate on the way in, persist on the way out.
 *
 * The alternative was making every store function async, which would have
 * rippled into 59 probe assertions that call them directly — a large, risky
 * edit to make a storage decision visible in places that do not care about one.
 * Two awaits in the request wrapper cost the same and change nothing else.
 *
 * The read-modify-write is not atomic. Two callers drafting in the same second
 * could lose one write. Acceptable here: a business has one phone line, and the
 * alternative is per-draft keys plus an index, which is more moving parts than
 * this earns.
 */
const DRAFTS_KEY = "voice:drafts:v1";
const LIVE_KEY = "voice:live:v1";

export async function hydrate(): Promise<void> {
  const [d, l] = await Promise.all([
    kvGet<Record<string, Draft>>(DRAFTS_KEY),
    kvGet<Record<string, { entityId: string; startedAt: number }>>(LIVE_KEY),
  ]);
  if (d) {
    drafts.clear();
    for (const [k, v] of Object.entries(d)) drafts.set(k, v);
  }
  if (l) {
    liveCalls.clear();
    for (const [k, v] of Object.entries(l)) liveCalls.set(k, v);
  }
}

export async function persist(): Promise<void> {
  await Promise.all([
    kvSet(DRAFTS_KEY, Object.fromEntries(drafts)),
    kvSet(LIVE_KEY, Object.fromEntries(liveCalls)),
  ]);
}
