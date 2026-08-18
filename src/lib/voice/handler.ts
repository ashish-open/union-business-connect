/*
 * One wrapper every voice route goes through.
 *
 * Auth, session, policy, timing and the structured log line are identical for
 * all fifteen tools, so they live here once. Each route is then just its own
 * logic — which is the point: a security check that has to be remembered in
 * fifteen places is a security check that will be missing from one of them.
 *
 * The route never sees an unauthenticated request, never sees an expired
 * session, and never sees a tool the caller isn't allowed to use.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authenticate } from "./auth";
import { refusalFor } from "./policy";
import { logTool, ok, refuse } from "./respond";
import { verifySession } from "./session";
import { hydrate, persist } from "./store";
import type { SessionClaims, ToolName, ToolRequest } from "./types";

/**
 * A number the platform may have sent as a string.
 *
 * Tool arguments arrive through a form UI where every field has a declared type,
 * and a quantity typed as Text arrives as "5" rather than 5. That string then
 * flows into an invoice total and multiplies into nonsense, or concatenates —
 * silently, because JavaScript will happily do both.
 *
 * Coerced at the edge instead, in one place, so a wiring choice in someone
 * else's console cannot change what a rupee figure means in the books. Only
 * where a number is genuinely expected: applying this to every argument would
 * eventually meet a 14-digit account number and quietly round it.
 *
 * Returns undefined rather than NaN or 0 for anything unusable, so a caller's
 * `!= null` check still means "the caller actually said a number". An
 * unresolved "{{qty}}" is treated as absent, which is what it is.
 */
const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Indian scale words, plus the ones a transcriber tends to produce. */
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1_000, k: 1_000,
  lakh: 100_000, lakhs: 100_000, lac: 100_000, lacs: 100_000,
  crore: 10_000_000, crores: 10_000_000, cr: 10_000_000,
  million: 1_000_000, mn: 1_000_000,
};

export function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t || /^\{\{.*\}\}$/.test(t)) return undefined;

  const plain = Number(t.replace(/[,\s₹]/g, ""));
  if (Number.isFinite(plain)) return plain;

  /*
   * Spoken amounts, because this arrives from a phone call.
   *
   * The caller says "five lakh" and the transcriber writes "five lakh" — the
   * model is asked for a number and passes the words through, which reached the
   * slot filler as NaN, left `amount` unfilled, and made the draft incomplete.
   * An incomplete draft is never stored, so the tool returned ok, the agent
   * announced an invoice, and nothing existed. Every layer behaved correctly and
   * the caller was told a lie.
   *
   * Parsed here rather than solved with a field description, because the
   * description is a request and this is a guarantee. "5 lakh", "five lakh",
   * "1.5 crore", "fifty thousand" and "500000" all mean one thing to the person
   * who said them, and should mean one thing here.
   */
  let total = 0;
  let current = 0;
  let saw = false;
  for (const raw of t.toLowerCase().replace(/[,₹]/g, " ").split(/\s+/)) {
    const w = raw.replace(/[^a-z0-9.]/g, "");
    if (!w) continue;
    const asNum = Number(w);
    if (Number.isFinite(asNum)) { current += asNum; saw = true; continue; }
    if (w in WORDS) { current += WORDS[w]; saw = true; continue; }
    if (w in SCALES) {
      // "lakh" with nothing before it means one lakh, as anyone would read it.
      current = (current || 1) * SCALES[w];
      total += current;
      current = 0;
      saw = true;
      continue;
    }
    // Units and filler the caller says around the number. "two days" is a
    // due period of 2; "five lakh rupees" is an amount. Dropping the noun keeps
    // the number, which is the only part the slot wants.
    if (["and", "rupees", "rupee", "rs", "inr", "in", "day", "days", "kg", "kgs", "units", "unit", "pieces", "piece", "nos"].includes(w)) continue;
    return undefined; // an unknown word means we are guessing; do not.
  }
  const n = total + current;
  return saw && Number.isFinite(n) ? n : undefined;
}

/*
 * Reserved by the envelope itself. Everything else in the body is an argument.
 */
const ENVELOPE = new Set(["call_id", "conversation_id", "session_token", "idempotency_key", "args"]);

/**
 * Arguments, whether the platform nests them or flattens them.
 *
 * The tool builder gives you one form row per body field, and each row can be
 * filled by the model. A nested object cannot: to send `args` as one field it
 * has to be typed JSON, and a JSON literal is sent verbatim — `{"pin":"{{pin}}"}`
 * arrives with the braces still in it, the model never having been asked. The
 * PIN then strips to the empty string and is refused with the same sentence as
 * a wrong code, which is indistinguishable on a phone call.
 *
 * So both shapes are accepted: `{call_id, session_token, args:{pin}}` and
 * `{call_id, session_token, pin}`. Nested wins on a collision, because a caller
 * who sent both meant the explicit one.
 *
 * This is a concession to someone else's form, not a preference. It costs one
 * merge and removes a class of failure that is invisible from both ends.
 */
export function toolArgs<A>(body: Record<string, unknown>): A {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (!ENVELOPE.has(k)) flat[k] = v;
  const merged: Record<string, unknown> = { ...flat, ...((body.args as object) ?? {}) };

  /*
   * A lower-cased alias for every argument, so `Pin` also answers to `pin`.
   *
   * The field name is typed by hand into a form in another console, and a
   * capital letter there produces a request that is structurally perfect and
   * semantically empty: `args.pin` is undefined, the route returns "read me the
   * code again", and the caller hears the agent rejecting a code it was never
   * sent. Nothing on either side can see the difference between that and a
   * caller who misread the digits.
   *
   * Aliasing rather than replacing: the original key stays, so a route that
   * genuinely wants a capitalised name still gets it, and an explicit lower-case
   * key already present is never overwritten by a variant.
   */
  for (const [k, v] of Object.entries(merged)) {
    const lower = k.toLowerCase();
    if (lower !== k && !(lower in merged)) merged[lower] = v;
  }
  return merged as A;
}

export interface ToolContext<A> {
  claims: SessionClaims;
  args: A;
  callId: string;
  idempotencyKey?: string;
}

/**
 * Returns a POST handler. `fn` may return a NextResponse (via ok/refuse) — it is
 * never expected to handle auth, and never expected to catch its own errors:
 * an unhandled throw becomes a speakable failure rather than a 500, because a
 * voice agent handed a 500 improvises.
 */
export function tool<A = Record<string, unknown>>(
  name: ToolName,
  fn: (ctx: ToolContext<A>) => Promise<NextResponse> | NextResponse,
) {
  return async function POST(req: NextRequest) {
    const t0 = Date.now();
    const done = (outcome: "ok" | "refused" | "error", reason?: string, extra?: object) =>
      logTool({ tool: name, outcome, reason, ms: Date.now() - t0, ...extra });

    const auth = authenticate(req.headers);
    if (!auth.ok) {
      done("error", auth.why);
      return refuse("not_authorised");
    }

    let body: ToolRequest<A>;
    try {
      body = (await req.json()) as ToolRequest<A>;
    } catch {
      done("error", "bad_json");
      return refuse("bad_request");
    }

    const callId = body.call_id ?? "";

    /*
     * A missing call_id is a wiring fault, not a request to reject.
     *
     * `verifySession` only compares the bound call when one is supplied, so a
     * tool whose body template omits the field authenticates fine and silently
     * drops the replay binding — the token becomes reusable across calls for the
     * rest of its 30 minutes. Refusing outright would take the whole agent down
     * over a template typo, and the token is still signed and still expiring, so
     * this logs loudly instead. If this line appears in production, a tool
     * config is missing `call_id` and the second factor is weaker than designed.
     */
    if (!callId) {
      console.warn(
        JSON.stringify({
          evt: "voice_wiring_fault",
          at: new Date().toISOString(),
          tool: name,
          detail: "no call_id in request body — session token replay binding skipped",
        }),
      );
    }

    const session = verifySession(body.session_token, callId);
    if (!session.ok) {
      /*
       * The shape that arrived, when the session check fails.
       *
       * A misconfigured tool and a genuinely bad token produce the same refusal
       * — deliberately, since telling them apart on the wire would be an oracle.
       * But they need completely different fixes, and from the console side the
       * platform can only ever report its own view of the config back to you. We
       * are the only place that sees what was actually sent.
       *
       * KEY NAMES ONLY, never values. `{"payload"}` means the tool is still on
       * the LLM-authored stub; `{"call_id","session_token","args"}` means the
       * body is right and the token itself is the problem. That one line is the
       * difference between re-editing a tool and chasing a signing secret.
       */
      console.warn(
        JSON.stringify({
          evt: "voice_body_shape",
          at: new Date().toISOString(),
          tool: name,
          keys: Object.keys(body as object).sort(),
          has_session_token: Boolean(body.session_token),
          /*
           * The first few characters of a token that already failed to verify.
           *
           * Safe: a malformed token is not a credential, and a real one is only
           * identifiable by its `vs_` prefix, which reveals nothing. Decisive:
           * `{{session_t` means the platform sent the template literally and the
           * save-reply mapping never populated the variable, while `vs_` means
           * the mapping works and the signature or expiry is the problem. Those
           * are opposite fixes and nothing else distinguishes them.
           */
          token_prefix: String(body.session_token ?? "").slice(0, 12),
          call_id_prefix: String(body.call_id ?? "").slice(0, 12),
          reason: session.reason,
        }),
      );
      done("refused", `session_${session.reason}`, { callId });
      // A token that never existed and one that has expired are different
      // conversations: the first is an attack, the second is a long call.
      return refuse(session.reason === "expired" ? "session_expired" : "not_authorised");
    }

    const { claims } = session;
    const meta = {
      callId,
      entityId: claims.entityId,
      role: claims.role,
      authLevel: claims.authLevel,
    };

    const denial = refusalFor(name, { role: claims.role, authLevel: claims.authLevel });
    if (denial) {
      // Refusals are logged as first-class events, not filtered out —
      // EXPERIENCE_SPEC §10a is explicit that the audit records what the agent
      // was stopped from doing, not only what it did.
      done("refused", denial, meta);
      return refuse(denial);
    }

    try {
      // Shared state in, shared state out. Every tool that touches a draft or a
      // live call gets this for free, so no route has to remember it.
      await hydrate();
      const res = await fn({
        claims,
        args: toolArgs<A>(body as unknown as Record<string, unknown>),
        callId,
        idempotencyKey: body.idempotency_key,
      });
      await persist();
      done("ok", undefined, { ...meta, args: body.args as Record<string, unknown> });
      return res;
    } catch (err) {
      done("error", (err as Error).message, meta);
      return refuse("upstream_unavailable");
    }
  };
}

/** Shared route segment config. Every voice route needs all four. */
export const voiceRouteConfig = {
  runtime: "nodejs" as const,
  preferredRegion: "bom1" as const,
  maxDuration: 5,
  dynamic: "force-dynamic" as const,
};

export { ok, refuse };
