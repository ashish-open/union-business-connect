"use client";

// GST — label, number, action. Nothing else.
//
// Density rule, taken from the reference (Brex settings, reports, accounts):
// a row is `label | one-line state | button`, a card is `label | number`, and
// helper prose appears only where the CONCEPT is unfamiliar — never to explain
// our own reasoning. Nobody reads a paragraph in a banking screen. Where the
// reasoning matters it goes behind "How this works", not on the page.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  ScrollText,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { accountantFor, complianceItemsFor } from "@/lib/complianceNav";
import { ExposureList } from "@/components/books/ExposureList";
import { AccountantStrip } from "@/components/books/AccountantStrip";
import { exposures } from "@/lib/statutory";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { buildEway, buildGst, eInvoices, GstLine, GstView } from "@/lib/compliance";
import { daysBetween, fmtDate, formatINR } from "@/lib/format";
import { useDismissable } from "@/lib/useDismissable";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";

export default function CompliancePage() {
  const router = useRouter();
  const entity = useEntity();
  const channelsConnected = useStore((s) => s.channelsConnected);
  const lineResolutions = useStore((s) => s.lineResolutions);
  const teamInvites = useStore((s) => s.teamInvites);
  const inviteTeammate = useStore((s) => s.inviteTeammate);
  const [copied, setCopied] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const resolutions = useMemo(() => {
    if (!entity) return {};
    const out: Record<string, "accepted" | "rejected"> = {};
    for (const [key, val] of Object.entries(lineResolutions)) {
      const [eid, txnId] = key.split("/");
      if (eid === entity.id) out[txnId] = val;
    }
    return out;
  }, [entity, lineResolutions]);

  const books = useBooks(entity);

  const opts = useMemo(
    () => ({ connected: entity ? !!channelsConnected[entity.id] : false, resolutions, books }),
    [entity, channelsConnected, resolutions, books],
  );

  const gst = useMemo(() => (entity ? buildGst(entity, opts) : null), [entity, opts]);
  const invoices = useMemo(() => (entity ? eInvoices(entity) : null), [entity]);
  const eway = useMemo(() => (entity ? buildEway(entity) : null), [entity]);

  if (!entity) return <AppShell />;

  if (!gst) {
    return (
      <AppShell>
        <SectionLayout title="Compliance" items={complianceItemsFor(entity.constitution)} active="/compliance">
        <Card className="mt-1">
          <p className="text-[13px] font-medium text-ink">No GSTIN on file</p>
          <p className="mt-1 text-[12.5px] text-ink-3">Add one and this fills from your lines.</p>
        </Card>
        </SectionLayout>
      </AppShell>
    );
  }

  const daysLeft = daysBetween("2026-07-29", gst.due);
  const missingIrn = (invoices ?? []).filter((i) => i.b2b && !i.irn);
  const atRisk = missingIrn.reduce((s, i) => s + i.outstanding, 0);
  const registrable = (invoices ?? [])
    .filter((i) => i.b2b)
    .sort((a, b) => Number(!b.irn) - Number(!a.irn));
  const consumer = (invoices ?? []).filter((i) => !i.b2b);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const exposed = books ? exposures(entity, books) : [];

  return (
    <AppShell>
      <SectionLayout title="Compliance" items={complianceItemsFor(entity.constitution)} active="/compliance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-3 tnum">{gst.gstin}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadSummary(entity.id, gst)}>
            <Download size={13} /> Working
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push("/statement")}>
            <ScrollText size={13} /> Lines
          </Button>
          <Button size="sm" onClick={() => window.open("https://www.gst.gov.in/", "_blank")}>
            <ExternalLink size={13} /> File
          </Button>
        </div>
      </div>

      {exposed.length > 0 && (
        <div className="mt-4">
          <ExposureList exposed={exposed} onOpen={(x) => router.push(x.href)} />
        </div>
      )}

      {/* the number */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {gst.noSales ? "Credit carried forward" : `${gst.period}, so far`}
            </p>
            <Money
              value={gst.noSales ? gst.inputCredit : gst.netPayable}
              size="hero"
              className="mt-1 block"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {gst.noSales ? "No sales this month" : `Due ${fmtDate(gst.due)} · ${daysLeft} days`}
            </p>
          </div>
          <button
            onClick={() => setHowOpen(true)}
            className="text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
          >
            How this works
          </button>
        </div>
        {gst.paid > 0 && (
          <p className="mt-3 border-t border-border pt-3 text-[12px] text-ink-3">
            {`${formatINR(gst.paid)} paid 20 Jul settled June.`}
          </p>
        )}
      </Card>

      {/* the working */}
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Sold · {gst.ratePct}%</h2>
          <LineTable
            lines={gst.outward}
            total={gst.outputTax}
            totalLabel="Tax on sales"
            empty="No sales this month"
          />
        </div>

        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Bought</h2>
          {gst.scheme === "restaurant" ? (
            <Card className="mt-2.5">
              <p className="text-[12.5px] text-ink-2">No input credit at 5%</p>
              <Money value={gst.itcForgone} size="xl" className="mt-1 block" />
              <p className="mt-1.5 text-[12px] text-ink-3">Forgone this month</p>
            </Card>
          ) : (
            <LineTable
              lines={gst.inward}
              total={gst.inputCredit}
              totalLabel="Credit claimable"
              empty="No claimable purchases"
            />
          )}

          {gst.blocked.count > 0 && (
            <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 !py-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink">
                  {`${formatINR(gst.blocked.tax)} unclaimed`}
                </p>
                <p className="text-[11.5px] text-ink-3">
                  {`${gst.blocked.count} line${gst.blocked.count > 1 ? "s" : ""} need${gst.blocked.count > 1 ? "" : "s"} explaining`}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push("/statement?filter=issues")}>
                Explain <ArrowRight size={12} />
              </Button>
            </Card>
          )}
          {gst.excluded.count > 0 && (
            <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 !py-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink">
                  {`${formatINR(gst.excluded.gross)} personal spend`}
                </p>
                <p className="text-[11.5px] text-ink-3">
                  {`${gst.excluded.count} line${gst.excluded.count > 1 ? "s" : ""} · excluded, not claimable`}
                </p>
              </div>
              <Badge variant="outline">Excluded</Badge>
            </Card>
          )}
        </div>
      </section>

      {/* Only once there IS a return to hand over — the difference between
          this and Open's banner, which offers the CA instead of the number. */}
      <AccountantStrip
        what={`the ${gst.period} return`}
        accountant={accountantFor(entity, teamInvites)}
        onInvite={(i) => inviteTeammate(entity.id, i)}
        onSend={() => downloadSummary(entity.id, gst)}
      />

      {/* e-invoice */}
      {registrable.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-ink">e-Invoice</h2>
            {missingIrn.length > 0 && (
              <p className="text-[12px] text-ink-3">{`${formatINR(atRisk)} owed behind an unregistered invoice`}</p>
            )}
          </div>
          <Card pad="none" className="mt-2.5">
            {registrable.map((e) => (
              <div
                key={e.invoice.number}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {e.invoice.customer}
                    </span>
                    {!e.irn && <Badge tone="warn">No IRN</Badge>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-3 tnum">
                    {e.invoice.number}
                    {e.irn && (
                      <>
                        <span>· {e.irn.slice(0, 12)}…</span>
                        <button
                          onClick={() => copy(e.irn!, e.invoice.number)}
                          className="text-ink-3 transition-colors hover:text-ink-2 cursor-pointer"
                          aria-label={`Copy IRN for ${e.invoice.number}`}
                        >
                          {copied === e.invoice.number ? (
                            <Check size={11} className="text-pos" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Money value={e.invoice.total} size="sm" className="block" />
                  <span className="mt-0.5 block text-[10.5px] text-ink-3 tnum">
                    {e.outstanding > 0
                      ? `${formatINR(e.outstanding)} open`
                      : e.tds > 0
                        ? `Paid · ${formatINR(e.tds)} TDS`
                        : "Settled"}
                  </span>
                </span>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3">
            {missingIrn.length > 0 && "Unregistered invoices block your customer's credit. "}
            {consumer.length > 0 && `${consumer.length} to individuals · not required`}
          </p>
        </section>
      )}

      {/* e-way */}
      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink">e-Way bills</h2>
        {!eway?.moves ? (
          <Card className="mt-2.5">
            <p className="text-[12.5px] text-ink-2">None needed</p>
            <p className="mt-1 text-[11.5px] text-ink-3">You moved no goods this month</p>
          </Card>
        ) : (
          <>
            <Card pad="none" className="mt-2.5">
              {eway.items.map((i) => (
                <div
                  key={i.ref}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-ink">{i.party}</span>
                      {i.covered ? (
                        <Badge tone="pos">Freight paid</Badge>
                      ) : (
                        <Badge tone="warn">No freight</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-3">{fmtDate(i.date)}</span>
                  </span>
                  <Money value={i.amount} size="sm" className="shrink-0" />
                </div>
              ))}
            </Card>
            {eway.uncovered > 0 && (
              <p className="mt-2 text-[11.5px] text-ink-3">
                {`${eway.uncovered} above ₹50,000 with no freight beside it.`}
              </p>
            )}
          </>
        )}
      </section>

      {/* The company-cards cross-sell that used to sit here went with the
          /cards page. The finding it carried — card spend arriving pre-coded
          while other debits needed a person — was a pitch for a product, not a
          compliance fact, and this screen is for what you owe. */}

      </SectionLayout>

      {/* the reasoning, on demand — off the page, not deleted */}
      {howOpen && <HowPanel gst={gst} onClose={() => setHowOpen(false)} />}
    </AppShell>
  );
}

/** Everything the page used to say in paragraphs, now opt-in. */
function HowPanel({ gst, onClose }: { gst: GstView; onClose: () => void }) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const facts: Array<[string, string]> = [
    ["Where the figures come from", "Bank lines you have already explained. Nothing is typed in."],
    [
      "Rate",
      `${gst.ratePct}% assumed on what you supply. Purchases carry the supplier's rate — electricity is exempt.`,
    ],
    ...(gst.scheme === "restaurant"
      ? ([
          [
            "Why no input credit",
            "Restaurants supplying at 5% cannot claim credit on purchases. That is the condition of the rate.",
          ],
        ] as Array<[string, string]>)
      : []),
    ...(gst.paid > 0
      ? ([
          [
            "The payment on the 20th",
            `${formatINR(gst.paid)} settled June. It is not netted against this month.`,
          ],
        ] as Array<[string, string]>)
      : []),
    ["Running, not filed", "The figure moves as July's remaining lines land."],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-t-[16px] bg-surface p-5 shadow-(--shadow-pop) sm:rounded-[14px] animate-rise"ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
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

function LineTable({
  lines,
  total,
  totalLabel,
  empty,
}: {
  lines: GstLine[];
  total: number;
  totalLabel: string;
  empty: string;
}) {
  if (lines.length === 0) {
    return (
      <Card className="mt-2.5">
        <p className="text-[12.5px] text-ink-3">{empty}</p>
      </Card>
    );
  }
  return (
    <Card pad="none" className="mt-2.5">
      {lines.map((l) => (
        <div
          key={l.label}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-ink">{l.label}</span>
            <span className="mt-0.5 block text-[11px] text-ink-3 tnum">
              {`${l.count} · ${formatINR(l.taxable)}`}
            </span>
          </span>
          <Money value={l.tax} size="sm" className="shrink-0" />
        </div>
      ))}
      <div className="flex items-center gap-3 bg-surface-2 px-4 py-2.5">
        <span className="flex-1 text-[12px] font-medium text-ink-2">{totalLabel}</span>
        <Money value={total} size="md" className="shrink-0" />
      </div>
    </Card>
  );
}

function downloadSummary(entityId: string, gst: GstView) {
  const rows = [
    "section,label,lines,taxable,tax",
    ...gst.outward.map((l) => `outward,"${l.label}",${l.count},${l.taxable},${l.tax}`),
    ...gst.inward.map((l) => `inward,"${l.label}",${l.count},${l.taxable},${l.tax}`),
    `total,"Tax on sales",,,${gst.outputTax}`,
    `total,"Credit claimed",,,${gst.inputCredit}`,
    `total,"Net payable",,,${gst.netPayable}`,
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityId}-july-2026-gst-working.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
