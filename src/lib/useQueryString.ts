"use client";

// The query string, read on the client, without suspending the tree.
//
// `useSearchParams` is the obvious hook and it cost us the whole Statement
// page: it makes everything up to the nearest Suspense boundary a client-side
// rendering bailout, so the served HTML carried a pending boundary and no
// content, and the browser then waited on a chunk that never came. Opening
// /statement directly, or refreshing on it, showed an empty shell for good.
//
// The deeper reason not to use it here: this app has NOTHING to render on the
// server. The store lives in sessionStorage, so `customer` and `entity` are
// always undefined during SSR and every screen returns the skeleton frame.
// Server-side search params could never have changed a single pixel — the hook
// was buying nothing and charging the page for it.
//
// So: the same shape as `useHydrated` — `useSyncExternalStore` with an empty
// server snapshot and the real value on the client. No suspending, no boundary,
// no setState in an effect.
//
// Subscribing needs one trick. `router.push`/`replace` change the URL without
// firing `popstate`, so History is patched once to announce itself. Everything
// that changes the URL therefore goes through a notification, whether it came
// from the app, the back button, or the address bar.

import { useSyncExternalStore } from "react";

const EVENT = "app:urlchange";

let patched = false;

function patchHistory() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  for (const name of ["pushState", "replaceState"] as const) {
    const original = history[name];
    history[name] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(EVENT));
      return result;
    };
  }
}

function subscribe(onChange: () => void): () => void {
  patchHistory();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

// A string, so React's identity check compares by value and a re-render with
// the same URL does not loop. Returning a fresh URLSearchParams here would.
const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

/** The current `?a=b` string — `""` on the server and before hydration. */
export function useQueryString(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
