/*
 * Shared types for the voice surface.
 *
 * The whole voice integration is designed around one invariant: the agent can
 * create a draft and nothing else. These types exist to make that invariant
 * legible — there is no `Execute` shape in here, and there should never be one.
 * See 05_VOICE_AGENT_PLAN.md §3.4.
 */

/** What the caller has proved about themselves, in ascending order. */
export type AuthLevel = "unknown" | "cli_only" | "verified";

/**
 * Role caps what a caller may draft. Mirrors the app's maker-checker model
 * rather than inventing a second one — an outlet manager holding a registered
 * handset must not be able to draft a payout just because the number resolves.
 * Plan §2.4.
 */
export type Role = "owner" | "accountant" | "manager";

/** How much the agent is allowed to do at all, independent of who is calling. */
export type Autonomy = "observe" | "suggest" | "draft";

/** One entry in the number whitelist. */
export interface Registration {
  /** Last 10 digits, no country code, no punctuation. */
  mobile: string;
  /** Matches a BankCustomer.firstName in the seed, lowercased. */
  user: string;
  role: Role;
  /** Entity id, e.g. "nadi-foods". */
  entityId: string;
}

/** Resolved caller: a registration that actually matched seed data. */
export interface Caller extends Registration {
  displayName: string;
  entityName: string;
  /** True when the entity has a second user, so maker-checker applies. */
  hasChecker: boolean;
}

/**
 * The signed, self-contained call session. There is no session store — the
 * token carries its own claims and its own signature, because the no-backend
 * architecture has nowhere to keep server state. Plan §4.
 */
export interface SessionClaims {
  /** Sarvam's conversation id. Binds the token to one call. */
  callId: string;
  mobile: string;
  entityId: string;
  user: string;
  role: Role;
  authLevel: AuthLevel;
  /** Unix seconds. */
  exp: number;
}

/** Every tool call arrives in this envelope. Plan §3.2. */
export interface ToolRequest<A = Record<string, unknown>> {
  call_id?: string;
  session_token?: string;
  idempotency_key?: string;
  args?: A;
}

/**
 * Every tool response. `speak` is mandatory and must always be safe to say
 * verbatim — a voice agent handed a bare error improvises, which is the worst
 * outcome on a banking call. Plan §3.3.
 */
export type ToolResponse<D = unknown> =
  | { ok: true; speak: string; data?: D; session_token?: string }
  | { ok: false; reason: RefusalReason; speak: string };

export type RefusalReason =
  | "unknown_caller"
  | "auth_required"
  | "role_not_permitted"
  | "agent_disabled"
  | "autonomy_ceiling"
  | "bad_request"
  | "not_authorised"
  | "session_expired"
  | "upstream_unavailable";

/** Which tools each auth level and role may reach. Plan §1.1, §2.3, §2.4. */
export const READ_TOOLS = [
  "lookup_account_balance",
  "list_transactions",
  "get_invoices",
  "get_compliance_status",
  "get_cashflow_summary",
  "check_payout_status",
  "get_party_payments",
  "list_recent_payments",
  "list_pending_approvals",
] as const;

export const DRAFT_TOOLS = [
  "draft_invoice",
  "draft_beneficiary",
  "draft_payout",
  "draft_card_change",
] as const;

/*
 * Reachable at every auth level, because none of them reveals anything: two are
 * how a caller proves who they are, and the third is how they reach a human.
 * Gating the means of authentication behind authentication is a locked door with
 * the key inside.
 */
export const ALWAYS_TOOLS = ["verify_identity", "request_otp", "request_callback"] as const;

export type ToolName =
  | (typeof READ_TOOLS)[number]
  | (typeof DRAFT_TOOLS)[number]
  | (typeof ALWAYS_TOOLS)[number];
