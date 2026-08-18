// Tenant config. Nothing bank-specific may be hardcoded in components —
// every bank-facing string and color routes through here so a second bank
// tenant is a config change, not a rewrite.
//
// The one thing that cannot live here is the artwork: the mark is cropped out
// of the master lockup by CSS, which cannot read TypeScript. It is a single
// asset and a single rule — `public/pnb-logo.png` and `.pnb-mark` in
// globals.css — so a second tenant swaps the file and retunes the four
// numbers in that rule.

export const brand = {
  productName: "Business Connect",
  bankName: "Punjab National Bank",
  bankShort: "PNB",
  supportLine: "1800 180 2222",
} as const;
