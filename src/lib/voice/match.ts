/*
 * Resolving spoken names against the closed set we already hold.
 *
 * "Amal" for "Amul", "Kamal Textiles" for "Kamla Enterprises" — open-vocabulary
 * business names are where speech recognition fails most, and the failure is
 * silent because the transcript reads like a real name.
 *
 * The fix is not a better matcher, it is a smaller haystack: never match against
 * the world, only against parties and items this business already has. A closed
 * set of forty names is a fundamentally easier problem than open transcription,
 * and it is available to us precisely because we sit on the bank's own data.
 *
 * Three outcomes, and the middle one is the point:
 *   confident  -> use it, flag it as substituted so the human can see the swap
 *   ambiguous  -> ask, never guess
 *   none       -> say so, and offer to create it
 */

/*
 * Deliberately dependency-free. The string matching is the part most worth
 * testing in isolation, and keeping the entity graph out of this module means a
 * probe can exercise it without loading the whole application. The
 * entity-aware wrappers live in `resolve.ts`.
 */

export type MatchOutcome<T> =
  /** Safe to use. `substituted` when the resolved name differs from what was said. */
  | { kind: "confident"; value: T; label: string; substituted: boolean }
  /**
   * One plausible near-miss. The agent asks "did you mean X?" rather than
   * quietly substituting — a one-letter slip on a payee name is precisely where
   * confident resolution does the most damage, and one extra question is cheap.
   */
  | { kind: "confirm"; value: T; label: string }
  /** Several candidates too close to separate. The agent asks which. */
  | { kind: "ambiguous"; options: string[] }
  | { kind: "none" };

/** Cheap normalisation: case, punctuation, and the suffixes nobody says aloud. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|enterprises|traders|and|&)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein, iterative and bounded — these strings are short. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

/** 0..1. Length-relative, so a one-letter slip on a short name still scores low. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance(a, b) / longest;
}

/*
 * Thresholds. CONFIDENT is deliberately high and the ambiguity band is
 * deliberately wide, because the cost of the two mistakes is not symmetric:
 * asking one extra question is a small annoyance, while silently substituting
 * the wrong payee is the failure this entire design exists to prevent.
 */
const CONFIDENT = 0.82;
const PLAUSIBLE = 0.62;
/** Two candidates this close together are not distinguishable. Ask. */
const TIE_BAND = 0.08;

const tokens = (s: string): string[] => s.split(" ").filter(Boolean);

/**
 * Whole-word containment, not raw substring.
 *
 * The bug this replaces: `"kamal textiles".includes("amal")` is true, so a
 * caller saying "Amal" resolved confidently to Kamal Textiles. Matching on token
 * boundaries means "Acme" still finds "Acme Corp" while "Amal" no longer hides
 * inside "Kamal".
 */
function tokenSubset(queryTokens: string[], candidateTokens: string[]): boolean {
  const set = new Set(candidateTokens);
  return queryTokens.length > 0 && queryTokens.every((t) => set.has(t));
}

/**
 * Per-token similarity, averaged over the query's tokens.
 *
 * Whole-string comparison alone is length-biased: "Amal" against "Amul
 * Distributors" scores badly purely because the candidate is long, even though
 * the word the caller was reaching for is right there. Comparing each query
 * token against its best candidate token removes that bias.
 */
function tokenSimilarity(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  const best = queryTokens.map((qt) =>
    Math.max(...candidateTokens.map((ct) => similarity(qt, ct))),
  );
  return best.reduce((s, n) => s + n, 0) / best.length;
}

export function matchName(spoken: string, candidates: string[]): MatchOutcome<string> {
  const q = norm(spoken);
  if (!q) return { kind: "none" };
  const qt = tokens(q);

  const scored = candidates
    .map((c) => {
      const n = norm(c);
      const ct = tokens(n);
      const score = tokenSubset(qt, ct)
        ? 0.95
        : Math.max(similarity(q, n), tokenSimilarity(qt, ct));
      return { name: c, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < PLAUSIBLE) return { kind: "none" };

  const runnerUp = scored[1];
  if (runnerUp && best.score - runnerUp.score < TIE_BAND && runnerUp.score >= PLAUSIBLE) {
    return { kind: "ambiguous", options: [best.name, runnerUp.name] };
  }

  if (best.score >= CONFIDENT) {
    return {
      kind: "confident",
      value: best.name,
      label: best.name,
      // Flagged when the resolved name is not what was said, so the approval
      // screen can mark it "check this" rather than presenting it as certain.
      substituted: norm(best.name) !== q,
    };
  }

  // Plausible but not certain. Confirm on the call instead of substituting.
  return { kind: "confirm", value: best.name, label: best.name };
}
