"use client";

// One list for every document type. What changes between an invoice and a
// delivery challan is the spec, not the screen.

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Doc, DOC_SPEC, docTotals } from "@/lib/docs";
import { ANCHOR_DATE } from "@/data/seed";
import { daysBetween, fmtDate, formatINR, plural } from "@/lib/format";

export function DocList({
  docs,
  onOpen,
  empty,
}: {
  docs: Doc[];
  onOpen: (d: Doc) => void;
  empty: string;
}) {
  if (docs.length === 0) {
    return (
      <Card className="mt-3">
        <p className="text-[12.5px] text-ink-3">{empty}</p>
      </Card>
    );
  }

  return (
    <>
      <Card pad="none" className="mt-3">
        {docs.map((d) => {
          const t = docTotals(d);
          const spec = DOC_SPEC[d.kind];
          const late =
            d.dueDate && t.outstanding > 0 ? daysBetween(d.dueDate, ANCHOR_DATE) : 0;

          return (
            <button
              key={d.id}
              onClick={() => onOpen(d)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2/60 cursor-pointer"
            >
              <Avatar name={d.party || spec.label} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {d.party || "No party"}
                  </span>
                  {d.status === "draft" && <Badge variant="outline">Draft</Badge>}
                  {d.status === "settled" && <Badge tone="pos">Settled</Badge>}
                  {d.status === "cancelled" && <Badge>Cancelled</Badge>}
                  {late > 0 && <Badge tone="warn">{late}d late</Badge>}
                  {d.convertedFrom && <Badge variant="outline">From {d.convertedFrom}</Badge>}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-3 tnum">
                  {`${d.number} · ${fmtDate(d.date)}${
                    d.lines.length > 1 ? ` · ${plural(d.lines.length, "line")}` : ""
                  }`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <Money value={t.total} size="sm" className="block" />
                {/* A quotation is a price, not a debt — only documents that
                    post to the ledger have anything outstanding. Nor does a
                    parked one: it is not owed until it is issued. */}
                <span className="mt-0.5 block text-[10.5px] text-ink-3 tnum">
                  {d.status === "draft"
                    ? "Not issued"
                    : !spec.postsToLedger
                      ? spec.movesStock
                        ? "Stock moved"
                        : "No entry yet"
                      : t.outstanding > 0
                        ? `${formatINR(t.outstanding)} open`
                        : "Settled"}
                </span>
              </span>
            </button>
          );
        })}
      </Card>
      {/* The money line counts issued documents only — a parked one is in no
          total anywhere, and saying "₹4,20,000 open" while a third of it is
          half-typed is the kind of number people forward to their CA. */}
      <p className="mt-2 text-[11.5px] text-ink-3">
        {(() => {
          const issued = docs.filter((d) => d.status !== "draft");
          const parked = docs.length - issued.length;
          const tail = parked > 0 ? ` · ${parked} not issued` : "";
          if (issued.length === 0) return `${plural(parked, "draft")}, none issued`;
          return DOC_SPEC[docs[0].kind].postsToLedger
            ? `${plural(issued.length, "document")} · ${formatINR(
                issued.reduce((s, d) => s + docTotals(d).outstanding, 0),
              )} open${tail}`
            : `${plural(issued.length, "document")} · ${formatINR(
                issued.reduce((s, d) => s + docTotals(d).total, 0),
              )} in total${tail}`;
        })()}
      </p>
    </>
  );
}
