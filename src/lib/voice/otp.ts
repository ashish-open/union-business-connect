/*
 * SMS OTP — the fallback when the caller can't reach the app.
 *
 * The PIN in `pin.ts` proves possession of the app. That is the stronger factor,
 * but it assumes the app is reachable, which breaks the case voice exists for:
 * driving, on a site, phone against the ear. So the PIN leads and this backs it up.
 *
 * The property that makes this worth having rather than merely convenient: the
 * OTP is sent to the number on the whitelist, not to whoever is on the line. A
 * caller who has spoofed the caller ID can trigger an OTP but cannot receive one
 * — it goes to the real owner's handset. Spoofing alone therefore gets nobody
 * past this gate.
 *
 * Known weakness, stated rather than hidden: SIM swap defeats it, as it defeats
 * every SMS OTP in Indian banking. The PIN does not have that exposure, which is
 * the reason it stays the default.
 *
 * ── Intended live posture, recorded so this reads as temporary ───────────────
 * Production adds SIM binding and voice biometrics on top of these two factors:
 *
 *   SIM binding      closes the swap hole above, and is the reason this OTP is
 *                    acceptable as a prototype fallback rather than a permanent
 *                    design. It also binds the app to a device, so the PIN stops
 *                    being clonable.
 *   Voice biometrics is the strong one for this channel because it is *passive* —
 *                    it costs the caller no step, so it can run on every turn
 *                    rather than once at a gate. Its own weakness is replay and
 *                    synthesis, which is worsening as TTS improves, so it belongs
 *                    alongside a possession factor and not instead of one.
 *
 * None of that changes the shape of this module: `verify_identity` stays the only
 * route that raises `auth_level`, and each new factor is another branch inside it.
 *
 * ── Why there is nothing stored ─────────────────────────────────────────────
 * An OTP is random by definition, so unlike the PIN it cannot be re-derived. And
 * there is no database (05_VOICE_AGENT_PLAN.md §4). The resolution: hand the
 * agent a *signed token* carrying a hash of the code, and have it pass that token
 * back alongside what the caller typed. Verification recomputes the hash. The
 * code itself never leaves this process and never needs a home.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** 5 minutes. Long enough for a slow SMS, short enough to bound a replay. */
const TTL_SECONDS = 5 * 60;

/** Two per call. Beyond that this becomes a way to harass the real owner. */
export const MAX_SENDS = 2;

function secret(): string {
  const s = process.env.VOICE_OTP_SECRET ?? process.env.VOICE_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("VOICE_OTP_SECRET missing or under 32 chars — refusing to issue OTPs");
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

/** The code is hashed with the call id, so a token from one call is useless in another. */
function hash(code: string, callId: string): string {
  return b64url(createHmac("sha256", secret()).update(`${code}|${callId}`).digest()).slice(0, 32);
}

interface Claims {
  h: string;
  callId: string;
  send: number;
  exp: number;
}

export interface Issued {
  /** Opaque to the agent — it holds this and passes it back. Contains no code. */
  token: string;
  /** For delivery only. Must never be returned to the agent or spoken. */
  code: string;
  sendCount: number;
}

/**
 * `previousToken` carries the send count forward, so the cap survives a caller
 * asking for a resend without anything having to remember them.
 */
export function issueOtp(callId: string, previousToken?: string, now = Date.now()): Issued | null {
  const prior = previousToken ? read(previousToken, now, false) : null;
  const send = (prior?.send ?? 0) + 1;
  if (send > MAX_SENDS) return null;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const claims: Claims = {
    h: hash(code, callId),
    callId,
    send,
    exp: Math.floor(now / 1000) + TTL_SECONDS,
  };
  const payload = b64url(JSON.stringify(claims));
  return { token: `vo_${payload}.${sign(payload)}`, code, sendCount: send };
}

function read(token: string, now: number, enforceExpiry = true): Claims | null {
  if (!token.startsWith("vo_")) return null;
  const [payload, mac] = token.slice(3).split(".");
  if (!payload || !mac) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
  } catch {
    return null;
  }
  if (enforceExpiry && claims.exp * 1000 < now) return null;
  return claims;
}

export type OtpResult = "ok" | "wrong" | "expired" | "bad_token";

export function verifyOtp(
  presented: string,
  token: string | undefined,
  callId: string,
  now = Date.now(),
): OtpResult {
  if (!token) return "bad_token";

  // Distinguished from "wrong" on purpose: an expired code is a slow SMS and the
  // caller should be offered another, while a wrong one costs them an attempt.
  const unexpired = read(token, now, true);
  if (!unexpired) return read(token, now, false) ? "expired" : "bad_token";
  if (unexpired.callId !== callId) return "bad_token";

  const clean = presented.replace(/\D/g, "");
  if (clean.length !== 6) return "wrong";

  const a = Buffer.from(hash(clean, callId));
  const b = Buffer.from(unexpired.h);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "wrong";
}

/**
 * Delivery. There is no SMS provider wired up, so this logs and returns.
 *
 * The code is logged deliberately and ONLY under an explicit flag, because a
 * prototype where nobody can read the OTP cannot be demonstrated. It must not be
 * enabled anywhere a real customer can call: an OTP in a log is an OTP.
 */
export function deliverOtp(mobile: string, code: string): void {
  const reveal = process.env.VOICE_OTP_DEBUG === "1";
  console.log(
    JSON.stringify({
      evt: "voice_otp_sent",
      at: new Date().toISOString(),
      to: `••${mobile.slice(-4)}`,
      code: reveal ? code : "[withheld]",
    }),
  );
}
