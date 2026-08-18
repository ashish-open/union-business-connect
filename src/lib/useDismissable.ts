"use client";

// Modal keyboard behaviour, once, for every sheet in the app.
//
// The audit found all fifteen doing the same three things wrong: Escape did
// nothing, focus never moved into the panel, and Tab walked straight out to
// the page behind the overlay — so a keyboard user could reach and activate
// controls they could not see.
//
// Attach the returned ref to the panel (not the overlay) and give the panel
// `tabIndex={-1}` so it can hold focus when it contains no controls.

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDismissable<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Held in a ref so an inline arrow from the caller does not re-run the
  // effect on every render and yank focus back to the top mid-typing.
  //
  // Updated in an effect rather than during render: a render can be thrown
  // away or replayed, and writing to a ref from one is how you end up calling
  // a handler that belongs to a render that never committed.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = () =>
      node
        ? [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (el) => el.offsetWidth > 0 || el.offsetHeight > 0,
          )
        : [];

    // Focus the panel itself rather than its first control: landing on
    // "Close" reads as though closing is what you came to do.
    node?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!node.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Put the keyboard back where it came from, so closing a sheet does not
      // dump you at the top of the page.
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return ref;
}
