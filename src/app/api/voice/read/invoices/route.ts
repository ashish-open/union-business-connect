import { ok, refuse, tool } from "@/lib/voice/handler";
import { entityById, receivables } from "@/lib/voice/reads";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool("get_invoices", ({ claims }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");
  const a = receivables(entity);
  return ok(a.speak, a.data);
});
