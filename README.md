# Business Connect — Union Bank of India

Business banking that explains your money back to you. A Next.js 16 / React 19
prototype covering the SME journey: smart statement, reconciliation, books,
collections, payouts, compliance, and a voice agent.

Forked from `pnb-business-connect-v2`. Bank-facing strings and values live in
[`src/config/brand.ts`](src/config/brand.ts); the palette lives in
[`src/app/globals.css`](src/app/globals.css); the device is
[`src/components/app/marks/UnionMark.tsx`](src/components/app/marks/UnionMark.tsx).
See [BRANDING.md](BRANDING.md) for how the palette was derived and what is
still outstanding.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Copy `.env.example` to `.env.local` and fill it in for the voice agent. The
keys are per-tenant — do not reuse another bank's.

## Upstream

The product trunk is
[`Ajmal-open/pnb-business-connect-v2`](https://github.com/Ajmal-open/pnb-business-connect-v2),
wired here as the `upstream` remote. Product changes land there first and come
here by cherry-pick — never by copying files, so authorship survives and a
clash announces itself.

```bash
git fetch upstream
git log --oneline a308589..upstream/main
git cherry-pick <sha>
```

**Last synced: `a308589`.** Update that SHA here when you sync.

Branding changes are tenant-local and never go upstream. See BRANDING.md §11
for why three forks is the wrong long-term shape and what to do about it.

## Checks

```bash
npm run check
```

`tsc --noEmit`, ESLint, and six probes. `probe:contrast` is the one that
matters for a rebrand: it asserts every text token clears WCAG AA against the
surfaces it actually lands on, in both themes, and exits non-zero if not.
