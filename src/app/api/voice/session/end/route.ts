/*
 * Sarvam on_end hook. The call's closing record.
 *
 * Sarvam already stores the call itself — attempts, transcript, recording — so
 * this does not copy any of that. What it captures is the agent's own account
 * of the call: the output variables already configured on the agent
 * (call_summary, call_disposition, action_taken, escalation_reason).
 *
 * Note the honest limitation: with no database this is a log line, not an audit
 * trail, and it is bounded by Vercel's log retention. 05_VOICE_AGENT_PLAN.md
 * §5.8 says not to describe it as an audit trail, and that holds.
 */

import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/voice/auth";
import { logTool, ok, refuse } from "@/lib/voice/respond";
import { verifySession } from "@/lib/voice/session";
import { markCallEnded } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

interface EndBody {
  call_id?: string;
  conversation_id?: string;
  session_token?: string;
  call_summary?: string;
  call_disposition?: string;
  action_taken?: string;
  escalation_reason?: string;
  transcript_ref?: string;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const auth = authenticate(req.headers);
  if (!auth.ok) {
    logTool({ tool: "session_end", outcome: "error", reason: auth.why, ms: Date.now() - t0 });
    return refuse("not_authorised");
  }

  let body: EndBody;
  try {
    body = (await req.json()) as EndBody;
  } catch {
    return refuse("bad_request");
  }

  const callId = body.call_id ?? body.conversation_id ?? "";

  // The session may legitimately have expired on a long call, so a failed
  // verification is recorded rather than rejected — losing the closing record
  // of a real call is worse than accepting an unverified one at this stage.
  const session = verifySession(body.session_token, callId);

  markCallEnded(callId);

  logTool({
    tool: "session_end",
    callId,
    entityId: session.ok ? session.claims.entityId : undefined,
    role: session.ok ? session.claims.role : undefined,
    authLevel: session.ok ? session.claims.authLevel : undefined,
    outcome: "ok",
    reason: session.ok ? undefined : `unverified_session:${session.reason}`,
    ms: Date.now() - t0,
    args: {
      disposition: body.call_disposition,
      action_taken: body.action_taken,
      escalation_reason: body.escalation_reason,
      transcript_ref: body.transcript_ref,
      summary_len: body.call_summary?.length ?? 0,
    },
  });

  return ok("Recorded.");
}
