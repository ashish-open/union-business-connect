"use client";

/*
 * The code a caller reads to Simran to prove who they are.
 *
 * Two things this has to get right, and both are about not looking broken:
 *
 *  1. Show the countdown. A code that silently stops working reads as the product
 *     failing, and the caller will insist they read it correctly — because they
 *     did. Ninety seconds of visible life sets the expectation instead.
 *  2. Group the digits. "742 815" survives being read aloud down a bad line;
 *     "742815" gets run together and mis-heard.
 *
 * It appears only while a call is in progress. A permanent code on the home screen
 * is a standing invitation to read it to whoever asks for it — which is how phone
 * fraud actually works. No call, no code.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function VoiceCodeCard({
  entityId,
  user,
  visible,
}: {
  entityId: string;
  user: string;
  /** True while a call is live. Passed in so this component owns no call state. */
  visible: boolean;
}) {
  /*
   * The remaining time is DERIVED from an expiry timestamp rather than held as a
   * counter that gets decremented.
   *
   * Storing a countdown means a state write every second and a second write to
   * trigger the refetch when it hits zero — which is both a cascading render and
   * a clock that drifts if the tab is backgrounded. One timestamp plus a ticking
   * `now` is exact, and it self-corrects when the tab wakes up.
   */
  const [state, setState] = useState<{ pin: string; expiresAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /*
   * Expiry is mirrored in a ref so the ticker can decide whether to refetch
   * without reading state. Two reasons: a state read would make the interval
   * depend on state and resubscribe every second, and doing the check inside a
   * setState updater would fire the fetch twice under StrictMode, since updaters
   * must be pure.
   */
  const expiresAt = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/voice/pin?entity=${encodeURIComponent(entityId)}&user=${encodeURIComponent(user)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { ok?: boolean; pin?: string; secondsLeft?: number };
      if (json.ok && json.pin) {
        const exp = Date.now() + (json.secondsLeft ?? 0) * 1000;
        expiresAt.current = exp;
        setState({ pin: json.pin, expiresAt: exp });
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
  }, [entityId, user]);

  // One interval drives everything: it advances the clock and refetches once the
  // code has rolled over. The first fetch is deferred a tick so nothing writes
  // state synchronously from the effect body.
  useEffect(() => {
    if (!visible) return;
    let inflight = false;

    const tick = () => {
      setNow(Date.now());
      if (expiresAt.current > Date.now() || inflight) return;
      inflight = true;
      void load().finally(() => {
        inflight = false;
      });
    };

    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      expiresAt.current = 0;
    };
  }, [visible, load]);

  const pin = state?.pin ?? null;
  const left = state ? Math.max(0, Math.ceil((state.expiresAt - now) / 1000)) : 0;

  if (!visible) return null;

  return (
    <Card className="mt-4">
      <div className="flex items-start gap-3">
        <Phone size={15} className="mt-0.5 shrink-0 text-ink-3" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">Read this to Simran</p>

          {failed ? (
            // Never render a blank space where a code should be — a caller would
            // read out nothing and conclude the line was at fault.
            <p className="mt-1 text-[12px] text-warn">
              Couldn’t generate a code just now. Ask her to text you one instead.
            </p>
          ) : pin === null ? (
            <p className="mt-1 text-[12px] text-ink-3">Getting your code…</p>
          ) : (
            <>
              <p className="mt-1.5 font-mono text-2xl tracking-[0.18em] text-ink tnum">
                {pin.slice(0, 3)} {pin.slice(3)}
              </p>
              <p className="mt-1 text-[11.5px] text-ink-3">
                {left > 0
                  ? `Changes in ${left}s — read the one showing now`
                  : "Getting a fresh code…"}
              </p>
            </>
          )}

          <p className="mt-2 text-[11.5px] text-ink-3">
            Only ever read this out on a call you made. Nobody from the bank will ring and
            ask for it.
          </p>
        </div>
      </div>
    </Card>
  );
}
