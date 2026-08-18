"use client";

// The dispute pack — the most-promised artifact in the product, delivered as
// a real document: claim summary, contract vs charged, order-level evidence,
// bank references. Print-styled (always light), with CSV export for the
// platform's merchant-support form.

import { useEffect, useMemo } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { ANCHOR_DATE } from "@/data/seed";
import { findBatch, SettlementBatch } from "@/lib/settlements";
import { channelSpec, contractedTake, reportHeld } from "@/lib/channels";
import { fmtDateFull, fmtDate, formatINR, maskAccount } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";

export default function DisputePackPage() {
  const mounted = useHydrated();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const mobile = useStore((s) => s.mobile);
  const entity = useEntity();
  useEffect(() => {
    if (mounted && (!mobile || !entity)) router.replace("/signin");
  }, [mounted, mobile, entity, router]);

  /* A claim letter is the last place in the product to guess.
     This page rendered a "Settlement variance claim" carrying the company's
     GSTIN, the real bank UTR and seventy-nine order rows for a rail that had
     never been connected — every order ID invented, on a document an owner
     could send to Amazon. The gate is the same one the batches now use: no
     report, no batch, and therefore no pack. */
  const channelSources = useStore((s) => s.channelSources);
  const channelsConnected = useStore((s) => s.channelsConnected);
  const batch = useMemo(
    () =>
      entity && params.id
        ? findBatch(
            entity,
            params.id,
            reportHeld({
              source: (id) => channelSources[`${entity.id}/${id}`],
              aggregatorsOn: !!channelsConnected[entity.id],
            }),
          )
        : undefined,
    [entity, params.id, channelSources, channelsConnected],
  );

  if (!mounted || !entity) return null;

  if (!batch || batch.variance <= 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
        <p className="text-sm text-ink-2">No dispute evidence for this settlement.</p>
        <Button variant="secondary" onClick={() => router.push("/statement")}>
          Back to statement
        </Button>
      </div>
    );
  }

  const account = entity.accounts.find((a) => !a.readOnly);
  /* The contracted rate was `batch.channel === "Swiggy" ? "22%" : "24%"` — a
     literal, on the one page in this product that a merchant sends to the
     platform's disputes desk. Amazon's own rate card, two files away, adds to
     25.7%. A claim letter quoting a rate the agreement does not contain is a
     claim the desk closes. */
  const spec = channelSpec(batch.channelId);
  const contractedPct = spec ? `${(contractedTake(spec) * 100).toFixed(1)}%` : "the contracted rate";

  /* The pack argues ONE case, so it has to know which. A settlement can carry
     a slab overcharge and a fee on items the platform zero-rated; they are
     different arguments with different evidence, and lumping the second into
     "commission was charged above the contracted rate" hands the desk a reason
     to reject the whole letter. */
  const above = batch.orders.filter((o) => o.cause === "above_slab");
  const zeroRated = batch.orders.filter((o) => o.cause === "zero_fee_item");
  const zeroFloor = spec?.zeroFeeBelow;

  return (
    <div className="min-h-dvh bg-[#f2f2ee] py-6 print:bg-white print:py-0">
      {/* toolbar — never printed */}
      <div className="mx-auto mb-5 flex w-full max-w-3xl items-center justify-between px-5 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push("/statement")}>
          <ArrowLeft size={14} /> Statement
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadOrders(batch)}>
            <Download size={13} /> Orders CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={13} /> Print / save PDF
          </Button>
        </div>
      </div>

      {/* the document — hard-coded light, it's paper */}
      <div className="mx-auto w-full max-w-3xl bg-white px-8 py-10 text-[#1c1d22] shadow-(--shadow-card) print:max-w-none print:px-0 print:shadow-none sm:px-12">
        <div className="flex items-start justify-between border-b-2 border-[#8e1230] pb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8e1230]">
              Settlement variance claim
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {batch.channel} · {fmtDate(batch.periodStart)}–{fmtDate(batch.periodEnd)} 2026
            </h1>
            <p className="mt-1 text-[13px] text-[#5d5f67]">
              {entity.legalName} · GSTIN {entity.gstin}
            </p>
          </div>
          <div className="text-right text-[12px] leading-5 text-[#5d5f67]">
            <p>Generated {fmtDateFull(ANCHOR_DATE)}</p>
            <p>
              via {brand.productName} · {brand.bankName}
            </p>
          </div>
        </div>

        {/* claim summary */}
        <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <SummaryStat label="Expected net" value={formatINR(batch.expectedNet)} />
          <SummaryStat label="Amount received" value={formatINR(batch.received)} />
          <SummaryStat label="Orders affected" value={String(batch.orders.length)} />
          <SummaryStat label="Claim amount" value={formatINR(batch.variance)} strong />
        </div>

        <div className="mt-7 space-y-3 rounded-lg bg-[#f7f7f4] p-5 text-[13px] leading-6">
          <p>
            {`For the settlement period ${fmtDate(batch.periodStart)}–${fmtDate(batch.periodEnd)} 2026, the amount remitted was short of the contracted position by `}
            <strong>{formatINR(batch.variance)}</strong>
            {`, on the following grounds. Order-level details are enclosed.`}
          </p>
          {above.length > 0 && (
            <p>
              <strong>{`1. Commission above the contracted rate — ${formatINR(above.reduce((s, o) => s + o.short, 0))}.`}</strong>
              {` Fee was charged above the contracted ${contractedPct} on ${above.length} orders.`}
            </p>
          )}
          {zeroRated.length > 0 && (
            <p>
              <strong>{`${above.length > 0 ? "2. " : "1. "}Referral fee on zero-rated items — ${formatINR(zeroRated.reduce((s, o) => s + o.short, 0))}.`}</strong>
              {zeroFloor
                ? ` ${zeroRated.length} orders below ${formatINR(zeroFloor.amount)} carry no referral fee under the fee schedule effective ${fmtDateFull(zeroFloor.from)}, but a fee was deducted on each.`
                : ` A fee was deducted on ${zeroRated.length} orders that carry none under the fee schedule.`}
            </p>
          )}
          <p>
            We request a review and refund of the excess deduction to the settlement account on
            record.
          </p>
        </div>

        {/* references */}
        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f919a]">
          References
        </h2>
        <table className="mt-2 w-full text-[13px]">
          <tbody>
            <RefRow k="Settlement UTR" v={batch.ref} />
            <RefRow k="Bank credit" v={`${formatINR(batch.received)} on ${fmtDateFull(batch.creditDate)}`} />
            <RefRow k="Settlement account" v={`${brand.bankName} ${account ? maskAccount(account.masked) : ""}`} />
            <RefRow k="Gross sales (order report)" v={formatINR(batch.gross)} />
            {/* GST is already inside `contractedTake`, so the old
                "+ taxes as per agreement" charged it twice in the reader's
                head against a rate that already carried it. */}
            <RefRow k="Contracted commission" v={`${contractedPct} of gross, GST included`} />
          </tbody>
        </table>

        {/* order evidence */}
        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f919a]">
          Order-level evidence · {batch.orders.length} orders
        </h2>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#d8d8d0] text-left text-[#8f919a]">
              <th className="py-2 pr-3 font-medium">Order ID</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Basis</th>
              <th className="py-2 pr-3 text-right font-medium">Item total</th>
              <th className="py-2 pr-3 text-right font-medium">Contracted fee</th>
              <th className="py-2 pr-3 text-right font-medium">Charged fee</th>
              <th className="py-2 text-right font-medium">Excess</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {batch.orders.map((o) => (
              <tr key={o.id} className="border-b border-[#efefe9]">
                <td className="py-1.5 pr-3">{o.id}</td>
                <td className="py-1.5 pr-3">{fmtDate(o.date)}</td>
                <td className="py-1.5 pr-3">
                  {o.cause === "zero_fee_item" ? "Zero-rated item" : "Above slab"}
                </td>
                <td className="py-1.5 pr-3 text-right">{formatINR(o.itemTotal)}</td>
                <td className="py-1.5 pr-3 text-right">{formatINR(o.contractedFee)}</td>
                <td className="py-1.5 pr-3 text-right">{formatINR(o.chargedFee)}</td>
                <td className="py-1.5 text-right font-semibold text-[#b3261e]">{formatINR(o.short)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} className="py-2.5 pr-3 text-right font-semibold">
                Total claim
              </td>
              <td className="py-2.5 text-right text-[13px] font-bold text-[#b3261e]">
                {formatINR(batch.variance)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 border-t border-[#e9e9e2] pt-4 text-[11px] leading-5 text-[#8f919a]">
          Evidence derived from the {batch.channel} order report and the bank statement of{" "}
          {entity.legalName}. Figures computed by {brand.productName}; every line traces to a bank
          transaction or an order record. This document is generated for filing through the{" "}
          {batch.channel} partner support process.
        </p>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8f919a]">{label}</p>
      <p className={`tnum mt-1 text-xl font-semibold tracking-tight ${strong ? "text-[#8e1230]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function RefRow({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-[#efefe9]">
      <td className="py-1.5 pr-6 text-[#5d5f67]">{k}</td>
      <td className="tnum py-1.5 font-medium">{v}</td>
    </tr>
  );
}

function downloadOrders(batch: SettlementBatch) {
  downloadCsv(
    `${batch.id}-dispute-orders.csv`,
    toCsv(
      ["order_id", "date", "basis", "item_total", "contracted_fee", "charged_fee", "excess"],
      batch.orders.map((o) => [
        o.id,
        o.date,
        o.cause === "zero_fee_item" ? "zero-rated item" : "above slab",
        o.itemTotal,
        o.contractedFee,
        o.chargedFee,
        o.short,
      ]),
    ),
  );
}
