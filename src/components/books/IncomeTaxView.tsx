"use client";

// The proprietor's own tax, projected from the books.
//
// The other four exposures on this route are amounts the business already owes
// and can look up. This one does not exist yet — it is a forecast of a year
// that is a third gone — so every part of the screen has to carry that. The
// figure is stated as a projection, the arithmetic is on screen with the
// caveats one tap away, and the instalment already late says so without
// pretending we know what was paid.

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fmtDateFull, formatINR, plural } from "@/lib/format";
import { fyLabel, type IncomeTax } from "@/lib/incometax";
import { cn } from "@/lib/cn";

export function IncomeTaxView({ tax, on }: { tax: IncomeTax; on: string }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{`Income tax · FY ${fyLabel(on)}`}</h2>
        <p className="text-[12.5px] text-ink-3">Your profit is your income · ITR-3</p>
      </div>

      {tax.rebated ? (
        /* Under the §87A ceiling nothing is due, and inventing a schedule for a
           liability that does not exist would be four deadlines of pure noise. */
        <Card className="mt-4">
          <p className="text-[15px] font-semibold text-ink">Nothing due this year</p>
          <p className="mt-1 text-[12.5px] leading-5 text-ink-2">
            {`On this pace the year ends near ${formatINR(tax.projectedProfit)}, under the ₹12,00,000 the rebate covers.`}
          </p>
          <Method tax={tax} />
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Profit so far
                </p>
                <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                  {formatINR(tax.profitToDate)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3 tnum">
                  {`over ${tax.monthsElapsed} months of books`}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Year at this pace
                </p>
                <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                  {formatINR(tax.projectedProfit)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3">Projected, not earned</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  Tax on that
                </p>
                <p className="tnum mt-1 text-xl font-semibold tracking-[-0.02em] text-ink">
                  {formatINR(tax.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3 tnum">
                  {`${formatINR(tax.taxBeforeCess)} + ${formatINR(tax.cess)} cess${tax.surcharge > 0 ? ` + ${formatINR(tax.surcharge)} surcharge` : ""}`}
                </p>
              </div>
            </div>
            <Method tax={tax} />
          </Card>

          <h3 className="mt-6 text-[13px] font-semibold text-ink">Advance tax · four instalments</h3>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Underpay one and §234C charges 1% a month, even if the return is right
          </p>

          <Card pad="none" className="mt-2.5">
            {tax.instalments.map((i) => {
              const late = i.daysLeft < 0;
              const soon = !late && i.daysLeft <= 30;
              return (
                <div
                  key={i.n}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
                    late && "border-l-2 border-l-warn",
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink">
                      <span className="font-semibold tnum">{formatINR(i.amount)}</span>
                      <span className="text-ink-2">{fmtDateFull(i.due)}</span>
                      <Badge variant="outline">{`${i.cumulativePct}% by now`}</Badge>
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[11.5px] tnum",
                        late || soon ? "text-warn" : "text-ink-3",
                      )}
                    >
                      {late
                        ? `${plural(-i.daysLeft, "day")} past · interest runs if it went unpaid`
                        : `${plural(i.daysLeft, "day")} left · ${formatINR(i.cumulative)} cumulative`}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </>
  );
}

/**
 * The method, one line on the page and the rest behind a disclosure.
 *
 * A projected tax figure with no visible working is a number to argue with and
 * nothing to argue against — so the arithmetic is stated. The caveats matter
 * more than the arithmetic but they are read once, so they go where the rest of
 * this product puts reasoning (law G) rather than into a paragraph under a
 * figure somebody is trying to read.
 */
function Method({ tax }: { tax: IncomeTax }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-[11.5px] text-ink-3 tnum">
          {`Books profit ÷ ${tax.monthsElapsed} months × 12 · new-regime slabs`}
        </p>
        <button
          onClick={() => setOpen(true)}
          className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
        >
          How this works
        </button>
      </div>
      {open && <MethodPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function MethodPanel({ onClose }: { onClose: () => void }) {
  const facts: Array<[string, string]> = [
    ["An estimate, not a return", "It is built from this account and nothing else."],
    ["It cannot see your other income", "Rent, interest, a spouse's return, capital gains."],
    ["No deductions are applied", "Chapter VI-A and anything you claim separately."],
    ["§44AD may suit you better", "Presumptive tax often lands lower. Your CA will know."],
    ["The pace can change", "A quiet quarter moves the projection and the instalments."],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-t-[16px] bg-surface p-5 shadow-(--shadow-pop) animate-rise sm:rounded-[14px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">How this works</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {facts.map(([label, body]) => (
            <div key={label}>
              <p className="text-[12.5px] font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-ink-3">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
