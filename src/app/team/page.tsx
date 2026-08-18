"use client";

// People & roles — reached from the business switcher, not the nav (the
// five nav items are the daily beat; this is a once-a-quarter surface).
// Maker-checker is OFFERED once a second person exists, never forced:
// the only friction we add is friction that protects money.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ShieldCheck, UserPlus } from "lucide-react";
import { useCustomer, useEntity, useStore, TeamInvite } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { AppShell } from "@/components/app/AppShell";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

const CHECKER_THRESHOLD = 50_000;

export default function TeamPage() {
  const router = useRouter();
  const customer = useCustomer();
  const entity = useEntity();
  const teamInvites = useStore((s) => s.teamInvites);
  const makerChecker = useStore((s) => s.makerChecker);
  const inviteTeammate = useStore((s) => s.inviteTeammate);
  const setMakerChecker = useStore((s) => s.setMakerChecker);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamInvite["role"]>("Accountant");

  if (!entity || !customer) return <AppShell />;

  const invite = teamInvites[entity.id];
  const secondPerson = entity.secondUser ?? (invite ? `${invite.name} (${invite.role.toLowerCase()})` : null);
  // a second user seeded on the entity means checking is already their habit
  const checkerOn = makerChecker[entity.id] ?? !!entity.secondUser;

  return (
    <AppShell>
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink transition-colors cursor-pointer"
      >
        <ArrowLeft size={13} />
        Back
      </button>

      {/* the title lives in the top bar — this line answers the page instead */}
      <p className="text-[12.5px] text-ink-3">
        {entity.name} · who can see, prepare and release.
      </p>

      {/* the people */}
      <Card className="mt-6 !p-0 overflow-hidden">
        <PersonRow
          name={customer.name}
          detail="Sees everything · releases money · adds people"
          badge={
            <Badge variant="outline">
              Owner
            </Badge>
          }
        />
        {entity.secondUser && (
          <PersonRow
            name={entity.secondUser}
            detail="Prepares payouts and invoices · never releases"
            badge={
              <Badge variant="outline">
                Prepares
              </Badge>
            }
          />
        )}
        {invite && (
          <PersonRow
            name={invite.name}
            detail={`${invite.role} — sees the books read-only, prepares — never releases money`}
            badge={<Badge tone="info">Invited · WhatsApp sent</Badge>}
          />
        )}
      </Card>

      {/* invite */}
      {!invite && !entity.secondUser && !inviteOpen && (
        <Card className="mt-4 !p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <UserPlus size={16} />
            </span>
            <div className="min-w-0 flex-1">
              {/* a deficiency empty state: name the void, say what the missing
                  person would do for you, offer the one action */}
              <p className="text-sm font-medium text-ink">No teammates yet</p>
              <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">
                An accountant sees the same books read-only and gets the CA pack each close.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
          </div>
        </Card>
      )}
      {inviteOpen && !invite && (
        <Card className="mt-4 !p-4 animate-fade">
          <p className="text-[13px] font-medium text-ink">Invite someone</p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Their name"
              className="flex-1"
            />
            <div className="flex gap-2">
              {(["Accountant", "Manager"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-xl px-3.5 py-2 text-[13px] transition-colors cursor-pointer",
                    role === r
                      ? "bg-accent text-white"
                      : "bg-surface text-ink-2 shadow-(--shadow-ctl) hover:text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            They get a WhatsApp link. Whatever the role, releasing money stays with you.
          </p>
          <Button
            size="sm"
            className="mt-3"
            disabled={name.trim().length < 2}
            onClick={() => {
              inviteTeammate(entity.id, { name: name.trim(), role });
              setInviteOpen(false);
            }}
          >
            Send invite
          </Button>
        </Card>
      )}

      {/* maker-checker — offered once a second person exists, never forced */}
      {secondPerson && (
        <Card className="mt-4 !p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                checkerOn ? "bg-pos-soft text-pos" : "bg-surface-2 text-ink-2",
              )}
            >
              <ShieldCheck size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Two pairs of eyes on money out</p>
              <p className="mt-0.5 text-[12.5px] leading-5 text-ink-3">
                {checkerOn ? (
                  <>
                    {`On · ${secondPerson.split(" (")[0]} prepares, you release above ${formatINR(CHECKER_THRESHOLD, { compact: true })}`}
                  </>
                ) : (
                  <>
                    Payments above {formatINR(CHECKER_THRESHOLD, { compact: true })} would wait
                    for a second OK. Your choice — you can turn it off any time.
                  </>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant={checkerOn ? "ghost" : "secondary"}
              onClick={() => setMakerChecker(entity.id, !checkerOn)}
            >
              {checkerOn ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </Card>
      )}

      <p className="mt-4 text-[12px] leading-5 text-ink-3">
        Logged · the bank sees the same trail.
      </p>
    </AppShell>
  );
}

function PersonRow({
  name,
  detail,
  badge,
}: {
  name: string;
  detail: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">
        {name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          {name}
          {badge}
        </p>
        <p className="mt-0.5 text-[12px] leading-4 text-ink-3">{detail}</p>
      </div>
      <Check size={14} className="shrink-0 text-ink-3/0" aria-hidden />
    </div>
  );
}
