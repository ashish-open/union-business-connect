/*
 * Step-up authentication. The only route that raises `auth_level`.
 *
 * The caller reads the 6-digit PIN their app is displaying. Caller ID told us who
 * they claim to be; this tells us they are holding the device — which is the part
 * a spoofed number cannot fake.
 *
 * Note what is deliberately absent from the logs: the presented value. A PIN
 * echoed into a log is a PIN. Sarvam's "Protect sensitive info" setting should be
 * on as well, so it is masked on their side too.
 */

import { ok, refuse, tool } from "@/lib/voice/handler";
import { verifyOtp } from "@/lib/voice/otp";
import { isLocked, recordAttempt, verifyPin } from "@/lib/voice/pin";
import { allowedTools } from "@/lib/voice/policy";
import { upgradeSession } from "@/lib/voice/session";
import { markCallVerified } from "@/lib/voice/store";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

interface Args {
  /** The rolling code the app displays. Preferred — no SIM-swap exposure. */
  pin?: string | number;
  /** The texted code, for callers who can't reach the app. */
  otp?: string;
  /** Opaque token from request_otp. Carries the hash; the agent just holds it. */
  otp_token?: string;
}

export const POST = tool<Args>("verify_identity", ({ claims, args, callId }) => {
  /*
   * One line on entry, before any branch. Four of the paths out of this handler
   * return without logging — already-verified, locked, and two OTP outcomes —
   * so a call could reach here, take one of them, and leave no trace at all.
   *
   * That is how the PIN investigation went in circles: the logging added for the
   * comparison never fired, and the silence read as "the PIN was checked and
   * rejected" when the handler had branched away long before. Which branch it
   * takes is the whole diagnosis, so it is recorded before the branching starts.
   *
   * Names and presence only — never the code itself.
   */
  console.warn(
    JSON.stringify({
      evt: "voice_verify_entry",
      at: new Date().toISOString(),
      entityId: claims.entityId,
      user: claims.user,
      auth_level: claims.authLevel,
      locked: isLocked(callId),
      pin_digits: String(args.pin ?? "").replace(/\D/g, "").length,
      has_otp: Boolean(args.otp),
      args_received: Object.keys(args as object).sort(),
      branch:
        claims.authLevel === "verified"
          ? "already_verified"
          : isLocked(callId)
            ? "locked"
            : args.otp
              ? "otp"
              : args.pin
                ? "pin"
                : "no_credential",
    }),
  );

  /*
   * The allow-list changes at this moment and at no other.
   *
   * `session_start` returns the cli_only list and the Instructions gate every
   * offer on it. Without re-sending it here the agent holds that list for the
   * rest of the call: verified, permitted by policy to reach every read and
   * draft, and still telling the caller that drafting an invoice is "outside
   * what your role can do on this call". The refusal is the prompt's, not the
   * policy's, which is why it came and went depending on whether the model
   * consulted the variable or simply called the tool.
   */
  const toolsWhenVerified = allowedTools({ role: claims.role, authLevel: "verified" });

  if (claims.authLevel === "verified") {
    return ok("You're already verified — go ahead.", { auth_level: "verified", tools_allowed: toolsWhenVerified });
  }

  // Checked before any comparison so a locked call cannot be used to keep
  // guessing, and so the lock survives a caller who keeps trying.
  if (isLocked(callId)) {
    return refuse(
      "not_authorised",
      "I've had too many wrong attempts on this call. Please use the app, or call back.",
    );
  }

  /* ---- OTP branch: only when the caller couldn't reach the app ---- */
  if (args.otp) {
    const result = verifyOtp(args.otp, args.otp_token, callId);

    if (result === "bad_token") {
      // No live code for this call. Almost always the caller reading a code from
      // an earlier call, so say what to do rather than just refusing.
      return refuse("bad_request", "I don't have a code outstanding — shall I send one now?");
    }

    // Expiry is not the caller's mistake — a slow text should not cost an
    // attempt, so this returns before recordAttempt.
    if (result === "expired") {
      return refuse(
        "auth_required",
        "That code has expired. Shall I send you a fresh one?",
      );
    }

    if (result === "wrong") {
      const { locked, left } = recordAttempt(callId);
      if (locked) {
        return refuse(
          "not_authorised",
          "That's not matching. I'll stop there for security — the app can help.",
        );
      }
      return refuse(
        "auth_required",
        `That didn't match. ${left} ${left === 1 ? "try" : "tries"} left.`,
      );
    }

    markCallVerified(claims.callId);
    const token = upgradeSession(claims);
    return ok(
      "Thank you, you're verified. What can I help with?",
      { auth_level: "verified", factor: "otp", tools_allowed: toolsWhenVerified },
      token,
    );
  }

  /* ---- PIN branch: the default ---- */

  /*
   * VOICE_DEMO_PIN=any accepts whatever the caller says, including nothing.
   *
   * The step-up is the part of this product worth showing a bank: the caller
   * reads a code off their own screen and proves they are holding the device.
   * That moment depends on six digits crossing a tool boundary we do not
   * control, and when they do not cross it the agent says "that didn't match"
   * to a caller reading a perfectly correct code.
   *
   * This keeps the conversation and drops the comparison. Simran still asks,
   * the caller still reads, and verification succeeds. What it does NOT do is
   * pretend: the factor is gone while this is set, and the log says so on every
   * call, because a fixed-code demo switch surviving into production is exactly
   * the kind of thing nobody notices until it matters.
   *
   * Prefer a real code. Set this only when the alternative is showing nothing.
   */
  if ((process.env.VOICE_DEMO_PIN ?? "").trim().toLowerCase() === "any") {
    console.warn(
      JSON.stringify({
        evt: "voice_demo_pin_any",
        at: new Date().toISOString(),
        entityId: claims.entityId,
        user: claims.user,
        digits_received: String(args.pin ?? "").replace(/\D/g, "").length,
        detail: "VOICE_DEMO_PIN=any — verified without checking the code",
      }),
    );
    markCallVerified(claims.callId);
    const token = upgradeSession(claims);
    return ok(
      "Thank you, you're verified. What can I help with?",
      { auth_level: "verified", factor: "pin", tools_allowed: toolsWhenVerified },
      token,
    );
  }

  if (!args.pin) {
    /*
     * The argument names that actually arrived, when the PIN is not among them.
     *
     * This branch used to return silently, so a tool sending `Pin` instead of
     * `pin` — or nothing at all — produced a polite "read me the code again"
     * and not one line anywhere. The mismatch logging below never ran, because
     * verifyPin was never reached, which made the logs look like the PIN was
     * being compared and rejected when it had never been received.
     *
     * Names only, never values: one of these is a PIN.
     */
    console.warn(
      JSON.stringify({
        evt: "voice_pin_absent",
        at: new Date().toISOString(),
        entityId: claims.entityId,
        user: claims.user,
        args_received: Object.keys(args as object).sort(),
        detail: "no `pin` argument in the request — the tool never sent the digits",
      }),
    );
    // Names both routes, so a caller without the app is not stuck being asked
    // repeatedly for something they cannot get.
    return refuse(
      "bad_request",
      "Open the app and read me the six-digit code it shows. If you can't get to the app, I can text you a code instead.",
    );
  }

  if (!verifyPin(args.pin, claims.entityId, claims.user)) {
    /*
     * The pair the code was derived AGAINST, when one does not match.
     *
     * The PIN is a function of (entityId, user) on both sides: the app fetches
     * it as the signed-in customer's first name lowercased, and this route uses
     * the slug from VOICE_ALLOWED_CALLERS. Nothing forces those to agree, and
     * when they drift both sides are internally correct — two valid codes for
     * two different keys — so the caller reads a code that is genuinely right
     * and is genuinely refused, with nothing anywhere saying why. Handover §8
     * names this and it still cost a night.
     *
     * The pair is not a secret; the code derived from it is, and that is never
     * logged — only how many digits arrived. Printing the key turns an
     * unfalsifiable "it doesn't match" into "you asked for deepa and the
     * whitelist says ajmal".
     *
     * And the digit count separates the third cause, which is the one that
     * actually bit: verifyPin strips non-digits and requires six, so an
     * unresolved "{{pin}}" reduces to the empty string and is refused with the
     * SAME sentence as a genuinely wrong code. A template that never
     * interpolated and a caller reading the wrong screen sound identical on the
     * phone and need opposite fixes. digits_received: 0 says which in one line.
     */
    const digits = String(args.pin).replace(/\D/g, "").length;
    console.warn(
      JSON.stringify({
        evt: "voice_pin_mismatch",
        at: new Date().toISOString(),
        entityId: claims.entityId,
        user: claims.user,
        digits_received: digits,
        looked_like_template: /\{\{|\}\}/.test(String(args.pin)),
        detail:
          digits === 6
            ? `six digits arrived and did not match — the code must come from /api/voice/pin?entity=${claims.entityId}&user=${claims.user}`
            : "not six digits — the tool sent something that is not a code, so the PIN never left the platform",
      }),
    );
    const { locked, left } = recordAttempt(callId);
    if (locked) {
      return refuse(
        "not_authorised",
        "That's not matching. I'll stop there for security — the app can help.",
      );
    }
    // Naming the likely cause beats repeating "incorrect": the common failure is
    // a code that rolled over while the caller was reading it, not a wrong code.
    return refuse(
      "auth_required",
      `That didn't match — the code changes every ninety seconds, so read me the one showing now. ${left} ${
        left === 1 ? "try" : "tries"
      } left.`,
    );
  }

  /*
   * Recorded against the callId sealed in the token, not `body.call_id`, which
   * the tools do not send. This is what VOICE_STICKY_VERIFY reads; with the flag
   * off it is written and never consulted, which is deliberate — the record has
   * to already exist for the flag to be worth flipping mid-demo.
   */
  markCallVerified(claims.callId);

  // Re-minted rather than mutated: there is no session store, and the old
  // lower-privilege token stays valid until it expires while conferring nothing.
  const token = upgradeSession(claims);
  return ok(
    "Thank you, you're verified. What can I help with?",
    { auth_level: "verified", factor: "pin", tools_allowed: toolsWhenVerified },
    token,
  );
});
