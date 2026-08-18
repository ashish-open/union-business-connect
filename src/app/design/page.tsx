"use client";

// Phase 0 deliverable: the design system on one reviewable page.
// This page is a workbench, not a product surface.

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, OtpInput } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { ExceptionCard } from "@/components/cards/ExceptionCard";
import { NudgeCard } from "@/components/cards/NudgeCard";
import { StatementLine } from "@/components/statement/StatementLine";
import { BrandMark } from "@/components/app/BrandMark";

const SWATCHES = [
  ["bg", "var(--bg)"],
  ["surface", "var(--surface)"],
  ["surface-2", "var(--surface-2)"],
  ["border", "var(--border)"],
  ["ink", "var(--ink)"],
  ["ink-2", "var(--ink-2)"],
  ["ink-3", "var(--ink-3)"],
  ["accent", "var(--accent)"],
  ["accent-soft", "var(--accent-soft)"],
  ["gold", "var(--gold)"],
  ["pos", "var(--pos)"],
  ["warn", "var(--warn)"],
  ["neg", "var(--neg)"],
  ["info", "var(--info)"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-10 flex items-end justify-between">
        <BrandMark size="lg" />
        <p className="text-xs text-ink-3">Phase 0 · design system</p>
      </div>

      <Section title="Color tokens">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {SWATCHES.map(([name, v]) => (
            <div key={name}>
              <div className="h-12 rounded-lg border border-border" style={{ background: v }} />
              <p className="mt-1 text-[10.5px] text-ink-3">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type & money">
        <Card className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Money is the hero of every screen
          </h1>
          <p className="text-sm leading-6 text-ink-2">
            Body copy is plain and confident. Numbers always carry tabular numerals so columns
            align: 1,111 vs 9,999.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Money value={4852210} size="hero" />
            <Money value={484000} size="xl" />
            <Money value={-92400} size="lg" tone="neg" />
            <Money value={48200} size="md" tone="pos" signed />
            <Money value={10620000} size="md" compact />
          </div>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Connect Swiggy</Button>
          <Button variant="secondary">See the gap</Button>
          <Button variant="ghost">Skip for now</Button>
          <Button variant="danger">Reject match</Button>
          <Button size="lg">Allow and continue</Button>
          <Button size="sm" variant="secondary">
            Track for 26AS
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge tone="pos">Matched</Badge>
          <Badge tone="info">88% match — confirm?</Badge>
          <Badge tone="warn">TDS deducted</Badge>
          <Badge tone="neg">Short −₹16,400</Badge>
          <Badge tone="accent">From bank KYC</Badge>
          <Badge tone="gold">First in market</Badge>
          <Badge>Read-only</Badge>
        </div>
      </Section>

      <Section title="Statement lines — recon state lives on the line">
        <Card pad="none">
          <StatementLine
            date="2026-07-22"
            name="Swiggy"
            narration="NEFT CR-ICIC0000104-BUNDL TECHNOLOGIES PVT LTD-SWIGGY WKLY SETL"
            amount={371900}
            direction="credit"
            recon={{ state: "matched", to: "Settlement 13–19 Jul" }}
          />
          <StatementLine
            date="2026-07-20"
            name="Meta Ads"
            narration="CARD PUR-META PLATFORMS INDIA-AD SPEND"
            amount={92400}
            direction="debit"
            recon={{ state: "suggested", confidence: 88 }}
          />
          <StatementLine
            date="2026-07-15"
            name="Zomato"
            narration="NEFT CR-HDFC0000060-ZOMATO LIMITED-WKLY SETL"
            amount={261900}
            direction="credit"
            recon={{ state: "short", by: 26800 }}
          />
          <StatementLine
            date="2026-07-13"
            name="Prestige Tech Park FM"
            narration="NEFT CR-HDFC0000042-PRESTIGE TECH PARK FM-CATERING INV 2214"
            amount={182160}
            direction="credit"
            recon={{ state: "unexplained" }}
          />
          <StatementLine
            date="2026-07-12"
            name="School fee"
            narration="NEFT DR-VIBGYOR HIGH SCHOOL-TERM FEE"
            amount={28500}
            direction="debit"
            recon={{ state: "personal" }}
          />
        </Card>
      </Section>

      <Section title="Exception card — typed, with verbs">
        <ExceptionCard
          reason="TDS_DEDUCTED"
          amount={3400}
          title="Urbannest paid ₹3,36,600 against INV-101 (₹3,40,000)"
          evidence="Landed at exactly invoice − 1% · 194C"
          onAction={() => {}}
        />
      </Section>

      <Section title="Nudge card — earned, fact-led, one action">
        <NudgeCard
          fact="₹48,200 looks short-settled by Swiggy this quarter"
          body="Three settlements came in below your contracted rate. Connect the channel and the dispute drafts itself, order by order."
          action="See the gap"
        />
      </Section>

      <Section title="Inputs">
        <Card className="space-y-4">
          <Input placeholder="Mobile number registered with the bank" />
          <OtpInput onComplete={() => {}} />
        </Card>
      </Section>
    </div>
  );
}
