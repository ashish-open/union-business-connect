// Which persona can actually reach a closed month, and what the closed line
// will say when they do. Read before believing the UI.
import { BANK_CUSTOMERS } from "@/data/seed";
import { buildClose } from "@/lib/close";
import { buildBooks } from "@/lib/books";
import { formatINR } from "@/lib/format";

for (const c of BANK_CUSTOMERS) {
  for (const e of c.entities) {
    const books = buildBooks(e, {});
    const cl = buildClose(e, { connected: true, resolutions: {}, resolved: {}, books });
    const open = cl.items.filter((i) => !i.done);
    console.log(
      `${e.name.padEnd(20)} ${cl.items.length - open.length}/${cl.items.length} · ` +
        `${formatINR(cl.moneyIn, { compact: true })} in · ${formatINR(cl.moneyOut, { compact: true })} out · ${cl.rows.length} lines` +
        (open.length ? `\n   open: ${open.map((i) => i.label).join(" | ")}` : "   READY"),
    );
  }
}
