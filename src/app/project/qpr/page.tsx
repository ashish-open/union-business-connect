"use client";

// The QPR draft — a real document, assembled from the project ledger.
// Like every artifact in this product it is paper: always light, hard-coded
// ink, printable, and every figure traces to a bank line or a certificate.

import { useEffect, useMemo } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { ANCHOR_DATE } from "@/data/seed";
import { buildRera, detectRera } from "@/lib/rera";
import { fmtDate, fmtDateFull, formatINR } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { brand } from "@/config/brand";

export default function QprPage() {
  const mounted = useHydrated();
  const router = useRouter();
  const mobile = useStore((s) => s.mobile);
  const entity = useEntity();
  const caSigned = useStore((s) => (entity ? !!s.reraCaSigned[entity.id] : false));
  const sessionWithdrawn = useStore((s) => (entity ? (s.reraWithdrawn[entity.id] ?? 0) : 0));
  useEffect(() => {
    if (mounted && (!mobile || !entity)) router.replace("/signin");
  }, [mounted, mobile, entity, router]);
  useEffect(() => {
    if (mounted && entity && !detectRera(entity)) router.replace("/today");
  }, [mounted, entity, router]);

  const rera = useMemo(
    () => (entity ? buildRera(entity, { caSigned, sessionWithdrawn }) : null),
    [entity, caSigned, sessionWithdrawn],
  );

  if (!mounted || !entity || !rera) return null;

  const permittedSpend = rera.costHeads.filter((h) => h.permitted).reduce((s, h) => s + h.spent, 0);

  return (
    <div className="min-h-dvh bg-[#f2f2ee] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden sm:px-0">
        <Button variant="ghost" onClick={() => router.push("/project")}>
          <ArrowLeft size={13} />
          Back to the project
        </Button>
        <Button onClick={() => window.print()}>
          <Printer size={13} />
          Print / save PDF
        </Button>
      </div>

      <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-[#1c1d22] shadow-(--shadow-card) print:max-w-none print:px-0 print:shadow-none sm:px-12">
        {/* header */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-brand-mark pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-mark">
              Quarterly progress report · draft
            </p>
            <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight">
              {rera.project.name} — Q2 FY 2026-27
            </h1>
            <p className="mt-1 text-[12.5px] text-[#5d5f67]">
              {entity.legalName} · GSTIN {entity.gstin} · {rera.project.rera}
            </p>
          </div>
          <div className="shrink-0 text-right text-[11.5px] leading-5 text-[#8f919a]">
            Generated {fmtDateFull(ANCHOR_DATE)}
            <br />
            via {brand.productName} · {brand.bankName}
          </div>
        </div>

        {/* headline grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Units sold" value={`${rera.project.unitsSold} / ${rera.project.unitsTotal}`} />
          <Stat label="Construction certified" value={`${rera.project.progressPct}%`} sub={`as of ${fmtDate(rera.project.progressAsOf)}`} />
          <Stat label="Collections to date" value={formatINR(rera.lifetimeCollections, { compact: true })} />
          <Stat label="Withdrawn to date" value={formatINR(rera.withdrawnToDate, { compact: true })} />
        </div>

        {/* collections this quarter */}
        <Section title="Buyer collections — last 90 days (designated account)">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#e9e9e2] text-left text-[10.5px] uppercase tracking-[0.06em] text-[#8f919a]">
                <th className="py-1.5 pr-3 font-semibold">Date</th>
                <th className="py-1.5 pr-3 font-semibold">Unit</th>
                <th className="py-1.5 pr-3 font-semibold">Allottee</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Amount</th>
                <th className="py-1.5 text-right font-semibold">70% retained</th>
              </tr>
            </thead>
            <tbody>
              {rera.splits.map((s) => (
                <tr key={`${s.unit}-${s.date}`} className="border-b border-[#efefe9]">
                  <td className="py-1.5 pr-3 tabular-nums">{fmtDate(s.date)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{s.unit}</td>
                  <td className="py-1.5 pr-3">{s.buyer}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatINR(s.amount)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatINR(s.amount - s.opsShare)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-2 text-[11.5px] font-semibold">
                  Total
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatINR(rera.collections90d)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatINR(Math.round(rera.collections90d * 0.7))}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* spend by head */}
        <Section title="Project spend by cost head (to date)">
          {rera.costHeads.map((h) => (
            <Row
              key={h.head}
              label={`${h.head}${h.permitted ? "" : " — ops account only"}`}
              sub={h.evidence}
              value={formatINR(h.spent, { compact: true })}
            />
          ))}
          <Row label="Total from permitted heads" value={formatINR(permittedSpend, { compact: true })} bold />
        </Section>

        {/* withdrawal position */}
        <Section title="Withdrawal position — Section 4(2)(l)(D)">
          <Row
            label={`Collections to date × ${rera.project.progressPct}% certified completion`}
            value={formatINR(Math.round((rera.lifetimeCollections * rera.project.progressPct) / 100), { compact: true })}
          />
          <Row label="Withdrawn to date" value={`−${formatINR(rera.withdrawnToDate, { compact: true })}`} />
          <Row label="Eligible as of this report" value={formatINR(rera.eligibleToday, { compact: true })} bold />
          <p className="mt-2 text-[11px] leading-4 text-[#8f919a]">
            Certificates on file: {rera.certificates.map((c) => `${c.form} (${c.role} — ${c.seeded === "signed" ? `signed${c.date ? ` ${fmtDate(c.date)}` : ""}` : "awaiting"})`).join(" · ")}.
          </p>
        </Section>

        <p className="mt-8 border-t border-[#e9e9e2] pt-4 text-[10.5px] leading-4 text-[#8f919a]">
          Draft for review with {entity.secondUser ?? "your chartered accountant"} before portal
          submission. Every figure in this report traces to a bank transaction on the designated
          account {rera.designatedMasked}, a certificate on file, or the project ledger — nothing
          is typed in by hand. Compliance score at generation: {rera.score}/100.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8f919a]">
        {label}
      </p>
      <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[10.5px] text-[#8f919a]">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <h2 className="mb-2.5 text-[13px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Row({
  label,
  sub,
  value,
  bold,
}: {
  label: string;
  sub?: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#efefe9] py-1.5 last:border-b-0">
      <div className="min-w-0">
        <p className={`text-[12px] ${bold ? "font-semibold" : ""}`}>{label}</p>
        {sub && <p className="text-[10.5px] text-[#8f919a]">{sub}</p>}
      </div>
      <p className={`shrink-0 text-[12px] tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
