/*
 * What the agent is allowed to do, computed from three independent inputs:
 * the kill switch, the autonomy ceiling, and the caller's role.
 *
 * All three are enforced here rather than in the agent's prompt. A prompt
 * instruction is not a control — a jailbreak or a hallucinated tool name must
 * fail because the capability isn't reachable, not because the model was asked
 * nicely. 05_VOICE_AGENT_PLAN.md §1.1, §2.4.
 */

import {
  ALWAYS_TOOLS,
  DRAFT_TOOLS,
  READ_TOOLS,
  type AuthLevel,
  type Autonomy,
  type Role,
  type ToolName,
} from "./types";

/**
 * One switch that stops every call at the door. Checked in `session_start`, so
 * a disabled agent never reaches a single tool.
 * EXPERIENCE_SPEC §10a requires this to exist.
 */
export function killSwitchOn(): boolean {
  return process.env.VOICE_KILL_SWITCH === "1";
}

/**
 * Env-backed for now, which means changing it is a redeploy. That is an honest
 * limitation of the no-backend architecture rather than a design choice — noted
 * in plan §5.4 so nobody mistakes it for one.
 */
export function autonomyCeiling(): Autonomy {
  const raw = (process.env.VOICE_AUTONOMY ?? "draft").toLowerCase();
  return raw === "observe" || raw === "suggest" ? raw : "draft";
}

/**
 * Role caps. Mirrors the app's maker-checker model rather than inventing a
 * second one.
 *
 * A manager holding a registered handset gets reads only. Note what is absent
 * from every row: approval. Nobody approves over voice, ever — approval is an
 * app action by definition, and a channel that could both draft and approve has
 * defeated the entire design. Plan §2.4.
 */
const ROLE_DRAFTS: Record<Role, readonly ToolName[]> = {
  owner: DRAFT_TOOLS,
  accountant: DRAFT_TOOLS,
  manager: [],
};

/** Reads that never carry a rupee figure, so they survive at cli_only. */
const NON_NUMERIC_READS: readonly ToolName[] = ["list_pending_approvals"];

export interface PolicyInput {
  role: Role;
  authLevel: AuthLevel;
}

/**
 * The allow-list handed to the agent. Sarvam can gate tools on flags returned
 * by the on-start hook, so this list is what actually shapes the agent's
 * behaviour for the call.
 */
export function allowedTools({ role, authLevel }: PolicyInput): ToolName[] {
  if (killSwitchOn() || authLevel === "unknown") return [];

  const autonomy = autonomyCeiling();
  const tools: ToolName[] = [...ALWAYS_TOOLS];

  if (authLevel === "cli_only") {
    // Identification is not authentication (plan §2.3). A spoofed caller ID
    // must not be able to elicit a balance, a party name or an amount — so at
    // this level the only reads permitted are the ones that carry no figures.
    tools.push(...NON_NUMERIC_READS);
    return tools;
  }

  tools.push(...READ_TOOLS);

  if (autonomy === "draft") {
    tools.push(...ROLE_DRAFTS[role]);
  }

  return tools;
}

export function canUse(tool: ToolName, input: PolicyInput): boolean {
  return allowedTools(input).includes(tool);
}

/**
 * Why a tool was refused, so the refusal can be both spoken and logged with a
 * reason. EXPERIENCE_SPEC §10a: the audit records refusals, not just successes.
 */
export function refusalFor(
  tool: ToolName,
  input: PolicyInput,
): "agent_disabled" | "auth_required" | "role_not_permitted" | "autonomy_ceiling" | null {
  if (canUse(tool, input)) return null;
  if (killSwitchOn()) return "agent_disabled";
  if (input.authLevel !== "verified") return "auth_required";
  if ((DRAFT_TOOLS as readonly string[]).includes(tool)) {
    if (autonomyCeiling() !== "draft") return "autonomy_ceiling";
    if (ROLE_DRAFTS[input.role].length === 0) return "role_not_permitted";
  }
  return "role_not_permitted";
}
