import { asNumber, ok, refuse, tool } from "@/lib/voice/handler";
import { entityById, transactions } from "@/lib/voice/reads";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool<{ limit?: number | string }>("list_transactions", ({ claims, args }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");
  // Capped: a phone call cannot absorb twenty lines, and the app is right there.
  const a = transactions(entity, Math.min(Math.max(asNumber(args.limit) ?? 5, 1), 8));
  return ok(a.speak, a.data);
});
