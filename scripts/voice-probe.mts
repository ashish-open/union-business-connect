/*
 * Probe for the voice auth chain. Pure logic, no server, no network.
 *
 * Run: npm run probe:voice
 *
 * These are the cases that actually fail first, per 05_VOICE_AGENT_PLAN.md §8:
 * refusal at cli_only, role caps, token tampering, and caller-ID formatting
 * variance. Written before the read tools exist, on purpose.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.env.VOICE_SESSION_SECRET = "x".repeat(48);
process.env.VOICE_SHARED_SECRET = "y".repeat(32);
process.env.VOICE_ALLOWED_CALLERS = [
  "+919845012345:vikram:owner:nadi-foods",
  "+919812345678:rajesh:owner:rajesh-interiors",
  "+919700000001:arun:manager:nadi-foods",
  "bogus-entry-should-be-dropped",
  "+919999999999:ghost:owner:no-such-entity",
].join(",");
process.env.VOICE_AUTONOMY = "draft";
process.env.VOICE_KILL_SWITCH = "0";
process.env.VOICE_PIN_SECRET = "p".repeat(40);
process.env.VOICE_OTP_SECRET = "o".repeat(40);

/*
 * Dynamic imports on purpose: the modules above read process.env at module
 * scope, so the env has to be set before they load. A static import would be
 * hoisted above the assignments and every check would run against an unset
 * registry.
 */
const { normaliseMobile, resolveCaller, resetRegistryCache, registrations } =
  await import("@/lib/voice/registry");
const { mintSession, verifySession, upgradeSession } = await import("@/lib/voice/session");
const { allowedTools, canUse, refusalFor } = await import("@/lib/voice/policy");
const { authenticate } = await import("@/lib/voice/auth");
const { currentPin, verifyPin, recordAttempt, isLocked, clearAttempts } = await import(
  "@/lib/voice/pin"
);
const { fill, executable } = await import("@/lib/voice/slots");
const { matchName } = await import("@/lib/voice/match");
const { putDraft, editDraft, execute, listDrafts, pendingCount, refFor, resetStore } =
  await import("@/lib/voice/store");

let pass = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    pass += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

console.log("\nregistry");

check("normalises every caller-ID format to the same 10 digits", () => {
  const forms = ["+919845012345", "919845012345", "9845012345", "+91 98450 12345", "098450-12345"];
  const all = new Set(forms.map(normaliseMobile));
  assert.equal(all.size, 1, `expected one form, got ${[...all].join(", ")}`);
  assert.equal([...all][0], "9845012345");
});

check("drops malformed whitelist entries without throwing", () => {
  resetRegistryCache();
  const regs = registrations();
  // 5 entries in, 1 is malformed -> 4 parsed. The ghost entry parses fine but
  // must fail to *resolve*, which is the next test.
  assert.equal(regs.length, 4);
});

check("resolves an owner to the right person and business", () => {
  const c = resolveCaller("+919845012345");
  assert.ok(c, "expected a caller");
  assert.equal(c.role, "owner");
  assert.equal(c.entityId, "nadi-foods");
  assert.equal(c.displayName, "Vikram");
  assert.equal(c.entityName, "Nadi Foods");
  assert.equal(c.hasChecker, true, "Nadi Foods has a second user");
});

check("resolves a manager, who is not a bank customer", () => {
  const c = resolveCaller("9700000001");
  assert.ok(c, "expected a caller");
  assert.equal(c.role, "manager");
  assert.equal(c.entityId, "nadi-foods");
});

check("refuses an unwhitelisted number", () => {
  assert.equal(resolveCaller("9000000000"), null);
});

check("fails closed when a whitelist entry names an entity that does not exist", () => {
  assert.equal(resolveCaller("9999999999"), null);
});

console.log("\nsession token");

const caller = resolveCaller("+919845012345")!;

check("mints and verifies", () => {
  const t = mintSession(caller, "call-1", "cli_only");
  const v = verifySession(t, "call-1");
  assert.ok(v.ok);
  assert.equal(v.claims.entityId, "nadi-foods");
  assert.equal(v.claims.authLevel, "cli_only");
});

check("rejects a tampered payload", () => {
  const t = mintSession(caller, "call-1", "cli_only");
  const [payload, mac] = t.slice(3).split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.authLevel = "verified"; // the attack: self-promote
  const forged =
    "vs_" + Buffer.from(JSON.stringify(claims)).toString("base64url") + "." + mac;
  const v = verifySession(forged, "call-1");
  assert.equal(v.ok, false);
  assert.equal((v as { reason: string }).reason, "bad_signature");
});

check("rejects a token replayed against a different call", () => {
  const t = mintSession(caller, "call-1", "verified");
  const v = verifySession(t, "call-2");
  assert.equal(v.ok, false);
  assert.equal((v as { reason: string }).reason, "call_mismatch");
});

check("survives a full-length call, expires after it", () => {
  const now = Date.now();
  // Sarvam's Max call length allows 25 minutes, so a token minted at pickup
  // must still be valid at minute 25 — otherwise the longest calls, where the
  // caller is already struggling, are the ones that break.
  const atPickup = mintSession(caller, "call-1", "verified", now - 25 * 60 * 1000);
  assert.equal(verifySession(atPickup, "call-1", now).ok, true, "died mid-call");

  const stale = mintSession(caller, "call-1", "verified", now - 31 * 60 * 1000);
  const v = verifySession(stale, "call-1", now);
  assert.equal(v.ok, false);
  assert.equal((v as { reason: string }).reason, "expired");
});

check("rejects junk", () => {
  for (const junk of ["", "vs_", "nope", "vs_a.b"]) {
    assert.equal(verifySession(junk, "call-1").ok, false, `accepted ${junk}`);
  }
});

check("step-up re-mints at verified without mutating the original", () => {
  const low = mintSession(caller, "call-1", "cli_only");
  const v = verifySession(low, "call-1");
  assert.ok(v.ok);
  const high = upgradeSession(v.claims);
  const hv = verifySession(high, "call-1");
  assert.ok(hv.ok);
  assert.equal(hv.claims.authLevel, "verified");
  // the old token still verifies, and still confers only cli_only
  const again = verifySession(low, "call-1");
  assert.ok(again.ok);
  assert.equal(again.claims.authLevel, "cli_only");
});

console.log("\npolicy");

check("cli_only cannot reach a single tool that returns a figure", () => {
  const tools = allowedTools({ role: "owner", authLevel: "cli_only" });
  for (const t of ["lookup_account_balance", "list_transactions", "get_party_payments"] as const) {
    assert.ok(!tools.includes(t), `${t} leaked at cli_only`);
  }
  assert.ok(tools.includes("verify_identity"), "must be able to step up");
  assert.ok(tools.includes("list_pending_approvals"), "non-numeric read is fine");
});

check("verified owner gets reads and drafts", () => {
  const tools = allowedTools({ role: "owner", authLevel: "verified" });
  assert.ok(tools.includes("lookup_account_balance"));
  assert.ok(tools.includes("draft_invoice"));
  assert.ok(tools.includes("draft_payout"));
});

check("a manager is refused every draft, even when verified", () => {
  const input = { role: "manager", authLevel: "verified" } as const;
  assert.ok(canUse("lookup_account_balance", input), "reads are fine");
  for (const t of ["draft_invoice", "draft_payout", "draft_beneficiary"] as const) {
    assert.ok(!canUse(t, input), `${t} leaked to a manager`);
    assert.equal(refusalFor(t, input), "role_not_permitted");
  }
});

check("nobody, at any role or level, can approve over voice", () => {
  for (const role of ["owner", "accountant", "manager"] as const) {
    for (const authLevel of ["cli_only", "verified"] as const) {
      const tools: string[] = allowedTools({ role, authLevel });
      assert.ok(
        !tools.some((t) => t.includes("approve") || t.includes("execute") || t.includes("pay_")),
        `an approval/execute capability appeared for ${role}/${authLevel}`,
      );
    }
  }
});

check("autonomy ceiling below draft removes every draft tool", () => {
  process.env.VOICE_AUTONOMY = "suggest";
  const tools = allowedTools({ role: "owner", authLevel: "verified" });
  assert.ok(tools.includes("lookup_account_balance"), "reads survive");
  assert.ok(!tools.includes("draft_invoice"), "draft leaked under suggest");
  assert.equal(refusalFor("draft_invoice", { role: "owner", authLevel: "verified" }), "autonomy_ceiling");
  process.env.VOICE_AUTONOMY = "draft";
});

check("kill switch empties the allow-list for everyone", () => {
  process.env.VOICE_KILL_SWITCH = "1";
  assert.deepEqual(allowedTools({ role: "owner", authLevel: "verified" }), []);
  assert.equal(refusalFor("lookup_account_balance", { role: "owner", authLevel: "verified" }), "agent_disabled");
  process.env.VOICE_KILL_SWITCH = "0";
});

console.log("\ninbound auth");

function hdrs(bearer?: string, ip = "4.213.167.70"): Headers {
  const h = new Headers();
  if (bearer) h.set("authorization", `Bearer ${bearer}`);
  h.set("x-forwarded-for", `${ip}, 10.0.0.1`);
  return h;
}

check("accepts the right bearer from the right IP", () => {
  process.env.SARVAM_EGRESS_IPS = "4.213.167.70";
  assert.equal(authenticate(hdrs("y".repeat(32))).ok, true);
});

check("rejects a wrong bearer", () => {
  const r = authenticate(hdrs("z".repeat(32)));
  assert.equal(r.ok, false);
  assert.equal((r as { why: string }).why, "bad_bearer");
});

check("rejects a missing bearer", () => {
  assert.equal(authenticate(hdrs()).ok, false);
});

check("rejects an unexpected egress IP", () => {
  const r = authenticate(hdrs("y".repeat(32), "203.0.113.9"));
  assert.equal(r.ok, false);
  assert.equal((r as { why: string }).why, "bad_ip");
});

check("takes the first x-forwarded-for hop, not the last", () => {
  process.env.SARVAM_EGRESS_IPS = "4.213.167.70";
  const h = new Headers();
  h.set("authorization", `Bearer ${"y".repeat(32)}`);
  h.set("x-forwarded-for", "4.213.167.70, 203.0.113.9");
  assert.equal(authenticate(h).ok, true);
});

console.log("\napp-generated PIN");

check("app and API derive the same PIN with nothing stored", () => {
  const { pin, secondsLeft } = currentPin("nadi-foods", "vikram");
  assert.match(pin, /^\d{6}$/);
  assert.ok(secondsLeft > 0 && secondsLeft <= 90);
  assert.equal(verifyPin(pin, "nadi-foods", "vikram"), true);
});

check("a PIN is useless for a different business or user", () => {
  const { pin } = currentPin("nadi-foods", "vikram");
  assert.equal(verifyPin(pin, "rajesh-interiors", "vikram"), false);
  assert.equal(verifyPin(pin, "nadi-foods", "arun"), false);
});

check("tolerates the caller reading a PIN across the rollover", () => {
  // Aligned to a window boundary, not Date.now().
  //
  // Unaligned, this failed about one run in ninety: when t landed in the final
  // second of a 90s window, t+91s crossed TWO boundaries, so the single grace
  // window genuinely no longer covered it and the assertion was right to fail.
  // The test was measuring its own start phase as much as the grace logic.
  //
  // A gate that fails 1-in-90 is worse than no gate — it trains everyone to
  // re-run it rather than read it.
  const t = Math.floor(Date.now() / 90_000) * 90_000;
  const { pin } = currentPin("nadi-foods", "vikram", t);
  // 91s later the window has rolled, but the previous one is still accepted.
  assert.equal(verifyPin(pin, "nadi-foods", "vikram", t + 91_000), true);
  // Two windows later it must not be.
  assert.equal(verifyPin(pin, "nadi-foods", "vikram", t + 200_000), false);
});

check("rejects junk and wrong-length input", () => {
  for (const bad of ["", "12345", "1234567", "abcdef", "000000"]) {
    // 000000 could in principle be a real code; assert only that it is checked,
    // not blindly accepted.
    const ok = verifyPin(bad, "nadi-foods", "vikram");
    if (bad === "000000") continue;
    assert.equal(ok, false, `accepted ${bad}`);
  }
});

check("locks the call after three attempts", () => {
  clearAttempts("call-pin");
  assert.equal(isLocked("call-pin"), false);
  assert.equal(recordAttempt("call-pin").locked, false);
  assert.equal(recordAttempt("call-pin").locked, false);
  assert.equal(recordAttempt("call-pin").locked, true);
  assert.equal(isLocked("call-pin"), true);
});

console.log("\nOTP fallback — for callers who can't reach the app");

const { issueOtp, verifyOtp, MAX_SENDS } = await import("@/lib/voice/otp");

check("issues a code and verifies it, with nothing stored", () => {
  const iss = issueOtp("call-otp")!;
  assert.match(iss.code, /^\d{6}$/);
  assert.ok(iss.token.startsWith("vo_"));
  assert.equal(verifyOtp(iss.code, iss.token, "call-otp"), "ok");
});

check("the token never carries the code in readable form", () => {
  const iss = issueOtp("call-otp")!;
  const payload = Buffer.from(iss.token.slice(3).split(".")[0], "base64url").toString();
  assert.ok(!payload.includes(iss.code), "the code leaked into the token");
});

check("a token from one call cannot be used in another", () => {
  const iss = issueOtp("call-a")!;
  assert.equal(verifyOtp(iss.code, iss.token, "call-b"), "bad_token");
});

check("rejects a tampered token rather than trusting it", () => {
  const iss = issueOtp("call-otp")!;
  const forged = "vo_" + Buffer.from(JSON.stringify({ h: "x", callId: "call-otp", send: 1, exp: 9e9 })).toString("base64url") + ".nope";
  assert.equal(verifyOtp(iss.code, forged, "call-otp"), "bad_token");
});

check("expiry is reported separately from a wrong code", () => {
  const past = Date.now() - 6 * 60 * 1000;
  const iss = issueOtp("call-otp", undefined, past)!;
  // A slow text is not the caller's fault and must not cost them an attempt.
  assert.equal(verifyOtp(iss.code, iss.token, "call-otp"), "expired");
});

check("wrong code is wrong, and a 5-digit entry is not accepted", () => {
  const iss = issueOtp("call-otp")!;
  const wrong = String((Number(iss.code) + 1) % 1000000).padStart(6, "0");
  assert.equal(verifyOtp(wrong, iss.token, "call-otp"), "wrong");
  assert.equal(verifyOtp(iss.code.slice(0, 5), iss.token, "call-otp"), "wrong");
});

check("caps resends, so this cannot be used to pester the real owner", () => {
  let token: string | undefined;
  for (let i = 1; i <= MAX_SENDS; i++) {
    const iss = issueOtp("call-cap", token);
    assert.ok(iss, `send ${i} should be allowed`);
    token = iss!.token;
  }
  assert.equal(issueOtp("call-cap", token), null, "one past the cap must be refused");
});

console.log("\nslot filling — the agent's probing");

check("bare 'create an invoice' asks for the customer first, one thing at a time", () => {
  const r = fill("invoice", []);
  assert.equal(r.complete, false);
  assert.equal(r.nextPrompt, "Who is the invoice for?");
  assert.equal(r.missing.length, 3, "customer, item and amount are required");
});

check("probes for the next gap as slots arrive", () => {
  const after = fill("invoice", [{ key: "party", value: "Acme Corp", source: "voice" }]);
  assert.equal(after.nextPrompt, "What are you billing for?");
  const later = fill("invoice", [
    { key: "party", value: "Acme Corp", source: "voice" },
    { key: "item", value: "Consulting", source: "voice" },
  ]);
  assert.equal(later.nextPrompt, "And the amount?");
});

check("optional slots never block completion", () => {
  const r = fill("invoice", [
    { key: "party", value: "Acme Corp", source: "voice" },
    { key: "item", value: "Consulting", source: "voice" },
    { key: "amount", value: 50000, source: "voice" },
  ]);
  assert.equal(r.complete, true, "qty and terms are optional");
  assert.equal(r.nextPrompt, "");
});

check("beneficiary completes by voice but is NOT executable until the app fills digits", () => {
  const vals = [{ key: "party", value: "Sharma Traders", source: "voice" as const }];
  const r = fill("beneficiary", vals);
  assert.equal(r.complete, true, "nothing left to ask on the phone");
  assert.equal(r.pendingInApp.length, 2, "account and IFSC are typed, not dictated");
  assert.equal(executable("beneficiary", vals), false, "Execute must stay locked");
});

check("account number and IFSC are never askable by voice", () => {
  const r = fill("beneficiary", []);
  assert.ok(
    !r.missing.some((s) => s.key === "account" || s.key === "ifsc"),
    "digits must not be dictated",
  );
});

console.log("\nname matching — the Amal / Amul problem");

const KNOWN = ["Amul Distributors", "Acme Corp", "Kamal Textiles", "Kamla Enterprises"];

check("'Amal' does NOT hide inside 'Kamal' — the substring bug", () => {
  const r = matchName("Amal", KNOWN);
  assert.notEqual(
    r.kind === "confident" || r.kind === "confirm" ? r.value : null,
    "Kamal Textiles",
    "raw substring matching resolved this to Kamal Textiles",
  );
});

check("'Amal' with both Amul and Kamal on file is genuinely ambiguous — so ask", () => {
  const r = matchName("Amal", KNOWN);
  assert.equal(r.kind, "ambiguous", "one letter from two different payees is a coin flip");
  if (r.kind === "ambiguous") {
    assert.ok(r.options.includes("Amul Distributors"));
    assert.ok(r.options.includes("Kamal Textiles"));
  }
});

check("a lone near-miss asks 'did you mean' rather than substituting", () => {
  const r = matchName("Amal", ["Amul Distributors", "Acme Corp"]);
  assert.equal(r.kind, "confirm", "close enough to offer, not close enough to assume");
  if (r.kind === "confirm") assert.equal(r.value, "Amul Distributors");
});

check("resolves a partial name confidently on whole-word match", () => {
  const r = matchName("Acme", KNOWN);
  assert.equal(r.kind, "confident");
  if (r.kind === "confident") {
    assert.equal(r.value, "Acme Corp");
    assert.equal(r.substituted, true, "the screen should still show what was said");
  }
});

check("asks which, when two candidates are genuinely inseparable", () => {
  const r = matchName("Sharma", ["Sharma Traders", "Sharma Textiles", "Acme Corp"]);
  assert.equal(r.kind, "ambiguous");
  if (r.kind === "ambiguous") assert.equal(r.options.length, 2);
});

check("returns nothing for a party we do not have", () => {
  assert.equal(matchName("Reliance Industries", KNOWN).kind, "none");
});

console.log("\ndraft store — idempotency, edit, execute");

const INV = [
  { key: "party", value: "Acme Corp", source: "voice" as const },
  { key: "item", value: "Consulting", source: "voice" as const },
  { key: "amount", value: 50000, source: "voice" as const },
];

check("the same utterance twice yields one draft", () => {
  resetStore();
  const a = putDraft({ kind: "invoice", entityId: "e1", requestedBy: "vikram", callId: "c1", values: INV });
  const b = putDraft({ kind: "invoice", entityId: "e1", requestedBy: "vikram", callId: "c1", values: INV });
  assert.equal(a.ref, b.ref);
  assert.equal(listDrafts("e1").length, 1);
});

check("'fifty thousand' and '50,000' collapse to the same reference", () => {
  const spoken = refFor("c1", "invoice", [{ key: "amount", value: "50,000", source: "voice" }]);
  const typed = refFor("c1", "invoice", [{ key: "amount", value: "50000", source: "voice" }]);
  assert.equal(spoken, typed);
});

check("a partial draft is 'collecting', not offered for execution", () => {
  resetStore();
  const d = putDraft({
    kind: "invoice",
    entityId: "e1",
    requestedBy: "vikram",
    callId: "c2",
    values: [{ key: "party", value: "Acme Corp", source: "voice" }],
  });
  assert.equal(d.state, "collecting");
  assert.equal(execute(d.ref, "INV-1"), undefined, "must not execute an incomplete draft");
});

check("editing a misheard name makes it ready and clears the substitution flag", () => {
  resetStore();
  const d = putDraft({
    kind: "invoice",
    entityId: "e1",
    requestedBy: "vikram",
    callId: "c3",
    values: [
      { key: "party", value: "Amul Distributors", heard: "Amal", substituted: true, source: "voice" },
      { key: "item", value: "Consulting", source: "voice" },
      { key: "amount", value: 50000, source: "voice" },
    ],
  });
  const edited = editDraft(d.ref, "party", "Amal Traders");
  assert.ok(edited);
  const party = edited.values.find((v) => v.key === "party")!;
  assert.equal(party.value, "Amal Traders");
  assert.equal(party.source, "app");
  assert.equal(party.substituted, false, "a human has now confirmed it");
  assert.equal(edited.state, "ready");
});

check("execute is idempotent — a double tap cannot create two records", () => {
  resetStore();
  const d = putDraft({ kind: "invoice", entityId: "e1", requestedBy: "vikram", callId: "c4", values: INV });
  assert.equal(d.state, "ready");
  assert.ok(execute(d.ref, "INV-1"));
  assert.equal(execute(d.ref, "INV-2"), undefined, "second execute must be refused");
});

check("an executed draft can no longer be edited", () => {
  resetStore();
  const d = putDraft({ kind: "invoice", entityId: "e1", requestedBy: "vikram", callId: "c5", values: INV });
  execute(d.ref, "INV-1");
  assert.equal(editDraft(d.ref, "amount", 999), undefined);
});

check("the nav badge counts only what still needs a human", () => {
  resetStore();
  const a = putDraft({ kind: "invoice", entityId: "e1", requestedBy: "vikram", callId: "c6", values: INV });
  putDraft({
    kind: "invoice",
    entityId: "e1",
    requestedBy: "vikram",
    callId: "c7",
    values: [{ key: "party", value: "Acme Corp", source: "voice" }],
  });
  assert.equal(pendingCount("e1"), 2);
  execute(a.ref, "INV-1");
  assert.equal(pendingCount("e1"), 1, "executed drafts leave the badge");
  assert.equal(pendingCount("other-entity"), 0, "scoped per business");
});

console.log("\nexecute — mapping a draft onto the records the app already has");

const { toInvoice, toPayee } = await import("@/lib/voice/execute");
const { docTotals } = await import("@/lib/docs");

check("the invoice total equals the amount the caller agreed to", () => {
  const doc = toInvoice(
    [
      { key: "party", value: "Acme Corp", source: "voice" },
      { key: "item", value: "Consulting", source: "voice" },
      { key: "amount", value: 50000, source: "voice" },
    ],
    { issueDate: "2026-07-29", existingCount: 41 },
  );
  // The figure read back on the call must be the figure on the document. If tax
  // were added on top, the caller approved one number and got another.
  assert.equal(docTotals(doc).total, 50000);
  assert.equal(doc.number, "INV-0042");
  assert.equal(doc.party, "Acme Corp");
});

check("quantity divides into a unit rate that reproduces the total", () => {
  const doc = toInvoice(
    [
      { key: "party", value: "Acme Corp", source: "voice" },
      { key: "item", value: "Boxes", source: "voice" },
      { key: "qty", value: 4, source: "voice" },
      { key: "amount", value: 20000, source: "voice" },
    ],
    { issueDate: "2026-07-29", existingCount: 0 },
  );
  assert.equal(doc.lines[0].qty, 4);
  assert.equal(doc.lines[0].rate, 5000);
  assert.equal(docTotals(doc).total, 20000);
});

check("lands as 'open', not 'draft' — books.ts excludes drafts", () => {
  const doc = toInvoice(
    [
      { key: "party", value: "Acme Corp", source: "voice" },
      { key: "item", value: "Consulting", source: "voice" },
      { key: "amount", value: 1000, source: "voice" },
    ],
    { issueDate: "2026-07-29", existingCount: 0 },
  );
  // A human already approved every field. Landing it as a draft would ask them
  // twice AND hide it from the books it is supposed to appear in.
  assert.equal(doc.status, "open");
});

check("due date honours the terms the caller gave", () => {
  const doc = toInvoice(
    [
      { key: "party", value: "Acme Corp", source: "voice" },
      { key: "item", value: "Consulting", source: "voice" },
      { key: "amount", value: 1000, source: "voice" },
      { key: "dueDays", value: 15, source: "voice" },
    ],
    { issueDate: "2026-07-29", existingCount: 0 },
  );
  assert.equal(doc.dueDate, "2026-08-13");
});

check("payee normalises IFSC to upper case", () => {
  const p = toPayee([
    { key: "party", value: "Sharma Traders", source: "voice" },
    { key: "account", value: "50100123456789", source: "app" },
    { key: "ifsc", value: "punb0123456", source: "app" },
  ]);
  assert.equal(p.ifsc, "PUNB0123456");
  assert.equal(p.account, "50100123456789");
});

/*
 * .env.example against what the code actually reads.
 *
 * A missing variable is not a crash, which is what makes it expensive. The build
 * is fine, the deploy is fine, tsc and lint are fine, and the failure only
 * appears on a live call — as behaviour, not as an error.
 *
 * VOICE_PIN_SECRET was missing from the template, and its symptom is a good
 * argument for asserting this: pin.ts throws without it, so /api/voice/pin
 * answers 503 and verify_identity can never accept an app code, while the SMS
 * fallback keeps working because otp.ts defaults to the session secret. The
 * agent therefore appears to work and the primary factor is simply dead.
 */
console.log("\nenvironment — the template against what the code reads");

check(".env.example documents every variable the voice surface reads", () => {
  // fileURLToPath, not `.pathname` — a URL percent-encodes, so a checkout under
  // a directory with a space in it resolved to `PNB%20Businessconnect` and this
  // check died on ENOENT instead of running. It never once compared anything.
  const root = fileURLToPath(new URL("..", import.meta.url));
  const template = readFileSync(`${root}.env.example`, "utf8");
  const declared = new Set(
    [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]),
  );

  const dir = `${root}src/lib/voice`;
  const read = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    for (const m of readFileSync(`${dir}/${file}`, "utf8").matchAll(
      /process\.env\.([A-Z][A-Z0-9_]*)/g,
    )) {
      if (m[1] !== "NODE_ENV") read.add(m[1]);
    }
  }

  const undocumented = [...read].filter((v) => !declared.has(v)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `read by src/lib/voice but absent from .env.example: ${undocumented.join(", ")}`,
  );
});

console.log(`\n${pass} passed${process.exitCode ? " — with failures above" : ""}\n`);
