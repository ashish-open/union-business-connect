# White-labelling Business Connect for Union Bank of India and SBI

**Date:** 18 August 2026
**Base:** `pnb-business-connect-v2` (Next.js 16, React 19, Tailwind v4, Zustand)
**Targets:** `union-business-connect`, `sbi-business-connect`

---

## 1. How the branding below was obtained

Colour values are **not** taken from memory or from brand-guideline PDFs. Each bank's
live site was loaded in a real browser and the palette read out of the running
document — declared CSS custom properties on `:root` first, then computed
`color` / `background-color` / `border-color` over every element in the DOM,
ranked by frequency. That is the palette the bank actually ships, not the one
its style guide claims.

| Bank | Source read | What it gave |
|---|---|---|
| Union Bank of India | `unionbankofindia.bank.in/en/home` | A **complete declared token set** — 37 CSS variables on `:root`. Highest-fidelity source of the three. |
| SBI (corporate) | `sbi.bank.in` (`sbi.co.in` redirects here) | The **current** SBI identity: deep indigo, cyan, yellow. Three brand tokens declared; the rest read from computed styles. |
| SBI (net banking) | `onlinesbi.sbi.bank.in` | A legacy Bootstrap portal on teal `#065C79`. **Documented but not used** — see §3.1. |

Every colour proposed in §3 and §4 has been run through the same WCAG maths the
repo's own `scripts/contrast-probe.ts` uses, against the surfaces it will
actually land on, in both light and dark. Measured ratios are printed inline.
Nothing below ships under 4.5:1.

---

## 2. What the v2 codebase already gets right — and what it doesn't

The good news is that v2 was built with a second tenant in mind. There is a
`src/config/brand.ts` whose header comment says so explicitly, and the entire
palette is CSS custom properties in one file. The bad news is that the intent
was only about 80% enforced.

### 2.1 Already tenant-safe (change one value, done)

| Surface | File | Mechanism |
|---|---|---|
| Bank name, short name, product name, support line | `src/config/brand.ts` | 4 string constants |
| Full colour system, light + dark + `prefers-color-scheme` | `src/app/globals.css` | ~60 CSS custom properties, three blocks |
| Primary button, Ask bubble, nav pill | `src/components/ui/Button.tsx`, `AppShell.tsx`, `AskAnywhere.tsx` | All read `var(--brand-grad-a/b)` — no hardcoded hex |
| Brand lockup | `src/components/app/BrandMark.tsx` | Reads `brand.*`, mark is one CSS class |
| Theme switching | `src/lib/theme.ts` | Bank-agnostic |

### 2.2 Leaks — bank-specific values hardcoded outside `brand.ts`

These are the real work. Found by grepping `pnb|punjab` across `src/`,
`scripts/`, and config (excluding `node_modules` and `.next`):

| # | Location | Leak | Severity |
|---|---|---|---|
| L1 | `src/app/globals.css:284-304` | `.pnb-mark` — the logo is a **CSS-cropped sprite** off `/pnb-logo.png` with four magic numbers (`6.0166`, `-0.51524`, `-0.39612`). Class name is bank-specific too. | **High** — needs redesign, see §5.1 |
| L2 | `public/pnb-logo.png` | The master lockup raster | High |
| L3 | `src/lib/balance.ts:50-55` | `BANK_CODE` IFSC map — `[/punjab|pnb/i, "PUNB"]` | Medium |
| L4 | `src/data/seed.ts` (9 sites: 805, 839, 863-4, 887, 928, 1067, 165-171, 540, 765) | Demo accounts literally say `"Punjab National Bank"` | Medium — it's the whole demo |
| L5 | `src/data/bankSeed.ts:27,51` | Funnel stage `"Settlements land at PNB"`, signal copy | Medium |
| L6 | `src/app/statement/page.tsx` (7 sites: 399, 465, 991, 1076, 1135, 1319) | User-visible copy: *"Your PNB QR takings carry no fee"*, *"Point this payout at your PNB account"*, *"Landed in PNB ••7734"* | **High** — reads as another bank's product |
| L7 | `src/app/today/page.tsx:315`, `src/app/bank/page.tsx:107` | `"Settlements now landing at PNB"`, comment copy | High |
| L8 | `src/lib/ask.ts:69` | Ask-answer detail string mentions PNB | High |
| L9 | `src/app/collections/page.tsx:281` | Payment link domain `pnb.bc/pay/...` | Medium |
| L10 | `src/app/collections/page.tsx:43,196-197`, `payouts/page.tsx:63`, `AppShell.tsx:210,245,466` | Local variable named `pnb` / `pnbAccount` | Low — cosmetic, but rename for hygiene |
| L11 | `scripts/agree-probe.ts:209`, `scripts/copy-probe.ts:187` | Probe fixtures pinned to PNB | Low |
| L12 | `package.json:2` | `"name": "v2"` | Low |
| L13 | `src/app/layout.tsx:12-15` | `metadata.title` is `"Business Connect"` — no bank, no favicon per tenant | Medium |
| L14 | `src/app/favicon.ico` | PNB favicon | Medium |
| L15 | `README.md` | Still the stock `create-next-app` README | Low |

### 2.3 Two leak classes the name grep could not see

The table above came from grepping `pnb|punjab`. That finds every leak that
*says* PNB. It cannot find a leak that only *looks* like PNB — a hex literal.
Grepping the brand's colour (`8e1230`, `9b1240`) instead turned up two more,
one of them the single loudest surface in the product:

| # | Location | Leak | Severity |
|---|---|---|---|
| L16 | `src/app/signin/page.tsx:124-128` | The sign-in aurora — `#3e081a` base with `#a91d55`, `#690f36`, `#c99a3f` glows, hardcoded in the component. This is the first thing anyone sees and it is 100% PNB maroon. | **Critical** |
| L17 | `close/report`, `dispute/[id]`, `project/qpr` | 8 sites hardcoding `#8e1230` — the PNB maroon — as the rule and heading colour of the three printable documents. | **High** |

Both are now tokens. The aurora became `--hero-base` / `--hero-glow-1` /
`--hero-glow-2` / `--hero-accent`, declared next to `--brand-mark` and fixed in
both themes for the same reason it is: a lit brand surface is white-on-dark
either way. The documents route through the existing `brand-mark` utility.

**What correctly stayed hardcoded.** Those three documents also fix their own
paper palette — `#f2f2ee` stock, `#1c1d22` ink, `#5d5f67` / `#8f919a` greys,
`#e9e9e2` rules — and that is not a leak. They are print artefacts; they must
not follow dark mode, and none of those greys is a bank colour. Only the
maroon was wrong. The `Avatar` palette is likewise deliberate and neutral.

**The lesson for tenant three:** grep the outgoing tenant's hex, not just its
name.

**Recommended fix pattern:** extend `brand.ts` rather than sprinkling more
strings. Add `bankNameShortInCopy`, `ifscPrefix`, `payLinkDomain`, and a
`markSrc`, then route L3, L6-L9, L13 through it. That turns a third tenant into
a genuine config change, which is what the file's header comment already
promises.

---

## 3. Union Bank of India

### 3.1 Identity read from the live site

UBI ships a fully declared design-token set. Verbatim, the ones that matter:

```
--bg-blue:              #00569b   ← primary navy (also --cards-bg-darkblue)
--bg-lightblue:         #0078C0
--navigation-bg:        #006bb7
--color-blue:           #006C95   (also --blue_for_home_page)
--bg-red:               #e31e24   ← primary red (also --cards-bg-red)
--color-red1:           #91203e
--color-red2:           #BD3D41
--bg-footer-red:        #ce1d4e
--darkred-color-contrast: #A30005
--bg-blue1:             #e2edff   ← pale blue fill
--bg-blue2:             #d7e7f5
--dropdowm-bg:          #ddebf8
--input-bg:             #EAEFFB
--page-blue-bg:         rgb(235 240 245)
--color-black:          #222222
--color-black1:         #444444
--color-black2:         #555555
--color-lightgray:      #d3d3d3
--red-gradiant-color:   linear-gradient(125deg, #00569b 20%, red)
--blue-gradient:        linear-gradient(to bottom, #b2e1ff 0%, #66b6fc 100%)
```

**Typography:** Poppins (headings/UI), Noto Sans (body/Devanagari).
**Logo:** `https://www.unionbankofindia.bank.in/img/header/ubi_logo.png` — red
device + blue wordmark, horizontal lockup.
**Support:** 1800 2333 (also 1800 8333 / 1800 8331 / 1800 8332, 1800 208 2244).
**Reading of the identity:** navy is the *institution*, red is the *emphasis*.
Red never carries large areas on their own site; it's used for CTAs, the footer
band, and accents. Our mapping honours that.

### 3.2 Token mapping — `src/app/globals.css`

**Light (`:root`)** — replace only these lines; everything else stays:

| Token | PNB (now) | **UBI (new)** | Measured |
|---|---|---|---|
| `--accent` | `#9b1240` | `#00569b` | **7.49** on `--surface`, 6.99 on `--bg`, 6.74 on `--surface-2` |
| `--accent-strong` | `#7e0e33` | `#003f73` | 10.72 on white |
| `--accent-soft` | `#fbedf2` | `#e8f0f9` | `--ink` on it: 13.70 |
| `--brand-mark` | `#8e1230` | `#00569b` | — |
| `--brand-grad-a` | `#b01d4f` | `#0078c0` | UBI's own light blue |
| `--brand-grad-b` | `#8e1230` | `#00569b` | UBI's own navy |
| `--ring` | `rgb(155 18 64 / .16)` | `rgb(0 86 155 / 0.16)` | — |
| `--ask-rim` | `rgb(155 18 64 / .30)` | `rgb(0 86 155 / 0.30)` | — |
| `--shadow-ask` | …`rgb(155 18 64 / .45)` | `0 0 0 1px var(--accent), 0 0 22px -4px rgb(0 86 155 / 0.45)` | — |
| `--info` | `#2e6cca` | `#5145b8` | 7.26 on white, 6.23 on `--info-soft` |
| `--info-soft` | `#ecf2fc` | `#eeecfa` | — |
| `--gold` / `--gold-soft` | `#ac8228` / `#f8f0dc` | **unchanged** | see note |

**Dark (`[data-theme="dark"]` *and* the `prefers-color-scheme` block — both, they
are duplicated in the file at lines ~105 and ~154):**

| Token | **UBI dark** | Measured on `--surface` `#16181d` |
|---|---|---|
| `--accent` | `#6fb6e8` | **8.06** |
| `--accent-strong` | `#8ec7ee` | 9.77 |
| `--accent-soft` | `#0f2438` | accent on it: 7.17 |
| `--ring` | `rgb(111 182 232 / 0.24)` | — |
| `--ask-rim` | `rgb(111 182 232 / 0.34)` | — |
| `--shadow-ask` | …`rgb(111 182 232 / 0.45)` | — |
| `--info` | `#9d92ee` | 6.58 |
| `--info-soft` | `#1b1a33` | info on it: 6.26 |

#### Three decisions worth stating

**Why `--info` moves.** PNB's accent is maroon, so a blue `--info` (`#2e6cca`)
was unambiguous. With a navy accent, a blue informational badge and the active
nav item become the same colour and the badge stops meaning anything. Moving
`--info` to violet keeps the semantic layer readable against a blue brand. This
is the one change that is *caused by* the rebrand rather than part of it.

**Why the red is not `--accent`.** UBI's own site uses red for punctuation, not
for structure — navy carries the chrome. Making red the accent would also put
it one hue away from `--neg` (`#c03434`), and in a product whose entire job is
flagging short settlements, "brand" and "something is wrong" must not look
alike. Red is available if the bank insists; it would then need `--neg` retuned
to a distinctly darker crimson, and that is a bigger change than it sounds.

**Why `--gold` stays amber.** `--gold` is not a brand slot. It carries
*"First in market"*, *"What I noticed"*, and the NudgeCard rail — an
opportunity tone. UBI's palette is navy + red only, and red in that slot would
read as an error. Amber is semantic here, not PNB residue. Leave it.

**One more to watch:** `--chart-1` is `#2a78d6`, a blue that now sits close to
the accent. Charts are decorative, not semantic, but consider rotating the
series so `--chart-1` (the first, most-used series) isn't brand-adjacent.

### 3.3 Config — `src/config/brand.ts`

```ts
export const brand = {
  productName: "Business Connect",
  bankName: "Union Bank of India",
  bankShort: "Union Bank",   // NOT "UBI" — see note
  supportLine: "1800 2333",
} as const;
```

**On `bankShort`.** This string appears in running copy (*"Your ___ QR takings
carry no fee"*). "UBI" is an internal abbreviation; the bank's customer-facing
short form is "Union Bank". Use that. Reserve "UBI" for the repo name and
internal identifiers only.

### 3.4 Other UBI-specific values

| What | Value |
|---|---|
| IFSC prefix (`src/lib/balance.ts`) | `UBIN` — replace `[/punjab\|pnb/i, "PUNB"]` with `[/union bank\|ubi/i, "UBIN"]` |
| Pay-link domain (`collections/page.tsx:281`) | `unionbank.bc/pay/...` |
| Seed accounts (`seed.ts`, 9 sites) | `"Union Bank of India"` |
| Font | Currently Inter. **Keep Inter** for the product UI; Poppins is UBI's marketing face and is weaker at 11px table density. Flag as a bank decision, not a silent choice. |
| Favicon / `metadata.title` | `"Business Connect · Union Bank of India"` |

---

## 4. State Bank of India

### 4.1 Which SBI identity to build against — this needs a decision

SBI presents **two visually unrelated systems**, and picking wrong means
rebuilding:

| | `sbi.bank.in` (corporate) | `onlinesbi.sbi.bank.in` (net banking) |
|---|---|---|
| Primary | Deep indigo `#280071` | Teal `#065C79` |
| Secondary | Cyan `#12A8E0` | Cyan `#00B5EF` |
| Accent | Yellow `#FFD100` | — |
| Type | Open Sans / Noto Sans | Arial |
| Framework | Liferay, modern | Legacy Bootstrap 4 |
| Read | **Current SBI brand** | Unmaintained portal skin |

**Recommendation: build against the corporate identity (`#280071`).** It is the
current SBI system, it is what YONO and all recent SBI work use, and the
onlinesbi teal is a decade-old portal that SBI is migrating away from. If the
client's stakeholder is the net-banking team rather than brand, raise it early —
this is the single highest-cost thing to get wrong.

Declared tokens read from `sbi.bank.in`:

```
--color-dark-blue-1: #280071   ← SBI indigo/purple, 507 computed occurrences
--color-black3:      #161519
--color-black4:      #212121
```

Dominant computed values (the tokens SBI didn't declare):

```
#272833   ink              (2869 occurrences)
#12A8E0   SBI cyan          (950)  — also #1CACE1
#280071   SBI indigo        (507)  — also #280977
#FFD100   SBI yellow        (244)
#F3F7FA   pale page wash    (107)
```

**Typography:** Open Sans (UI), Noto Sans (body/Indic).
**Logo:** `https://sbi.bank.in/o/SBI-Theme/images/custom/logo.png` — the keyhole
device plus wordmark. The keyhole is geometrically simple (a filled circle, a
notch at 12 o'clock, a small circle above) and reproduces cleanly as inline SVG
at 26-40px, which is what we need. See §5.1.
**Support:** 1800 1234 (also 1800 2100, 1800 11 2211, 1800 425 3800).

### 4.2 Token mapping — `src/app/globals.css`

**Light (`:root`):**

| Token | PNB (now) | **SBI (new)** | Measured |
|---|---|---|---|
| `--accent` | `#9b1240` | `#280071` | **15.81** on `--surface`, 14.22 on `--surface-2` |
| `--accent-strong` | `#7e0e33` | `#1e0057` | 17.61 |
| `--accent-soft` | `#fbedf2` | `#efeaf8` | `--ink` on it: 13.34 |
| `--brand-mark` | `#8e1230` | `#280071` | — |
| `--brand-grad-a` | `#b01d4f` | `#3a108f` | tonal lift of the indigo |
| `--brand-grad-b` | `#8e1230` | `#280071` | — |
| `--ring` | `rgb(155 18 64 / .16)` | `rgb(40 0 113 / 0.16)` | — |
| `--ask-rim` | `rgb(155 18 64 / .30)` | `rgb(40 0 113 / 0.30)` | — |
| `--shadow-ask` | …`rgb(155 18 64 / .45)` | `0 0 0 1px var(--accent), 0 0 22px -4px rgb(40 0 113 / 0.45)` | — |
| `--gold` | `#ac8228` | `#8a6a00` | 5.07 on white, 4.68 on `--gold-soft` — **this is SBI yellow `#FFD100` darkened to AA** |
| `--gold-soft` | `#f8f0dc` | `#fff6d4` | — |
| `--info` | `#2e6cca` | `#0b6f96` | 5.63 on white, 5.01 on `--info-soft` — **SBI cyan darkened to AA** |
| `--info-soft` | `#ecf2fc` | `#e6f4fa` | — |

**Dark (both blocks):**

| Token | **SBI dark** | Measured on `#16181d` |
|---|---|---|
| `--accent` | `#a78bf5` | **6.47** |
| `--accent-strong` | `#c7b4fb` | 9.60 |
| `--accent-soft` | `#241443` | accent-strong on it: 9.04 |
| `--ring` | `rgb(167 139 245 / 0.24)` | — |
| `--ask-rim` | `rgb(167 139 245 / 0.34)` | — |
| `--shadow-ask` | …`rgb(167 139 245 / 0.45)` | — |
| `--gold` | `#e0bb4a` | on `--gold-soft` `#2c2610`: 8.17 |
| `--gold-soft` | `#2c2610` | — |
| `--info` | `#4fc3f0` | 8.79 |
| `--info-soft` | `#102a38` | info on it: 7.37 |

#### Decisions worth stating

**SBI is the cleanest of the three fits.** The indigo/cyan/yellow triad maps
one-to-one onto `--accent` / `--info` / `--gold` with no semantic collisions:
indigo is nowhere near `--neg`, cyan is unmistakably informational, and yellow
in the opportunity slot is *more* on-brand than PNB's amber ever was. Both
`--gold` and `--info` become genuinely SBI colours rather than carried-over
neutrals.

**Raw brand colours would fail AA.** `#12A8E0` on white is **2.73:1** and
`#FFD100` is worse. They are correct as *fills* — a cyan chip with dark text, a
yellow rule — but as text-on-white they are unreadable. The values above are
the same hues taken down in lightness until they clear 4.5:1. If SBI's brand
team objects, the counter-offer is to use raw `#12A8E0` for non-text fills only
and keep the darkened value for anything with a glyph on it.

**The gradient is tonal, not indigo→cyan.** An indigo-to-cyan primary button
would be very SBI and very loud — this product's primary button appears on
every screen. `#3a108f → #280071` reads as SBI without shouting. The
indigo→cyan version is worth mocking for the pitch; it is a one-line change.

### 4.3 Config — `src/config/brand.ts`

```ts
export const brand = {
  productName: "Business Connect",
  bankName: "State Bank of India",
  bankShort: "SBI",
  supportLine: "1800 1234",
} as const;
```

`bankShort: "SBI"` is correct here — unlike UBI, "SBI" *is* the customer-facing
short form and reads naturally in running copy.

**Product name — decided.** SBI's business digital brand is **YONO Business**,
and `productName` is now `"YONO Business"`, not `"Business Connect"`. A second
product name beside YONO would be a bank asking its customers to learn two.
This flows everywhere the name appears without further edits — the lockup, the
tab title, the consent line ("you're allowing YONO Business to:"), and the
footer of all three printable documents — because it was always one constant.

### 4.4 Other SBI-specific values

| What | Value |
|---|---|
| IFSC prefix | `SBIN` — already present in `balance.ts:53`; move it to first position and drop the PNB row |
| Pay-link domain | `sbi.bc/pay/...` |
| Seed accounts | `"State Bank of India"` |
| Font | Keep Inter for UI. SBI's Open Sans is close enough in feel that no one will object; note it. |
| Favicon / `metadata.title` | `"Business Connect · SBI"` |

---

## 5. Shared modifications

### 5.1 The logo mechanism must be replaced, not re-cropped

`.pnb-mark` crops the device out of a master PNG using a background-size and
two background-position offsets, all expressed as multiples of `--mark`. It
works, and its own comment admits it is fragile ("a second tenant swaps the
file and retunes the four numbers").

For two tenants, retuning magic numbers twice is the wrong trade. Replace it:

1. Ship **inline SVG marks** — `src/components/app/marks/UnionMark.tsx`,
   `SbiMark.tsx`. SVG scales to `sm`/`md`/`lg` without a sprite, follows
   `currentColor` where the mark permits, and stays crisp at 26px where a
   cropped raster goes soft.
2. Rename `.pnb-mark` → `.brand-mark`, keep `--on-dark` white-chip rule (that
   part is genuinely bank-agnostic — every bank's mark needs a white chip on
   its own colour).
3. `BrandMark.tsx` picks the mark component; the wordmark stays live text, as
   today, for the reasons its comment gives.

SBI's keyhole is trivially drawable. UBI's device is more involved — **request
the official SVG from the bank** rather than tracing the 40px PNG off their
header. Until then, use the PNG as placeholder and mark it as such.

### 5.2 File-by-file checklist (both repos)

| Step | File | Action |
|---|---|---|
| 1 | `src/config/brand.ts` | Replace 4 constants; **extend** with `ifscPrefix`, `payLinkDomain`, `markSrc` |
| 2 | `src/app/globals.css` | Swap accent/brand/ring/ask/info/gold tokens in **all three** blocks (`:root`, `[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`) |
| 3 | `src/app/globals.css:268-304` | Replace `.pnb-mark` with `.brand-mark` per §5.1 |
| 4 | `src/components/app/BrandMark.tsx` | Point at new mark component |
| 5 | `public/` | Remove `pnb-logo.png`; add tenant mark |
| 6 | `src/app/favicon.ico` | Replace |
| 7 | `src/app/layout.tsx:12-15` | Title from `brand`, add bank name |
| 8 | `src/lib/balance.ts:50` | IFSC row |
| 9 | `src/data/seed.ts` (9 sites), `bankSeed.ts` (2) | Bank name in demo data |
| 10 | `statement/page.tsx` (7), `today/page.tsx:315`, `bank/page.tsx:107`, `ask.ts:69`, `collections/page.tsx:281` | User-visible copy → `brand.bankShort` |
| 11 | `collections/`, `payouts/`, `AppShell.tsx` | Rename `pnb`/`pnbAccount` locals → `primaryAccount` |
| 12 | `scripts/agree-probe.ts:209`, `copy-probe.ts:187` | Fixtures |
| 13 | `package.json:2` | `"name"` |
| 14 | `README.md` | Replace stock CNA text |
| 15 | — | `npm run check` — tsc, eslint, and all six probes including `probe:contrast` |

### 5.3 The contrast probe is the acceptance gate

`scripts/contrast-probe.ts` checks 11 declared pairs across both themes and
exits non-zero below 4.5:1. Two of them — `accent/surface` and `info/info-soft`
— sit directly on tokens this rebrand touches. Every value in §3 and §4 was
computed against that same routine before being written down, so both tenants
should pass on the first run. **If a bank overrides a colour later, that probe
is the argument** — it turns "we'd prefer the brighter cyan" into a number.

### 5.4 What does *not* change

Layout, density, spacing, information architecture, the voice agent, the books
engine, the reconciliation logic, the seed journeys, the probe suite. This is a
skin and a copy pass over an unchanged product. Anything else is scope.

---

## 6. Repository and deployment plan

| | Union Bank | SBI |
|---|---|---|
| Repo | `union-business-connect` | `sbi-business-connect` |
| `package.json` name | `union-business-connect` | `sbi-business-connect` |
| Vercel region | `bom1` (unchanged — both banks are India-domiciled) | `bom1` |
| Env | Copy `.env.example`; **voice keys are per-tenant** and must not be shared | same |

Both start as a **squashed copy** of `pnb-business-connect-v2` at its current
HEAD (`4b7641c`), not a fork — the PNB history has no value to either bank and
carries PNB-specific commit messages into a client repo.

---

## 7. Open items — need a decision or an asset

| # | Item | Owner |
|---|---|---|
| O1 | **SBI: corporate indigo or onlinesbi teal?** (§4.1) Highest-cost item. | Client |
| ~~O2~~ | ~~SBI product name~~ — **decided: YONO Business** (§4.3) | ✅ |
| O3 | UBI official logo as SVG (§5.1) | Bank |
| O4 | SBI official logo as SVG | Bank |
| O5 | Keep Inter, or adopt Poppins (UBI) / Open Sans (SBI)? Recommend Inter. | Design + client |
| O6 | UBI: is red acceptable as punctuation only, or does the bank want it as the primary accent? (§3.2) | Client |
| O7 | Confirm support numbers for the business segment — both banks publish several | Bank |
| O8 | Confirm demo entity names (Nadi Foods etc.) carry over, or need per-bank fiction | Internal |

---

## 8. Delivered

Both repos are rebranded, and both pass `npm run check` — `tsc --noEmit`,
ESLint, and all six probes — with zero PNB references remaining in `src/`.

| | `union-business-connect` | `sbi-business-connect` |
|---|---|---|
| Port (local) | 3003 | 3004 |
| `--accent` light | `#00569b` — **7.49:1** | `#280071` — **15.81:1** |
| `--accent` dark | `#6fb6e8` — **8.06:1** | `#a78bf5` — **6.47:1** |
| `--info` | violet `#5145b8` (moved off blue) | SBI cyan `#0b6f96` |
| `--gold` | amber, unchanged (semantic) | SBI yellow `#8a6a00` |
| Aurora | navy with a red glow | indigo with a yellow glow |
| Product name | Business Connect | **YONO Business** |
| Mark | `UnionMark.tsx` | `SbiMark.tsx` |
| IFSC | `UBIN` | `SBIN` |
| Pay link | `unionbank.bc` | `sbi.bc` |

### 8.1 The marks are traced, not approximated

Both devices were measured off the banks' own lockups rather than drawn by
eye. Each master was loaded into a canvas and scanned a row at a time, the
colour regions reduced to spans, and the geometry read off the result:

- **Union Bank** — a red `#ed1c24` "U" and a blue `#006cb7` "n", the "Un" of
  Union. Both are constant-width round-capped strokes, so the trace is their
  centrelines stroked at the measured width. Overlaid on the original at 10×,
  the two register to within the raster's own antialiasing. Note the mark's
  blue is **not** the site's navy `#00569b` — they are different blues, and
  using the CSS token would have been subtly wrong.
- **SBI** — the keyhole. The disc is a true circle 42 units across; the bore
  is radius 6 **concentric with it**, not offset upward as it is usually
  redrawn; the slot is a constant 4 wide running out through the bottom edge.
  The keyhole is masked rather than filled white, because in the original it
  is transparent and takes the colour behind it.

Both are still traces. §7 O3/O4 stand: ask each bank for the official vector.

### 8.2 Verified, not assumed

- `probe:contrast` passes on both, both themes — the numbers in §3 and §4 are
  the probe's own output, not a spreadsheet.
- Both apps were run and driven: sign-in, OTP, entity selection, consent,
  Today, Statement, the bank console, and the design-system page, in light and
  dark. That is how L16 was caught — the palette was already correct and the
  sign-in page was still maroon.

### 8.3 Known cosmetic notes

- `--gold` and `--warn` sit close in hue in both tenants. They did in PNB too
  (`#ac8228` vs `#935207`); this is inherited, not introduced. If it matters,
  `--gold` is the token to move.
- `--chart-1` (`#2a78d6`) is brand-adjacent for Union Bank. Charts are
  decorative, not semantic, so it is left alone — noted in §3.2.
- SBI's primary button is a deep indigo on a dark page in dark mode, so it
  recedes more than PNB's maroon did. `--brand-grad-*` is fixed in both themes
  by design; lifting it for dark is a one-line change if the client asks.

---

## 9. Second pass — light by default, and a hero that follows it

Three changes after the first review.

### 9.1 The product ships light

`lib/theme.ts` used to default to `"system"`, which is why the same account
looked dark on one machine and light on another. It now defaults to **light**.
A bank's product has a house appearance, the screens are dense tables of
money, and the demo is given on whatever laptop is in the room — "it looked
different in the meeting" should not be something that can happen.

System is still on the menu. It is a choice now, not the silent default.

One consequence worth naming, because it is the kind of thing that breaks
quietly: since absence-of-key now means light, `"system"` has to be **stored**
rather than expressed by clearing the key. `setTheme` writes all three values,
and the inline `themeScript` — which runs before first paint so there is no
flash — reads them back the same way. Its `catch` falls through to light too:
in a browser with storage blocked, the default still has to be the default.

Verified with the OS set to dark: no stored preference gives
`data-theme="light"`, `colorScheme: light`, page background `#f6f7f9`.

### 9.2 The sign-in hero follows the theme

The hero was a deep aurora pinned in both themes with **white text hardcoded
over it**. That was defensible while dark was what everyone saw. The moment
light became the default it was a dark slab bolted to a white page.

It is now theme-aware: a pale wash of the same brand colours in light, the
deep aurora in dark, and the copy moved from `text-white` / `text-white/65` /
`text-white/50` to the `--ink` tokens — so it is legible either way and nobody
has to keep two sets of text colours in step.

Two details that make it hold together:

- **Alpha moved into the tokens.** The glow opacities used to be
  `opacity-50` / `opacity-70` / `opacity-[0.13]` classes on the elements. Those
  are tuned for a dark base; a wash needs about a fifth of the strength. Since
  the difference has to change with the theme and a Tailwind class cannot, the
  alpha is now baked into `--hero-glow-*` and the classes are gone.
- **The mark's white chip is now conditional on the theme, not on a prop.**
  `BrandMark`'s `onDark` became `onHero`, and it no longer controls text
  colour at all — only whether the device gets a chip, which CSS decides. On
  the pale wash the device needs no help; on the dark aurora a mark in the
  bank's own colour would sink into it.

SBI's yellow glow shipped at `0.30` and read as a muddy tan where it crossed
the lavender. It is at `0.16`.

### 9.3 Still true

`npm run check` passes on both — tsc, ESLint, six probes. Both sign-in pages
were driven in light and dark, and the full SBI journey (phone → OTP → entity
→ consent → Today) was run to confirm "YONO Business" reads correctly in
running copy, not just in the lockup.

---

## 10. Third pass — YONO Business branding, and upstream sync

### 10.1 YONO Business has its own identity, and it is not SBI corporate

Reading `yonobusiness.sbi.bank.in` the same way as the others turned up
something the corporate site did not show: **YONO Business is a gradient
brand.** Its signature surface — the Login button — is, verbatim from the
computed style:

```
linear-gradient(64.89deg, rgb(198, 32, 82) 9.33%, rgb(40, 0, 113) 83.6%)
```

Crimson `#C62052` → indigo `#280071`, on a 65° diagonal. It appears 20+ times
across the page. The rest:

| Role | Value |
|---|---|
| Gradient start | `#C62052` crimson/magenta |
| Gradient end | `#280071` indigo |
| UI violet (chrome, icons, rules) | `#514FA1` |
| Pale wash | `#F1F3FF`, `#EAEBF5` |
| Blue accent | `#007AD9` |
| Ink | `#242424` |
| Type | Roboto |

**The useful discovery: `#280071` is the same indigo already shipping as
`--accent`.** The corporate read and the YONO read agree on the anchor colour.
So the accent, `--brand-mark`, ring and focus states did not move — what was
missing was the magenta and the diagonal.

Changed:

| Token | Was | Now |
|---|---|---|
| `--brand-grad-a` | `#3a108f` (a tonal lift I invented) | **`#c62052`** — YONO's own |
| `--brand-grad-b` | `#280071` | unchanged — YONO's own |
| `--brand-grad-angle` | *(did not exist — 180° hardcoded)* | **`65deg`** |
| `--accent-soft` | `#efeaf8` | `#f1f3ff` — YONO's own pale wash |
| dark `--accent` | `#a78bf5` | `#a5a2e8` — derived from YONO's `#514FA1` |
| dark `--accent-strong` | `#c7b4fb` | `#b3b0f0` |
| Hero glows | indigo / yellow | magenta + indigo + YONO violet |

White on `#c62052` — the lightest end of the button, and therefore the worst
case for the label — is **5.63:1**. It clears AA.

**The gradient angle is now a token in both repos.** It was `180deg` hardcoded
in three components. Union Bank's gradient genuinely runs top-to-bottom and
YONO's genuinely runs at 65°, so the angle is tenant data like the colours
are. `--brand-grad-angle` is `180deg` for Union — its rendering is byte-for-byte
unchanged, verified in the browser — and `65deg` for SBI.

**Not changed, deliberately.** `--gold` stays amber: YONO's palette is
magenta / indigo / violet / cyan, and there is no yellow in it to be faithful
to. `--info` stays the darkened cyan — still clearly distinct from a deep
indigo accent. The mark stays the SBI keyhole, which is what the real YONO
Business lockup pairs its wordmark with. The custom magenta "y" of that
wordmark is not reproduced; **request the official YONO lockup as a vector**
(this now supersedes O4).

### 10.2 Upstream had moved — four commits, now in both tenants

`pnb-business-connect-v2` had advanced from the fork point `4b7641c` to
`a308589` while this work was happening:

| Commit | What |
|---|---|
| `4e7fa9d` | Share the draft store across instances (adds `lib/voice/kv.ts`, KV env vars) |
| `91cf378` | Understand amounts the way a caller says them |
| `fbddbe2` | Today: queue first, verification code off the home screen |
| `a308589` | Trim whitespace from incoming field names |

All four are now in both tenant repos, cherry-picked with **Ajmal's authorship
preserved**, not copy-pasted. Zero conflicts — `today/page.tsx` auto-merged
around the one rebranded comment. Both repos pass `npm run check` after.

The mechanism: each tenant repo now has an `upstream` remote pointing at
`Ajmal-open/pnb-business-connect-v2`. Even though the tenants were squashed
and share no merge base, `git fetch upstream` makes the objects reachable, so
`git cherry-pick` works normally.

```bash
git fetch upstream
git log --oneline <last-synced-sha>..upstream/main   # what is new
git cherry-pick <sha>...                             # take it
```

### 10.3 How much actually differs — measured

The three codebases are far closer than three repos implies. Union vs SBI,
counted rather than estimated:

- **150 source files. 10 differ. Two more exist in only one repo** (the mark
  components).
- Of ~167 differing lines, **102 are the palette block in `globals.css`** and
  **26 are `brand.ts`**.
- `statement/page.tsx`, `today/page.tsx` and `AppShell.tsx` differ by **8
  lines, all of them comments** — zero functional difference.
- `seed.ts` / `bankSeed.ts` differ only by the bank's name in demo data.
- `balance.ts` differs by **one line**.

So the real tenant surface is four things: **a palette block, a config object,
a mark component, and the bank name in the seed data.** That is a tenant
config. It is not a fork, and it should not be maintained as three forks —
see the recommendation in §11.

---

## 11. Recommendation: stop maintaining three forks

Three repos was the right call for the pitch. It is the wrong shape for
"we will be modifying all three until this is finalised".

### 11.1 What three forks costs

The cherry-pick in §10.2 was painless — four commits, zero conflicts. That is
not evidence the model works; it is luck. Those four commits happened to land
almost entirely in `lib/voice/`, which no tenant has touched. The first time
someone edits `globals.css`, `AppShell.tsx`, `BrandMark.tsx` or `seed.ts` —
the ten files that diverge — every sync becomes a manual three-way merge, done
twice, by someone holding the rebrand in their head.

The worse failure is quieter. A fix lands in two repos and is forgotten in the
third; nobody notices until a screen behaves differently for one bank in a
demo. Forks do not tell you they have drifted.

And the cost is per-change, forever, for a difference that is **167 lines**.

### 11.2 What to do instead

One repo, three tenants, selected at build time. The extraction is already
~90% done — that is what §2 and §5 of this document were.

```
src/tenants/
  index.ts                  # picks from NEXT_PUBLIC_TENANT
  pnb/    { brand.ts, palette.css, Mark.tsx }
  union/  { brand.ts, palette.css, Mark.tsx }
  sbi/    { brand.ts, palette.css, Mark.tsx }
```

- **`brand.ts`** — already a single exported object in all three. Becomes
  three objects and a lookup.
- **`palette.css`** — lift the `:root` / `[data-theme="dark"]` /
  `prefers-color-scheme` token blocks out of `globals.css` into one file per
  tenant. `globals.css` keeps everything else and does `@import "./tenant.css"`,
  where `tenant.css` is a Turbopack `resolveAlias` to the active tenant. One
  import, resolved at build, no runtime cost, no selector explosion.
- **`Mark.tsx`** — three tiny SVG components behind one lookup.
- **`seed.ts`** — replace the literal bank names with `brand.bankName`. This
  removes the largest remaining diff and is a strict improvement anyway.
- **The comment-only diffs** — delete them. Eight lines of comments naming a
  specific bank are the reason three files show as "differing" while being
  functionally identical.

Deployment: **three Vercel projects off one repo**, differing by one env var.
Same as today from the outside; one codebase from the inside.

**Where it should live:** fold into `pnb-business-connect-v2` rather than
starting a new repo. It keeps Ajmal's history and his workflow — he carries on
pushing to the same place — and it makes the tenant that already has the most
active development the trunk instead of a fork's upstream.

**Effort:** roughly half a day, most of it mechanical, and it is verifiable —
build all three tenants and diff the rendered output against the current
repos before deleting anything.

### 11.3 Until then

The `upstream` remote is wired in both tenant repos and works. The rule while
three repos exist:

1. **Product changes land in `pnb-business-connect-v2` first.** Always. It is
   the trunk whether or not we have formalised that.
2. Sync with `git fetch upstream && git cherry-pick`, never by copying files —
   cherry-pick keeps authorship and tells you when it conflicts.
3. **Branding changes never go upstream.** They are tenant-local by definition.
4. Record the last synced upstream SHA in each tenant's README so "what is new"
   is one command and not an archaeology exercise.

Last synced: `a308589`.
