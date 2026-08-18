"use client";

// Collections — receivables truth. Who owes you, chase them all with one
// tap (WhatsApp + payment link), and every link collects straight into the
// bank account. Part payments and TDS-settled invoices are first-class.

import { useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { Check, Copy, FileText, Link2, MessageCircle, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { brand } from "@/config/brand";
import { ANCHOR_DATE, Invoice } from "@/data/seed";
import { daysBetween, fmtDate, formatINR, maskAccount } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";

export default function CollectionsPage() {
  const entity = useEntity();
  const remindersSent = useStore((s) => s.remindersSent);
  const sendReminder = useStore((s) => s.sendReminder);
  const [linkOpen, setLinkOpen] = useState(false);

  const stats = useMemo(() => {
    if (!entity) return null;
    const open = entity.invoices.filter((i) => !isSettled(i));
    const overdue = open.filter((i) => i.dueDate < ANCHOR_DATE);
    return {
      outstanding: open.reduce((s, i) => s + (i.total - i.received), 0),
      openCount: open.length,
      overdueAmt: overdue.reduce((s, i) => s + (i.total - i.received), 0),
      overdue,
      collected: entity.invoices.reduce((s, i) => s + i.received, 0),
    };
  }, [entity]);

  if (!entity || !stats) return <AppShell />;

  const primaryAccount = entity.accounts.find((a) => !a.readOnly);
  const unchased = stats.overdue.filter((i) => !remindersSent[`${entity.id}/${i.number}`]);
  const oldest = stats.overdue.reduce((m, i) => Math.max(m, daysBetween(i.dueDate, ANCHOR_DATE)), 0);

  // Destination-sized entry points for what you come here to DO, equal weight.
  // Chasing stays visible with nothing to chase — a control that disappears
  // teaches nothing; one that says why it is off does.
  const tiles: Array<{
    label: string;
    sub: string;
    icon: typeof Check;
    disabled?: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Payment link",
      sub: "UPI, card or netbanking — collects into your account",
      icon: Link2,
      onClick: () => setLinkOpen(true),
    },
    {
      label: "Chase everyone",
      sub:
        unchased.length > 0
          ? `${unchased.length} overdue invoice${unchased.length === 1 ? "" : "s"} · WhatsApp + link`
          : stats.overdue.length > 0
            ? "Every overdue invoice has been chased"
            : "Nothing is past its due date",
      icon: MessageCircle,
      disabled: unchased.length === 0,
      onClick: () => unchased.forEach((i) => sendReminder(entity.id, i.number)),
    },
  ];

  return (
    <AppShell>
      {/* no in-content H1 — the title lives in the top bar and never scrolls */}
      <p className="text-[13px] text-ink-3">
        {`Collects into ${brand.bankName} ${primaryAccount ? maskAccount(primaryAccount.masked) : ""} and reconciles itself`}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={t.onClick}
            disabled={t.disabled}
            className="flex min-w-[180px] flex-1 flex-col items-start rounded-(--radius-card) bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-pop) disabled:pointer-events-none disabled:opacity-50 cursor-pointer sm:max-w-[260px]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <t.icon size={16} />
            </span>
            <span className="mt-2.5 text-[13.5px] font-semibold text-ink">{t.label}</span>
            <span className="mt-0.5 text-[11.5px] leading-4 text-ink-3">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* the numbers */}
      <Card className="mt-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Outstanding</p>
            <Money value={stats.outstanding} size="lg" className="mt-1 block" compact />
            <p className="mt-0.5 text-[11px] text-ink-3">
              {stats.openCount} open invoice{stats.openCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Overdue</p>
            {/* the amount is a fact and stays ink; the lateness is the judgment,
                and it is the only thing here that spends colour */}
            <Money value={stats.overdueAmt} size="lg" className="mt-1 block" compact />
            <p className="mt-0.5 text-[11px] text-ink-3">
              {stats.overdue.length > 0 ? (
                <>
                  {stats.overdue.length} invoice{stats.overdue.length !== 1 ? "s" : ""} ·{" "}
                  <span className="font-medium text-neg">oldest {oldest} days late</span>
                </>
              ) : (
                "Nothing past its due date"
              )}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Collected</p>
            <Money value={stats.collected} size="lg" className="mt-1 block" compact />
            <p className="mt-0.5 text-[11px] text-ink-3">against invoices</p>
          </div>
        </div>
      </Card>

      {/* the chase — one tap, all of them */}
      {stats.overdue.length > 0 && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 !p-4">
          <div className="min-w-0">
            <p className="text-[13.5px] text-ink">
              <Money value={stats.overdueAmt} size="sm" className="mr-1 font-semibold" compact />
              is overdue across {new Set(stats.overdue.map((i) => i.customer)).size} customers
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-3">
              One tap sends a WhatsApp reminder with a payment link.
            </p>
          </div>
          {unchased.length > 0 ? (
            <Button
              size="sm"
              onClick={() => unchased.forEach((i) => sendReminder(entity.id, i.number))}
            >
              <MessageCircle size={13} /> Chase all {unchased.length}
            </Button>
          ) : (
            <Badge tone="pos">
              <Check size={11} strokeWidth={2.5} /> All chased
            </Badge>
          )}
        </Card>
      )}

      {/* invoices */}
      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink">Invoices</h2>
        <Card pad="none" className="mt-2.5">
          {entity.invoices.length === 0 && (
            // no CTA: the payment-link tile above already offers the way in
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
                <FileText size={20} />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-ink">No invoices</p>
              <p className="mt-1 max-w-xs text-[12.5px] leading-5 text-ink-3">
                Marks itself paid when the bank credit lands.
              </p>
            </div>
          )}
          {[...entity.invoices]
            .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))
            .map((inv) => (
              <InvoiceRow
                key={inv.number}
                inv={inv}
                chased={!!remindersSent[`${entity.id}/${inv.number}`]}
              />
            ))}
        </Card>
        <p className="mt-2 text-[11.5px] text-ink-3 tnum">
          Showing {entity.invoices.length} of {entity.invoices.length} invoices
        </p>
        <p className="mt-1 text-[11.5px] text-ink-3">
          Billing elsewhere? Keep it there — the money still matches.
        </p>
      </section>

      {linkOpen && primaryAccount && (
        <PaymentLinkSheet masked={maskAccount(primaryAccount.masked)} onClose={() => setLinkOpen(false)} />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function isSettled(inv: Invoice): boolean {
  if (inv.received >= inv.total) return true;
  // short by exactly its 1% TDS = settled, tax tracked
  return !!inv.tdsSection && Math.abs(inv.received - Math.round(inv.total * 0.99)) <= 2;
}

function InvoiceRow({ inv, chased }: { inv: Invoice; chased: boolean }) {
  const settled = isSettled(inv);
  const tdsSettled = settled && inv.received < inv.total;
  const partPaid = !settled && inv.received > 0;
  const overdueDays = daysBetween(inv.dueDate, ANCHOR_DATE);
  const overdue = !settled && overdueDays > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-2.5 last:border-b-0">
      <Avatar name={inv.customer} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ink">
          {inv.customer}{" "}
          <span className="tnum text-[12px] text-ink-3">
            {inv.number} · due {fmtDate(inv.dueDate)}
          </span>
        </p>
        {/* the arithmetic nobody does at a glance — how late, in days. Its
            magnitude ranks the backlog without a sort, and it is the only
            colour on the row: the amount itself is just a fact. */}
        <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
          {overdue && <span className="font-medium text-neg">{overdueDays} days overdue</span>}
          {!settled && !overdue && (overdueDays === 0 ? "Due today" : `Due in ${-overdueDays} days`)}
          {settled &&
            (tdsSettled
              ? `Paid in full · TDS ${formatINR(inv.total - inv.received)} tracked u/s ${inv.tdsSection}`
              : "Paid in full")}
          {partPaid && (
            <span className="tnum">
              {" · "}
              {formatINR(inv.received, { compact: true })} of{" "}
              {formatINR(inv.total, { compact: true })} received
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {/* filled = where this invoice is in its life; outlined = what you did to it */}
        {settled && (
          <Badge>
            <Check size={11} strokeWidth={2.5} className="text-ink-3" /> Paid
          </Badge>
        )}
        {partPaid && <Badge tone="info">Part paid</Badge>}
        {chased && !settled && (
          <Badge variant="outline">
            <MessageCircle size={10} /> Reminder sent · link attached
          </Badge>
        )}
      </div>
      <Money
        value={settled ? inv.total : inv.total - inv.received}
        size="sm"
        tone={settled ? "muted" : undefined}
        className="shrink-0"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PaymentLinkSheet({ masked, onClose }: { masked: string; onClose: () => void }) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const amt = Number(amount.replace(/\D/g, "")) || 0;
  const slug = customer.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "pay";
  const link = `${brand.payLinkDomain}/pay/${slug}-${amt}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-(--shadow-pop) animate-scale-in sm:rounded-(--radius-card)" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink">New payment link</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer">
            <X size={15} />
          </button>
        </div>
        {!created ? (
          <>
            <Input autoFocus placeholder="Who's paying you?" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <Input
              placeholder="Amount in ₹"
              inputMode="numeric"
              value={amount ? formatINR(amt).slice(1) : ""}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum mt-2.5"
            />
            <Button size="lg" full className="mt-4" disabled={!customer || amt <= 0} onClick={() => setCreated(true)}>
              Create link
            </Button>
            <p className="mt-3 text-center text-[11.5px] text-ink-3">
              UPI, cards and netbanking — settles into {brand.bankName} {masked}.
            </p>
          </>
        ) : (
          <div className="animate-rise">
            <div className="rounded-[10px] bg-surface-2 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Link for {customer} · {formatINR(amt)}
              </p>
              <p className="tnum mt-1 text-[15px] font-semibold text-ink">{link}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="md"
                variant="secondary"
                full
                onClick={() => {
                  navigator.clipboard?.writeText(`https://${link}`);
                  setCopied(true);
                }}
              >
                <Copy size={13} /> {copied ? "Copied" : "Copy link"}
              </Button>
              <Button size="md" full onClick={onClose}>
                <MessageCircle size={13} /> Send on WhatsApp
              </Button>
            </div>
            <p className="mt-3 text-center text-[11.5px] text-ink-3">
              The credit matches this link automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
