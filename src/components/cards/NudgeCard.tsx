// An earned nudge: always led by a fact from the user's own money, one
// action, one-tap dismiss or snooze. Never a banner, never a carousel.

import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NudgeCard({
  fact,
  body,
  action,
  onAction,
  onDismiss,
  onSnooze,
}: {
  fact: string; // the user's own number, e.g. "₹4.2L of Swiggy settlements last month"
  body: string;
  action: string;
  onAction?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
}) {
  return (
    <div className="relative rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card)">
      <span className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-gold" aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-3">
        <div>
          <p className="text-sm font-semibold text-ink">{fact}</p>
          <p className="mt-1 text-[13px] leading-5 text-ink-2">{body}</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={onSnooze}
            aria-label="Snooze"
            className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors cursor-pointer"
          >
            <Clock size={14} />
          </button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="mt-3 pl-3">
        <Button size="sm" variant="secondary" onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  );
}
