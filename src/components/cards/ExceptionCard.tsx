// A "didn't match" item. Exceptions are typed — the reason code determines
// the resolution path — and every card carries real verbs, because a user who
// can't reject a suggestion won't trust the ones they accept.

import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

export type ReasonCode =
  | "TDS_DEDUCTED"
  | "PART_PAYMENT"
  | "ADVANCE_RECEIVED"
  | "COMMISSION_HIGHER_THAN_CONTRACT"
  | "FEE_ON_ZERO_RATED_ITEM"
  | "SETTLEMENT_SHORT_MULTIPLE"
  | "REFUND_NETTED"
  | "DUPLICATE_SUSPECT"
  | "INTERNAL_TRANSFER"
  | "PERSONAL"
  | "BANK_CHARGE"
  | "UNKNOWN_CREDIT";

export const REASONS: Record<ReasonCode, { label: string; tone: BadgeTone }> = {
  TDS_DEDUCTED: { label: "TDS deducted", tone: "warn" },
  PART_PAYMENT: { label: "Part payment", tone: "info" },
  ADVANCE_RECEIVED: { label: "Advance received", tone: "info" },
  COMMISSION_HIGHER_THAN_CONTRACT: { label: "Commission above contract", tone: "neg" },
  // A settlement can be short for more than one reason at once, and the badge
  // has to say which. Every short marketplace credit used to read "Commission
  // above contract" — including the ones whose fee was charged on items the
  // platform zero-rated, which is a different claim to a different desk.
  FEE_ON_ZERO_RATED_ITEM: { label: "Fee on a zero-rated item", tone: "neg" },
  SETTLEMENT_SHORT_MULTIPLE: { label: "Short on two counts", tone: "neg" },
  REFUND_NETTED: { label: "Refunds netted off", tone: "warn" },
  DUPLICATE_SUSPECT: { label: "Possible duplicate", tone: "neg" },
  INTERNAL_TRANSFER: { label: "Internal transfer", tone: "neutral" },
  PERSONAL: { label: "Personal spend", tone: "neutral" },
  BANK_CHARGE: { label: "Bank charge", tone: "neutral" },
  UNKNOWN_CREDIT: { label: "Unknown credit", tone: "warn" },
};

export function ExceptionCard({
  reason,
  amount,
  title,
  evidence,
  onAction,
}: {
  reason: ReasonCode;
  amount: number;
  title: string;
  evidence: string;
  onAction?: (verb: "accept" | "reject" | "split") => void;
}) {
  const r = REASONS[reason];
  return (
    <div className="rounded-(--radius-card) bg-surface p-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone={r.tone}>{r.label}</Badge>
          <p className="mt-2 text-sm font-medium text-ink">{title}</p>
          <p className="mt-1 text-xs text-ink-3">{evidence}</p>
        </div>
        <Money value={amount} size="lg" />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAction?.("accept")}>
          Accept &amp; explain
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction?.("reject")}>
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction?.("split")}>
          Split
        </Button>
      </div>
    </div>
  );
}
