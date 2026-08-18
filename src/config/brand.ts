// Tenant config. Nothing bank-specific may be hardcoded in components —
// every bank-facing string and value routes through here so a second bank
// tenant is a config change, not a rewrite.
//
// The artwork is the one thing that cannot be a string: the device is an
// inline SVG component in `src/components/app/marks/`, picked by `BrandMark`.
// A bank's logo has fixed colours that are not ours to theme, so those hexes
// live in the mark and nowhere else.

export const brand = {
  productName: "Business Connect",
  bankName: "Union Bank of India",
  /**
   * The short form that appears in running copy — "Your ___ QR takings carry
   * no fee". It has to read as a name, not an abbreviation: "UBI" is what the
   * bank calls itself internally, "Union Bank" is what it calls itself to a
   * customer. The repo and the identifiers may say UBI; the product may not.
   */
  bankShort: "Union Bank",
  supportLine: "1800 2333",
  /** First four of the IFSC, for the demo account identifiers. */
  ifscPrefix: "UBIN",
  /** Matches this bank's own accounts in seed data against other banks'. */
  bankPattern: /union bank|ubi/i,
  /** Host on a generated payment link. */
  payLinkDomain: "unionbank.bc",
} as const;
