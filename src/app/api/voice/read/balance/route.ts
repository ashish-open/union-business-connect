import { ok, refuse, tool } from "@/lib/voice/handler";
import { balance, entityById } from "@/lib/voice/reads";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool("lookup_account_balance", ({ claims }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");
  const a = balance(entity);
  return ok(a.speak, a.data);
});
