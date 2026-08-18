/*
 * The app-generated verification PIN.
 *
 * The app shows a 6-digit PIN; the caller reads it to Simran; the API checks it.
 * The interesting constraint is that there is nowhere to store it — no backend
 * (05_VOICE_AGENT_PLAN.md §4) — so the PIN is *derived* rather than issued:
 * both sides compute the same value from a shared secret, the entity id and the
 * current time window. Nothing is written, nothing has to be cleaned up, and a
 * PIN cannot be stolen from a store that does not exist.
 *
 * This is the same construction as an authenticator app (TOTP), and it inherits
 * the same property that matters here: possession of the app proves identity,
 * because only the app can display the current code.
 *
 * Why this is the right second factor: caller ID identifies but does not
 * authenticate — CLI spoofing is trivial. A spoofed caller cannot produce this
 * PIN without the app open on the real owner's device.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 90 seconds. Long enough to read six digits aloud on a bad line, short enough
 * that a PIN overheard in a shop is useless by the time it is reused.
 */
const WINDOW_SECONDS = 90;

/** Accept the previous window too, so a PIN read at the boundary still works. */
const GRACE_WINDOWS = 1;

function secret(): string {
  const s = process.env.VOICE_PIN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("VOICE_PIN_SECRET missing or under 32 chars — refusing to issue PINs");
  }
  return s;
}

function windowAt(now: number): number {
  return Math.floor(now / 1000 / WINDOW_SECONDS);
}

function derive(entityId: string, user: string, win: number): string {
  const mac = createHmac("sha256", secret()).update(`${entityId}|${user}|${win}`).digest();
  // Standard dynamic truncation: take the low nibble of the last byte as an
  // offset, read 31 bits from there, reduce to six digits.
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * What the app displays. Also returns how long it stays valid, so the UI can
 * show a countdown rather than a code that silently stops working — a PIN that
 * expires with no warning reads as the product being broken.
 */
export function currentPin(
  entityId: string,
  user: string,
  now = Date.now(),
): { pin: string; secondsLeft: number } {
  const win = windowAt(now);
  const nextRollover = (win + 1) * WINDOW_SECONDS * 1000;
  return {
    pin: derive(entityId, user, win),
    secondsLeft: Math.max(0, Math.ceil((nextRollover - now) / 1000)),
  };
}

/**
 * Compares in constant time and across the grace window.
 *
 * Note what is deliberately absent: this never returns *which* window matched,
 * and the caller must not log the presented value. A PIN echoed into a log is a
 * PIN, and Sarvam's "Protect sensitive info" setting should be on as well.
 */
export function verifyPin(
  presented: string,
  entityId: string,
  user: string,
  now = Date.now(),
): boolean {
  const clean = presented.replace(/\D/g, "");
  if (clean.length !== 6) return false;

  /*
   * A fixed code for demonstrations, accepted alongside the rolling one.
   *
   * The rolling PIN is the right design and stays the default: derived per
   * ninety seconds, so a code overheard once is worthless a minute later. But it
   * puts three things on the critical path of a live demo — the app on the right
   * business, the tool passing the digits through, and the window not rolling
   * mid-sentence — and any of them failing sounds identical to the caller.
   *
   * Set VOICE_DEMO_PIN and that one code also verifies. It does not replace the
   * derived code; both work, so the real mechanism is still what gets shown.
   *
   * Logged every single time it is used, because a fixed PIN on a banking line
   * is exactly the thing that must never quietly survive into production. If
   * this line is in your logs and you are not standing in front of a projector,
   * unset the variable.
   */
  const fixed = (process.env.VOICE_DEMO_PIN ?? "").replace(/\D/g, "");
  if (fixed.length === 6 && clean === fixed) {
    console.warn(
      JSON.stringify({
        evt: "voice_demo_pin_used",
        at: new Date().toISOString(),
        entityId,
        user,
        detail: "VOICE_DEMO_PIN is set — a fixed code verified this caller",
      }),
    );
    return true;
  }

  const win = windowAt(now);
  let matched = false;
  // Check every candidate window regardless of an early hit, so the work done
  // does not vary with which window matched.
  for (let i = 0; i <= GRACE_WINDOWS; i++) {
    const expected = derive(entityId, user, win - i);
    const a = Buffer.from(clean);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) matched = true;
  }
  return matched;
}

/*
 * Attempt limiting.
 *
 * Per-call and in memory, which is the honest limit of the no-backend design: a
 * caller who hangs up and redials gets a fresh allowance. Bounded anyway,
 * because each redial costs them a new call and the PIN rotates every 90s. A
 * durable limiter is on the list for when the store stops being in-process.
 */
const MAX_ATTEMPTS = 3;
const attempts = new Map<string, number>();

export function recordAttempt(callId: string): { locked: boolean; left: number } {
  const n = (attempts.get(callId) ?? 0) + 1;
  attempts.set(callId, n);
  return { locked: n >= MAX_ATTEMPTS, left: Math.max(0, MAX_ATTEMPTS - n) };
}

export function isLocked(callId: string): boolean {
  return (attempts.get(callId) ?? 0) >= MAX_ATTEMPTS;
}

export function clearAttempts(callId: string): void {
  attempts.delete(callId);
}
