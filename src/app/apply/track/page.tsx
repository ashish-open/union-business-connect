"use client";

// The application tracker — honest about where things stand, and the dead
// zone IS the onboarding: while the account opens, the applicant connects
// their existing bank and channels so day one starts explained.

import { useEffect } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import { Check, Landmark, MessageCircle, Phone, Store, UserPlus } from "lucide-react";
import { ANCHOR_DATE } from "@/data/seed";
import { addDays, fmtDateFull } from "@/lib/format";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/app/BrandMark";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

const BRANCH = { name: "Indiranagar branch", contact: "Suresh Menon · 98861 22110" };

export default function TrackPage() {
  const mounted = useHydrated();
  const router = useRouter();
  const application = useStore((s) => s.application);
  const tasks = useStore((s) => s.applicationTasks);
  const completeAppTask = useStore((s) => s.completeAppTask);
  useEffect(() => {
    if (mounted && !application) router.replace("/apply");
  }, [mounted, application, router]);
  if (!mounted || !application) return null;

  const timeline = [
    {
      label: "Application received",
      sub: `${fmtDateFull(application.submittedOn)} · ref ${application.ref}`,
      state: "done" as const,
    },
    {
      label: "Documents verified",
      sub: "PAN–GSTIN name match confirmed automatically — nothing pending from you",
      state: "done" as const,
    },
    {
      label: "Video KYC",
      sub: `Scheduled · ${application.slot} — a bank officer calls you, ~10 minutes`,
      state: "now" as const,
    },
    {
      label: "Branch approval",
      sub: `${BRANCH.name} · ${BRANCH.contact}`,
      state: "todo" as const,
    },
    {
      label: "Account opens",
      sub: `Expected by ${fmtDateFull(addDays(ANCHOR_DATE, 2))} — we'll WhatsApp you at every step`,
      state: "todo" as const,
    },
  ];

  const dayOne = [
    {
      id: "bank",
      icon: Landmark,
      label: "Connect your current bank, read-only",
      sub: application.viaTry
        ? "Done while you explored — HDFC ••4210 is already being read"
        : "Account Aggregator · revocable any time",
      done: application.viaTry || !!tasks["bank"],
    },
    {
      id: "channels",
      icon: Store,
      label: "Connect Swiggy & Zomato",
      sub: "Your settlement history starts matching itself today, not on day one",
      done: !!tasks["channels"],
    },
    {
      id: "accountant",
      icon: UserPlus,
      label: "Invite your accountant",
      sub: "Read-only books · CA pack at every close",
      done: !!tasks["accountant"],
    },
  ];
  const allReady = dayOne.every((t) => t.done);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-0">
        <BrandMark withName />
        <span className="tnum text-[12.5px] text-ink-3">{application.ref}</span>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-0">
        <div className="animate-rise">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {application.legalName} — account on its way
            </h1>
            <Badge tone="info">In progress</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            Nothing is waiting on you except the video call.
          </p>

          {/* honest tracker */}
          <Card className="mt-6 !p-4">
            <ol className="space-y-0">
              {timeline.map((t, i) => (
                <li key={t.label} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span
                      className="absolute left-[10px] top-6 bottom-0 w-px bg-border"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-[1] flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full",
                      t.state === "done"
                        ? "bg-pos-soft text-pos"
                        : t.state === "now"
                          ? "bg-accent-soft text-accent"
                          : "border border-border-strong bg-surface",
                    )}
                  >
                    {t.state === "done" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : t.state === "now" ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        t.state === "todo" ? "text-ink-2" : "font-medium text-ink",
                      )}
                    >
                      {t.label}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">{t.sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <p className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-3">
            <MessageCircle size={13} />
            Updates arrive on WhatsApp.
            <span className="ml-auto flex items-center gap-1.5">
              <Phone size={12} />
              {brand.supportLine}
            </span>
          </p>

          {/* ★ the dead zone is onboarding */}
          <div className="mt-8">
            <h2 className="text-base font-semibold text-ink">
              While it opens, get day one ready
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-2">
              The account takes a couple of days. Your books don&apos;t wait for it.
            </p>

            <div className="mt-3 space-y-2.5">
              {dayOne.map((t) => (
                <Card key={t.id} className="!p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        t.done ? "bg-pos-soft text-pos" : "bg-surface-2 text-ink-2",
                      )}
                    >
                      {t.done ? <Check size={16} strokeWidth={2.5} /> : <t.icon size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{t.label}</p>
                      <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">{t.sub}</p>
                    </div>
                    {!t.done && (
                      <Button size="sm" variant="secondary" onClick={() => completeAppTask(t.id)}>
                        Connect
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {allReady ? (
              <div className="mt-4 rounded-(--radius-card) bg-pos-soft px-4 py-3.5 text-[13px] leading-5 text-pos animate-fade">
                <span className="font-semibold">Day one is ready.</span> Payouts unlock the
                moment the account opens.
              </div>
            ) : (
              <p className="mt-3 text-[12px] leading-5 text-ink-3">
                Your first sign-in then starts with 90 days of explained history.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
