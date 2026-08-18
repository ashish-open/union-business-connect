/*
 * The one read allowed before step-up, because it carries no figures — it tells
 * a caller whether to reach for the app without revealing a rupee to someone who
 * may have spoofed the caller ID.
 */
import { ok, refuse, tool } from "@/lib/voice/handler";
import { entityById, pendingSummary } from "@/lib/voice/reads";
import { pendingCount } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool("list_pending_approvals", ({ claims }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");
  const a = pendingSummary(entity, pendingCount(claims.entityId));
  return ok(a.speak, a.data);
});
