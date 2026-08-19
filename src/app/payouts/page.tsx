"use client";

// Payouts — the second strength. Payees are derived from payment history
// (no data entry), new payees verify by penny drop and are active instantly
// (no cooling period), and mode choice always says when the money lands.
// Returns are first-class: a payment isn't "done" at submission.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryString } from "@/lib/useQueryString";
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
import { ShareBar } from "@/components/ui/ShareBar";
import { brand } from "@/config/brand";
import { ANCHOR_DATE, type PendingApproval } from "@/data/seed";
import {
  derivePayees,
  legalNameFor,
  modeFor,
  nameMatches,
  payoutHistoryCount,
  recentPayments,
  Payee,
} from "@/lib/payments";
import { payable } from "@/lib/balance";
import { ConfirmPayment } from "@/components/money/ConfirmPayment";
import { ShortOfBalance } from "@/components/money/ShortOfBalance";
import { cn } from "@/lib/cn";
import { fmtDate, formatINR, maskAccount, parseAmount, parseIfsc, plural } from "@/lib/format";
import { useCustomer, useEntity, useStore, SessionPayee, SessionPayment } from "@/store/useStore";

export default function PayoutsPage() {
  const router = useRouter();
  const entity = useEntity();
  const customer = useCustomer();
  const resolved = useStore((s) => s.resolved);
  const resolveItem = useStore((s) => s.resolveItem);
  const sessionPayments = useStore((s) => s.sessionPayments);
  const addPayment = useStore((s) => s.addPayment);
  const sessionPayees = useStore((s) => s.sessionPayees);
  const addPayee = useStore((s) => s.addPayee);
  const makerCheckerPref = useStore((s) => (entity ? s.makerChecker[entity.id] : undefined));

  /*
   * `?pay=<payee>&amount=<n>` — how a returned payment is sent again.
   *
   * Read as the INITIAL state rather than corrected by an effect a render later,
   * so the sheet is never briefly open on the wrong payee. `useQueryString` and
   * not `useSearchParams`: the latter suspends the tree up to the nearest
   * boundary, which is what left /statement rendering an empty shell on a cold
   * load.
   */
  const query = useQueryString();
  const asked = useMemo(() => {
    const q = new URLSearchParams(query);
    const name = q.get("pay");
    return name ? { name, amount: q.get("amount") ?? "" } : null;
  }, [query]);

  const [payTo, setPayTo] = useState<Payee | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [approving, setApproving] = useState<PendingApproval | null>(null);

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
      /* The name the penny drop returned when they were added, not a fresh
         guess — this is evidence from a moment in time. */
      legalName: p.legalName ?? legalNameFor(p.name),
      mismatchAcceptedBy: p.mismatchAcceptedBy,
    }));
    const derived = derivePayees(entity).filter((d) => !added.some((a) => a.name === d.name));
    return [...added, ...derived];
  }, [entity, sessionPayees]);
  const recent = useMemo(() => (entity ? recentPayments(entity) : []), [entity]);
  /* The denominator for the share bars: everything that has gone to payees, not
     everything that has left the account. A share of the wrong total is a
     smaller lie than no share, but it is still one. */
  const paidAcrossPayees = useMemo(
    () => payees.reduce((sum, p) => sum + p.totalPaid, 0),
    [payees],
  );

  /*
   * The deep link resolves against the payee list, so "send it again" lands on
   * the same person the failed payment went to — matched by name, because that
   * is the only handle a derived payee has.
   */
  const askedPayee = asked ? (payees.find((p) => p.name === asked.name) ?? null) : null;

  if (!entity) return <AppShell />;

  const mine = sessionPayments[entity.id] ?? [];
  const primaryAccount = entity.accounts.find((a) => !a.readOnly);
  /*
   * What can actually be sent, right now.
   *
   * `payable` counts only the accounts we hold rails to — money in an
   * AA-linked account is money we can see and cannot move, which is the whole
   * premise of the sweep-in offer. Payments already made this session come off
   * it, because otherwise the same ₹7 L could be sent five times over and the
   * fifth screen would look exactly as confident as the first.
   */
  const spent = mine.reduce((sum, p) => sum + p.amount, 0);
  const available = Math.max(0, (payable(entity) ?? 0) - spent);
  const watchedOnly = entity.accounts
    .filter((a) => a.readOnly)
    .reduce((sum, a) => sum + a.balance, 0);
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
        {`Paid from ${brand.bankName} ${primaryAccount ? maskAccount(primaryAccount.masked) : ""} · no wallet to load`}
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
                    <Button size="sm" variant="secondary" onClick={() => setApproving(a)}>
                      Review &amp; approve
                    </Button>
                  )}
                </div>

                {/* Every payment in the batch, on the card, before anything is
                    approved.
                    This button used to clear the whole run on one press with the
                    six payments nowhere on screen — the total was the only thing
                    the data knew. Approving a figure is exactly how the wrong
                    vendor gets paid, and a batch is the one place it would have
                    been visible. */}
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {a.lines.map((l) => (
                    <li
                      key={l.payee}
                      className="flex items-center gap-3 py-2"
                    >
                      <Avatar name={l.payee} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-ink">{l.payee}</span>
                        <span className="block truncate text-[11px] text-ink-3">{l.tag}</span>
                      </span>
                      <Money value={l.amount} size="sm" className="shrink-0" />
                    </li>
                  ))}
                </ul>
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
                id={p.id}
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
                  id={p.id}
                  payee={p.payee}
                  amount={p.amount}
                  sub={
                    p.status === "returned"
                      ? `${p.note} · money is back`
                      : `${fmtDate(p.date)}${p.utr ? ` · UTR ${p.utr}` : ""}`
                  }
                  status={retried ? "retry-queued" : p.status}
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
                  {/* The list is ranked by spend, which says who is biggest and
                      not by how much. Here the first payee is a third of
                      everything that leaves — visible as a length, not a sum
                      the reader has to do. */}
                  <ShareBar value={p.totalPaid} total={paidAcrossPayees} />
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

      {(payOpen || asked) && (
        <PaySheet
          payees={payees}
          /* Null when the failed payment went somewhere that is not a saved
             payee — which is the usual case for the return this exists for:
             "beneficiary account closed" means the old details are the problem,
             so landing on the picker with an empty slot is right, and prefilling
             the dead account would be wrong. */
          preselected={payTo ?? askedPayee}
          initialAmount={payTo ? "" : (asked?.amount ?? "")}
          available={available}
          watchedOnly={watchedOnly}
          hasChecker={makerCheckerPref ?? !!entity.secondUser}
          onClose={() => {
            setPayOpen(false);
            setPayTo(null);
            /* Drop `?pay=` on the way out, or closing the sheet leaves a URL
               that reopens it on the next render. */
            if (asked) router.replace("/payouts");
          }}
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
      {approving && (
        <ApproveRunSheet
          approval={approving}
          onClose={() => setApproving(null)}
          onApprove={() => {
            resolveItem(entity.id, `ap-${approving.id}`);
            setApproving(null);
          }}
        />
      )}
      {addOpen && (
        <AddPayeeSheet
          acceptedBy={customer?.name ?? "You"}
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
              legalName: p.legalName ?? legalNameFor(p.name),
              mismatchAcceptedBy: p.mismatchAcceptedBy,
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

/*
 * A row no longer offers its own retry.
 *
 * It used to, and pressing it marked the return resolved and created nothing —
 * the row then said "Retry queued" about a payment that did not exist. The retry
 * lives on the payment's own screen now, where it makes a real new payment and
 * this failed attempt survives beside it.
 */
function PaymentRow({
  id,
  payee,
  amount,
  sub,
  status,
}: {
  /** The record this row is a view of. Absent means there is nothing to open. */
  id?: string;
  payee: string;
  amount: number;
  sub: string;
  status: "credited" | "returned" | "queued" | "retry-queued";
}) {
  const shell = cn(
    "flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0",
    id && "transition-colors hover:bg-surface-2",
  );
  /* The row opens the payment. It used to be the only representation of one, so
     the UTR it printed in grey was as far as the product could go. */
  const inner = (
    <>
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
      <Money value={-amount} size="sm" className="shrink-0" />
    </>
  );

  return id ? (
    <Link href={`/payouts/${encodeURIComponent(id)}`} className={shell}>
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

/* ------------------------------------------------------------------ */

/*
 * Choose who, enter how much, READ IT BACK, then send.
 *
 * The review stage is new and it is the point of this flow. Before it, the
 * amount step's button was the commit: one press moved the money, and the four
 * facts that decide whether a payment is a mistake — how much, to whose account
 * by the bank's name, on which rail, and whether it can be taken back — were
 * never on one screen. There was also no balance check at all, so the flow
 * would confirm a figure the account could not cover.
 *
 * Friction is normally the enemy here. This is the exception the product should
 * make: the only friction worth adding is the friction that protects money.
 */
type PayStage = "amount" | "review" | "sent";

function PaySheet({
  payees,
  preselected,
  initialAmount,
  available,
  watchedOnly,
  hasChecker,
  onClose,
  onAddPayee,
  onDone,
}: {
  payees: Payee[];
  preselected: Payee | null;
  /** Prefilled by a retry, so a failed amount is not retyped from memory. */
  initialAmount?: string;
  /** What the accounts we hold rails to can actually send right now. */
  available: number;
  /** Balances we can see but not move — named so the shortfall can point at them. */
  watchedOnly: number;
  hasChecker: boolean;
  onClose: () => void;
  onAddPayee: () => void;
  onDone: (p: SessionPayment) => void;
}) {
  const [payee, setPayee] = useState<Payee | null>(preselected);
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [tag, setTag] = useState("");
  const [stage, setStage] = useState<PayStage>("amount");
  const parsed = parseAmount(amount);
  const amt = parsed?.value ?? 0;
  const suggestion = modeFor(amt);
  const short = Math.max(0, amt - available);
  const covered = amt > 0 && short === 0;
  const confirmed = stage === "sent";

  /* In this workspace the signed-in owner IS the approver, so a large payment
     still leaves immediately — it just says so first. Where a business has a
     separate checker this is where the queued wording belongs. */
  const approvalNote =
    hasChecker && amt >= 100000
      ? "Over ₹1,00,000 — your approval clears it, and it goes straight away."
      : undefined;

  function send() {
    if (!payee || !covered) return;
    setStage("sent");
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
        confirmed || !payee ? undefined : stage === "review" ? (
          /* The commit, and the only button in the flow that moves money. It
             names the rail as well as the amount, so what you press says what
             it does. */
          <SheetFooter
            retreat={{ label: "Change the amount", onClick: () => setStage("amount") }}
            advance={{
              label: `Send ${formatINR(amt)} · ${suggestion.mode}`,
              onClick: send,
            }}
            hint={
              approvalNote
                ? "You are the approver, so this leaves as soon as you press it."
                : "This cannot be recalled."
            }
          />
        ) : (
          /* Advancing to the review is NOT a payment, so it does not claim to
             be one. It used to read "Pay ₹45,000 · IMPS" and it paid. */
          <SheetFooter
            retreat={{ label: "Change payee", onClick: () => setPayee(null) }}
            advance={{
              label: "Review the payment",
              disabled: !covered,
              onClick: () => setStage("review"),
            }}
            hint={
              amt <= 0
                ? "Enter an amount."
                : short > 0
                  ? `${formatINR(short)} more than this account can send.`
                  : undefined
            }
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
      ) : stage === "review" && payee ? (
        <ConfirmPayment
          amount={amt}
          payeeName={payee.name}
          legalName={payee.legalName}
          masked={payee.masked}
          ifsc={payee.ifsc}
          mode={suggestion.mode}
          lands={suggestion.lands}
          tag={tag || undefined}
          approvalNote={approvalNote}
          mismatchAcceptedBy={payee.mismatchAcceptedBy}
        />
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
              {amt > 0 && short === 0 && (
                <div className="mt-3 rounded-[10px] bg-info-soft px-3.5 py-2.5 text-[12.5px] text-ink animate-fade">
                  <span className="font-semibold">{suggestion.mode}</span> · {suggestion.lands}
                  <span className="text-ink-3">
                    {" "}
                    · or {suggestion.alternatives[0].mode}, {suggestion.alternatives[0].lands}
                  </span>
                </div>
              )}
              {/* Said here, while the amount can still be changed, rather than
                  after the bank has bounced it. */}
              {short > 0 && (
                <ShortOfBalance short={short} available={available} elsewhere={watchedOnly} />
              )}
              {/* What this account can send, always in view — a balance you have
                  to leave the flow to check is a balance nobody checks. */}
              <p className="mt-2 text-[11.5px] text-ink-3 tnum">
                {`${formatINR(available)} available to send`}
              </p>
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
  acceptedBy,
  onClose,
  onAdded,
}: {
  /** Recorded against an accepted mismatch — an override needs an owner. */
  acceptedBy: string;
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

  /*
   * What the bank came back with — which is allowed to differ from what was
   * typed. It used to be `name.toUpperCase()`: the screen ran a verification
   * whose result it had already decided, and then reported a match. The single
   * commonest way a payment goes to the wrong account was unreachable.
   */
  const legal = legalNameFor(name);
  const agrees = nameMatches(name, legal);

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
              label: agrees ? "Add payee and pay them" : "Use the bank's name and continue",
              onClick: () =>
                onAdded({
                  name: name.trim(),
                  account,
                  ifsc: code!,
                  legalName: legal,
                  /* Stamped only when they actually overrode something. An
                     override nobody can see afterwards is the same as a check
                     that never ran. */
                  mismatchAcceptedBy: agrees ? undefined : acceptedBy,
                }),
            }}
            hint={
              agrees
                ? undefined
                : "The next screen shows the bank's name, not yours."
            }
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
          <div
            className={cn(
              "rounded-[10px] px-4 py-3",
              agrees ? "bg-pos-soft" : "bg-warn-soft",
            )}
          >
            <p className="text-[12px] text-ink-2">The bank says this account belongs to</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{legal}</p>
            {agrees ? (
              <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-pos">
                <Check size={12} strokeWidth={2.5} /> Matches the name you entered
              </p>
            ) : (
              /* BOTH names, side by side, and no default choice.
                 A mismatch is the commonest cause of money reaching the wrong
                 account, so it stops the flow rather than colouring a border:
                 the two names are stated as a comparison, and continuing is a
                 decision somebody makes on the record. */
              <>
                <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-warn">
                  <CircleAlert size={12} strokeWidth={2.5} /> Not the name you entered
                </p>
                <dl className="mt-2.5 space-y-1 border-t border-warn/25 pt-2.5 text-[12px]">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-ink-3">You typed</dt>
                    <dd className="font-medium text-ink">{name.trim()}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-ink-3">The bank has</dt>
                    <dd className="font-medium text-ink">{legal}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
          {/* Two lines, not a paragraph: the first says why a mismatch is
              usually harmless, the second says when it is not. Run together they
              were a wall, and a wall at the moment of deciding gets skipped. */}
          {agrees ? (
            <p className="mt-3 text-[11.5px] leading-5 text-ink-3">
              No cooling period. Verification replaced the waiting.
            </p>
          ) : (
            <>
              <p className="mt-3 text-[11.5px] leading-5 text-ink-2">
                Trading names and registered names often differ.
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
                Don&apos;t recognise this one? Check the account number.
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

/*
 * Clearing a prepared run — one press that sends six payments.
 *
 * So it restates them all. `ConfirmPayment` does this for a single payee and
 * deliberately is not reused here: its whole shape is one legal name and one
 * arrival, and a batch has neither. What both share is the rule — the last
 * thing read before money moves lists what moves, never only the total.
 */
function ApproveRunSheet({
  approval,
  onClose,
  onApprove,
}: {
  approval: PendingApproval;
  onClose: () => void;
  onApprove: () => void;
}) {
  return (
    <Sheet
      title="Approve the run"
      onClose={onClose}
      footer={
        <SheetFooter
          retreat={{ label: "Payments", onClick: onClose }}
          advance={{
            label: `Approve ${approval.count} payments · ${formatINR(approval.total)}`,
            onClick: onApprove,
          }}
          hint="They go out in the next payment run."
        />
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        Prepared by {approval.preparedBy}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-2">{approval.note}</p>

      <ul className="mt-4 divide-y divide-border rounded-[10px] border border-border">
        {approval.lines.map((l) => (
          <li key={l.payee} className="flex items-center gap-3 px-3.5 py-2.5">
            <Avatar name={l.payee} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-ink">{l.payee}</span>
              <span className="block truncate text-[11px] text-ink-3">{l.tag}</span>
            </span>
            <Money value={l.amount} size="sm" className="shrink-0" />
          </li>
        ))}
      </ul>

      {/* The total sits UNDER the list, as its sum. Above it, it is a headline
          you approve instead of reading the lines. */}
      <div className="mt-2.5 flex items-baseline justify-between gap-3 px-3.5">
        <span className="text-[11.5px] text-ink-3">{plural(approval.count, "payment")}</span>
        <Money value={approval.total} size="md" />
      </div>
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
