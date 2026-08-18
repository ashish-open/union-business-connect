/*
 * Collects a payee over the phone. Creates nothing, and never takes the digits.
 *
 * The name is captured by voice; the account number and IFSC are typed in the
 * app. That split is the whole safety argument: speech recognition on digits is
 * the weakest link in this system, and a payee account wrong by one digit is
 * money gone to a stranger with no recourse. A second human tap does not catch
 * it, because the human is confirming what we *heard*.
 *
 * `slots.ts` enforces it structurally — `account` and `ifsc` carry
 * `viaVoice: false`, so they can never be asked for on the call, and
 * `executable()` keeps Execute locked until they are present.
 */

import { ok, refuse, tool } from "@/lib/voice/handler";
import { entityById } from "@/lib/voice/reads";
import { matchParty } from "@/lib/voice/resolve";
import { fill, type SlotValue } from "@/lib/voice/slots";
import { putDraft, spokenRef } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

interface Args {
  party?: string;
  said?: string;
}

export const POST = tool<Args>("draft_beneficiary", ({ claims, args, callId }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");

  if (!args.party) {
    return refuse("bad_request", "What name should I put on the payee?");
  }

  const m = matchParty(entity, args.party);

  // Already a payee. Saying so is more useful than silently making a duplicate,
  // and duplicate payees are how the wrong one gets picked later.
  if (m.kind === "confident" && !m.substituted) {
    return ok(`${m.value} is already on your account — no need to add them again.`, {
      existing: m.value,
    });
  }

  if (m.kind === "ambiguous") {
    return ok(
      `I have ${m.options.join(" and ")} already. Is it one of those, or someone new?`,
      { ambiguous: m.options },
    );
  }
  if (m.kind === "confirm") {
    return ok(`Did you mean ${m.value}, who you already pay?`, { confirm: m.value });
  }

  const values: SlotValue[] = [
    {
      key: "party",
      heard: args.party,
      value: m.kind === "confident" ? m.value : args.party,
      // Always flagged. A new payee's name has never been checked against
      // anything, so the approval screen must ask a human to read it.
      substituted: true,
      source: "voice",
    },
  ];

  const state = fill("beneficiary", values);
  const draft = putDraft({
    kind: "beneficiary",
    entityId: claims.entityId,
    requestedBy: claims.user,
    callId,
    values,
    transcriptExcerpt: args.said,
  });

  // Says why the digits are not being taken now, rather than leaving the caller
  // wondering whether the agent forgot to ask.
  return ok(
    `I've started a payee for ${values[0].value}. The account number and IFSC need typing in ` +
      `the app — too easy to mishear a digit over the phone. Reference ${spokenRef(draft.ref)}.`,
    {
      ref: draft.ref,
      state: draft.state,
      pending_in_app: state.pendingInApp.map((s) => s.key),
    },
  );
});
