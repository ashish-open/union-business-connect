"use client";

// Purchases — the same engine, the other direction.
//
// Bills live here; PAYING them does not. Payouts stays the money rail
// (approvals, penny drop, returns, UTRs) because that is a bank capability,
// not a document. A bill's Pay button hands over to it rather than growing a
// second way to move money.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SectionLayout } from "@/components/app/SubNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { DocList } from "@/components/books/DocList";
import { DocSheet } from "@/components/books/DocSheet";
import { DocEditor } from "@/components/books/DocEditor";
import { itemsFor } from "@/data/items";
import { buildParties } from "@/lib/parties";
import { convert, Doc, DOC_SPEC, DocKind, docTotals, newDoc, PURCHASE_KINDS } from "@/lib/docs";
import { ANCHOR_DATE } from "@/data/seed";
import { daysBetween, formatINR, plural } from "@/lib/format";
import { useBooks } from "@/lib/useBooks";
import { useEntity, useStore } from "@/store/useStore";

const purchaseItems = PURCHASE_KINDS.map((k) => ({
  label: DOC_SPEC[k].plural,
  href: `/purchases/${k}`,
}));

export default function PurchasesPage() {
  const router = useRouter();
  const params = useParams<{ kind: string }>();
  const entity = useEntity();
  const saveDoc = useStore((s) => s.saveDoc);
  const [open, setOpen] = useState<Doc | null>(null);
  const [draft, setDraft] = useState<Doc | null>(null);

  const books = useBooks(entity);

  if (!entity || !books) return <AppShell />;

  const kind = params.kind as DocKind;
  const spec = DOC_SPEC[kind];
  if (!spec || spec.side !== "purchase") {
    return (
      <AppShell>
        <SectionLayout title="Purchases" items={purchaseItems} active={`/purchases/${params.kind}`}>
          <Card>
            <p className="text-[13px] font-medium text-ink">No such document</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              Pick one from the list beside this.
            </p>
          </Card>
        </SectionLayout>
      </AppShell>
    );
  }

  const mine = books.docs
    .filter((d) => d.kind === kind)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  // Parked documents come first: they are the only ones in the list still
  // waiting on you. They are also kept out of every total below.
  const parked = books.drafts.filter((d) => d.kind === kind);

  const openTotal = mine.reduce((s, d) => s + docTotals(d).outstanding, 0);
  const overdue = mine.filter(
    (d) => d.dueDate && docTotals(d).outstanding > 0 && daysBetween(d.dueDate, ANCHOR_DATE) > 0,
  );

  // A blank document saved straight to the list would be junk nobody can
  // edit, so New opens the editor and only a saved document reaches the store.
  const create = () => setDraft(newDoc(kind, [...books.docs, ...books.drafts]));

  return (
    <AppShell>
      <SectionLayout title="Purchases" items={purchaseItems} active={`/purchases/${kind}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{spec.plural}</h2>
            <p className="text-[12.5px] text-ink-3">{spec.sub}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={create}>
            <Plus size={13} /> New
          </Button>
        </div>

        {spec.postsToLedger && mine.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                You owe
              </p>
              <Money value={openTotal} size="xl" className="mt-1 block" />
              <p className="mt-1.5 text-[11.5px] text-ink-3">
                {`Across ${plural(mine.filter((d) => docTotals(d).outstanding > 0).length, spec.label.toLowerCase())}`}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Past due
              </p>
              <p className="tnum mt-1 text-[28px] font-semibold leading-none tracking-[-0.025em] text-ink">
                {overdue.length}
              </p>
              <p className="mt-1.5 text-[11.5px] text-ink-3">
                {overdue.length > 0
                  ? `${formatINR(overdue.reduce((s, d) => s + docTotals(d).outstanding, 0))} to settle`
                  : "Nothing late"}
              </p>
            </Card>
          </div>
        )}

        <DocList
          docs={[...parked, ...mine]}
          onOpen={(d) => (d.status === "draft" ? setDraft(d) : setOpen(d))}
          empty={`No ${spec.plural.toLowerCase()} yet. ${spec.emptyBody}`}
        />
      </SectionLayout>

      {draft && (
        <DocEditor
          draft={draft}
          items={itemsFor(entity.id)}
          parties={buildParties(entity).map((p) => p.name)}
          onCancel={() => setDraft(null)}
          onSave={(d) => {
            saveDoc(entity.id, d);
            setDraft(null);
          }}
        />
      )}

      {open && (
        <DocSheet
          doc={open}
          all={books.docs}
          onClose={() => setOpen(null)}
          onOpenDoc={(d) => setOpen(d)}
          onPay={
            spec.postsToLedger && docTotals(open).outstanding > 0
              ? () => router.push("/payouts")
              : undefined
          }
          onConvert={(to) => {
            const made = convert(open, to, [...books.docs, ...books.drafts]);
            saveDoc(entity.id, made);
            setOpen(null);
            router.push(`/purchases/${to}`);
          }}
        />
      )}
    </AppShell>
  );
}
