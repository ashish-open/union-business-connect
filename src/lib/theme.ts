"use client";

// Light, dark, or whatever the machine says.
//
// The palette always had three states — `globals.css` keys dark off
// `[data-theme="dark"]`, light off `[data-theme="light"]`, and falls through
// to `prefers-color-scheme` when neither is set — but for a long time nothing
// wrote the attribute, so every browser silently followed its own OS setting
// and the same account looked dark on one machine and light on another.
//
// It now defaults to LIGHT rather than to the OS. A bank's product has a
// house appearance, and light is it: the screens are dense tables of money,
// the demo is given on whatever laptop is in the room, and "it looked
// different in the meeting" is not a thing that should be able to happen.
// System is still on the menu for anyone who wants it — it is a choice now,
// not the silent default.
//
// One consequence worth naming: because absence-of-key means light, "system"
// has to be STORED rather than expressed by clearing the key. `setTheme`
// writes all three values.
//
// The preference is deliberately NOT in the Zustand store: that persists to
// sessionStorage and is keyed to a signed-in session, and "I prefer dark" is
// neither. It belongs to the browser, survives sign-out, and has to be
// readable before React exists — see `themeScript` below.

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "bc-theme";

export const DEFAULT_THEME: Theme = "light";

/**
 * Runs in <head>, before first paint, so the page never flashes the wrong
 * palette. Kept as a string because it must not wait for a bundle.
 *
 * `colorScheme` is set too — without it the native date pickers in the
 * journal and document editors, and the scrollbars, stay light on a dark page.
 *
 * The catch falls through to light rather than doing nothing: in a browser
 * with storage blocked, the default has to still be the default.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=document.documentElement;if(t==="system"){d.removeAttribute("data-theme");d.style.colorScheme="light dark"}else{var m=t==="dark"?"dark":"light";d.setAttribute("data-theme",m);d.style.colorScheme=m}}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

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
    // Anything unrecognised — absent, stale, hand-edited — is the default.
    return t === "dark" || t === "light" || t === "system" ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
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
    // All three are written. See the note above: clearing the key would mean
    // light, so "system" cannot be expressed by absence.
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the choice still applies to this page */
  }
  apply(theme);
  listeners.forEach((fn) => fn());
}

/** The current choice — the default on the server, so SSR matches frame one. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);
}
