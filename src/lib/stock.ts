// Stock — quantity and value on hand.
//
// Phase B lays the opening position and the valuation that reaches the balance
// sheet. Movements arrive with the documents that cause them (Phase C sells,
// Phase D buys), so `StockMove` already exists and simply has nothing feeding
// it yet — the shape is here so documents do not force a rewrite.
//
// Valuation is at COST, never at selling rate. Valuing stock at what you hope
// to get for it is how a balance sheet starts lying.

import { Entity } from "@/data/seed";
import { Item, itemsFor } from "@/data/items";

export interface StockMove {
  itemId: string;
  date: string;
  qty: number; // positive in, negative out
  /** Document number that caused it — every movement traces to a document. */
  ref: string;
}

export interface StockRow {
  item: Item;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  /** closingQty × cost — what the balance sheet carries. */
  value: number;
  low: boolean;
}

export interface StockView {
  rows: StockRow[];
  /** Total closing value — the Stock in hand figure. */
  value: number;
  lowCount: number;
  /** Services are listed but never valued. */
  goodsCount: number;
}

export function buildStock(entity: Entity, moves: StockMove[] = []): StockView {
  const items = itemsFor(entity.id);
  const rows: StockRow[] = items.map((item) => {
    const mine = moves.filter((m) => m.itemId === item.id);
    const inQty = mine.filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0);
    const outQty = mine.filter((m) => m.qty < 0).reduce((s, m) => s - m.qty, 0);
    const closingQty = item.service ? 0 : item.openingQty + inQty - outQty;
    return {
      item,
      openingQty: item.openingQty,
      inQty,
      outQty,
      closingQty,
      value: item.service ? 0 : closingQty * item.cost,
      low: !item.service && closingQty <= item.reorder,
    };
  });

  return {
    rows,
    value: rows.reduce((s, r) => s + r.value, 0),
    lowCount: rows.filter((r) => r.low).length,
    goodsCount: rows.filter((r) => !r.item.service).length,
  };
}

export function itemById(entity: Entity, id: string): Item | undefined {
  return itemsFor(entity.id).find((i) => i.id === id);
}
