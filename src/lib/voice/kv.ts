/*
 * The smallest possible shared store.
 *
 * A draft is spoken on a phone and approved in a browser, and that hand-off
 * cannot be stateless. Locally `next dev` is one process, so a Map is perfectly
 * reliable. On Vercel the call writes into one instance and the browser polls
 * another, so the draft is created, logged as created, and invisible — which is
 * exactly what happened: draft_invoice returned ok and eight consecutive polls
 * came back empty.
 *
 * Upstash over REST rather than a Redis client, because there is no connection
 * to pool from a serverless function and `fetch` is already there. Two env vars,
 * no dependency.
 *
 * Every call falls back to process memory: if the variables are absent (local
 * dev, the probes) or the request fails (network, quota, a bad token), the
 * product keeps working exactly as it did before, minus the sharing. A store
 * that breaks the phone line when a cache is unreachable would be a worse
 * trade than the bug it fixes.
 */

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when a shared store is configured. False means process memory only. */
export const kvShared = Boolean(URL_ && TOKEN);

const memory = new Map<string, string>();

/** Logged once per process, not per request — this must not spam a live call. */
let warned = false;
function warnOnce(detail: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    JSON.stringify({
      evt: "voice_kv_unavailable",
      at: new Date().toISOString(),
      detail,
      consequence: "drafts are per-instance again; the Today screen may not see them",
    }),
  );
}

async function cmd(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_ as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json() as { result: unknown }).result;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (kvShared) {
    try {
      const r = await cmd(["GET", key]);
      return typeof r === "string" ? (JSON.parse(r) as T) : null;
    } catch (e) {
      warnOnce(`read failed: ${(e as Error).message}`);
    }
  }
  const v = memory.get(key);
  return v ? (JSON.parse(v) as T) : null;
}

/** TTL keeps a demo's leftovers from becoming next week's confusion. */
export async function kvSet<T>(key: string, value: T, ttlSeconds = 86_400): Promise<void> {
  const s = JSON.stringify(value);
  memory.set(key, s); // always, so a failed write still serves this instance
  if (!kvShared) return;
  try {
    await cmd(["SET", key, s, "EX", ttlSeconds]);
  } catch (e) {
    warnOnce(`write failed: ${(e as Error).message}`);
  }
}
