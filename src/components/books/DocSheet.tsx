"use client";

// One detail view for every document type, and the place conversion happens.
//
// The chain is shown from both ends — what this came from, and what came out
// of it — because a quotation you cannot follow to its invoice is just a PDF.

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useDismissable } from "@/lib/useDismissable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { chainOf, Doc, DOC_SPEC, DocKind, docTotals, lineSubtotal } from "@/lib/docs";
import { fmtDate, formatINR } from "@/lib/format";

export function DocSheet({
  doc,
  all,
  onClose,
  onConvert,
  onOpenDoc,
  onPay,
}: {
  doc: Doc;
  all: Doc[];
  onClose: () => void;
  onConvert: (to: DocKind) => void;
  onOpenDoc: (d: Doc) => void;
  /** Present on an unpaid bill — hands over to the money rail. */
  onPay?: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const spec = DOC_SPEC[doc.kind];
  const t = docTotals(doc);
  const chain = chainOf(doc, all);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-[14px] font-semibold text-ink">{doc.party}</p>
              {doc.status === "settled" && <Badge tone="pos">Settled</Badge>}
            </div>
            <p className="text-[11.5px] text-ink-3 tnum">
              {`${spec.label} ${doc.number} · ${fmtDate(doc.date)}`}
              {doc.dueDate ? ` · due ${fmtDate(doc.dueDate)}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* lines */}
          {doc.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">
                  {l.description || "—"}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-3 tnum">
                  {`${l.qty} × ${formatINR(l.rate)} · GST ${l.taxPct}%`}
                </span>
              </span>
              <Money value={lineSubtotal(l)} size="sm" className="shrink-0" />
            </div>
          ))}

          {/* totals */}
          <div className="space-y-1.5 px-5 py-3">
            <Row label="Subtotal" value={formatINR(t.subtotal)} />
            <Row label={`Tax${doc.taxInclusive ? " (included)" : ""}`} value={formatINR(t.tax)} />
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-[13px] font-medium">
              <span className="text-ink">Total</span>
              <span className="text-ink tnum">{formatINR(t.total)}</span>
            </div>
            {doc.paid > 0 && (
              <Row label={spec.side === "sales" ? "Received" : "Paid"} value={formatINR(doc.paid)} />
            )}
            {t.outstanding > 0 && <Row label="Still open" value={formatINR(t.outstanding)} />}
          </div>

          {/* the chain, both directions */}
          {(chain.from || chain.to.length > 0) && (
            <div className="border-t border-border px-5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Chain
              </p>
              {chain.from && (
                <ChainRow
                  label={`From ${DOC_SPEC[chain.from.kind].label.toLowerCase()}`}
                  doc={chain.from}
                  onOpen={onOpenDoc}
                />
              )}
              {chain.to.map((d) => (
                <ChainRow
                  key={d.id}
                  label={`Became ${DOC_SPEC[d.kind].label.toLowerCase()}`}
                  doc={d}
                  onOpen={onOpenDoc}
                />
              ))}
            </div>
          )}
        </div>

        {/* convert — never retype */}
        {(spec.convertsTo.length > 0 || onPay) && (
          <div className="border-t border-border px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {onPay && (
                <Button size="sm" onClick={onPay}>
                  Pay {formatINR(t.outstanding)}
                </Button>
              )}
              {spec.convertsTo.map((to) => (
                <Button key={to} size="sm" variant="secondary" onClick={() => onConvert(to)}>
                  Make {DOC_SPEC[to].label.toLowerCase()} <ArrowRight size={12} />
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">
              {onPay ? "Paying runs through Payouts." : "Lines carry over. Nothing to retype."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink tnum">{value}</span>
    </div>
  );
}

function ChainRow({
  label,
  doc,
  onOpen,
}: {
  label: string;
  doc: Doc;
  onOpen: (d: Doc) => void;
}) {
  return (
    <button
      onClick={() => onOpen(doc)}
      className="mt-1.5 flex w-full items-center gap-2 text-left text-[12.5px] text-ink-2 transition-colors hover:text-accent cursor-pointer"
    >
      <span className="text-ink-3">{label}</span>
      <span className="font-medium tnum">{doc.number}</span>
      <ArrowRight size={12} className="ml-auto text-ink-3" />
    </button>
  );
}
