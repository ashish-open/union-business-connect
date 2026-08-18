/*
 * "Did Acme pay me?" — resolved against the closed set of parties we already
 * hold, never against open speech. Ambiguity is answered with a question, not a
 * guess: silently reporting on the wrong party is the failure mode here.
 */
import { ok, refuse, tool } from "@/lib/voice/handler";
import { entityById, partyPayments } from "@/lib/voice/reads";
import { matchParty } from "@/lib/voice/resolve";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool<{ party_name?: string; direction?: "received" | "paid" | "both" }>(
  "get_party_payments",
  ({ claims, args }) => {
    const entity = entityById(claims.entityId);
    if (!entity) return refuse("upstream_unavailable");
    if (!args.party_name) return refuse("bad_request", "Which customer or supplier?");

    const m = matchParty(entity, args.party_name);

    if (m.kind === "none") {
      return ok(`I can't find anyone called ${args.party_name} on your account.`, { found: false });
    }
    if (m.kind === "ambiguous") {
      return ok(`I have ${m.options.join(" and ")}. Which one?`, { ambiguous: m.options });
    }
    if (m.kind === "confirm") {
      return ok(`Did you mean ${m.value}?`, { confirm: m.value });
    }

    const a = partyPayments(entity, m.value, args.direction ?? "both");
    return ok(a.speak, a.data);
  },
);
