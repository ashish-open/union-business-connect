"use client";

// Light, dark, or whatever the machine says.
//
// The palette always had three states — `globals.css` keys dark off
// `[data-theme="dark"]`, light off `[data-theme="light"]`, and falls through
// to `prefers-color-scheme` when neither is set — but nothing ever wrote the
// attribute. So every browser silently followed its own OS setting, which is
// why the same account looked dark on one machine and light on another. That
// is not a bug in the palette; it is a missing choice.
//
// The preference is deliberately NOT in the Zustand store: that persists to
// sessionStorage and is keyed to a signed-in session, and "I prefer dark" is
// neither. It belongs to the browser, survives sign-out, and has to be
// readable before React exists — see `themeScript` below.

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "bc-theme";

/**
 * Runs in <head>, before first paint, so the page never flashes the wrong
 * palette. Kept as a string because it must not wait for a bundle.
 *
 * `colorScheme` is set too — without it the native date pickers in the
 * journal and document editors, and the scrollbars, stay light on a dark page.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=document.documentElement;if(t==="light"||t==="dark"){d.setAttribute("data-theme",t);d.style.colorScheme=t}else{d.style.colorScheme="light dark"}}catch(e){}`;

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") {
    el.removeAttribute("data-theme");
    el.style.colorScheme = "light dark";
  } else {
    el.setAttribute("data-theme", theme);
    el.style.colorScheme = theme;
  }
}

function read(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab changing it should not leave this one disagreeing.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      apply(read());
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the choice still applies to this page */
  }
  apply(theme);
  listeners.forEach((fn) => fn());
}

/** The current choice — "system" on the server, so SSR matches frame one. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "system");
}
