"use client";

// The close report — the month explained, as a document. Print-styled and
// always light; every number computed from the period's statement rows.

import { useEffect, useMemo } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { ANCHOR_DATE } from "@/data/seed";
import { balanceFootprint } from "@/lib/insights";
import { buildBatches } from "@/lib/settlements";
import { reportHeld } from "@/lib/channels";
import { buildClose } from "@/lib/close";
import { fmtDateFull, formatINR } from "@/lib/format";
import { KIND_LABEL } from "@/lib/analysis";
import { useEntity, useStore } from "@/store/useStore";


export default function CloseReportPage() {
  const mounted = useHydrated();
  const router = useRouter();
  const mobile = useStore((s) => s.mobile);
  const entity = useEntity();
  const resolved = useStore((s) => s.resolved);
  const channelsConnected = useStore((s) => s.channelsConnected);
  const lineResolutions = useStore((s) => s.lineResolutions);
  useEffect(() => {
    if (mounted && (!mobile || !entity)) router.replace("/signin");
  }, [mounted, mobile, entity, router]);

  const report = useMemo(() => {
    if (!entity) return null;
    const connected = !!channelsConnected[entity.id];
    const resolutions: Record<string, "accepted" | "rejected"> = {};
    for (const [key, val] of Object.entries(lineResolutions)) {
      const [eid, txnId] = key.split("/");
      if (eid === entity.id) resolutions[txnId] = val;
    }
    const close = buildClose(entity, { connected, resolutions, resolved });

    const inByKind = new Map<string, number>();
    const outByKind = new Map<string, number>();
    let moneyIn = 0;
    let moneyOut = 0;
    for (const r of close.rows) {
      const bucket = r.txn.direction === "credit" ? inByKind : outByKind;
      bucket.set(r.kind, (bucket.get(r.kind) ?? 0) + r.txn.amount);
      if (r.txn.direction === "credit") moneyIn += r.txn.amount;
      else moneyOut += r.txn.amount;
    }

    const monthStart = ANCHOR_DATE.slice(0, 8) + "01";
    const batches = connected
      ? buildBatches(entity, reportHeld({ aggregatorsOn: connected })).filter(
          (b) => b.creditDate >= monthStart,
        )
      : [];
    const gross = batches.reduce((s, b) => s + b.gross, 0);
    const received = batches.reduce((s, b) => s + b.received, 0);
    const recoverable = batches.reduce((s, b) => s + b.variance, 0);

    const tds = entity.invoices.filter(
      (i) => i.tdsSection && i.received > 0 && Math.abs(i.received - Math.round(i.total * 0.99)) <= 2,
    );

    return {
      close,
      moneyIn,
      moneyOut,
      inByKind: [...inByKind.entries()].sort((a, b) => b[1] - a[1]),
      outByKind: [...outByKind.entries()].sort((a, b) => b[1] - a[1]),
      batches,
      gross,
      received,
      recoverable,
      tds,
      footprint: balanceFootprint(entity, Number(ANCHOR_DATE.slice(8, 10)) - 1),
    };
  }, [entity, channelsConnected, lineResolutions, resolved]);

  if (!mounted || !entity || !report) return null;

  return (
    <div className="min-h-dvh bg-[#f2f2ee] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex w-full max-w-3xl items-center justify-between px-5 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push("/close")}>
          <ArrowLeft size={14} /> Close
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={13} /> Print / save PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl bg-white px-8 py-10 text-[#1c1d22] shadow-(--shadow-card) print:max-w-none print:px-0 print:shadow-none sm:px-12">
        <div className="flex items-start justify-between border-b-2 border-brand-mark pb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mark">
              Period close report
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{report.close.period}</h1>
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

        {/* summary */}
        <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <Stat label="Money in" value={formatINR(report.moneyIn, { compact: true })} />
          <Stat label="Money out" value={formatINR(report.moneyOut, { compact: true })} />
          <Stat
            label="Net"
            value={`${report.moneyIn - report.moneyOut >= 0 ? "+" : "−"}${formatINR(Math.abs(report.moneyIn - report.moneyOut), { compact: true })}`}
          />
          {report.footprint && (
            <Stat label="Avg daily balance" value={formatINR(report.footprint.avg, { compact: true })} />
          )}
        </div>

        {/* money in / out by category */}
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <CategoryTable title="Money in" rows={report.inByKind} />
          <CategoryTable title="Money out" rows={report.outByKind} />
        </div>

        {/* channel performance */}
        {report.batches.length > 0 && (
          <>
            <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f919a]">
              Channel performance
            </h2>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                <Row k="Gross sales (order reports)" v={formatINR(report.gross)} />
                <Row k="Landed in the bank" v={formatINR(report.received)} />
                <Row
                  k="Effective platform take"
                  v={`${formatINR(report.gross - report.received)} · ${Math.round(((report.gross - report.received) / report.gross) * 100)}%`}
                />
                {report.recoverable > 0 && (
                  <Row
                    k="Charged above contract — disputes drafted"
                    v={formatINR(report.recoverable)}
                    strong
                  />
                )}
              </tbody>
            </table>
          </>
        )}

        {/* TDS */}
        {report.tds.length > 0 && (
          <>
            <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f919a]">
              TDS credits · verify against 26AS
            </h2>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {report.tds.map((i) => (
                  <Row
                    key={i.number}
                    k={`${i.customer} · ${i.number} (194C)`}
                    v={formatINR(i.total - i.received)}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="mt-8 border-t border-[#e9e9e2] pt-4 text-[11px] leading-5 text-[#8f919a]">
          Prepared by {brand.productName} for {entity.legalName}. Every figure in this report
          traces to a bank transaction or an order record. Personal spends are excluded from the
          business view and listed for your accountant.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8f919a]">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function CategoryTable({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f919a]">{title}</h2>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {rows.map(([kind, amount]) => (
            <Row key={kind} k={KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind} v={formatINR(amount)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <tr className="border-b border-[#efefe9]">
      <td className="py-1.5 pr-4 text-[#5d5f67]">{k}</td>
      <td className={`tnum py-1.5 text-right font-medium ${strong ? "text-brand-mark" : ""}`}>{v}</td>
    </tr>
  );
}
