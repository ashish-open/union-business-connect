/*
 * The number whitelist: caller ID -> user, role, entity.
 *
 * Env-backed rather than database-backed, per the no-backend decision
 * (05_VOICE_AGENT_PLAN.md §4.6). Format, comma-separated:
 *
 *   VOICE_ALLOWED_CALLERS="+919845012345:vikram:owner:nadi-foods,
 *                          +919812345678:rajesh:owner:rajesh-interiors,
 *                          +919700000001:arun:manager:nadi-foods"
 *
 * Role is in the whitelist because a registered handset is a *person*, not a
 * business. Without it, an outlet manager's phone would carry the owner's
 * authority — the thing a bank reviewer will poke at first. Plan §2.4.
 */

import { BANK_CUSTOMERS, findCustomer } from "@/data/seed";
import type { Caller, Registration, Role } from "./types";

const ROLES: readonly Role[] = ["owner", "accountant", "manager"];

/**
 * Indian caller ID arrives as +91XXXXXXXXXX, 91XXXXXXXXXX or bare 10 digits
 * depending on the originating network, so every comparison happens on the
 * last 10 digits. Getting this wrong produces *intermittent* auth failures,
 * which is the worst way for it to fail.
 */
export function normaliseMobile(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

function parseEntry(entry: string): Registration | null {
  const parts = entry.trim().split(":");
  if (parts.length !== 4) return null;

  const [rawMobile, user, rawRole, entityId] = parts.map((p) => p.trim());
  const mobile = normaliseMobile(rawMobile);
  const role = rawRole.toLowerCase() as Role;

  if (mobile.length !== 10) return null;
  if (!user || !entityId) return null;
  if (!ROLES.includes(role)) return null;

  return { mobile, user: user.toLowerCase(), role, entityId };
}

/**
 * Parsed once per cold start. Malformed entries are dropped rather than
 * throwing: a typo in one entry must not take the whole agent offline, but it
 * must also never silently widen access, so a dropped entry simply doesn't
 * resolve and its caller gets the unknown-caller refusal.
 */
let cache: Registration[] | null = null;

export function registrations(): Registration[] {
  if (cache) return cache;
  const raw = process.env.VOICE_ALLOWED_CALLERS ?? "";
  cache = raw
    .split(",")
    .map(parseEntry)
    .filter((r): r is Registration => r !== null);
  return cache;
}

/** Test seam — the probe script needs to reload after changing env. */
export function resetRegistryCache(): void {
  cache = null;
}

/**
 * Resolve a caller number to a person and a business.
 *
 * Two gates, deliberately separate. First the number must be whitelisted.
 * Then it must resolve against real seed data — a whitelist entry pointing at
 * an entity that doesn't exist is a configuration error, and it must fail
 * closed rather than produce a caller with no data.
 */
export function resolveCaller(rawMobile: string): Caller | null {
  const mobile = normaliseMobile(rawMobile);
  if (mobile.length !== 10) return null;

  const reg = registrations().find((r) => r.mobile === mobile);
  if (!reg) return null;

  // The owner's own handset resolves through the seed's own lookup. A
  // non-owner (manager) won't be in BANK_CUSTOMERS, so fall back to locating
  // the entity directly and take the display name from the whitelist.
  const customer = findCustomer(mobile);
  const entity =
    customer?.entities.find((e) => e.id === reg.entityId) ??
    BANK_CUSTOMERS.flatMap((c) => c.entities).find((e) => e.id === reg.entityId);

  if (!entity) return null;

  const displayName =
    customer?.firstName ?? reg.user.charAt(0).toUpperCase() + reg.user.slice(1);

  return {
    ...reg,
    displayName,
    entityName: entity.name,
    hasChecker: Boolean(entity.secondUser),
  };
}
