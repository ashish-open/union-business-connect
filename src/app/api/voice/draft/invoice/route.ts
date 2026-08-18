/*
 * Collects an invoice over the phone. Creates nothing.
 *
 * This is the route that answers "the agent should probe for the required
 * details": it accepts whatever slots have been captured so far, and if something
 * required is missing it hands back the exact next question to ask. The schema
 * lives in `slots.ts`, so the agent is never the thing that remembers what an
 * invoice needs.
 *
 * If the item doesn't exist, that is not an error — for a new account nothing
 * exists. The draft carries the new item name and the approval screen creates it
 * alongside the invoice.
 */

import { asNumber, ok, refuse, tool } from "@/lib/voice/handler";
import { entityById } from "@/lib/voice/reads";
import { matchParty } from "@/lib/voice/resolve";
import { fill, type SlotValue } from "@/lib/voice/slots";
import { putDraft, spokenRef } from "@/lib/voice/store";
import { rupees } from "@/lib/voice/speak";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

interface Args {
  party?: string;
  item?: string;
  // string too: a form field typed as Text sends "5", not 5. asNumber coerces.
  qty?: number | string;
  amount?: number | string;
  due_days?: number | string;
  said?: string;
}

export const POST = tool<Args>("draft_invoice", ({ claims, args, callId }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");

  const values: SlotValue[] = [];

  if (args.party) {
    const m = matchParty(entity, args.party);

    // Ambiguity and near-misses are resolved on the call, before anything is
    // written. Cheaper than a wrong payee reaching the approval screen, and it
    // keeps the queue clean.
    if (m.kind === "ambiguous") {
      return ok(`I have ${m.options.join(" and ")}. Which one?`, { ambiguous: m.options });
    }
    if (m.kind === "confirm") {
      return ok(`Did you mean ${m.value}?`, { confirm: m.value });
    }

    values.push(
      m.kind === "confident"
        ? {
            key: "party",
            heard: args.party,
            value: m.value,
            substituted: m.substituted,
            source: "voice",
          }
        : // No match at all — a genuinely new customer. Kept as spoken, and
          // flagged so the approval screen asks the human to confirm the spelling.
          { key: "party", heard: args.party, value: args.party, substituted: true, source: "voice" },
    );
  }

  if (args.item) values.push({ key: "item", value: args.item, source: "voice" });
  // Named for where they came from: these are what the caller SAID, before the
  // slot filler has had them. `amount` below is what the draft ended up holding.
  const saidQty = asNumber(args.qty);
  const saidAmount = asNumber(args.amount);
  const saidDueDays = asNumber(args.due_days);
  if (saidQty != null) values.push({ key: "qty", value: saidQty, source: "voice" });
  if (saidAmount != null) values.push({ key: "amount", value: saidAmount, source: "voice" });
  if (saidDueDays != null) values.push({ key: "dueDays", value: saidDueDays, source: "voice" });

  const state = fill("invoice", values);

  // Still gaps: ask for exactly one of them. Nothing is stored yet, so a caller
  // who abandons the call leaves no half-invoice behind.
  if (!state.complete) {
    return ok(state.nextPrompt, {
      missing: state.missing.map((s) => s.key),
      collected: values.map((v) => v.key),
    });
  }

  const draft = putDraft({
    kind: "invoice",
    entityId: claims.entityId,
    requestedBy: claims.user,
    callId,
    values,
    transcriptExcerpt: args.said,
  });

  const party = values.find((v) => v.key === "party")?.value;
  const amount = values.find((v) => v.key === "amount")?.value;

  // States plainly that nothing has gone out, every time. A caller who believes
  // an invoice was sent when it is waiting for them is the worst outcome here.
  return ok(
    `Right — ${rupees(Number(amount))} to ${party}. It's in your app waiting for your approval, ` +
      `nothing has been sent. Reference ${spokenRef(draft.ref)}.`,
    { ref: draft.ref, state: draft.state },
  );
});
