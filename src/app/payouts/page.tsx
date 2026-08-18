"use client";

// Payouts — the second strength. Payees are derived from payment history
// (no data entry), new payees verify by penny drop and are active instantly
// (no cooling period), and mode choice always says when the money lands.
// Returns are first-class: a payment isn't "done" at submission.

import { useMemo, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { ArrowUpRight, Check, CircleAlert, ShieldCheck, Users, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { brand } from "@/config/brand";
import { ANCHOR_DATE } from "@/data/seed";
import { derivePayees, modeFor, payoutHistoryCount, recentPayments, Payee } from "@/lib/payments";
import { cn } from "@/lib/cn";
import { fmtDate, formatINR, maskAccount, parseAmount, parseIfsc } from "@/lib/format";
import { useEntity, useStore, SessionPayee, SessionPayment } from "@/store/useStore";

export default function PayoutsPage() {
  const entity = useEntity();
  const resolved = useStore((s) => s.resolved);
  const resolveItem = useStore((s) => s.resolveItem);
  const sessionPayments = useStore((s) => s.sessionPayments);
  const addPayment = useStore((s) => s.addPayment);
  const sessionPayees = useStore((s) => s.sessionPayees);
  const addPayee = useStore((s) => s.addPayee);
  const makerCheckerPref = useStore((s) => (entity ? s.makerChecker[entity.id] : undefined));

  const [payTo, setPayTo] = useState<Payee | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Payees are derived from who you have actually paid — which left a
  // brand-new beneficiary nowhere to live, so "ready to pay" was a claim the
  // next screen immediately contradicted. Ones added this session are merged
  // in at the top, where you would look for the person you just added.
  const payees = useMemo(() => {
    if (!entity) return [];
    const added: Payee[] = (sessionPayees[entity.id] ?? []).map((p) => ({
      name: p.name,
      kind: "vendor",
      masked: `••${p.account.slice(-4)}`,
      ifsc: p.ifsc,
      lastPaid: ANCHOR_DATE,
      totalPaid: 0,
      payments: 0,
    }));
    const derived = derivePayees(entity).filter((d) => !added.some((a) => a.name === d.name));
    return [...added, ...derived];
  }, [entity, sessionPayees]);
  const recent = useMemo(() => (entity ? recentPayments(entity) : []), [entity]);

  if (!entity) return <AppShell />;

  const mine = sessionPayments[entity.id] ?? [];
  const pnb = entity.accounts.find((a) => !a.readOnly);
  const waiting = entity.approvals.filter((a) => !resolved[`${entity.id}/ap-${a.id}`]);

  // Destination-sized entry points for the two or three things you come to
  // this page to DO. All equal weight: we cannot know which one you arrived
  // wanting, and Approvals only exists when this entity actually has a checker.
  const tiles: Array<{ label: string; sub: string; icon: typeof Check; onClick: () => void }> = [
    {
      label: "Pay someone",
      sub: `${payees.length} payee${payees.length === 1 ? "" : "s"} you already pay`,
      icon: ArrowUpRight,
      onClick: () => {
        setPayTo(null);
        setPayOpen(true);
      },
    },
    {
      label: "Add a payee",
      sub: "Penny drop verifies · active immediately",
      icon: Users,
      onClick: () => setAddOpen(true),
    },
  ];
  if (entity.approvals.length > 0)
    tiles.push({
      label: "Approvals",
      sub:
        waiting.length > 0
          ? `${formatINR(waiting.reduce((s, a) => s + a.total, 0), { compact: true })} across ${waiting.reduce((s, a) => s + a.count, 0)} payments`
          : "Nothing waiting on you",
      icon: ShieldCheck,
      onClick: () =>
        document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    });

  return (
    <AppShell>
      {/* no in-content H1 — the title lives in the top bar and never scrolls */}
      <p className="text-[13px] text-ink-3">
        {`Paid from ${brand.bankName} ${pnb ? maskAccount(pnb.masked) : ""} · no wallet to load`}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={t.onClick}
            className="flex min-w-[180px] flex-1 flex-col items-start rounded-(--radius-card) bg-surface p-4 text-left shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-pop) cursor-pointer sm:max-w-[260px]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <t.icon size={16} />
            </span>
            <span className="mt-2.5 text-[13.5px] font-semibold text-ink">{t.label}</span>
            <span className="mt-0.5 text-[11.5px] leading-4 text-ink-3">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* approvals — same state as the Today queue. The one group that earns a
          heading, because it carries accountability. */}
      {entity.approvals.length > 0 && (
        <section id="approvals" className="mt-6 scroll-mt-16">
          <h2 className="text-[13px] font-semibold text-ink">Approvals</h2>
          {entity.approvals.map((a) => {
            const done = !!resolved[`${entity.id}/ap-${a.id}`];
            return (
              <Card key={a.id} className={cn("mt-2.5 !p-4", done && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={a.preparedBy} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] text-ink">
                        <Money value={a.total} size="sm" className="mr-1 font-semibold" />
                        across {a.count} payments waits for your approval
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-3">
                        Prepared by {a.preparedBy} · {a.note}
                      </p>
                      {done && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-pos">
                          <Check size={12} strokeWidth={2.5} /> Approved — queued for the next
                          payment run
                        </p>
                      )}
                    </div>
                  </div>
                  {!done && (
                    <Button size="sm" variant="secondary" onClick={() => resolveItem(entity.id, `ap-${a.id}`)}>
                      Review &amp; approve
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* recent payments */}
        <section className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Recent payments</h2>
          <Card pad="none" className="mt-2.5">
            {mine.length + recent.length === 0 && (
              <EmptyState
                icon={ArrowUpRight}
                title="No payments"
                body="Every payment with its UTR. Returns come back here with the reason."
              />
            )}
            {mine.map((p) => (
              <PaymentRow
                key={p.id}
                payee={p.payee}
                amount={p.amount}
                sub={`${p.mode} · ${p.lands}${p.tag ? ` · ${p.tag}` : ""}`}
                status="queued"
              />
            ))}
            {recent.map((p) => {
              const retried = p.status === "returned" && !!resolved[`${entity.id}/rp-${p.id.replace("ret-", "")}`];
              return (
                <PaymentRow
                  key={p.id}
                  payee={p.payee}
                  amount={p.amount}
                  sub={
                    p.status === "returned"
                      ? `${p.note} · money is back`
                      : `${fmtDate(p.date)}${p.utr ? ` · UTR ${p.utr}` : ""}`
                  }
                  status={retried ? "retry-queued" : p.status}
                  onRetry={
                    p.status === "returned" && !retried
                      ? () => resolveItem(entity.id, `rp-${p.id.replace("ret-", "")}`)
                      : undefined
                  }
                />
              );
            })}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3 tnum">
            Showing {mine.length + recent.length} of {mine.length + payoutHistoryCount(entity)}{" "}
            payments
          </p>
          <p className="mt-1 text-[11.5px] text-ink-3">
            Returns come back here, with the money.
          </p>
        </section>

        {/* payees */}
        <section className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Payees</h2>
          <Card pad="none" className="mt-2.5">
            {payees.length === 0 && (
              <EmptyState
                icon={Users}
                title="No payees"
                body="Anyone you pay becomes a payee automatically, account and last-paid filled in."
              />
            )}
            {payees.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  {/* the account tail identifies the payee; the IFSC is detail,
                      and it lives in the pay sheet where it is acted on */}
                  <p className="truncate text-[13.5px] text-ink">
                    {p.name} <span className="tnum text-[12px] text-ink-3">{p.masked}</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3 tnum">
                    {formatINR(p.totalPaid, { compact: true })} over {p.payments} payments · last{" "}
                    {fmtDate(p.lastPaid)}
                  </p>
                </div>
                <Badge variant="outline">
                  <Check size={11} strokeWidth={2.5} /> Verified
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPayTo(p);
                    setPayOpen(true);
                  }}
                >
                  Pay
                </Button>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[11.5px] text-ink-3 tnum">
            Showing {payees.length} of {payees.length} payees
          </p>
          <p className="mt-1 text-[11.5px] text-ink-3">
            Someone new verifies by penny drop.
          </p>
        </section>
      </div>

      {payOpen && (
        <PaySheet
          payees={payees}
          preselected={payTo}
          hasChecker={makerCheckerPref ?? !!entity.secondUser}
          onClose={() => setPayOpen(false)}
          onAddPayee={() => {
            // Hand straight over to the add flow; it comes back into the
            // payment with the new payee already chosen.
            setPayOpen(false);
            setAddOpen(true);
          }}
          onDone={(p) => {
            addPayment(entity.id, p);
            setPayOpen(false);
          }}
        />
      )}
      {addOpen && (
        <AddPayeeSheet
          onClose={() => setAddOpen(false)}
          onAdded={(p) => {
            addPayee(entity.id, p);
            setAddOpen(false);
            // "Ready to pay" now means it: the payment sheet reopens on them.
            setPayTo({
              name: p.name,
              kind: "vendor",
              masked: `••${p.account.slice(-4)}`,
              ifsc: p.ifsc,
              lastPaid: ANCHOR_DATE,
              totalPaid: 0,
              payments: 0,
            });
            setPayOpen(true);
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function EmptyState({ icon: Icon, title, body }: { icon: typeof Check; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
        <Icon size={20} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-[12.5px] leading-5 text-ink-3">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PaymentRow({
  payee,
  amount,
  sub,
  status,
  onRetry,
}: {
  payee: string;
  amount: number;
  sub: string;
  status: "credited" | "returned" | "queued" | "retry-queued";
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <Avatar name={payee} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ink">{payee}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{sub}</p>
      </div>
      {/* credited is the normal ending — it asks nothing of you, so it stays
          quiet; only the return, which needs a decision, spends colour */}
      {status === "credited" && (
        <Badge>
          <Check size={11} strokeWidth={2.5} className="text-ink-3" /> Credited
        </Badge>
      )}
      {status === "queued" && <Badge tone="info">Queued</Badge>}
      {status === "retry-queued" && <Badge tone="info">Retry queued</Badge>}
      {status === "returned" && (
        <Badge tone="neg">
          <CircleAlert size={11} strokeWidth={2.5} /> Returned
        </Badge>
      )}
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Fix &amp; retry
        </Button>
      )}
      <Money value={-amount} size="sm" className="shrink-0" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PaySheet({
  payees,
  preselected,
  hasChecker,
  onClose,
  onAddPayee,
  onDone,
}: {
  payees: Payee[];
  preselected: Payee | null;
  hasChecker: boolean;
  onClose: () => void;
  onAddPayee: () => void;
  onDone: (p: SessionPayment) => void;
}) {
  const [payee, setPayee] = useState<Payee | null>(preselected);
  const [amount, setAmount] = useState("");
  const [tag, setTag] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const parsed = parseAmount(amount);
  const amt = parsed?.value ?? 0;
  const suggestion = modeFor(amt);

  function submit() {
    if (!payee || amt <= 0) return;
    setConfirmed(true);
    setTimeout(() => {
      onDone({
        id: `sp-${payee.name}-${amt}`,
        payee: payee.name,
        amount: amt,
        mode: suggestion.mode,
        lands: suggestion.lands.split(" — ")[0],
        tag: tag || undefined,
      });
    }, 900);
  }

  return (
    <Sheet
      title="New payment"
      onClose={onClose}
      /* Nothing to pin while you are still choosing WHO — the list is the
         action, and a dead "Pay ₹0" under it would be furniture. */
      footer={
        confirmed || !payee ? undefined : (
          <SheetFooter
            retreat={{ label: "Change payee", onClick: () => setPayee(null) }}
            advance={{
              label: amt > 0 ? `Pay ${formatINR(amt)} · ${suggestion.mode}` : "Pay",
              disabled: amt <= 0,
              onClick: submit,
            }}
            hint={amt <= 0 ? "Enter an amount." : undefined}
          />
        )
      }
    >
      {confirmed ? (
        <div className="py-8 text-center animate-rise">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pos-soft text-pos">
            <Check size={22} strokeWidth={2.5} />
          </div>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            {formatINR(amt)} to {payee?.name}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {suggestion.mode} · {suggestion.lands}
          </p>
        </div>
      ) : (
        <>
          {!payee ? (
            <>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {payees.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setPayee(p)}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-surface-2 cursor-pointer"
                  >
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-ink">{p.name}</span>
                      <span className="block text-[11.5px] text-ink-3 tnum">
                        {p.masked}
                        {p.payments > 0 ? ` · last ${fmtDate(p.lastPaid)}` : " · added just now"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {/* Paying someone new started here and had nowhere to go: you
                  had to abandon the payment, find another tile, and start
                  again. The escape hatch sits below the list, not beside
                  it (F4). */}
              <button
                onClick={onAddPayee}
                className="mt-2 flex w-full items-center gap-2.5 rounded-[10px] border-t border-border px-3 pb-1 pt-3 text-left text-[13px] font-medium text-accent transition-colors hover:bg-surface-2 cursor-pointer"
              >
                <Users size={14} className="shrink-0" />
                Someone new — verify and pay
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-[10px] bg-surface-2 px-3.5 py-2.5">
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{payee.name}</p>
                  <p className="text-[11.5px] text-ink-3 tnum">
                    {payee.masked} · {payee.ifsc}
                  </p>
                </div>
                {/* No inline "Change" any more — the footer's retreat is that
                    exact action, and one small sheet does not need two. */}
              </div>
              {/* The field keeps what they typed. It used to overwrite every
                  keystroke with a re-formatted number, which is how a decimal
                  point turned ₹50,000.50 into ₹50,00,050 — the point was
                  swallowed and the paise appended as rupees. */}
              <Input
                autoFocus
                inputMode="decimal"
                placeholder="Amount in ₹"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum mt-3"
              />
              {amount.trim() && !parsed && (
                <p className="mt-1.5 text-[11.5px] text-neg">Not an amount we can read.</p>
              )}
              {parsed?.note && <p className="mt-1.5 text-[11.5px] text-ink-3">{parsed.note}</p>}
              <Input
                placeholder="Tag — becomes the expense and the ledger entry (optional)"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="mt-2.5"
              />
              {amt > 0 && (
                <div className="mt-3 rounded-[10px] bg-info-soft px-3.5 py-2.5 text-[12.5px] text-ink animate-fade">
                  <span className="font-semibold">{suggestion.mode}</span> · {suggestion.lands}
                  <span className="text-ink-3">
                    {" "}
                    · or {suggestion.alternatives[0].mode}, {suggestion.alternatives[0].lands}
                  </span>
                </div>
              )}
              {hasChecker && amt >= 100000 && (
                <p className="mt-2 text-[11.5px] text-ink-3">
                  Over ₹1,00,000 — as the approver, your confirmation clears it in one step.
                </p>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

// The no-cooling-period flow: penny drop returns the account holder's legal
// name, you confirm the match, the payee is active immediately.
// Adding a payee used to end on "{name} is ready to pay" and then store
// nothing — the list is derived from payment history, so the new
// beneficiary vanished the moment the sheet closed. That line was the
// strongest claim on the screen and it was false.
function AddPayeeSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (p: SessionPayee) => void;
}) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [stage, setStage] = useState<"form" | "checking" | "matched">("form");

  // Bank details arrive pasted out of WhatsApp, so the field takes whatever
  // shape they came in and we check the real one. `length >= 4` used to send
  // "PUNB 01234" to a penny drop that could only fail.
  const code = parseIfsc(ifsc);
  const ready = !!name && account.length >= 6 && !!code;

  function verify() {
    if (!ready) return;
    setStage("checking");
    setTimeout(() => setStage("matched"), 1400);
  }

  const legal = name.toUpperCase();

  return (
    <Sheet
      title="Add a payee"
      onClose={onClose}
      footer={
        stage === "checking" ? undefined : stage === "form" ? (
          <SheetFooter
            retreat={{ label: "Payments", onClick: onClose }}
            advance={{ label: "Verify with a penny drop", disabled: !ready, onClick: verify }}
            hint={ready ? undefined : "Needs a name, an account number and a valid IFSC."}
          />
        ) : (
          <SheetFooter
            retreat={{ label: "Change the details", onClick: () => setStage("form") }}
            advance={{
              label: "Add payee and pay them",
              onClick: () => onAdded({ name: name.trim(), account, ifsc: code! }),
            }}
          />
        )
      }
    >
      {stage === "form" && (
        <>
          <Input autoFocus placeholder="Payee name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Account number"
            inputMode="numeric"
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
            className="tnum mt-2.5"
          />
          <Input
            placeholder="IFSC"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            className="tnum mt-2.5"
          />
          {ifsc.trim() && !code && (
            <p className="mt-1.5 text-[11.5px] text-neg">
              An IFSC is four letters, a zero, then six characters.
            </p>
          )}
          <p className="mt-3 text-[11.5px] text-ink-3">
            ₹1 goes across and the bank returns their legal name.
          </p>
        </>
      )}
      {stage === "checking" && (
        <div className="py-10 text-center">
          <p className="text-[13.5px] text-ink-2 animate-pulse-soft">
            Penny drop in flight — asking the bank for the account holder&apos;s name…
          </p>
        </div>
      )}
      {stage === "matched" && (
        <div className="animate-rise">
          <div className="rounded-[10px] bg-pos-soft px-4 py-3">
            <p className="text-[12px] text-ink-2">The bank says this account belongs to</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{legal}</p>
            <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-pos">
              <Check size={12} strokeWidth={2.5} /> Matches the name you entered
            </p>
          </div>
          <p className="mt-3 text-[11.5px] text-ink-3">
            No cooling period. Verification replaced the waiting.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

// The sheet both payment flows live in. It had no height limit and no scroll
// region, so on a short viewport a tall stage simply ran off the bottom of the
// screen with the commit on it. Header pinned, body scrolls, footer pinned (E8).
function Sheet({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-(--shadow-pop) animate-scale-in sm:rounded-(--radius-card)" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 cursor-pointer">
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer}
      </div>
    </div>
  );
}
