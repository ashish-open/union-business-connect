/*
 * The way out of the call.
 *
 * The Instructions lean on this in six places — failed verification, a tool that
 * will not answer, a role that may not act, an off-topic question, anything the
 * agent cannot do. Every one of those is a moment where the agent has already
 * decided it cannot help, so this is the last thing the caller hears. Until now
 * it was the one tool with no route behind it: `tools_allowed` advertised it,
 * because it sits in ALWAYS_TOOLS, and a call to it 404'd. A tool pointed at a
 * missing path fails mid-sentence and the agent narrates the failure, which is
 * the worst possible ending for the path that exists to end things gracefully.
 *
 * It is in ALWAYS_TOOLS deliberately: escalation has to work for a caller who
 * could NOT verify, which is precisely when they most need a human. Gating the
 * exit behind the check they just failed is a locked door with the key inside.
 *
 * Writes nothing. There is no create endpoint on this surface and the lint guard
 * in eslint.config.mjs stops one appearing. The request lands in the structured
 * log, which is the same place every other tool call lands, and is bounded by
 * Vercel's retention — 05_VOICE_AGENT_PLAN.md §5.8 is explicit that this is a
 * real gap and must not be described as an audit trail.
 *
 * What is NOT resolved here is where a callback actually goes. The Instructions
 * promise a human and nobody is behind it yet (handover §10). That is a bank
 * decision, not a code one, and the honest place for the caveat is the handover
 * rather than the caller's ear — a tool that recorded a request while telling
 * the caller it might go nowhere would be worse than not offering it.
 *
 * No reference number, on purpose. A draft gets one because the Today screen
 * renders it and the caller can check it (§6.4). Nothing renders callbacks, so a
 * reference here would be a number the caller writes down and can never look up.
 */

import { ok, tool } from "@/lib/voice/handler";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

interface Args {
  /** Why the caller needs a human. Free text, straight from the agent. */
  reason?: string;
  /** The caller's own words, kept alongside the agent's summary of them. */
  said?: string;
}

export const POST = tool<Args>("request_callback", ({ claims, args, callId }) => {
  /*
   * Logged separately from the wrapper's own line so the reason survives.
   *
   * The wrapper logs `args` on success, but a callback is the one outcome
   * somebody will go looking for later, and burying why it happened inside a
   * generic tool line makes it unfindable. Its own event name is what makes it
   * greppable.
   */
  console.log(
    JSON.stringify({
      evt: "voice_callback_requested",
      at: new Date().toISOString(),
      callId,
      entityId: claims.entityId,
      user: claims.user,
      role: claims.role,
      // Recorded because escalation from an UNVERIFIED call is the common case,
      // and whoever picks this up needs to know the caller never proved who
      // they were — they must verify again by their own means.
      authLevel: claims.authLevel,
      reason: args.reason ?? args.said ?? "not stated",
    }),
  );

  return ok("I've noted a callback request. Someone from the team will call you on this number.", {
    logged: true,
    // So the agent can close the loop without a second tool call, and so it
    // never has to guess whether the caller still needs to verify.
    auth_level: claims.authLevel,
  });
});
