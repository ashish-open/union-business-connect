/*
 * Entity-aware wrappers over the pure matcher in `match.ts`.
 *
 * Split out so the matching logic can be probed without loading the entity
 * graph — `@/lib/parties` transitively pulls in most of the app.
 */

import type { Entity } from "@/data/seed";
import { buildParties } from "@/lib/parties";
import { matchName, type MatchOutcome } from "./match";

export function matchParty(entity: Entity, spoken: string): MatchOutcome<string> {
  return matchName(
    spoken,
    buildParties(entity).map((p) => p.name),
  );
}

/**
 * There is no item master in the seed — `Invoice` carries a customer and a
 * total, not lines. So the known-item set is whatever this session has already
 * created, passed in by the caller.
 *
 * That absence is itself the answer to "what if the item doesn't exist": for a
 * new account, nothing does. A miss is the normal case and the cue to create the
 * item, not an error to report.
 */
export function knownItems(sessionDocs: { description: string }[] = []): string[] {
  return [...new Set(sessionDocs.map((d) => d.description).filter(Boolean))];
}

export function matchItem(
  _entity: Entity,
  spoken: string,
  sessionDocs: { description: string }[] = [],
): MatchOutcome<string> {
  return matchName(spoken, knownItems(sessionDocs));
}
