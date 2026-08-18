"use client";

// "Has the client taken over yet?"
//
// The store rehydrates from sessionStorage synchronously, so the client's
// first render knows things the server's never could. Every screen needs to
// hold that back for exactly one frame or React sees two different trees.
//
// The version we had written twenty-odd times was:
//
//   const [mounted, setMounted] = useState(false);
//   useEffect(() => setMounted(true), []);
//
// which works, but sets state inside an effect — a render, then a second
// render, on every screen, and the lint rule that flags it was right. This is
// the same answer with no extra render and no state: `getServerSnapshot`
// returns false, `getSnapshot` returns true, and React swaps between them at
// hydration on its own.
//
// The subscribe function never fires because the value never changes after
// hydration, so it returns a no-op unsubscribe.

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
