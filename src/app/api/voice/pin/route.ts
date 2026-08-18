/*
 * The rolling code the app displays, for the caller to read to Simran.
 *
 * App-facing, not a Sarvam tool — the agent must never be able to ask for this.
 * A tool that returns the PIN would let the agent verify itself, which is the
 * whole point of the factor gone.
 *
 * Scoped by entity id in the query, which is weak on its own. That is acceptable
 * only because of what a leaked code can do: nothing by itself. It grants read
 * access on a call that already came from a whitelisted number, and it rolls every
 * ninety seconds. In production this sits behind the app's own session.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentPin } from "@/lib/voice/pin";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");
  const user = req.nextUrl.searchParams.get("user");
  if (!entityId || !user) {
    return NextResponse.json({ ok: false, reason: "entity and user required" }, { status: 400 });
  }

  try {
    const { pin, secondsLeft } = currentPin(entityId, user);
    return NextResponse.json({ ok: true, pin, secondsLeft });
  } catch {
    // Missing signing secret. Fail closed rather than showing a code that the
    // verify side cannot possibly agree with.
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
}
