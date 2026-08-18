"use client";

// One editor for every document type.
//
// Picking an item fills the rate, the unit and the GST rate, because the item
// master already knows them — the same reason parties are not typed. Totals
// move as you type, so the number you are about to commit to is never a
// surprise at the end.

import { useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import { ArrowLeft, Plus, X } from "lucide-react";
import { SheetFooter } from "@/components/ui/SheetFooter";
import { Item } from "@/data/items";
import {
  blankLine,
  Doc,
  DOC_SPEC,
  DocLine,
  docTotals,
  lineSubtotal,
} from "@/lib/docs";
import { formatINR, parseAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

export function DocEditor({
  draft,
  items,
  parties,
  onCancel,
  onSave,
}: {
  draft: Doc;
  items: Item[];
  parties: string[];
  onCancel: () => void;
  onSave: (d: Doc) => void;
}) {
  const dismissRef = useDismissable<HTMLDivElement>(onCancel);
  const spec = DOC_SPEC[draft.kind];
  const [party, setParty] = useState(draft.party);
  const [date, setDate] = useState(draft.date);
  const [lines, setLines] = useState<DocLine[]>(draft.lines);

  const doc: Doc = { ...draft, party, date, lines };
  const t = docTotals(doc);
  const valid = party.trim().length > 0 && lines.some((l) => lineSubtotal(l) > 0);
  /** Enough to find it again tomorrow — the whole bar for parking one. */
  const nameable = party.trim().length > 0;
  const parked = draft.status === "draft";

  const setLine = (i: number, patch: Partial<DocLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const pickItem = (i: number, id: string) => {
    const item = items.find((x) => x.id === id);
    if (!item) return setLine(i, { itemId: null });
    setLine(i, {
      itemId: item.id,
      description: item.name,
      rate: item.rate || item.cost,
      taxPct: item.gstPct,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onCancel} aria-hidden />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface sm:rounded-[14px] shadow-(--shadow-pop) animate-rise" ref={dismissRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[14px] font-semibold text-ink">
              {`${parked ? "Draft" : "New"} ${spec.label.toLowerCase()}`}
            </p>
            <p className="text-[11.5px] text-ink-3 tnum">{draft.number}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Field label={spec.side === "sales" ? "Customer" : "Supplier"}>
            <input
              list="party-options"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              placeholder="Start typing a name"
              className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) outline-none placeholder:text-ink-3"
            />
            <datalist id="party-options">
              {parties.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] text-ink shadow-(--shadow-ctl) outline-none tnum"
            />
          </Field>

          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Lines
          </p>
          {lines.map((l, i) => (
            <div key={i} className="mt-2 rounded-lg bg-surface-2/50 p-3">
              <div className="flex items-center gap-2">
                <select
                  value={l.itemId ?? ""}
                  onChange={(e) => pickItem(i, e.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) outline-none cursor-pointer"
                >
                  <option value="">Free text</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
                {lines.length > 1 && (
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    aria-label={`Remove line ${i + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {!l.itemId && (
                <input
                  value={l.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                  placeholder="Describe this line"
                  className="mt-2 w-full rounded-md bg-surface px-2 py-1.5 text-[12.5px] text-ink shadow-(--shadow-ctl) outline-none placeholder:text-ink-3"
                />
              )}

              <div className="mt-2 grid grid-cols-3 gap-2">
                {/* Rate and GST% are refilled by the item master, so they are
                    keyed on the item — the field keeps a draft of what you
                    typed, and picking an item has to replace that draft
                    rather than leave stale text over a new number. */}
                <Num label="Qty" value={l.qty} onChange={(v) => setLine(i, { qty: v })} />
                <Num
                  key={`rate-${l.itemId ?? "free"}`}
                  label="Rate"
                  money
                  value={l.rate}
                  onChange={(v) => setLine(i, { rate: v })}
                />
                <Num
                  key={`tax-${l.itemId ?? "free"}`}
                  label="GST %"
                  value={l.taxPct}
                  onChange={(v) => setLine(i, { taxPct: v })}
                />
              </div>
              <p className="mt-1.5 text-right text-[11.5px] text-ink-3 tnum">
                {formatINR(lineSubtotal(l))}
              </p>
            </div>
          ))}

          <button
            onClick={() => setLines((ls) => [...ls, blankLine()])}
            className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
          >
            <Plus size={13} /> Add a line
          </button>
        </div>

        {/* Totals, then the three exits (E8). Park needs less than advance,
            deliberately: a name alone is enough to come back to, whereas
            issuing the document needs a line with money on it. */}
        <SheetFooter
          retreat={{ label: spec.plural, onClick: onCancel }}
          park={
            parked
              ? undefined
              : {
                  label: "Save as draft",
                  disabled: !nameable,
                  onClick: () => onSave({ ...doc, status: "draft" }),
                }
          }
          advance={{
            label: `${parked ? "Issue" : "Save"} ${spec.label.toLowerCase()}`,
            disabled: !valid,
            onClick: () => onSave({ ...doc, status: draft.status === "draft" ? "open" : doc.status }),
          }}
          hint={
            !valid
              ? "Needs a name and at least one line with an amount."
              : parked
                ? "Issuing it puts it in your books. Until then it counts towards nothing."
                : undefined
          }
        >
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-ink-3">Tax</span>
            <span className="text-ink tnum">{formatINR(t.tax)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[13.5px] font-medium">
            <span className="text-ink">Total</span>
            <span className="text-ink tnum">{formatINR(t.total)}</span>
          </div>
        </SheetFooter>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}

// A quantity is not money — 2.5 kg is a real quantity and "2.5L" is not — so
// only the rate goes through the rupee parser. Both used to share one
// `[^\d.]` strip, which turned "1.2.3" into NaN and then, via `|| 0`, into a
// silent zero on an invoice line.
const QUANTITY = /^\d+(?:\.\d+)?$/;

function Num({
  label,
  value,
  onChange,
  money,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Read it as rupees: accepts ₹, grouping, and L/Cr. */
  money?: boolean;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const text = raw ?? String(value);

  function read(next: string): number | null {
    const t = next.trim();
    if (!t) return null;
    if (money) return parseAmount(t)?.value ?? null;
    return QUANTITY.test(t) ? Number(t) : null;
  }

  const unreadable = text.trim().length > 0 && read(text) === null;

  return (
    <label className="block">
      <span className="mb-0.5 block text-[10.5px] text-ink-3">{label}</span>
      <input
        inputMode="decimal"
        value={text}
        aria-invalid={unreadable}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(read(e.target.value) ?? 0);
        }}
        className={cn(
          "w-full rounded-md bg-surface px-2 py-1.5 text-[12.5px] shadow-(--shadow-ctl) outline-none tnum",
          unreadable ? "text-neg" : "text-ink",
        )}
      />
    </label>
  );
}
