/*
 * Response helpers, and the structured log line.
 *
 * The one rule this file exists to enforce: a voice route never returns a bare
 * HTTP error. A 5xx makes the model improvise, and an improvised number on a
 * banking call is the worst outcome available. Every failure is a 200 carrying
 * a `speak` string that is safe to say verbatim.
 * 05_VOICE_AGENT_PLAN.md §3.3.
 */

import { NextResponse } from "next/server";
import type { RefusalReason, ToolResponse } from "./types";

/** Copy for each refusal. Written to be spoken, not read. */
const REFUSAL_COPY: Record<RefusalReason, string> = {
  unknown_caller:
    "I can't find an account linked to this number. You can sign in on the app, or I can put you through to the team.",
  auth_required:
    "I'll need to verify you before I can share that. Shall I do that now?",
  role_not_permitted:
    "That one needs the account owner. I can leave it for them to action in the app.",
  agent_disabled:
    "I'm not able to help over the phone at the moment. Everything is still available in the app.",
  autonomy_ceiling:
    "I can look things up but I'm not set up to prepare that right now. The app can do it.",
  bad_request: "Sorry, I didn't catch that clearly. Could you say it again?",
  not_authorised: "I can't action that on this call.",
  session_expired:
    "This call has been going a while and I've lost my place. Could you tell me again?",
  upstream_unavailable:
    "I can't reach your account details right now. Shall I try again, or would the app be easier?",
};

export function ok<D>(speak: string, data?: D, sessionToken?: string): NextResponse {
  const body: ToolResponse<D> = sessionToken
    ? { ok: true, speak, data, session_token: sessionToken }
    : { ok: true, speak, data };
  return NextResponse.json(body, { status: 200 });
}

export function refuse(reason: RefusalReason, speak?: string): NextResponse {
  const body: ToolResponse = { ok: false, reason, speak: speak ?? REFUSAL_COPY[reason] };
  // 200 on purpose. See the header comment.
  return NextResponse.json(body, { status: 200 });
}

/**
 * The only audit we have. With no database, Vercel's log retention is the
 * ceiling — so emit structured JSON now and a log drain later is configuration
 * rather than a code change. Plan §5.8 is explicit that this is a real gap and
 * should not be described as an audit trail.
 *
 * Args are logged but never the session token, and never a PIN or OTP.
 */
export function logTool(entry: {
  tool: string;
  callId?: string;
  entityId?: string;
  role?: string;
  authLevel?: string;
  outcome: "ok" | "refused" | "error";
  reason?: string;
  ms: number;
  args?: Record<string, unknown>;
}): void {
  const { args, ...rest } = entry;
  console.log(
    JSON.stringify({
      evt: "voice_tool",
      at: new Date().toISOString(),
      ...rest,
      args: args ? redact(args) : undefined,
    }),
  );
}

const SENSITIVE = /pin|otp|password|passcode|cvv|session_token/i;

function redact(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = SENSITIVE.test(k) ? "[redacted]" : v;
  }
  return out;
}
