"use client";

// One claim, as a row.
//
// It lives here because two screens show it — the register, which lists every
// claim across every rail, and the rail page, which lists that rail's own. They
// were drifting apart within a day of each other: the register grouped by
// urgency and the rail page by settlement, and only one of them had learnt that
// the title and the type badge were saying the same thing twice.
//
// Amount · who · what kind on the first line; evidence · clock on the second.
// Never the claim restated (law G2) — the badge already names the type, so the
// second line is what the number came from and how long you have.

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatINR, plural } from "@/lib/format";
import { leakLabel, type Leak } from "@/lib/leaks";
import { cn } from "@/lib/cn";
import type { DisputeStatus } from "@/store/useStore";

const LABEL: Record<DisputeStatus, string> = {
  drafted: "Drafted",
  sent: "Sent to the platform",
  recovered: "Recovered",
  rejected: "Rejected by them",
};

export function LeakRow({
  leak,
  status,
  showChannel = true,
  onAdvance,
}: {
  leak: Leak;
  status?: DisputeStatus;
  /** The register says which rail; a rail's own page already has. */
  showChannel?: boolean;
  /** Absent on a read-only list — the row then carries no lifecycle verb. */
  onAdvance?: (next: DisputeStatus) => void;
}) {
  const l = leak;
  const closing = !status && l.daysLeft > 0 && l.daysLeft <= 7;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink">
          <span className="font-semibold tnum">{formatINR(l.amount)}</span>
          {showChannel && <span className="text-ink-2">{l.channel}</span>}
          <Badge variant="outline">{leakLabel(l.kind)}</Badge>
        </p>
        <p className={cn("mt-0.5 text-[11.5px] tnum", closing ? "text-warn" : "text-ink-3")}>
          {status
            ? LABEL[status]
            : l.daysLeft > 0
              ? `${l.evidence} · ${plural(l.daysLeft, "day")} left`
              : `${l.evidence} · window closed`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {status === "recovered" ? (
          <Badge tone="pos">
            <Check size={11} strokeWidth={2.5} /> Recovered
          </Badge>
        ) : onAdvance && status === "sent" ? (
          <Button size="sm" variant="secondary" onClick={() => onAdvance("recovered")}>
            Mark recovered
          </Button>
        ) : onAdvance && l.daysLeft > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => onAdvance("sent")}>
            Mark sent
          </Button>
        ) : onAdvance ? (
          /* Disabled in place, with the reason already on the line beside
             it (D5) — "window closed" is two inches to the left. */
          <Button size="sm" variant="secondary" disabled>
            Too late to raise
          </Button>
        ) : null}
        <Link href={l.href}>
          <Button size="sm" variant="secondary">
            {l.kind === "delivered_not_remitted" ? "Orders" : "Pack"} <ArrowRight size={12} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
