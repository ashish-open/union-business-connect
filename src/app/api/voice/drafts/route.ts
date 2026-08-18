/*
 * App-facing, not a Sarvam tool. This is what the browser polls.
 *
 * Deliberately NOT wrapped in `tool()`: that wrapper expects a bearer token and a
 * per-call session, neither of which a browser has. This route is scoped by
 * entity id and returns only drafts — no balances, no statement, nothing that
 * would matter if the id were guessed.
 *
 * It exists because a draft spoken on a phone has to reach a laptop, and with no
 * database the store is the only thing standing between them.
 */

import { NextResponse, type NextRequest } from "next/server";
import { callLive, hydrate, listDrafts } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get("entity");
  if (!entityId) {
    return NextResponse.json({ ok: false, reason: "entity required" }, { status: 400 });
  }
  // `ok` is explicit so the client can tell "no drafts" from "the poll failed".
  // Without it, a failed fetch renders as an empty queue and the user concludes
  // nothing needs them — which is the trust failure this whole surface exists to
  // avoid. See 04_V2_IMPROVEMENT_BACKLOG.md R1.
  await hydrate();
  return NextResponse.json({
    ok: true,
    drafts: listDrafts(entityId),
    // Drives the verification code card: no call, no code on screen.
    live: callLive(entityId),
  });
}
