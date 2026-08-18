/*
 * Turning drafts into queue rows, and the client-side hook that fetches them.
 *
 * Kept out of `today.ts` so the Today engine stays pure over `Entity` — it has no
 * business knowing that a fetch exists.
 */

"use client";

import { useEffect, useState } from "react";
import type { QueueItem } from "@/lib/today";
import { SLOTS, executable } from "./slots";
import type { Draft } from "./store";

export function draftToQueueItem(d: Draft): QueueItem {
  const get = (k: string) => d.values.find((v) => v.key === k)?.value ?? null;
  const amount = Number(get("amount") ?? 0);
  const party = String(get("party") ?? "someone");

  // Anything a human still has to check: a fuzzy name match, or a field the app
  // owns and hasn't been given yet. Surfaced on the collapsed row so the reason
  // to open it is visible without opening it.
  const toCheck = d.values.filter((v) => v.substituted).length;
  const stillNeeded = SLOTS[d.kind].filter(
    (s) => s.required && !s.viaVoice && !get(s.key),
  ).length;

  const flags: string[] = [];
  if (toCheck) flags.push(`${toCheck} to check`);
  if (stillNeeded) flags.push(`${stillNeeded} to fill in`);

  const excerpt = d.transcriptExcerpt ? `“${d.transcriptExcerpt}”` : "";
  const sub = [`From your call`, excerpt, flags.join(" · ")].filter(Boolean).join(" · ");

  return {
    id: `voice-${d.ref}`,
    kind: "voice",
    // Never "neg". A request the caller made themselves is not a problem, and
    // colouring it as one would misread the whole row.
    tone: executable(d.kind, d.values) ? "info" : "warn",
    amount,
    title:
      d.kind === "invoice"
        ? `invoice for ${party}`
        : d.kind === "beneficiary"
          ? `new payee ${party}`
          : `${d.kind} for ${party}`,
    sub,
    action: "Review",
    done: "",
    draftRef: d.ref,
  };
}

interface Poll {
  drafts: Draft[];
  /** True while a draft is fresh — drives the verification code card. */
  live: boolean;
  /**
   * False when the last poll failed. The caller MUST distinguish this from an
   * empty list: rendering a failed poll as "nothing needs you" tells someone who
   * just spoke an invoice that nothing is waiting, which is the trust failure
   * this surface exists to prevent. See 04_V2_IMPROVEMENT_BACKLOG.md R1.
   */
  ok: boolean;
}

export function useVoiceDrafts(entityId: string | undefined): Poll {
  const [state, setState] = useState<Poll>({ drafts: [], ok: true, live: false });

  useEffect(() => {
    if (!entityId) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/voice/drafts?entity=${encodeURIComponent(entityId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { ok?: boolean; drafts?: Draft[]; live?: boolean };
        if (!alive) return;
        // Keep the last good list on failure rather than blanking the queue —
        // stale-with-a-notice beats empty-and-wrong.
        setState((prev) =>
          json.ok && Array.isArray(json.drafts)
            ? { drafts: json.drafts, ok: true, live: Boolean(json.live) }
            : { ...prev, ok: false },
        );
      } catch {
        if (alive) setState((prev) => ({ ...prev, ok: false }));
      }
    };

    load();
    // 20s. Fast enough that a draft appears while the caller is still talking,
    // slow enough to be invisible. No websocket: under the in-process store
    // there is nothing to push from.
    const timer = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [entityId]);

  return state;
}
