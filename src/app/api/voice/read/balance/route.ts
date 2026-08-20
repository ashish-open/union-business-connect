/*
 * Combined by default, per account on request.
 *
 * `account` is optional and carries the caller's own words — "axis", "my
 * savings", "8264", "each of them". Omitted, it answers the total exactly as it
 * did before this field existed, so a tool config that does not send it is not
 * broken by its arrival.
 */
import { ok, refuse, tool } from "@/lib/voice/handler";
import { balance, entityById } from "@/lib/voice/reads";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool<{ account?: string }>("lookup_account_balance", ({ claims, args }) => {
  const entity = entityById(claims.entityId);
  if (!entity) return refuse("upstream_unavailable");
  const a = balance(entity, typeof args.account === "string" ? args.account : undefined);
  return ok(a.speak, a.data);
});
