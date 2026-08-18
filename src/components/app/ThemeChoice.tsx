"use client";

// Three states, because there are three.
//
// A two-way toggle would have to drop "System", and System is the only option
// that keeps following the OS at dusk. It is no longer the default — the
// product ships light, see `lib/theme.ts` — but "default" and "unavailable"
// are different things, and someone who wants their laptop's setting honoured
// should be able to say so.
//
// Selection is a surface change, never a hue (law B4): the chosen segment
// gets a raised white chip, so the accent stays spent on meaning.

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { setTheme, Theme, useTheme } from "@/lib/theme";

const OPTIONS: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

export function ThemeChoice() {
  const theme = useTheme();

  return (
    <div className="px-2.5 py-1.5">
      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
        Appearance
      </p>
      <div role="radiogroup" aria-label="Appearance" className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
        {OPTIONS.map((o) => {
          const on = theme === o.id;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(o.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] transition-colors cursor-pointer",
                on
                  ? "bg-surface font-medium text-ink shadow-(--shadow-ctl)"
                  : "text-ink-3 hover:text-ink-2",
              )}
            >
              <o.icon size={12} className="shrink-0" />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
