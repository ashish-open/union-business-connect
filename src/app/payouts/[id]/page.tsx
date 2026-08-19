"use client";

// One payment, and what happened to it.
//
// This screen did not exist. A payment was a row in a list, and the row was
// everything the product could say about it — which left two questions with
// nowhere to go. "Can you send me the reference?" is the one a vendor actually
// asks, and the UTR was printed in eleven-pixel grey inside a row nobody could
// link to. And a returned payment showed a reason with no account of when it
// left, when it came back, or where the money is now.
//
// The returned case is what this screen is for. Its retry creates a NEW
// payment rather than reviving this one, so the failed attempt survives as a
// record: two attempts happened, and a screen that erases the first is a screen
// that quietly disagrees with the bank statement.

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Copy } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Timeline } from "@/components/ui/Timeline";
import { paymentById } from "@/lib/payments";
import { fmtDateFull } from "@/lib/format";
import { useEntity, useStore } from "@/store/useStore";

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const entity = useEntity();
  const sessionPayments = useStore((s) => s.sessionPayments);
  /*
   * null = not tried, true = it is on the clipboard, false = it is not.
   *
   * The first version set "Copied" on the click and dropped the promise. The
   * clipboard write can genuinely be refused — an unfocused document, a denied
   * permission, an insecure context — and it was refused in testing, leaving a
   * button that said Copied over a clipboard that did not have it. The user then
   * pastes the wrong reference into a message to their vendor.
   */
  const [copied, setCopied] = useState<boolean | null>(null);

  const payment = useMemo(
    () =>
      entity
        ? paymentById(entity, decodeURIComponent(id), sessionPayments[entity.id] ?? [])
        : undefined,
    [entity, id, sessionPayments],
  );

  if (!entity) return <AppShell />;

  if (!payment) {
    return (
      <AppShell>
        <Card className="mt-1">
          <p className="text-[13px] font-medium text-ink">No such payment</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            It may be older than the window this workspace holds.
          </p>
          <Link
            href="/payouts"
            className="mt-3 inline-block text-[12.5px] font-medium text-accent hover:underline"
          >
            Back to payments
          </Link>
        </Card>
      </AppShell>
    );
  }

  const returned = payment.status === "returned";

  return (
    <AppShell>
      <Link
        href="/payouts"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} /> Payments
      </Link>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={payment.payee} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{payment.payee}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    {fmtDateFull(payment.date)}
                    {payment.tag ? ` · ${payment.tag}` : ""}
                  </p>
                </div>
              </div>
              {returned ? (
                <Badge tone="neg">
                  <CircleAlert size={11} strokeWidth={2.5} /> Returned
                </Badge>
              ) : payment.status === "queued" ? (
                <Badge tone="info">Queued</Badge>
              ) : (
                <Badge>
                  <Check size={11} strokeWidth={2.5} className="text-ink-3" /> Credited
                </Badge>
              )}
            </div>
            <div className="mt-3">
              <Money value={payment.amount} size="xl" tone={returned ? "muted" : undefined} />
            </div>
            {payment.mode && (
              <p className="mt-1 text-[12.5px] text-ink-3">
                {payment.mode}
                {payment.lands ? ` · ${payment.lands}` : ""}
              </p>
            )}
          </Card>

          <h2 className="mt-5 text-[13px] font-semibold text-ink">What happened</h2>
          <Card className="mt-2.5">
            <Timeline
              steps={payment.timeline.map((e) => ({
                label: e.label,
                detail: e.detail,
                state: e.tone,
              }))}
            />
          </Card>
        </div>

        <aside className="min-w-0">
          {/* The reference, as a thing you can hand over.
              It is the single most-requested fact about a payment and it lived
              inside a list row. */}
          <h2 className="text-[13px] font-semibold text-ink">Reference</h2>
          <Card className="mt-2.5">
            {payment.utr ? (
              <>
                <p className="text-[11.5px] text-ink-3">UTR</p>
                <p className="mt-0.5 break-all text-[13.5px] font-medium text-ink tnum">
                  {payment.utr}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(payment.utr!);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={12} strokeWidth={2.5} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy the reference
                    </>
                  )}
                </Button>
                {copied === false && (
                  /* Says so, and says what to do instead. */
                  <p className="mt-1.5 text-[11px] leading-4 text-warn">
                    Couldn&apos;t reach the clipboard — select it above.
                  </p>
                )}
              </>
            ) : (
              /* Said plainly rather than left blank: a missing UTR is a fact
                 about where the payment has got to, not an empty field. */
              <p className="text-[12.5px] leading-5 text-ink-2">
                A UTR appears once the bank sends it.
              </p>
            )}
          </Card>

          {returned && (
            <>
              <h2 className="mt-5 text-[13px] font-semibold text-ink">Try again</h2>
              <Card className="mt-2.5">
                <p className="text-[12.5px] leading-5 text-ink-2">
                  Fix the account, then send it again.
                </p>
                {/* A NEW payment, deep-linked with the payee and the amount, not
                    a resurrection of this one. Both attempts stay on the record
                    because both attempts happened. */}
                <Link
                  href={`/payouts?pay=${encodeURIComponent(payment.payee)}&amount=${payment.amount}`}
                  className="mt-3 inline-block"
                >
                  <Button size="sm">
                    <ArrowUpRight size={13} /> Send it again
                  </Button>
                </Link>
                <p className="mt-2 text-[11px] leading-4 text-ink-3">
                  This attempt stays here either way.
                </p>
              </Card>
            </>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
