/*
 * App-facing mutations on a draft: edit a field, execute, or discard.
 *
 * Not a Sarvam tool, and not reachable from the voice surface — the agent has no
 * route that can move a draft past "ready". Execute is a browser action by
 * definition, because that is what makes the approval a real control rather than
 * a formality.
 *
 * Note that `execute` here only marks the draft executed. The domain record is
 * created client-side through the same `saveDoc` / `addPayee` the manual forms
 * use, so a spoken invoice and a typed one are the same object.
 */

import { NextResponse, type NextRequest } from "next/server";
import { editDraft, execute, getDraft, hydrate, persist, reject } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";

interface Body {
  op: "edit" | "execute" | "reject";
  key?: string;
  value?: string | number;
  executedAs?: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  // The screen acts on a draft the phone created, possibly on another instance.
  await hydrate();

  if (!getDraft(ref)) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  if (body.op === "edit") {
    if (!body.key) return NextResponse.json({ ok: false, reason: "key required" }, { status: 400 });
    const d = editDraft(ref, body.key, body.value ?? "");
    await persist();
    return d
      ? NextResponse.json({ ok: true, draft: d })
      : NextResponse.json({ ok: false, reason: "already_executed" }, { status: 409 });
  }

  if (body.op === "execute") {
    const d = execute(ref, body.executedAs ?? "record");
    await persist();
    // 409 rather than an error: the usual cause is a second click, and the first
    // one succeeded. The client treats this as "already done", not as a failure.
    return d
      ? NextResponse.json({ ok: true, draft: d })
      : NextResponse.json({ ok: false, reason: "not_ready_or_done" }, { status: 409 });
  }

  const d = reject(ref);
  await persist();
  return d
    ? NextResponse.json({ ok: true, draft: d })
    : NextResponse.json({ ok: false, reason: "already_executed" }, { status: 409 });
}
