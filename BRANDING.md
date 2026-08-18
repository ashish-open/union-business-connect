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

**Naming question for the client:** SBI's business digital brand is **YONO
Business**. "SBI Business Connect" may need to become "YONO Business Connect",
or the product may need to sit inside YONO entirely. Worth asking before the
first demo — it changes `productName` and possibly the whole nav framing.

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
| O2 | **SBI: "Business Connect" or "YONO Business Connect"?** (§4.3) | Client |
| O3 | UBI official logo as SVG (§5.1) | Bank |
| O4 | SBI official logo as SVG | Bank |
| O5 | Keep Inter, or adopt Poppins (UBI) / Open Sans (SBI)? Recommend Inter. | Design + client |
| O6 | UBI: is red acceptable as punctuation only, or does the bank want it as the primary accent? (§3.2) | Client |
| O7 | Confirm support numbers for the business segment — both banks publish several | Bank |
| O8 | Confirm demo entity names (Nadi Foods etc.) carry over, or need per-bank fiction | Internal |
