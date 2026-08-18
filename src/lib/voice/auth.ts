/*
 * Inbound authentication for every voice route.
 *
 * Two independent checks, because Sarvam supports bearer / api_key / basic but
 * not request signing (05_VOICE_AGENT_PLAN.md §2.2):
 *
 *   1. Bearer token  — authenticates the platform. Held in Sarvam Secrets.
 *   2. Egress IP     — Sarvam calls from a single documented address.
 *
 * Neither is sufficient alone. Together with the per-call session token
 * (session.ts) they give three layers over a surface that cannot be signed.
 */

import { timingSafeEqual } from "node:crypto";

export type AuthFailure = "no_secret_configured" | "bad_bearer" | "bad_ip";

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Vercel puts the client address first in x-forwarded-for. Falls back to
 * x-real-ip. Both are set by the platform, not by the caller, so they are
 * trustworthy *on Vercel* — this check would be worthless behind an arbitrary
 * proxy, which is worth remembering if this ever moves to PNB's cloud.
 */
export function callerIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}

/**
 * IP allowlist. Comma-separated so a second Sarvam egress address can be added
 * without a code change — the docs list one today, and it will change.
 *
 * Deliberately skipped in development, where requests arrive through a tunnel
 * from an address we cannot predict.
 */
function ipAllowed(headers: Headers): boolean {
  const allow = (process.env.SARVAM_EGRESS_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allow.length === 0) return process.env.NODE_ENV !== "production";

  const ip = callerIp(headers);
  if (ip !== null && allow.includes(ip)) return true;

  /*
   * The address that was refused, named.
   *
   * The bearer is checked first, so reaching here means the platform is
   * authentic and only its address is unexpected — which in practice means it
   * egresses from more than one, and the docs list one. That failure is
   * intermittent by nature: some calls land on a known address and work, others
   * do not and die at the door, and from the caller's side it is indistinguish-
   * able from a flaky line.
   *
   * Without the address in the log there is nothing to add to the allowlist, so
   * the only remedies are guessing or turning the check off. It is a server's
   * egress IP, not a person's, and it has already failed the check.
   */
  console.warn(
    JSON.stringify({
      evt: "voice_ip_refused",
      at: new Date().toISOString(),
      saw: ip ?? "no x-forwarded-for or x-real-ip header",
      allowed: allow,
      detail: "add this address to SARVAM_EGRESS_IPS if it is the platform's",
    }),
  );
  return false;
}

export function authenticate(headers: Headers): { ok: true } | { ok: false; why: AuthFailure } {
  const expected = process.env.VOICE_SHARED_SECRET;
  if (!expected || expected.length < 24) return { ok: false, why: "no_secret_configured" };

  const header = headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented || !constantTimeEqual(presented, expected)) {
    return { ok: false, why: "bad_bearer" };
  }

  if (!ipAllowed(headers)) return { ok: false, why: "bad_ip" };

  return { ok: true };
}
