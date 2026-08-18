/*
 * Sarvam on_start hook. The security gate for the whole voice surface.
 *
 * This fires BEFORE the agent speaks its greeting, receives the caller number,
 * and its response is mapped into agent variables — Sarvam's docs allow gating
 * tools and states on returned flags, which is why identity, the kill switch
 * and the autonomy ceiling all live here rather than in the prompt.
 * 05_VOICE_AGENT_PLAN.md §2.1.
 *
 * Second, free benefit: this request pays the cold start. By the time the
 * caller has heard "Namaste, this is Simran…" the function is warm, so the
 * first real question doesn't wait. The greeting IS the warm-up (§5.2).
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/voice/auth";
import { allowedTools, autonomyCeiling, killSwitchOn } from "@/lib/voice/policy";
import { resolveCaller } from "@/lib/voice/registry";
import { logTool, ok, refuse } from "@/lib/voice/respond";
import { mintSession } from "@/lib/voice/session";
import { hydrate, markCallStarted, persist } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1"; // India-only data. FOUNDATION §0.
export const maxDuration = 5; // The caller is waiting. Fail fast.
export const dynamic = "force-dynamic";

interface StartBody {
  caller_number?: string;
  from?: string; // some telephony providers use `from`
  call_id?: string;
  conversation_id?: string;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const auth = authenticate(req.headers);
  if (!auth.ok) {
    logTool({ tool: "session_start", outcome: "error", reason: auth.why, ms: Date.now() - t0 });
    return refuse("not_authorised");
  }

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    logTool({ tool: "session_start", outcome: "error", reason: "bad_json", ms: Date.now() - t0 });
    return refuse("bad_request");
  }

  /*
   * The call id is minted here when the platform cannot supply one.
   *
   * Sarvam documents exactly six built-in variables — current_date,
   * current_time, current_datetime, current_day, start_datetime, language_name
   * — and not one of them is a call, conversation or interaction id. Requiring
   * the caller to send one therefore made this route un-wireable: the field sat
   * unbound in the tool config, arrived empty, and every call died here with
   * bad_request. Nothing downstream populated, so the agent answered from its
   * own prompt instead of from the account.
   *
   * A minted id is worth as much as a supplied one, because of what it is FOR:
   * binding the session token to one call so a token cannot be replayed on the
   * next. It is generated once, returned as data.call_id, and the agent echoes
   * it on every subsequent tool. What it loses is the join back to Sarvam's own
   * interaction id in their console — worth having, not worth the whole surface.
   *
   * The caller's number is NOT defaulted. It is the identity claim, and a
   * default would silently hand one business's data to whoever rang.
   */
  const callId = body.call_id?.trim() || body.conversation_id?.trim() || randomUUID();
  const number = body.caller_number ?? body.from ?? "";

  if (!number) {
    logTool({ tool: "session_start", outcome: "error", reason: "missing_caller_number", ms: Date.now() - t0 });
    return refuse("bad_request");
  }

  // Checked before identity resolution on purpose: a disabled agent should not
  // even reveal whether a number is registered.
  if (killSwitchOn()) {
    logTool({ tool: "session_start", callId, outcome: "refused", reason: "agent_disabled", ms: Date.now() - t0 });
    return ok("Voice banking is unavailable right now.", {
      known: false,
      kill_switch: true,
      tools_allowed: [],
    });
  }

  const caller = resolveCaller(number);

  if (!caller) {
    // Never probe. No hint about what a valid number looks like, no offer to
    // try another, nothing that turns this into an enumeration oracle. §2.3.
    logTool({ tool: "session_start", callId, outcome: "refused", reason: "unknown_caller", ms: Date.now() - t0 });
    return ok(
      "I can't find an account linked to this number. You can sign in on the app, or I can put you through to the team.",
      { known: false, kill_switch: false, tools_allowed: [] },
    );
  }

  // Caller ID identifies; it does not authenticate. Start at cli_only and let
  // verify_identity raise it. §2.3.
  /*
   * VOICE_SKIP_VERIFY starts the caller verified, skipping the step-up entirely.
   *
   * The last resort, and the only switch here that gives something away: caller
   * ID alone is identification, not authentication, and it is spoofable. With
   * this set, a spoofed number reaches every read the role permits without ever
   * proving possession of the device.
   *
   * It exists because the step-up depends on a tool argument crossing a platform
   * we do not control, and a demo that cannot show a balance shows nothing. The
   * data behind it is fabricated, so what is conceded is a property of the
   * design rather than anyone's money.
   *
   * Logged on every call it affects. Never set it anywhere a real account lives.
   */
  const skipVerify = process.env.VOICE_SKIP_VERIFY === "1";
  if (skipVerify) {
    console.warn(
      JSON.stringify({
        evt: "voice_step_up_skipped",
        at: new Date().toISOString(),
        callId,
        entityId: caller.entityId,
        detail: "VOICE_SKIP_VERIFY=1 — caller ID alone granted verified access",
      }),
    );
  }
  const authLevel = skipVerify ? ("verified" as const) : ("cli_only" as const);
  const tools = allowedTools({ role: caller.role, authLevel });

  let sessionToken: string;
  try {
    sessionToken = mintSession(caller, callId, authLevel);
  } catch {
    // Missing or weak signing secret. Fail closed rather than issuing a
    // session nobody can trust.
    logTool({ tool: "session_start", callId, outcome: "error", reason: "no_session_secret", ms: Date.now() - t0 });
    return refuse("upstream_unavailable");
  }

  // Lets the app show the verification code while, and only while, a call runs.
  await hydrate();
  markCallStarted(callId, caller.entityId);
  await persist();

  logTool({
    tool: "session_start",
    callId,
    entityId: caller.entityId,
    role: caller.role,
    authLevel,
    outcome: "ok",
    ms: Date.now() - t0,
  });

  return ok(
    `Namaste ${caller.displayName}.`,
    {
      known: true,
      kill_switch: false,
      /*
       * Echoed back on purpose, so the agent can carry it as a variable.
       *
       * Every later tool must send `call_id`: it is what binds the session token
       * to this call, and `verifySession` skips that check when the field is
       * absent rather than failing — so a body template that omits it works
       * perfectly and quietly loses the replay binding. Sarvam documents no
       * system variable for a conversation id (only current_date, current_time,
       * current_datetime, current_day, start_datetime, language_name), and the
       * caller number arrives as telephony metadata rather than a named
       * variable. Rather than depend on an undocumented built-in, this hook
       * receives the id and hands it straight back: map it to a `call_id`
       * variable here, and every tool can reference it for the rest of the call.
       */
      call_id: callId,
      // Mapped into agent variables so the greeting can use them and the agent
      // never has to ask for what we already know.
      user_name: caller.displayName,
      business_name: caller.entityName,
      role: caller.role,
      auth_level: authLevel,
      autonomy: autonomyCeiling(),
      has_checker: caller.hasChecker,
      tools_allowed: tools,
    },
    sessionToken,
  );
}
