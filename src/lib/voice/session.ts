/*
 * Call sessions, without a session store.
 *
 * There is no database (05_VOICE_AGENT_PLAN.md §4), so the token carries its
 * own claims and its own HMAC. Nothing to look up, nothing to expire on a
 * schedule, nothing to keep warm.
 *
 * Why this matters beyond convenience: Sarvam supports bearer / api_key /
 * basic auth on tools but *not* request signing (§2.2). So the shared bearer
 * token is a replayable credential on its own. The session token is the second
 * factor — it is minted only by `on_start` for a real call, it is bound to that
 * call_id, and it expires. A leaked bearer token cannot act without one.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthLevel, Caller, Role, SessionClaims } from "./types";

/*
 * Sarvam's Max call length setting allows up to 25 minutes, so a 15-minute TTL
 * would expire mid-conversation on a long call and the caller would be asked to
 * start over — a bug that only shows up on exactly the calls where the caller is
 * already struggling. 30 gives headroom while still bounding replay.
 */
const TTL_SECONDS = 30 * 60;

function secret(): string {
  const s = process.env.VOICE_SESSION_SECRET;
  if (!s || s.length < 32) {
    // Fail closed and loudly. A weak signing key on a banking surface is worse
    // than an outage, because it fails silently and stays failed.
    throw new Error(
      "VOICE_SESSION_SECRET missing or under 32 chars — refusing to mint sessions",
    );
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export function mintSession(
  caller: Caller,
  callId: string,
  authLevel: AuthLevel,
  now = Date.now(),
): string {
  const claims: SessionClaims = {
    callId,
    mobile: caller.mobile,
    entityId: caller.entityId,
    user: caller.user,
    role: caller.role,
    authLevel,
    exp: Math.floor(now / 1000) + TTL_SECONDS,
  };
  const payload = b64url(JSON.stringify(claims));
  return `vs_${payload}.${sign(payload)}`;
}

export type VerifyResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "call_mismatch" };

/**
 * `callId` is checked as well as the signature. Without it, a token captured
 * from one call could be replayed against another — the signature would still
 * be valid, because it is.
 */
export function verifySession(
  token: string | undefined,
  callId: string | undefined,
  now = Date.now(),
): VerifyResult {
  if (!token || !token.startsWith("vs_")) return { ok: false, reason: "malformed" };

  const [payload, mac] = token.slice(3).split(".");
  if (!payload || !mac) return { ok: false, reason: "malformed" };

  const expected = sign(payload);
  const a = fromB64url(mac);
  const b = fromB64url(expected);
  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(fromB64url(payload).toString("utf8")) as SessionClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (claims.exp * 1000 < now) return { ok: false, reason: "expired" };
  if (callId && claims.callId !== callId) return { ok: false, reason: "call_mismatch" };

  return { ok: true, claims };
}

/**
 * Step-up re-mints rather than mutating. There is nowhere to mutate — which is
 * a feature: the old lower-privilege token stays valid until it expires but
 * confers nothing extra, and the agent simply carries the new one.
 */
export function upgradeSession(claims: SessionClaims, now = Date.now()): string {
  const caller: Caller = {
    mobile: claims.mobile,
    user: claims.user,
    role: claims.role,
    entityId: claims.entityId,
    displayName: claims.user,
    entityName: "",
    hasChecker: false,
  };
  return mintSession(caller, claims.callId, "verified", now);
}

export function roleOf(claims: SessionClaims): Role {
  return claims.role;
}
