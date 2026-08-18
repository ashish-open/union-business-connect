"use client";

// The four exposures, one route, sub-nav switching the view.
//
// Each screen states the number, the lines behind it, and the rule that makes
// it matter. None of them files anything — the product's line here is that it
// tells you what you owe and where it came from, not that it becomes your
// return.

import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { buildBooks } from "@/lib/books";
import { accountantFor, complianceItemsFor } from "@/lib/complianceNav";
import { itcAtRisk, msmeExposure, payrollGaps, tdsPayable } from "@/lib/statutory";
import { formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";
import { AccountantStrip } from "@/components/books/AccountantStrip";
import { IncomeTaxView } from "@/components/books/IncomeTaxView";
import { filesAsIndividual, incomeTaxFor } from "@/lib/incometax";
import { profitAndLoss } from "@/lib/reports";
import { ANCHOR_DATE } from "@/data/seed";

export default function ExposurePage() {
  const params = useParams<{ view: string }>();
  const entity = useEntity();
  const teamInvites = useStore((s) => s.teamInvites);
  const inviteTeammate = useStore((s) => s.inviteTeammate);

  const books = useBooks(entity);

  if (!entity || !books) return <AppShell />;
  const view = params.view;
  const handover = handoverFor(view, entity, books);

  return (
    <AppShell>
      <SectionLayout title="Compliance" items={complianceItemsFor(entity.constitution)} active={`/compliance/${view}`}>
        {view === "tds" && <TdsView entity={entity} />}
        {view === "payroll" && <PayrollView entity={entity} />}
        {view === "itc-risk" && <ItcView books={books} />}
        {view === "msme" && <MsmeView books={books} />}
        {/* Absent, not disabled, for anyone who does not file as an individual —
            an LLP shown a slab table would be told something untrue about
            itself. */}
        {view === "income-tax" &&
          (filesAsIndividual(entity.constitution) ? (
            <IncomeTaxView
              tax={incomeTaxFor(profitAndLoss(books.tb).net, { booksFrom: books.from })}
              on={ANCHOR_DATE}
            />
          ) : (
            <Card>
              <p className="text-[13px] font-medium text-ink">
                {`${entity.constitution} files its own return`}
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink-3">
                Advance tax here is the proprietor&apos;s own, and this business is a separate
                taxpayer. Its return is not built from this account.
              </p>
            </Card>
          ))}

        {/* Only where a figure exists. A clean TDS screen has nothing to
            hand over, and offering the accountant anyway would be Open's
            banner all over again. */}
        {handover && (
          <AccountantStrip
            what={handover.what}
            accountant={accountantFor(entity, teamInvites)}
            onInvite={(i) => inviteTeammate(entity.id, i)}
            onSend={() => downloadWorking(entity.id, view, handover.csv)}
          />
        )}
        {!["tds", "payroll", "itc-risk", "msme", "income-tax"].includes(view) && (
          <Card>
            <p className="text-[13px] font-medium text-ink">No such view</p>
            <p className="mt-1 text-[12.5px] text-ink-3">Pick one from the list beside this.</p>
          </Card>
        )}
      </SectionLayout>
    </AppShell>
  );
}

/**
 * What this view could hand over, or null when it has nothing. Named per view
 * so the ask is about a figure rather than about "compliance".
 */
function handoverFor(
  view: string,
  entity: Parameters<typeof tdsPayable>[0],
  books: ReturnType<typeof buildBooks>,
): { what: string; csv: string[] } | null {
  if (view === "tds") {
    const t = tdsPayable(entity);
    if (t.lines.length === 0) return null;
    return {
      what: "what needs deducting",
      csv: [
        "party,section,rate,paid,deduct",
        ...t.parties.map((p) => `"${p.name}",${p.section.code},${p.section.rate},${p.paid},${p.due}`),
      ],
    };
  }
  if (view === "payroll") {
    const p = payrollGaps(entity);
    if (!p) return null;
    return {
      what: "the payroll position",
      csv: [
        "head,applies,paid,estimate",
        `provident fund,${p.pfApplies},${p.pfPaid},${p.estimatedPf}`,
        `esi,${p.esiApplies},${p.esiPaid},${p.estimatedEsi}`,
        `professional tax,true,${p.ptPaid},${p.estimatedPt}`,
      ],
    };
  }
  if (view === "itc-risk") {
    const r = itcAtRisk(books);
    if (r.rows.length === 0) return null;
    return {
      what: "the credit at risk",
      csv: ["supplier,bills,tax", ...r.rows.map((x) => `"${x.supplier}",${x.bills},${x.tax}`)],
    };
  }
  if (view === "msme") {
    const m = msmeExposure(books);
    if (m.rows.length === 0) return null;
    return {
      what: "the 45-day exposure",
      csv: ["supplier,bill,days,amount", ...m.rows.map((x) => `"${x.supplier}",${x.number},${x.days},${x.amount}`)],
    };
  }
  return null;
}

function downloadWorking(entityId: string, view: string, rows: string[]) {
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityId}-${view}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="text-[12.5px] text-ink-3">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TdsView({ entity }: { entity: Parameters<typeof tdsPayable>[0] }) {
  const t = tdsPayable(entity);
  const open = t.due - t.deposited;

  if (t.lines.length === 0) {
    return (
      <>
        <Head title="Tax you must deduct" sub="On contract work, professional fees and rent" />
        <Card className="mt-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Check size={14} className="text-pos" /> Nothing crossed a threshold
          </p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            No payment reached ₹30,000, and no party reached ₹1,00,000 for the year.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <Head title="Tax you must deduct" sub="On contract work, professional fees and rent" />

      <Card className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Should have been withheld
        </p>
        <Money value={open} size="hero" className="mt-1 block" />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          {`${plural(t.lines.length, "payment")} across ${plural(t.parties.length, "party", "parties")} · deposit by the 7th`}
        </p>
        <p className="mt-3 border-t border-border pt-3 text-[12px] text-ink-3">
          Miss it and 30% of the expense is disallowed, with 1.5% a month on top.
        </p>
      </Card>

      <Card pad="none" className="mt-4">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Party
          </span>
          <span className="w-28 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Paid
          </span>
          <span className="w-24 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Deduct
          </span>
        </div>
        {t.parties.map((p) => (
          <div
            key={`${p.name}-${p.section.code}`}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                <Badge variant="outline">
                  {p.section.code} · {p.section.rate}%
                </Badge>
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-3">
                {`${plural(p.count, "payment")} · ${p.section.label.toLowerCase()}`}
              </span>
            </span>
            <Money value={p.paid} size="sm" className="w-28 shrink-0 text-right" />
            <Money value={p.due} size="sm" className="w-24 shrink-0 text-right" />
          </div>
        ))}
        <div className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
          <span className="flex-1 text-[12px] font-medium text-ink-2">Total</span>
          <span className="w-28" />
          <Money value={t.due} size="md" className="w-24 shrink-0 text-right" />
        </div>
      </Card>

      <p className="mt-2 text-[11.5px] text-ink-3">
        {t.deposited > 0
          ? `${formatINR(t.deposited)} already deposited by challan.`
          : "No TDS challan has left this account."}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function PayrollView({ entity }: { entity: Parameters<typeof payrollGaps>[0] }) {
  const p = payrollGaps(entity);
  if (!p) {
    return (
      <>
        <Head title="Payroll" sub="What the salary run leaves behind" />
        <Card className="mt-4">
          <p className="text-[13px] font-medium text-ink">No salaries from this account</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            PF, ESI and professional tax start once staff are paid from here.
          </p>
        </Card>
      </>
    );
  }

  const rows: Array<[string, boolean, boolean, number, string]> = [
    ["Provident fund", p.pfApplies, p.pfPaid, p.estimatedPf, "12% of wages, capped at ₹15,000, from 20 staff"],
    ["ESI", p.esiApplies, p.esiPaid, p.estimatedEsi, "3.25% of wages up to ₹21,000, from 10 staff"],
    ["Professional tax", true, p.ptPaid, p.estimatedPt, "State levy, per head, per month"],
  ];

  return (
    <>
      <Head title="Payroll" sub="What the salary run leaves behind" />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Paid out</p>
          <Money value={p.paid} size="xl" className="mt-1 block" />
          <p className="mt-1.5 text-[11.5px] text-ink-3">{plural(p.runs, "run")}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">On payroll</p>
          <p className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.025em] text-ink">
            {p.headcount}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-3">From the salary narration</p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Statutory paid
          </p>
          <p className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.025em] text-ink">
            {[p.pfPaid, p.esiPaid, p.ptPaid].filter(Boolean).length}/3
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-3">Challans seen in the statement</p>
        </Card>
      </div>

      <Card pad="none" className="mt-4">
        {rows.map(([label, applies, paid, est, rule]) => (
          <div
            key={label}
            className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-medium text-ink">{label}</span>
                {!applies ? (
                  <Badge variant="outline">Not applicable</Badge>
                ) : paid ? (
                  <Badge tone="pos">Paid</Badge>
                ) : (
                  <Badge tone="warn">Nothing paid</Badge>
                )}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-3">{rule}</span>
            </span>
            {applies && !paid && <Money value={est} size="sm" className="shrink-0" />}
          </div>
        ))}
      </Card>

      <p className="mt-2 text-[11.5px] text-ink-3">
        Estimated at statutory rates on the average wage — a payslip would be exact.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ItcView({ books }: { books: ReturnType<typeof buildBooks> }) {
  const r = itcAtRisk(books);
  return (
    <>
      <Head title="Credit at risk" sub="Suppliers who have not filed" />
      {r.rows.length === 0 ? (
        <Card className="mt-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Check size={14} className="text-pos" /> Every supplier has filed
          </p>
          <p className="mt-1 text-[12.5px] text-ink-3">All your credit shows in the 2B.</p>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              You paid this, and cannot claim it
            </p>
            <Money value={r.tax} size="hero" className="mt-1 block" />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {`${plural(r.rows.length, "supplier")} have not filed GSTR-1`}
            </p>
          </Card>
          <Card pad="none" className="mt-4">
            {r.rows.map((row) => (
              <div
                key={row.supplier}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {row.supplier}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-3">
                    {plural(row.bills, "bill")}
                  </span>
                </span>
                <Money value={row.tax} size="sm" className="shrink-0" />
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Filing status comes from your 2B. Chasing them is the only fix.
          </p>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function MsmeView({ books }: { books: ReturnType<typeof buildBooks> }) {
  const m = msmeExposure(books);
  return (
    <>
      <Head title="Micro suppliers" sub="The 45-day clock under 43B(h)" />
      {m.rows.length === 0 ? (
        <Card className="mt-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Check size={14} className="text-pos" /> Nobody is past 45 days
          </p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Every micro supplier has been paid inside the window.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Deduction you lose this year
            </p>
            <Money value={m.amount} size="hero" className="mt-1 block" />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {`${plural(m.rows.length, "bill")} past 45 days`}
            </p>
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-ink-3">
              Pay before the year ends and the deduction comes back.
            </p>
          </Card>
          <Card pad="none" className="mt-4">
            {m.rows.map((row) => (
              <div
                key={row.number}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-ink">{row.supplier}</span>
                    <Badge tone="warn">{row.days} days</Badge>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-3 tnum">{row.number}</span>
                </span>
                <Money value={row.amount} size="sm" className="shrink-0" />
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
