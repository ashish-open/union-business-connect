/*
 * Sends a one-time code to the registered number.
 *
 * The fallback path: offered when the caller says they cannot get to the app, not
 * led with — the app PIN is the stronger factor and has no SIM-swap exposure.
 *
 * Note the destination. The code goes to the number on the whitelist, never to a
 * number supplied on the call, so a caller who has spoofed the caller ID can
 * trigger this but cannot receive it.
 */

import { ok, refuse, tool } from "@/lib/voice/handler";
import { MAX_SENDS, deliverOtp, issueOtp } from "@/lib/voice/otp";
import { isLocked } from "@/lib/voice/pin";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 5;
export const dynamic = "force-dynamic";

export const POST = tool<{ otp_token?: string }>(
  "request_otp",
  ({ claims, args, callId }) => {
    if (claims.authLevel === "verified") {
      return ok("You're already verified — no code needed.", { auth_level: "verified" });
    }

    // A locked call must not be able to keep sending messages to the owner's
    // handset. Failed PIN attempts and OTP sends share the lock deliberately.
    if (isLocked(callId)) {
      return refuse(
        "not_authorised",
        "I've had too many attempts on this call. Please use the app, or call back.",
      );
    }

    const issued = issueOtp(callId, args.otp_token);
    if (!issued) {
      return refuse(
        "not_authorised",
        `I've already sent ${MAX_SENDS} codes on this call. Let's not send more — the app can verify you instead.`,
      );
    }

    deliverOtp(claims.mobile, issued.code);

    // The code is never returned here and must never be spoken. Only the opaque
    // token comes back, which the agent carries and passes to verify_identity.
    const again = issued.sendCount > 1 ? " This one replaces the last." : "";
    return ok(
      `I've sent a six-digit code by text to the number registered on your account.${again} Read it back to me when it arrives.`,
      { otp_token: issued.token, sent_to_registered_number: true, send: issued.sendCount },
    );
  },
);
