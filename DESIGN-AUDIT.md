# Design audit — Brex sandbox (55 screens) → Business Connect v2

Reference screens live in `Brex/` (gitignored — 31 MB, not for the repo).
Every law below was observed independently in at least two batches; the
"why" is the mechanism that makes it work, not a style preference.

---

## Part 1 — The laws, and why each one buys speed or attention

### A. Where things live

**A1. The page title belongs in the top bar; the content starts with actions.**
Every functional Brex screen puts the H1 in the 56px bar and opens the
content with a verb row. Two effects: orientation survives scrolling (the
title never leaves), and ~70px of the most valuable real estate on the page
goes to *doing* instead of *labelling*. Only two of 55 screens keep an
in-content H1 — Home (a personal greeting) and Reports (a named, forkable
document). Titles that repeat the nav item you just clicked are dead pixels.

**A2. Identity sits at the top of the sidebar; it never scrolls.**
Avatar + person + org + chevron, first thing, top-left. It answers "who am I
acting as, on which entity" once per session and then stays out of the way.

**A3. The top-bar right cluster escalates outward: search → alerts → help.**
Frequency descends toward the edge; escalation ascends. Find it yourself,
then see what found you, then ask a human. Support in the coldest corner is
findable by muscle memory without competing with anything.

**A4. The nav spends zero colour.** Active = a tinted pill and a weight
change. The whole chromatic budget is reserved for data, so the first
coloured pixel in the content is instantly meaningful. No badges anywhere —
one counter only.

**A5. Group nav by whitespace, not rules or headers** — unless the group is a
governance concept (Brex labels only "Approvals", because it carries
accountability).

**A6. Button size encodes commitment depth.** One-click verbs → outline pills.
Multi-step flows and settings surfaces → large icon-above-label tiles. You
can feel how expensive a click is before you make it.

**A7. Actions adapt to what the object can actually do.** Six buttons on a
funded current account, two on an empty vault. Impossible actions are
*removed*; merely-unavailable *controls* are disabled in place so the
toolbar never reflows between states.

### B. Colour

**B1. One accent per surface, spent on the single committing action.** Orange
appears ~6 times across 55 screens. Five of eleven screens in one batch have
none — because they have no single right action. Refusing to rank is itself
a ranking, and it is what makes the accent mean something when it appears.

**B2. Colour encodes "does this require you", not "what state is this".**
Proof: `Canceled` is **red** on Cards (a live liability) and **grey** on
Invoices (a bookkeeping non-event). Same word, opposite treatment.

**B3. Money is never coloured.** ₹4,98,096 that is 342 days late renders in
plain black; only the words "342 days overdue" are red. Outgoing money is
never red — spending as intended is not an error. Losses get a minus sign
(universally legible); only gains occasionally get colour, and rarely.

**B4. Selection is a surface change, never a hue.** Active tabs, chosen
segments and selected rows use fills and underlines so hue stays unambiguous.

**B5. Disabled = drained of accent entirely.** The primary button's colour is
a live validity readout the user learns to trust product-wide.

**B6. Filled chips = lifecycle state. Outlined chips = attributes.** A glance
tells you whether a chip is about health or about classification.

**B7. Absence of colour is a focal technique.** One grey toggle in a column of
navy ones is found faster than any highlight could manage.

**B8. When a cell is red, it must also say what to do about it.**
"No limits available" is followed by "Issue limit to allow…".

### C. Tables

**C1. Column order is the reading order of the question, and it changes per
queue.** A drafts queue shows provenance and omits status; an entity list
puts verification last because that's the exception scan.

**C2. The lead column is chosen by persona.** The same expense table leads
with **Merchant** for the employee (you remember who you paid) and
**Transaction date** for the admin (you reconcile by period).

**C3. Mirror features are deliberately asymmetric.** Payables lead with
created-date + vendor; receivables lead with sent + due date, because the
aging window is the unit of analysis. Direction of money changes the question.

**C4. Only money is right-aligned.** Counts are left-aligned — they aren't money.

**C5. Every cell is a two-line vehicle.** Bold primary over muted derived
fact: `••4025`, `3.35% return`, `Engineering`, `342 days overdue`. This kills
3–4 columns and makes a row readable in one fixation.

**C6. `₹0` vs blank vs `N/A` are three rigorously distinct states.** Measured
zero / not populated / not computable. Never a dash, never a placeholder.

**C7. Do the arithmetic the user can't do at a glance, and price it in
colour.** A due date becomes `21 Aug` + red `342 days overdue`. Magnitude
alone ranks the backlog without a sort.

**C8. Encode provenance with icon species, not a column.** Envelope + email =
ingested; person + name = created by a human. Your money navy, their money grey.

**C9. Counts are links.** Numbers in tables are entry points.

**C10. Grouping replaces a column; it never duplicates one.** Date grouping
removes the Date column.

**C11. Footer triad:** count left (with the entity's own noun — rows / users /
vendors), pager centred, page-size right.

**G2. A row that repeats gets a word budget.** Headline ≤6 words of prose after
the amount; sub-line ≤7, and it must be **evidence** or **consequence** — never
the headline restated, never product-meta. The plainest available wording goes in
the **headline**, not the grey line. No first person. Each number once per screen.

*Prose* words, not tokens: names, amounts and percentages are data and cost
nothing. `₹81.7L from Swiggy and Zomato · fees not visible` is nine tokens and
five words of prose, and the platform names are the useful part.

The budget applies to copy that **stacks**. A sentence read once, at the moment
it decides something — a consent disclosure, the browser-agent privacy line, an
empty-state body (D3), a disabled reason (D5) — is the correct shape and is
exempt. Twelve defensible sentences in one column is a wall; the same sentence
alone on a decision screen is an explanation.

Enforced by `scripts/copy-probe.ts`.

**C12. Tabs switch entities; pills switch slices of one entity.** Counts only
on actionable stages: `0` is meaningful in a pipeline, noise in an inbox.

**C13. Two filter tiers.** Saved-view pills + `Save as` on row 1; the
low-contrast `Add filter` builder on row 2. Overflow → a dropdown, never
horizontal scroll.

### D. Empty, disabled and edge states

**D1. Empty states are typed by whether emptiness is good or bad.**
"You're all caught up" (achievement, no CTA) vs "No expenses yet"
(deficiency, icon + explanation) vs a promotional zero-state with
illustration + CTA when the user must act to begin.

**D2. Every explanatory empty state is a triad:** name the void → explain the
mechanism → offer the second-best action.

**D3. Copy formula:** title = "No «plural noun»"; body = what the missing
thing would *do for you*, never "click the button above".

**D4. Column headers render even with zero rows** — the schema is information.
But when there is nothing to search, the search input is *removed*, not
disabled.

**D5. Disable in place, and put the reason in the description.**
Never hide, never tooltip-only.

**D6. Absence must not be rendered at maximum weight.** Brex's own worst
moment: three 44px `N/A`s that are the loudest thing on the page and say
nothing.

### E. Forms and flows

**E1. Labels are questions, placeholders are instructions, helpers are
consequences** — and the helper updates with the selection.
"How much can they exceed this limit?" → "Expenses will get declined when
spending reaches the limit."

**E2. Field order: who → what → how much → how → when.** Money mechanics last.

**E3. Group by decision, not field count.** A one-field group still earns a heading.

**E4. `+ Add X` links for every optional field.** Advanced options cost one
line, never a section.

**E5. Everything rare folds into one drill-in row, placed last**, so the
default form stays ~7 questions.

**E6. Pre-fill aggressively, then mark what's a guess** (an in-field pencil).

**E7. Declare the time cost before the ask** — "Takes 2 min" — and list the
steps as promises, disclosing the KYC/bank-link work *before* commitment.

**E8. Flows delete the shell.** No nav, no search; back-link *names its
destination*; the stepper takes the nav's slot; footer CTAs align to the
form column, not the viewport.

**E9. Catch-all first** in choice lists, and offer the automated path first,
described in first-person plural ("We'll analyse…").

**E10. Modality is graded by ownership.** Own detail/config → right drawer,
**no scrim**, list stays live. Own multi-step creation → full-page takeover.
Third-party → centred modal **with** a dark scrim. Scrim severity tells you
whose system you're in.

### F. Cross-linking

**F1. Settings copy is a hyperlink graph in plain language** — name the
sibling screen instead of adding a button.

**F2. Two emphasis grades:** bold = a concept on this page; underline = a real link.

**F3. The same setting is reachable from at least two entry points.**
Reachability beats uniqueness.

**F4. Escape hatches sit below the happy path, never beside it.**

**F5. Controls sit beside the fact they change, even at the cost of
duplication** ("Update autopay" inline at the end of the autopay sentence).

**F6. Chevron grammar:** `›` deeper · `→` outward · `⌄` expand in place ·
`+ Add` reveal optional. Four link types, four glyphs, zero overlap.

**F7. Every page repeats its own precondition** — a decision receipt is
cheaper than a back-trip.

---

## Part 2 — What we changed, and why

### 1. The shell: title in the bar, identity in the rail, Ask always reachable
*(laws A1, A2, A3, A4, F3)* — `components/app/AppShell.tsx`

**Before:** the header carried the business switcher and a bell; the page
title lived in the content and scrolled away; there was no search and no
help anywhere in the product.

**After:** identity (avatar + business + masked account + chevron) moved to
the top of the sidebar; the page title is in the header and never scrolls;
the right cluster is **Ask → bell → Help**. The switcher's footer gained
*People & roles* and *Open another business account*.

**Why it makes the customer faster:** orientation is now free — you always
know where you are without scrolling up. The business switcher is where
every other banking product puts it, so it is found without a hunt. And the
three global affordances sit in the order you escalate through them, at the
screen edge where Fitts's law makes them cheap to hit.

### 2. Ask, from anywhere (⌘K)
*(laws A3, C13, F3)* — `components/app/AskAnywhere.tsx` (new)

**Before:** our answer engine — the single most differentiated thing we
own — was reachable from exactly one screen, half-way down `/statement`.

**After:** a search-shaped control in the top bar on every screen, ⌘K from
the keyboard, Esc to leave. It answers with the working shown, lists up to
four matching lines, and offers "See it in the statement →".

**Why:** the fastest path to a specific fact is typing, not navigating. It
wears the shape of a search box because that shape is already learned — but
it returns an answer rather than a filter. This converts a buried feature
into the product's front door.

### 3. Verbs above the data on Today
*(laws A1, A6, A7, B1)* — `app/today/page.tsx`

**Before:** Today opened with a date, a title and then data. To pay someone
you navigated to Payouts, found the payee, then clicked Pay — three screens
before any money moved.

**After:** a verb row directly under the greeting — *Pay someone · Chase a
payment · Connect channels · Withdraw from project · Close the month* —
**derived from this entity's own state**, so nothing offered can fail
(the RERA verb only exists for a project entity; "Chase" only when invoices
are outstanding; "Connect channels" only when marketplace credits exist and
aren't connected yet).

All are equal-weight outline buttons. That is deliberate: on a landing page
we cannot know which verb you arrived wanting, so refusing to rank them
*is* the ranking — and it keeps the accent free for the one place a screen
does have a single right action.

**Why it catches attention:** the row sits in the F-pattern's hottest zone
(top-left, first horizontal sweep) and it is the only bordered, elevated
band above the data. The icons let you target by shape rather than by
reading the label.

### 4. Money is never coloured
*(law B3)* — `app/today/page.tsx`, and the policy going forward

**Before:** upcoming inflows rendered green, outflows grey; the statement
coloured credits green.

**After:** every amount renders in ink; the sign carries direction. Colour
is now reserved for status and lateness only.

**Why:** when every number is coloured, colour stops meaning anything —
the eye habituates and the one row that genuinely needs attention is lost
in the wash. Brex renders a ₹4.98L bill that is 342 days overdue in plain
black and puts the red on "342 days overdue", because the lateness is the
judgment and the amount is just a fact.

### 5. A real empty state on the daily beat
*(laws D1, D2, D3)* — `app/today/page.tsx`

**Before:** "Nothing needs your eyes" as a single grey line in a card, with
the entire left column dead beneath it.

**After:** the explanatory grade — icon tile, noun-negation title
("Nothing needs you"), and one line that says what the absence *means*:
"Every line on your statement is explained and no approval is waiting. We
watch the account and put anything that needs a decision right here."
Deliberately no CTA: nothing is required of the user, and inventing a
button here would train them to distrust the empty state.

### 6. No raw bank strings where a name belongs
*(law C8)* — `lib/analysis.ts`, `lib/statement.ts`

**Found by the comparison:** our statement rendered `HDFC0000119` — an IFSC
code — as a counterparty name, and marked every RERA buyer installment
"Unexplained" while `/project` simultaneously showed the same credits as
matched 70/30 splits. Two screens contradicting each other about the same
rupees.

**Fixed:** a structured rule reads the buyer's name out of the virtual-account
narration; aliases added for the contractors and consultants; buyer
installments now reconcile as "Unit B-704 · 70% designated, 30% ops".
The developer's statement went from **8 needs-eyes to 0, 13 of 13 matched**,
and the insight card now surfaces a real fact ("L&T Geostructure took
₹58.6L — 39% of money out").

**Why it matters beyond tidiness:** Brex never shows a raw identifier where
a human name belongs, because an unreadable row is an unscannable row —
and a product that contradicts itself across two screens loses the trust
that the whole reconciliation promise rests on.

---

### 7. Balance — a new screen: "where is my money?"
*(laws A1, A6, A7, B3, C5, C10, F6, and "charts answer shape")* —
`app/balance/page.tsx`, `lib/balance.ts`, `components/money/BalanceChart.tsx`

The product could tell you what needed doing and what every line meant, but
had no screen that answered the oldest question a business owner asks. Today
carried a balance card as a sidebar afterthought.

**Built to the reference's Accounts pattern:**
- **No in-content H1** — the top bar owns the title; the first line is a
  subtitle that says what the page answers.
- **Verbs before data**, adapting to the entity (a project account adds a
  fourth verb; everyone else gets three).
- **The number, then its shape.** Total in hero type with in/out beneath;
  then a **filled area chart with no axes, no gridlines, no labels** —
  because it answers "which way is this going", and the exact value is
  already spelled out beside it. Giving it axes would invite reading a
  precision it can't support. The window select sits **with the chart it
  governs**, not with the page.
- **The series is derived, never stored:** balance(d−1) = balance(d) − net(d),
  walked back from today's real balances through the same ledger the
  statement renders — so the chart cannot disagree with the statement. If the
  walk-back would go negative we **hide the chart and say why** rather than
  draw a shape we can't stand behind.
- **The account list IS the balance sheet** — name, the one distinguishing
  fact, balance and share on every row, so the question is answered without
  entering the detail pane at all.
- **Sensitive data is asymmetric by real risk:** the IFSC shows in clear
  (it's public), the account number is masked behind an eye toggle.
- Every amount is ink. The floor line ("never below ₹3.29 Cr") is the
  lending-grade fact, stated where it's earned.

### 8. Backlog items completed
- **Monogram avatars** (C5, C8) — `components/ui/Avatar.tsx`, deterministic
  low-saturation tint per name so it never competes with the semantic
  palette; the business's own money renders in solid ink so "is this us or
  them" is answered pre-attentively. Applied to statement rows, balance
  accounts, Today's activity and payee lists.
- **Two-line derived facts on statement rows** (C5) — rail + UTR as the
  muted second line.
- **The daily beat no longer dies when the queue is empty** (D1) — it falls
  back to "Recently on your account" with a link into the statement.

---

### 9. Every other page brought to the laws
*(Payouts · Collections · Close · Project · Team · /try · /apply)*

The first pass only audited Today and Statement. The rest followed:

- **A1 — the in-content H1 is gone everywhere** it merely repeated the bar
  title, replaced by a one-line subtitle saying what the page answers.
  `/project` keeps a named heading (demoted to `h2`) because "Vistara One"
  is the object's proper name, which the generic bar title can't carry;
  `/try` and `/apply` keep theirs because shell-less flows own their title (E8).
- **A6 — launcher tiles** on Payouts (*Pay someone · Add a payee ·
  Approvals*) and Collections (*Payment link · Chase everyone*), each with a
  derived sub-line, all equal weight (B1). **A7:** the Approvals tile only
  exists when the entity has approvals.
- **C7 — overdue is now arithmetic, not a chip.** Red elapsed-days beneath
  the due date ("12 days overdue", "oldest 25 days late"). Magnitude ranks
  the backlog without a sort.
- **B6 — chip species enforced product-wide.** `Badge` gained a real
  `variant="outline"`; three local copies of the same workaround were
  consolidated onto it. Attributes (Verified, Owner, Prepares, Reminder
  sent, RERA project) are outlined; lifecycle states (Invited, In progress,
  Part paid, Returned) stay filled.
- **B3 — remaining coloured money removed**: collections' Overdue/Collected
  stats, the post-withdrawal confirmation (the rupees went to ink, only the
  word "done" stayed green), and a part-payment amount that was living
  inside a coloured chip.
- **B2 — terminal states went neutral.** `Credited` and `Paid` ask nothing
  of you, so `Returned` is now the only coloured chip in its column.
- **D5 — disable in place with the reason**: "Chase everyone" states why
  it's off; the blocked Close button now *names the first blocker* rather
  than only counting them.
- **E7 — time cost declared before the ask**: "Takes about a minute" on
  `/try`, "Takes about 10 minutes" plus a *What to expect* list on `/apply`.
- **E1 — labels became questions with consequence helpers**: "What's your
  GSTIN?" ("…you never type them twice"), "Which Aadhaar should we verify?",
  "When can you take the video call?" — and the label reverts to a noun once
  answered, so a settled question stops asking.
- **E8 — the flow stepper took the nav's slot** on `/apply`, rendered in ink
  so it spends zero accent, and the back-link now names its destination
  ("Back to your analysis").
- **D1/D2/D3 — typed empty states** on payments, payees, invoices, buyer
  splits and the team page, each with the value-proposition line and no
  invented CTA.

---

### 10. Phase 5 — the conversion ladder (rungs 3 and 5)
*(plan §4; laws B1, D5, E1, F5)* — `lib/conversion.ts`,
`components/money/SweepIn.tsx`, surfaced on `/balance` and `/statement`

The bank console already *reported* redirected settlements and sweep
candidates, but the SME side that produces those outcomes didn't exist —
the console was claiming a result the product couldn't cause.

**Every offer is earned or absent.** `lib/conversion.ts` returns `null` the
moment the justifying number is missing: no external balance ⇒ no sweep
offer; balance under ₹50k ⇒ noise, not an offer; no marketplace credits ⇒
no settlement line. Nothing here can render a banner or a rate card.

- **Rung 5, sweep-in** (`/balance`): led by their own fact — *"₹1.1L is
  sitting where we can watch it but not use it"* — as a dismissible
  NudgeCard, never a banner. The mandate sheet asks a question per
  decision, and the suggested floor is **computed from their own committed
  outflows** ("₹13L covers the ₹12.9L already committed over the next 30
  days — bills, salaries and standing instructions we can see"), not a
  number we invented. Each cadence option states its consequence (E1).
  The eNACH note is honest about scope: *"authorises pulls from your own
  account into your own account. It never sends money out to anyone else."*
  Once active the card becomes a state — source, floor, rule, and a one-tap
  pull — with cancel always beside it (F5).
- **Rung 3, settlement destination** (`/statement`): stated where the
  shortfall evidence already lives — *"Swiggy and Zomato settle about ₹6.3L
  a week into PNB ••4821 — the account we read every morning, which is why a
  short payment shows up here the day it happens."* For a business whose
  settlements land elsewhere the same line becomes the ask. A fact when it's
  already right; an offer only when it isn't.
- **Rung 2** was already true (links and invoices collect into PNB and
  reconcile themselves); this pass didn't need to add a surface for it.

### 11. Phase 12 — Credit line (rung 4)
*(plan §4; laws B1, E1, E7, F5, F7)* — `lib/credit.ts`, `app/credit/page.tsx`

The only irreversible rung, so the screen slows the user down in exactly one
place — the cost — and is fast everywhere else.

- **The limit is arithmetic, not a rate card.** It is one month of the
  inflow we could actually *match* to an invoice or a settlement — gross
  credits are ignored, because "pre-approved on money we've already
  verified" has to be true in the code, not just the copy. The page shows
  its own working: *"the median of 2 full months, with 86% of your credits
  explained."* The newest month is dropped from the median because it is
  usually partial and would understate them.
- **The offer is earned by a fact.** `projectedShortfall` walks their own
  calendar forward from the operating balance and only counts money we
  control — invoices *may* not be paid on time, so they never inflate the
  projection. With no shortfall the line still exists, but it never nudges:
  §5 forbids pitching a product before the product has produced a fact.
- **The default amount is the need, not the ceiling.** ₹2L, not the ₹19L
  limit — offering the maximum would serve the bank's interest, not theirs.
- **The cost precedes the commitment, twice.** EMI, total interest, rate,
  fee and first-debit date sit above the button; the confirm sheet then
  leads with **"You will repay"** rather than what you receive.
- **The honest lines stay in.** *"Borrowing costs money. If the gap is a
  customer paying late, chasing it is cheaper — we'll show you who owes you
  first."* And in the sheet: *"Missing a debit is reported to the credit
  bureau — the one thing here you can't undo."*
- Once drawn, the page becomes the repayment: EMI, first debit, remaining
  headroom, and the note that the auto-debit will match itself at close.

### 12. Phase 13 — Compliance and cards (late by design)
*(plan §12 row 13; laws A2, B3, C2, D1–D3, F5)* — `lib/compliance.ts`,
`app/compliance/page.tsx`, `app/cards/page.tsx`

Every competitor leads with e-invoice, e-way and GST, and every one of them
asks the owner to type their invoices in a second time. We arrive last and
ask for nothing: **the return is computed from lines that are already
explained.** The page footer is the whole claim — *"Nothing on this page was
typed in. Every figure traces to a bank line you can open."*

- **Two schemes, because they are not the same product.** A restaurant on
  the 5% rate cannot lawfully claim input credit at all, so showing Vikram
  a stack of claimable purchases would be a lie that ends in a notice.
  Instead the page *names the price of the deal he already took*: `The 5%
  rate comes with no input credit … on this month's rent, ingredients and
  advertising, that costs you ₹1,75,394.` Rajesh, on 18%, gets the credit
  table. One engine, two truths.
- **Purchases carry the supplier's rate, not yours.** Electricity is exempt,
  so there is nothing on that bill to claim, and we say so rather than
  quietly inflating the credit by a few thousand rupees.
- **The payment and the liability are never confused.** The ₹2,12,400 that
  left on 20 July settled *June*. Netting it against July's running figure
  would have been the single most damaging error on the page, so it sits in
  its own noted line: `We show it here so the two are never confused.`
- **An unexplained line is not untidiness, it is money.** Where open debits
  carry claimable tax, the page prices them and links straight to the
  statement filter. This is the same spine as the rest of the product,
  finally denominated in rupees.
- **e-Invoice is filed under compliance but argued as receivables.** Until
  an invoice is registered the buyer cannot claim credit on it, and a buyer
  who cannot claim credit does not pay — so the section header carries
  `₹90,000 of what you're owed sits behind an unregistered invoice`, and
  unregistered invoices sort to the top.
- **A TDS shortfall is never called "open".** A 1% gap on a 194C invoice is
  tax deducted, not a debt; labelling it open would send the owner chasing
  a customer who paid in full. It reads `Paid · ₹3,400 TDS`.
- **Rows only for facts that differ.** Five invoices to individuals never
  needed a registration, so they collapse into one sentence instead of five
  identical `Not required` rows — the dedupe rule, applied to a list.
- **The e-way section earns its place or explains its absence.** We infer
  goods movement from freight payments in the ledger. Rajesh gets real
  consignments with a `No freight found` warning on the uncovered one;
  Vikram gets a typed empty state — *"Nothing you do needs one … We would
  rather tell you that than hand you an empty form to fill in."*
- **Cards are argued on reconciliation, not cashback.** A card line arrives
  already carrying its merchant, holder and category, while every other
  debit has to be worked out afterwards. The offer is gated twice (a company
  or LLP with a second person, plus evidence of card-shaped spend) and cites
  the duplicate Meta charge: *"a per-merchant monthly cap … would have been
  declined at the terminal rather than found at close."* Where the gate
  fails it gives the specific reason — a proprietor is told they and the
  business are the same legal person, not "unavailable".
- **Neither page enters the nav.** Both are things you set up once and then
  forget, so they sit one click under identity in the sidebar menu, with a
  cross-link from Close. The six-item rail stays six.

### 13. Correcting §1 — the rail was too tight
*(supersedes the six-item rail in §1; laws A1, A3)* — `AppShell.tsx`

I read the reference teardown's tight rail as a rule and applied it past the
point where it served anyone. By the end of Phase 13, **three finished
features were unreachable from the navigation**: `/credit` only appeared when
a shortfall nudge happened to fire on Balance, and `/compliance` and `/cards`
lived behind the chevron beside the business name. A feature nobody can find
is a feature nobody has, and "the rail stays six" was a constraint I invented,
not one the reference imposes.

- **Three clusters, still separated by whitespace rather than headings**: the
  daily beat (Today, Balance, Statement, Payouts, Collections), the month-end
  (Project where it exists, Close), and what you reach for occasionally but on
  purpose (GST, Credit, Cards). The break reads as a change of rhythm without
  spending a line on a label.
- **Rail items are not data-gated.** GST, Credit and Cards exist for every
  business and may simply not apply — and each page already says so in words,
  which is why they can be permanent. A nav item that appears and disappears
  teaches people not to trust the rail. The single exception is **Project**: a
  RERA workspace does not exist at all without a project, so there would be
  nothing for a page to explain.
- **"GST", not "Compliance".** An Indian owner says GST. Plain English wins
  over the category name.
- **Mobile gets four destinations plus More**, not nine crushed into a 375px
  bar. More opens a real sheet titled *Everything else*, and the tab lights up
  when you are inside anything it holds — so the bar never lies about where
  you are.
- The identity menu lost its GST and Cards entries. Repeating them there would
  have taught that the menu is where features hide, which is the habit that
  caused this.

### 14. Correcting the whole audit — density. Nobody reads a paragraph.
*(supersedes the copy in §§1–13; new law G)* — every page

Ajmal: *"here its full of paragraph and sentences, who will read all this…
just recheck brex pages."* He is right, and rechecking the source settles it.

**The evidence.** Brex *Reports* → three cards, each `Total spend` + `N/A`.
No sentence anywhere on the page. Brex *Security settings* — the one screen
every product fills with help text — is seven rows of
`Account activity | 7 activities logged in the last 7 days | View activity`.
The only two-line body on that screen is Passkeys, because a passkey is a
genuinely unfamiliar concept. That is the entire allowance.

**What I had built.** The compliance page carried 24 prose blocks and ~700
words. Cards had three benefit tiles of marketing copy. Across the app,
158 blocks of 90+ characters. I had been writing the *reasoning* onto the
screen — "we would rather show you nothing than a line we can't stand
behind" — which is design-review language, not product copy.

**Law G — density.**
- A card is `label + number`. A row is `label | one-line state | button`.
- Helper text exists only where the **concept** is unfamiliar, never to
  justify our own logic. Cap it at roughly twelve words.
- Prefer deleting to shortening twice. If it survives two edits, it was a
  fact, not prose.
- Reasoning that genuinely matters moves **behind a "How this works" panel**
  — opt-in, off the page. It is not deleted, it is demoted.
- No editorialising: *"we'd rather…"*, *"nothing has gone wrong…"*,
  *"it is still worth knowing…"* all go.

Applied: compliance rewritten (~700 words → ~90, reasoning moved into a
`HowPanel`), cards stripped of its three benefit tiles in favour of two
number cards, credit's five explanatory blocks cut to single lines, and the
same pass over balance, close, statement, collections, payouts and SweepIn.

**Then the same pass over every remaining screen** — today, project, team,
bank, try, apply, apply/track — and over the copy that lives in `lib/`, since
findings and insights render as body text on Today and the statement. The
worst offenders there were `analysis.ts` (a 33-word TDS finding, a 26-word
overdue one) and `rera.ts` (a 33-word guardrail entry).

Where the rule does **not** apply, and why:

- **The dispute letter** (`dispute/[id]`) is a formal document sent to a
  platform. Prose is the correct register; a bulleted letter would read as
  unserious.
- **Ask answers** (`lib/ask.ts`) are replies to a question the owner typed.
  An answer is allowed to be a sentence — that is what was asked for.
- **Consent copy** on sign-in stays whole. It is legally meaningful, and
  compressing it to save a line would be the wrong kind of tidy.
- **The sign-in value proposition** is a marketing panel, not a workspace
  screen. One subhead is fine there and nowhere else.

Result: nothing over 20 words survives outside those four exceptions, and
the count of 16+ word blocks fell from 39 to 17 — most of the remainder
being 16–18 word factual lines that read as single statements.

### 15. Reachability audit — what else was built but unreachable
*(prompted by "the logout feature is missing"; law A3)*

Sign out turned out to be one instance of a class, so I checked the class
mechanically rather than by clicking: every route against its inbound links,
every store action against its callers, every button for a handler, every
panel for a trigger, and — the one that mattered — every conditional surface
against **all five personas with channels on and off**.

Clean: all 21 routes reachable (`/design` is the internal swatch page), no
dead store actions, no unread state, no handler-less buttons, no unopenable
panels, no unrendered components.

Three real defects:

1. **The mobile sheet was not the sidebar.** The rail is `hidden md:flex`, so
   on a phone there was no sign out, **no way to see which business you were
   in, no way to switch it**, no "open another account", and no Help — the
   top-bar Help is `hidden sm:flex`. A two-entity owner was stuck in whichever
   business the session opened with. The sheet now leads with the entity and
   its account, offers the switch, and closes with roles, apply, Help and
   sign out.
2. **Sign out was a 26px unlabelled icon** in the corner the dev-tools badge
   occupies. The user block is the target now, with a labelled row.
3. **The "credit stuck in unexplained lines" card could never render.** My own
   §12 called it "the whole point", and it was unreachable twice over. The
   logic filtered on counterparty kind *before* checking whether the line was
   open — but a line is unexplained precisely because we could not resolve the
   counterparty, so its kind is `unknown`, which is never claimable. The
   branch excluded exactly the lines it existed to find. And once fixed, the
   seed still had no unexplained *business* debit for any ITC-claiming entity,
   so one was added to Rajesh (`SS ENTERPRISES-INV 4471`, ₹47,200 → ₹7,200 of
   credit at risk). It now fires, and flows through to Close as 5 of 18.

Also caught two singular/plural bugs the new path exposed ("1 lines need
explaining", "1 batch still waits"), found by probing every count string
across all personas rather than by reading.

Two dead branches remain and are fine: the no-GSTIN empty state and the
B2C-only invoice list are defensive guards, not features.

### 16. The books — accounting, compliance and the Vyapar document suite
*(plan `fizzy-floating-treehouse`, phases A–G; law G throughout)*

PNB will host this free, so the app became the accounting system rather than
its integrator. The whole build rests on one inversion: **the statement
already knows what happened, so the books post themselves.**

- **Suspense is the hinge.** A bank line we cannot explain posts there rather
  than being guessed into a plausible head, which turns "needs your eyes" from
  a UI state into an accounting fact — and a non-zero Suspense blocks the
  close. Explaining Rajesh's ₹47,200 supplier line moves it into Purchases and
  the month unblocks.
- **One document engine, eleven types.** `DOC_SPEC` carries the only three
  things that differ — posts to ledger, moves stock, converts into — so the
  purchase suite cost a data table and a route, not four screens. Convert,
  never retype.
- **Payouts stayed separate from Bills.** Bills are documents; paying is a
  bank capability. A bill hands over to Payouts rather than growing a second
  way to move money, which keeps "open on data, exclusive on money movement".
- **`scripts/books-probe.ts` runs every phase, not at the end.** It asserts
  the trial balance ties, the bank ledger equals the accounts actually held,
  debtors agree across ledger/parties/documents, creditors agree with open
  bills, stock agrees with the shelf, every document totals its invoice, and
  assets equal liabilities plus equity.

**Four bugs the probe caught that a demo would not have.** Each is the same
shape — two calculations of one fact, drifting:

1. Three different events were all called "internal transfer"; posting them
   alike made money vanish.
2. The Items screen recalculated stock while the books carried opening only,
   so an invoice moved no stock at all.
3. **Cost of goods sold held a credit balance** — arrivals were posting
   against it, when a bill is not an expense while the goods are still on the
   shelf.
4. **The balance sheet did not balance while the trial balance tied.**
   Drawings is an equity account with a debit balance, so summing balances
   added it to Capital instead of subtracting. A contra account is invisible
   to a debit-equals-credit check.

The lesson worth keeping: **double entry guarantees balance, not
correctness.** Three of those four tied perfectly while being wrong.

---

## Part 3 — The second reference: Laws of UX

Every law in Part 1 came from **one source**: 55 Brex screens. Those are
observations of one product, not principles — which is exactly why §13 ("the
rail was too tight") and §14 ("nobody reads a paragraph") are both corrections
of rules over-applied from a sample of one.

lawsofux.com is the independent check: 30 laws with a research basis, none of
them derived from Brex. All 30 read (definitions and takeaways in
`research/lawsofux/LAWS.md`, gitignored like `Brex/`).

### 3.1 — What already passes, and why

Twenty-four of the thirty were already satisfied, mostly because Brex was
obeying them. The mapping is close to one-for-one:

| Law of UX | Already in the app as |
|---|---|
| Proximity · Common Region · Similarity · Uniform Connectedness | A5 whitespace clusters · `Card` boundaries · B6 chip species · C5 two-line cells |
| Chunking · Miller's Law | the rail's four groups (3·6·4·2) · `label + number` cards |
| Occam's Razor · Prägnanz · Cognitive Load | **law G** — 700 words → 90, reasoning demoted to `HowPanel` |
| Tesler's Law | "the statement already knows what happened, so the books post themselves" — the irreducible complexity of double entry lives in `lib/ledger.ts`, not on the owner |
| Von Restorff | B1 one accent per surface · B7 absence as a focal technique |
| Jakob's Law · Mental Model | A2 identity top-left · "GST" not "Compliance" · Vyapar's own nouns (Parties, Items) |
| Paradox of the Active User | `HowPanel` — guidance in context, opt-in, never a manual |
| Selective Attention | `NudgeCard` is dismissible and earned; `lib/conversion.ts` returns `null` rather than pitch, so nothing here can become a banner |
| Choice Overload | A7 impossible actions removed · D5 disable in place with the reason |
| Parkinson's Law | E7 "Takes about a minute" declared before the ask |
| Aesthetic-Usability | a **warning**, not a target — it is why `scripts/books-probe.ts` exists, and it is why a 28px button survived four audit passes |

### 3.2 — One law rejected on purpose

**Serial Position Effect** would put the least-used rail items in the middle.
Ours holds Sales · Purchases · Payouts · Reconcile there — the highest-frequency
destinations after Today. Kept as is: SPE is about *recall of a list seen once*,
and a persistent rail is never recalled, it is re-scanned, where Proximity and
Chunking govern. Recorded rather than silently ignored.

### 3.3 — Six laws Brex never taught us, and all six failed

**1. Fitts's Law — 28px was the primary action on a phone.**
`Button size="sm"` is `h-7`, used 89 times, and it is the action on
`ExposureCard`, `AccountantStrip`, `NudgeCard`, `StatementLine`, every Close
row and every document row — the button a thumb presses. Plus 85 hand-rolled
`<button>` elements across 27 files that no size policy reached, several
icon-only at 27–28px.

Fixed with a `@media (pointer: coarse)` block in `globals.css`. Conditioned on
the **pointer**, not the viewport: a phone or tablet gets a 44px floor, a
trackpad changes nothing, so the density asked for by name is untouched.
Measured across 16 routes at 375px: zero targets under 44px, zero horizontal
overflow; at desktop the floor is still 28px.

**2. Postel's Law — a decimal point multiplied a payment by a hundred.**
Three hand-rolled amount parsers, two of them wrong. `payouts/page.tsx` ran
`Number(amount.replace(/\D/g, ""))`, so `50000.50` was submitted as
**₹50,00,050**; `JournalSheet` had the same strip on a journal entry; the
`DocEditor` accepted `1.2.3` → `NaN` → `|| 0`, silently zeroing an invoice
line. The IFSC field was gated on `length >= 4`, so `PUNB 0123` reached a
penny drop that could only fail.

Now one `parseAmount(raw): Amount | null` and one `parseIfsc()` in
`lib/format.ts`. They accept `₹`, Indian and Western grouping, `Rs.`, pasted
whitespace, and `k`/`L`/`Cr`; they round paise to the rupee **and say so**
(GST rounds tax to the rupee by law, so whole rupees is the domain rule, not a
shortcut); and they return `null` rather than `0` so a field can state that it
did not understand instead of showing a confident wrong number. Covered by
`scripts/parse-probe.ts`, which exists because the bug it prevents is invisible
— the books would have tied perfectly around the wrong figure.

**3. Goal-Gradient Effect — the Close checklist hid how close you were.**
`openCount` was computed and spent only on a disabled button's subtitle. Now a
count and a bar sit above the list, and done rows collapse to the bottom behind
a disclosure so the remainder visibly shrinks as you work. They collapse rather
than vanish because Zeigarnik #1 wants a signifier that more exists.

**4. Peak-End Rule — the product's climax was three grey cards.**
`close/page.tsx` opens with its own thesis — *"Rituals create habit; dashboards
create bounce"* — and the reward for driving the checklist to zero was the
button being replaced by three secondary file cards. The end of the journey now
states what the month came to, once, at full weight:
`July 2026 is closed. · ₹7.2L in · ₹5.6L out · 12 lines, every one explained.`
Delight expressed as a number, which is the only kind law G permits. `moneyIn`
and `moneyOut` are carried on `CloseState` rather than re-summed on the page.

**5. Doherty Threshold — twenty screens painted nothing, then everything.**
Every page carried `if (!mounted) return null`, and so did `AppShell` — the
whole frame, rail and title included, was blank for a frame. There was no
skeleton, spinner or progress element anywhere in the app. Both a Doherty
failure and change blindness (Selective Attention #3).

The guard is hoisted: `AppShell` renders a `ShellFrame` — brand, rail, page
title, bottom nav, all derivable from the URL alone — so the server and the
client's first render produce identical HTML and only the identity block and
content region resolve. The server-rendered body went from empty to the full
chrome. The identical `/signin` redirect that had been copied into 20 pages
moved with it.

The mount pattern itself is gone, not relocated. `lib/useHydrated.ts` answers
"has the client taken over" with `useSyncExternalStore` — `getServerSnapshot`
returns false, `getSnapshot` returns true, React swaps at hydration — so there
is no state, no effect and no second render. The four places that were reading
`window.location` from an effect now read it as a state initialiser, because
the page renders nothing until hydration and a value computed once has no
business being written twice. Credit's default drawdown became a `useMemo` the
borrower's choice falls back to (`chosen ?? suggested`) rather than a number an
effect wrote into state. `useDismissable` updates its latest-handler ref in an
effect instead of during render.

**Lint went from 27 errors to zero**, and two real bugs fell out of it: the
`books` memo on Close and GST was missing `creditDrawn` from its dependencies
while `resolutions` carried it spuriously — so drawing credit did not rebuild
the books those two screens report from.

**6. Hick's Law / Chunking — the mobile More sheet dropped the rail's groups.**
The sheet rendered `nav.slice(MOBILE_PRIMARY)` as one flat run of ten, throwing
away the `group` field, so every phone user got the ungrouped version of a nav
grouped on purpose. Same whitespace break as the sidebar now.

### 3.4 — What the Peak-End work uncovered

Verifying the closed-month moment required reaching it, and **no persona could
close a month at all**. Statutory exposures were pushed onto the checklist with
`done: false` hardcoded and no path to true, so the entire files section —
close report, GST working, CA pack CSV — had been unreachable on all five
personas since that phase shipped. The same shape as the "credit stuck in
unexplained lines" card in §15: a branch that excluded exactly what it existed
to serve.

A tax position is not something this product clears for you — we detect and
deliberately file nothing. But a product that will not file for you does not
get to hold your books hostage either. So the exposure is now **acknowledged
rather than resolved**: an escape hatch below the happy path (F4), the figure
stays on `/compliance` until it is genuinely dealt with, and the close records
that the owner said they were handling it.

### 3.5 — The palette had three states and no way to pick one

Reported as a bug: the same account looked dark on one machine and light on
another. It was not a bug in the palette. `globals.css` has always keyed dark
off `[data-theme="dark"]`, light off `[data-theme="light"]`, and fallen through
to `prefers-color-scheme` when neither is set — but **nothing ever wrote the
attribute**, so every browser silently followed its own OS. Three states, no
choice: a Jakob's Law failure, since every product this audience uses has a
theme control and they will look for ours.

`lib/theme.ts` writes it now, and the three segments are System · Light · Dark
because there genuinely are three. Dropping System to save a segment would
remove the only option that keeps following the machine at dusk — and it is
the state everyone was already in.

- **The preference is not in the store.** That persists to `sessionStorage`
  keyed to a signed-in session, and "I prefer dark" is neither. It lives in
  `localStorage`, survives sign-out, and syncs across tabs via the `storage`
  event.
- **It is applied before first paint** by an inline script in the document
  head, because waiting for the bundle is one frame of white in a dark room.
  The same script sets `color-scheme`, without which the native date pickers
  in the journal and document editors stay light on a dark page.
- **It sits with sign-out, not in the business switcher** — appearance belongs
  to the person, not to the business. The mobile sheet carries it too, since
  the rail is desktop-only and would otherwise be the only route to it.

### 3.6 — The two controls in the top bar, neither of which worked

Reported from a screenshot. Both were in the cluster law A3 calls the product's
front door, which makes them the worst two places to have been broken.

**The bell was a counter with nothing behind it.** It rendered `Notifications: 6`
with a badge, and its entire behaviour was `router.push("/today")` — so from
Today, the screen it pushes to, it did nothing at all. A counter you cannot
open is a claim you cannot check. `NeedsYouBell` opens a panel now, and it
reads the **same `buildQueue` that Today renders**, so the badge and the list
cannot disagree about what needs you. Rows link to wherever the item is
actually settled; the ones with no deep link go to Today, where they are
resolved in place. Empty gets the achievement grade with no CTA (D1).

**Ask looked like it was falling off the top of the screen.** The input was
mounted flush against a panel with `overflow-hidden`, and the global
`:focus-visible` rule draws a ring 4px *outside* the field — so the top of that
ring was sliced off the moment you focused it. The panel is padded and no
longer clips itself. Two other defects fell out of testing it: at 375 the
panel was trigger-anchored and hung **22px off the left edge** (it is pinned to
the viewport below `sm` now), and nothing had ever checked that the answer
engine still ran from here — it does.

The lesson is the one from §15: the automated sweeps had all passed. Reachability
counted the bell as reachable because it had a handler, and the density and
overflow passes never focused a field.

### 3.7 — The class behind all of them: a claim with nothing behind it

Three separate reports turned out to be the same defect wearing different
clothes. Each one *said* something had happened, and nothing had.

| Where | It said | What was true |
|---|---|---|
| The bell | `Notifications: 6` | pushed to Today; on Today, nothing |
| Add a payee | "{name} is ready to pay" | stored nothing; the payee vanished on close |
| Accountant strip | "Sent to {accountant}" | downloaded a CSV to your own machine |

**Add a payee was the worst of the three**, because the sentence was the whole
point of the screen. Payees are derived from payment history (`derivePayees`
reads `entity.txns`), so a brand-new beneficiary had nowhere to live — and the
payment sheet's picker had no way to reach the add flow either, so paying
somebody new meant abandoning the payment, hunting a different tile, and
starting over. Now `sessionPayees` holds them, the picker leads with them
("added just now" instead of a fake last-paid date), it carries a *Someone new
— verify and pay* row below the list (F4), and verifying hands straight back
into the payment with the new payee selected. "Ready to pay" is true.

**The sweep that found none of this is itself worth recording.** Two of its
passes were reporting clean on pages they were never actually looking at:
`history.pushState` changes the URL without re-rendering the App Router, so
routes probed that way returned the *previous* page's DOM. Everything now goes
through real navigation and asserts the heading changed before believing a
result. A green check from a probe that tested the wrong page is worse than no
probe at all.

### 3.8 — What the other personas were hiding

The sweep in §3.7 ran entirely as the QSR owner, which left six pages unchecked
because they need a different persona or no session at all. Signing in as the
RERA developer found two more, and the second was the more serious.

**"the last 89days".** The very first sentence a new customer reads — the
post-analysis screen — had lost its space. This is the repo's own documented
hazard (`AGENTS.md`: Turbopack eats a JSX space after a `{expr}` that ends a
line), and it had been sitting on the highest-traffic screen in the product.
Both instances are template literals now. A DOM scan for a digit glued to three
or more lowercase letters found no others anywhere in the app.

**Signing in as a second customer inherited the first one's session.** `signIn`
only ever set the mobile number; `signOut` was the sole thing that cleared
state. So switching from one demo customer to another carried over resolved
queue items, closed periods, RERA certificate signatures, withdrawals and the
account application. It presented as a phantom bug: `/project` showed **₹0
eligible** and a permanently disabled withdraw button, which read like a dead
feature, and was in fact ₹2.3 Cr of a previous session's withdrawal bleeding
across. `BLANK_SESSION` is now shared by both, and signing in with a different
number resets. Demo state or not, one customer seeing another's actions is not
a thing a bank app may do — and it would have been read as a data-isolation
failure in a PNB demo.

Verified after the fix, all with real navigation and a clean store: `/project`
(₹2.3 Cr eligible → sign Form 3 → withdraw sheet), `/project/qpr` (a print
document, deliberately shell-less), `/bank`, `/try` (the sample analysis runs to
its result), `/apply` (entity → GSTIN fetch → Aadhaar eKYC → video-KYC slot) and
`/dispute/[id]` (reached the honest way — connect channels, open a short
settlement, open its pack).

### 3.9 — Two laws added

**Law H — touch.** A target is 44px on a coarse pointer and whatever the
density calls for on a fine one. Conditioned on `pointer`, never on viewport
width: a small window on a laptop is still a mouse.

**Law I — progress.** Any ritual with more than about three steps states how
far along you are, and completed steps move out of the way without being
deleted. A count and a bar cost one line and are the difference between a
checklist and a chore.

---

## Part 4 — Channels: the rail the money actually arrives on

Ajmal: *"marketplace recon, PG, POS, Shopify are the highlight features and
there is no nav for handling these."* Correct, and the state underneath was
worse than the missing nav.

**Three defects behind one feature.**

1. **No home.** Connecting was a modal on `/statement`, settlements were a
   section inside it, and a dispute pack was reachable only through a modal
   inside that section. §13's exact mistake, on the biggest revenue rail.
2. **Two rails worked; the rest were asserted.** `statement.ts` marked every
   gateway credit `Matched · Card takings · T+1` — 154 credits worth ₹56.5L on
   one persona, verified against nothing.
3. **The waterfall never reached the ledger.** The batch sheet showed
   ₹1,05,384 of commission and the books recorded only what landed.

### 4.1 — Matched has to mean verified

A new recon state, `received`: *"Arrived · fee not visible"*, neutral, never
green. It exists because the two honest answers were both wrong — `matched` was
a verification that never happened, and `unexplained` would deny that we know
exactly who sent it.

What each rail can claim is now a property of the rail, in `lib/channels.ts`:

- **report** — the settlement report gives a gross and every deduction, so
  expected-vs-received is arithmetic with order-level evidence.
- **law** — UPI carries **zero MDR by statute**, so the whole collection must
  arrive. A real check that needs nobody's portal, and one no competitor makes.
- **opaque** — a card, POS or COD fee is real and inside the credit. Without
  the portal we cannot see it, and the row says exactly that.

### 4.2 — One engine, N rails

`CHANNELS` is a spec table built the way `DOC_SPEC` was: eight rails, each a
row carrying rate card, cycle, report source, dispute window and verifiability.
Adding Cashfree or Meesho is a row.

It also corrects a tax error that had been shipping: a deduction labelled
**"TCS u/s 194-O"** — two different taxes welded into one nonsense name. TCS is
§52 of CGST; 194-O is income-tax TDS. And TCS does **not** apply to restaurant
supplies through an aggregator, because since Jan 2022 the aggregator pays that
GST under §9(5). Marketplaces selling goods take both. The spec encodes the
difference, so Zomato shows one and Amazon shows two.

### 4.3 — The sale is the gross

A settlement now posts what happened rather than what landed:

```
Dr Bank                 2,61,900
Dr Platform commission  1,05,384
Dr Input GST               18,969   ← claimable, and invisible before
Dr Advertising             29,047
Dr TCS receivable           4,391
  Cr Sales                        4,39,100
```

For Nadi Foods, connecting the reports moves Sales ₹1.41 Cr → ₹1.83 Cr, brings
`Platform commission` to life for the first time since Phase A (₹33,03,436) and
surfaces **₹5,06,993 of input GST credit the owner could not see**.

Gross only posts where the report is actually in hand. Without it the books
keep the net — inventing a gross is the Suspense mistake in reverse.
`books-probe` gained the gate: every batch's gross must equal its deductions
plus its net, order evidence must sum to the variance, and the books must tie
**both** with the reports and without.

### 4.4 — Two honesty bugs I built and caught on screen

Worth recording because both are the shape this codebase keeps producing.

- **The take rate was circular.** Deriving each rail's gross from its
  *contracted* rate makes the take rate equal the contract by construction, so
  Swiggy read `27.8% kept · 27.8% contracted` while showing ₹58,900 above
  contract on the same row. `channelView()` builds rails and settlements in one
  call now, against the grosses the ledger uses.
- **"Above contract" was claimed without the evidence for it.** A dip below the
  usual pattern is visible from the bank alone; calling it a *rate breach*
  needs the rate card, which needs the report. The label follows the evidence
  now — *"Below your usual"* until a report is connected.

And the red *"3.8% above contract"* on a rail row was removed entirely: most of
that gap is ads the platform netted off, which they are entitled to do.
Inflating a real finding with a legitimate deduction is the same sin as the
fake match. The over-charge is stated in rupees, with orders behind it.

### 4.5 — Disputes stop being forgotten

The pack was generated and then nothing remembered it existed. There is a
register now — drafted · sent · recovered — and every row carries the window,
because an aggregator stops accepting a claim after 30 days and *"9 days left
to raise it"* is the most useful thing we can say.

### 4.6 — A sixth persona

**Kaaya Naturals**, a D2C skincare label, exists because Shopify, Amazon and
courier COD have no plausible home on a restaurant or an interiors firm. Five
rails at once — Razorpay behind a Shopify storefront, Amazon fortnightly,
Flipkart weekly, Delhivery COD, and a Pine Labs machine at a weekend stall.
₹87.8L in over 90 days, none of it paid by a customer directly. It is the
persona that makes the marketplace-recon argument to PNB.

### 4.7 — One hook, because ten copies is ten chances

Ten pages each hand-assembled the same `buildBooks` options bag. Connecting a
channel now changes what the ledger records, so a page that forgot to pass it
would report a different Sales figure from the page beside it — the
"two calculations of one fact" shape, pre-loaded. `useBooks()` assembles it
once; 216 lines went.

---

### 4.8 — Three ways in, and the finding a bank statement cannot produce

Prompted by a teardown of **Cointab** (notes in `research/cointab/`), the
closest direct competitor: $149–$749/month, file-in and Excel-out, nineteen
recon modules, and **no bank connectivity at all**. Their one public review —
3.0 on G2 — reads *"Not interactive UI, but backend is strong"*, the same shape
as the Open.money finding.

Two things came out of it.

**The gap they have and we did not.** They reconcile *internal vs external*; we
only had *bank vs external*. A platform that never remits an order leaves **no
bank line to be suspicious of** — there is nothing for a statement-first
product to find. That is the floor a bank-only view cannot get under, and it is
where an SME loses the most.

`lib/orderbook.ts` closes it. With the owner's own order book beside the
remittance, Kaaya Naturals shows **₹63,240 delivered and never paid for** —
₹33,550 still claimable, **₹29,690 whose window has already closed.** Both
halves are stated: money already lost cannot be recovered by connecting today,
and hiding it would make the claimable figure look like the whole problem.

**Three routes in, each honest about its cost.** Connecting was a fake toggle;
it is now a real choice, recommended-first and never more than three:

| | Effort | Freshness | Brings |
|---|---|---|---|
| **API** | keys | always current | settlements only |
| **Agent** | one install | refreshes daily | both reports |
| **Upload** | 2 minutes | stale on arrival | whichever you drop |

The agent route is the one worth reading twice. `agent-browser` runs **on the
owner's own machine** and drives the portal with the session they are already
signed into — no password is typed into this product and none is stored. That
is the only shape in which a bank can ship "we sign in to your Amazon account",
and it is why it is offered at all.

Each route is honest about what it *cannot* bring: a settlement API returns
settlements, so the order book still needs the report or the agent, and the
rail page names that gap (D5) rather than leaving it blank. Sources merge —
connect by API today and upload the order file tomorrow, and the rail holds
both.

**A plural bug caught on screen**: *"1 days on the soonest"*. `plural()` has
existed since Phase C precisely because hand-rolled plurals had already shipped
three of these.

### 4.9 — The first run, read against the Peak-End Rule

The article's sharpest point is the one easiest to skip: **"people recall
negative experiences more vividly than positive ones."** Day one is therefore
won more by removing small humiliations than by adding delight.

**The premise correction first.** A new client is never dataless. The bank
already holds 90 days of statement, so the product opens on a number while
Vyapar and Open both open on an empty form. That is the whole differentiator,
and it means the first-run job is not "handle no data" — it is "choose which
number to lead with".

**The negative peak was real, and it was ours.** `analysis.ts` hardcoded the
action string, so the D2C brand's biggest first-run figure — ₹16,31,700, the
largest thing on the screen — read **"Connect Swiggy & Zomato"** for money that
came from Amazon and Flipkart. `statement.ts` tested `/BUNDL|ZOMATO/i`, so the
channels strip never rendered for her at all. On the one screen whose entire
job is to prove we read the statement, naming the wrong platforms is not a
wrong label — it is a broken promise, delivered at the moment of maximum
trust. Both are derived from the statement now.

**Four findings of equal size is not a peak, it is a to-do list** — and a
to-do list is what every competitor already opens with. One number at hero
weight with its working, then "Also worth knowing" for the rest.

**Two personas had no peak at all.** The commissary and the RERA developer
produce zero findings, so their first screen was "All clear, Sudhir — 32
transactions, every one explained": truthful, and forgettable. A clean business
now gets the balance floor — **₹3.29 Cr, the lowest it went all quarter, which
is what a lender actually prices on and no owner has been shown.** It needs
nothing but the statement already in hand. Where the walk-back cannot be
trusted (the commissary sees only some of its accounts) it stays silent rather
than draw a floor it cannot stand behind.

**The end has to pay off its own peak.** The CTA was chosen by `mode`, so a
developer shown a ₹3.29 Cr floor was then offered *"See who owes you"* — a
different errand from the fact just given. Peak and end are the two moments
anyone remembers; making them disagree wastes both. The handover now comes from
the top finding, and its sub-line is a **payoff rather than provenance**: it
read `peak.evidence` — "7 credits · last 30 days", a footnote — and now reads
*"₹1,11,800 already looks over-charged"*.

Reusing `buildBalance` mattered: a second walk-back written for this counted
internal transfers and drove the floor negative, which is the
"two calculations of one fact" trap for the fifth time. And a plural bug in the
oldest finding on the screen — *"1 invoices past due"*.

**And it persists on Today**, for anyone who skips the handover — but as its
own dismissible strip, not a queue item, because it was one and should not have
been. A queue item is a decision only this person can make and it clears when
they make it; its resolved line read *"Noted — we'll keep tracking it"*, which
is untrue of a rail — noting it connects nothing. Connecting is an unlock, so it
sits above the queue, states their own number first, names the real platforms,
and has two honest exits: dismiss (persisted) or connect, after which it is
gone for good. Nothing appears twice on the screen.

`buildQueue` carried the same hardcoded href map the sign-in screen did, so
channel findings on Today were still being sent to the statement's old connect
modal. It reads `f.href` now — one copy of that fact, on the finding.

---

## §16 — The statement as a table (C11, C13, D4)

Ninety days is 244 lines for Nadi Foods, and the statement rendered all of them
into one unbounded scroll with no header, no count and no way out to a
spreadsheet. Three laws were simply absent.

**C11 — the footer triad.** `components/ui/TableFooter.tsx`: the range in the
list's own noun on the left (*"51–100 of 244 lines"*), the pager centred, the
page size right. Both the range and the pager disappear on a single page — a
pager with one page is furniture, and *"1–16 of 16"* says less than *"16 lines"*.
The page number is stored **with the narrowing it belongs to** and believed only
while that still matches, so filtering down to two pages cannot leave you on
page five. An effect that corrected it afterwards would have fired after a
render that already drew the empty page — and the lint rule that forbids
`setState` in an effect is pointing at exactly that.

**C13 — two filter tiers.** Tier 1 stays the four view pills. Tier 2 is new: a
scoped search, a low-contrast `+ Add filter` builder producing removable chips,
and the export. The builder offers a field only when the window holds more than
one of its values — narrowing to "UPI" on a statement where every line is UPI is
a control whose only possible outcome is the answer you already had.

I did **not** build `Save as` / saved views. In a frontend prototype the store is
`sessionStorage`, so a saved view would evaporate when the tab closed; the whole
point of saving a filter is that it outlives the session. Named here rather than
quietly skipped.

**D4 — the schema is information.** The header row renders with zero rows under
it. The search input is *removed* when there is nothing to search — but
"nothing to search" means the **window** is empty, not that the filter matched
nothing: a filter that emptied the table must keep the input that undoes it.

**Two real bugs found while wiring it.** The Ask bar did double duty — it
answered on Enter and substring-filtered as you typed, so `?q=Sharma` from three
other screens landed in the question field looking like a question nobody had
answered. `?q=` now fills the table's own search box. And the filter chain did
`return answer.match(row)` early, so asking a question silently discarded the
pill you had set while the pill stayed lit, claiming otherwise. Every narrowing
composes now.

**Export was three copy-pasted writers.** `lib/csv.ts` is one, and it had to be:
two of the three quoted their cells and the third did not, so a party called
`Sharma, Sons & Co` shifted every column to its right in that one file —
silently, because a CSV with the wrong column count still opens. `scripts/csv-probe.ts`
gates the escaping and asserts every statement line becomes exactly one row with
raw numbers, not formatted rupees. `ledgerCsv` moved out of `close.ts` because
the statement needed the same rows, and a second serialiser would have been a
second answer to "what is a statement line, in a spreadsheet".

## §17 — Retreat, park, advance (E8)

`components/ui/SheetFooter.tsx`, adopted by all five intent sheets: the doc
editor, the journal entry, the channel connect, the sweep mandate and both
payment stages. Pinned outside the scroll area, which is the whole point — the
sweep sheet is four decisions and a consent line, so *"Authorise the mandate"*
was the first thing to leave the screen on a phone, and the payouts sheet had no
height limit or scroll region at all: a tall stage simply ran off the bottom
with the commit on it.

Retreat **names its destination** ("Invoices", "Books", "Change payee"), not the
act of leaving. Advance keeps the label it will carry when enabled and states
the reason beneath it — `Button` sets `pointer-events-none` when disabled, so a
`title` on it could never be read by anyone, which is D5's point exactly.

**Park had to be made real.** `DocStatus` had declared `"draft"` since Phase A
and nothing produced one, nothing displayed one, and nothing excluded one — so
the first document ever parked would have posted to the ledger, sat in
receivables and gone into a GST return. That is the same shape as the bell and
the "matched" PG credits, waiting to happen on money. So `buildBooks` splits
`docs` from `drafts` at the boundary rather than asking each of the seven
readers to remember, `saveDoc` upserts by id so parking then finishing does not
leave two, and numbering sees both so a parked number is never handed out twice.
A parked document says "Not issued", is excluded from every total, and reopens in
the editor rather than the detail sheet. The probe asserts the trial balance is
identical with and without one — and I broke the filter on purpose to confirm
that assertion can fail.

Park is offered **only where it is real**: the journal sheet has no draft state
to save into, so it gets retreat and advance and no third button. And parking
needs less than issuing — a name alone is enough to come back to.

Two duplications fell out: the payee card's inline "Change" (the footer's
retreat is that same action) and a footer hint repeating the shield line's
"Cancel any time".

---

## §18 — Today read like a memo (law G2)

Flagged from a screenshot: *"so much sentence here, will it overcomplicate and
customers will hate this."* Measured on the live screen — Nadi Foods, 1440×900 —
**282 words**, **10 lines of 8+ words**, **9 grey sub-lines of 6+ words**.

The instinct was right. The reflex to cut substance would have been wrong: *"30%
of the expense is disallowed"* is the whole reason a busy owner acts on a TDS
figure rather than scrolling past it, and a calm useless screen is worse than a
wordy one when there is a statutory deadline on it. So: compression,
de-duplication and ranking, with every number and every consequence still on the
page.

**Four defects, not one.**

1. **The headline and its sub-line said the same thing twice.** `₹1,11,800 looks
   short-settled against your own weekly pattern` sat directly above `4
   settlements vs 13-week median` — the mechanism in prose, then again in
   numbers. The numbers are the better version. Title is now `short-settled`.
2. **The clear sentence was in the small grey text and the clever one was in the
   headline.** `42 salaries paid, nothing statutory behind them` — which nobody
   parses on sight — over `PF, ESI and professional tax carry arrears and 12%
   interest`, which anyone does. Same inversion on ITC. The plain wording was
   already written; it was in the wrong slot.
3. **₹1,11,800 was printed twice, 700px apart** — channel strip and queue item —
   against the one-fact-per-screen rule, and mine, from §17's ConnectPrompt. The
   fix is structural rather than editorial: the component no longer *receives*
   the shortfall, so it cannot print it. A removed prop beats an assertion.
4. **The product talked about itself.** `we cannot see the fees inside it`,
   `Detected from your own payment rhythm`. The owner needs "fees not visible",
   and needs to know the forecast is a guess — `Predicted, not scheduled` — not
   how the detector works.

**Why nothing caught it.** Every one of those strings was written to be *honest*:
state the mechanism, cite the evidence, do not overclaim. Each is defensible
alone, and each was reviewed alone. Twelve defensible sentences in one column is
a wall, and no single edit ever looked wrong. The rule already existed; it drifted
because the books had a probe and the copy had nothing.

**The distinction that scoped it.** 54 strings of 9+ words across 19 files, but
they split cleanly: copy that **repeats** (queue, exposures, findings, insights —
read 5 to 12 times down one column) versus copy at a **one-time decision point**
(the consent screen, the browser-agent privacy line, empty-state bodies, disabled
reasons). Only the first is a wall. The second was left alone, and law G2 says so
explicitly, so the next pass does not "tidy" a consent disclosure into a fragment.

**The structural change.** Three `blocks the close` cards became one card with
three rows (`ExposureCard` → `ExposureList`): 290px of stacked frames down to
216px, `Blocks the close` said once as a group heading and shortened to `Blocks`
on the rows it is true of, three `Look →` buttons down to three row links.
Nothing moved behind a click — hiding a statutory deadline to save space is the
wrong trade. The heading deliberately carries **no total**: two of the three
amounts are read and one is modelled, and adding them is exactly the false
precision the rest of that file avoids. Rendering it as a table also exposed that
the one exposure whose figure is *estimated* was the only one showing no figure
at all; it leads with its amount now, beside the `Estimate` badge that makes
printing a modelled number honest.

**Result:** 282 → **215 words** (left column 223 → **142**), ten 8+ word lines →
two, both inside the prose budget. No repeated ₹ figure, no first person.

`scripts/copy-probe.ts` enforces it across all six personas and prints the
per-persona word count so it is tracked rather than felt. Each check was made to
fail on purpose — word budget, first person, and the restatement detector — and
its blind spot is stated in the file: it reads generators, so prose moved into a
component's JSX would pass.

---

## §19 — The right rail withheld two facts

Same pass, opposite finding. The rail was already dense — thirteen words of prose
across two cards, everything else data — so there was nothing to trim. Its problem
was the reverse: **it made you do arithmetic it could have done, and its hero
number overstated what you can spend.**

**The hero mixed usable and unusable money.** `Across 2 accounts · ₹7,96,550`
summed every account, including the Account-Aggregator-linked one holding
₹1,12,040. `sweepOffer` calls those exact rupees *"money we can see but cannot
use"* — so the landing page was counting as capacity precisely what another screen
offers to go and fetch, directly above a list of upcoming debits. `payable(entity)`
now names the distinction in one place.

**Six dated rows and no total (C7).** *Can I cover this* was left as homework.
There is a footer now: `Net of these 6 · ≈ −₹2.2L` and `≈ ₹4.6L left after these`,
turning into `≈ ₹2.4L short` in red when it is. `upcomingNet` takes the **rendered
items**, not the entity, so the total cannot disagree with the rows above it —
`sweepOffer` totals committed outflows over a different window for a different
purpose, and two numbers that mean roughly the same thing, computed twice, is the
shape this codebase has met five times.

**So the rail got longer, 59 → 70 words, and that is the right direction.** The
added words are two derived numbers and four labels. Density is not a word count;
it is words-per-fact, and withholding the fact that matters is not restraint.

**Two duplicates I introduced and the probe caught:**

- The coverage line first read `Covered by ₹6.8L available` — the payable balance
  printed a second time in compact form, directly under the card already showing
  `₹6,84,510`. It states what is *left* now, which is new information. The probe's
  duplicate check keyed on the **formatted string**, which is exactly how that got
  through; it keys on the raw rupee value now, and flags a `₹6,84,510` / `₹6.8L`
  collision.
- With one payable account the derived `available to pay` line **is** the account
  row beneath it. Gated on two or more.
- And with a single account full stop, `Across 1 account · ₹18,42,600` sat above a
  one-item list repeating `₹18,42,600`. The label names the bank instead, and the
  list is dropped.

**One false positive worth recording.** An ad-hoc DOM sweep flagged `−₹41,200`
twice on Nadi Commissary. Those are real transactions on the 17th and the 24th —
a weekly rhythm, told apart by their dates. The same amount twice is not the same
fact twice, and the probe deliberately ignores the recent-transactions list.

**One branch is reasoned, not seen.** No seed persona has two payable accounts
*and* a read-only one, so the `available to pay` line does not render for anybody
today. It guards a real shape — two current accounts plus an AA-linked one — and
is left in with that stated rather than deleted or claimed as verified.

---

## §20 — The same pass, every page

A route-by-route browser sweep at 1440 and 375, measuring prose words per line
rather than tokens. **Before: 30 lines of 8+ prose words across 20 screens.
After: 4, across 3, every one exempt by the law itself.** Total copy 3,397 →
3,258 words, and no page lost a number or a consequence.

**One pattern accounted for most of it: the page subtitle.** Nearly every screen
carried a 10–13 word line under a title that already said the same thing —
*"Every rupee in and out, matched to who and what it was for"* under **Statement**,
*"Every account in one place — what you hold, and how it got there"* under
**Balance**. Read once each, but you meet one on every screen, so it is a
repeating shape wearing a one-off's clothes. They are now five to seven words and
say something the title does not, or they are gone.

**The rest was the same three faults, in new places:**

- **Pointers at content directly below.** *"What each one kept is below."*
  *"Every figure here comes from a bank credit you can open."* Deleted — the
  thing below is below.
- **First person.** *"the account we read every morning"*, *"we match the money as
  it arrives"*, *"money we can watch but not use"*, *"once we have watched a few
  months"*. Gone from every SME screen.
- **A badge and its row saying the same thing.** The team page put `Owner` in a
  badge and *"Owner — sees everything…"* in the detail beside it.

The worst single line was the statement's settlement-home sentence at **23 prose
words**, explaining why an account read every morning catches short payments. It
is 13 now, and the reconcilable/not-reconcilable half is a state rather than an
essay.

### What was left alone, and why

The law budgets copy that **repeats**. A sentence read once, where it decides
something, is the correct shape — so these stayed:

| kept | why |
|---|---|
| The sweep mandate's body | one card, one decision, explains how a mandate works |
| `/cards` limit consequences | E1 — the helper states what the control will do |
| Empty-state bodies (D3) | *"A limit is one month of matched inflow, after a few months of history"* is the only useful thing to say when there is no offer |
| "How this works" entries | the density rule's own prescribed home for reasoning |
| Consent screens, `/try`, `/apply` | disclosure and pitch, different job |
| Printables — dispute pack, close report, QPR | documents, not screens |
| `/bank` | the internal PNB console. A different reader with a different register, and trimming a guardrail claim to fit a word budget would weaken a compliance statement |

### The blind spot is closed

`copy-probe.ts` now scans `.tsx` source as well as the generators, because the
generator checks could never have seen any of the above. It is a regex over
source, not a parser — coarser, and it will miss prose split across
interpolations, which is stated in the file rather than implied.

It deliberately does **not** apply the row budget to source: a scan cannot tell a
repeating row from a one-time explanation, and enforcing 7 words there would
fight the copy the law explicitly protects. It looks for **walls** — 12+ prose
words — plus first person, which has no exemption outside consent. Three strings
are allowlisted individually, each with its reason written next to it, so adding
a fourth is a decision somebody has to justify rather than a threshold somebody
quietly raises.

Verified failing on purpose before being trusted.

---

## §21 — The sheets, and three bugs in the probe that was checking them

Sheets had never been *rendered* and measured — the route sweep only ever saw
pages, and four sheet files were exempted wholesale from the source scan on
reasoning I had not tested. So each was opened in the browser, stage by stage, at
1440 and 375.

**The connect sheet was the worst, and for the reason the law predicts.** Its
three method rows are a repeated list, and their sub-lines had drifted into
sentences — one of which, *"Runs on your machine, signed in as you. We never see
the password"*, repeated the consent paragraph two stages later almost verbatim.
The paragraph is the right place for it; the row was the duplicate. Also trimmed:
the two upload-slot hints (another repeated list), a numbered step that said
*"hands them to us"*, the CSV hint, the header sub, and a 19-word explanation of
what a settlement API cannot bring.

The consent paragraph itself stays at 17 words, allowlisted by exact string with
its reason: it is a privacy disclosure read once, at the moment access is handed
over, and it is the only shape in which a bank can ship *"we log into your Amazon
account"*.

Elsewhere: the rules panel called itself *"Deterministic rules, not a black box"*
and promised *"we'll offer to make it a rule"*; the settlement waterfall said
*"Every order is listed below"* above the table listing every order; the channels
empty state ran to 21 words and found them *"in your statement"* on our behalf;
the sweep floor cited *"standing instructions we can see"*.

**Then the probe checking all this turned out to have three bugs of its own.**

1. **It was line-anchored.** Prettier wraps prose at 100 characters, so the
   pattern could only ever match prose *short enough not to wrap* — precisely
   backwards. A 21-word empty state sat unflagged.
2. **Template literals were skipped** for containing a brace, so any string with
   an interpolated platform name was invisible.
3. **The worst one: a minimum length inside the pattern broke delimiter
   pairing.** A short literal fails the length test, the scanner advances, and
   the next match runs from that literal's *closing* backtick to the following
   literal's *opening* one — capturing the JSX between them and, far worse,
   consuming the opening delimiter of the next real string. Long copy was skipped
   entirely and the probe reported clean.

Delimiters are matched with no length requirement now and filtered afterwards,
`${...}` is stripped before counting, and anything still holding `{}<>=` after
that is rejected as code. The fix immediately surfaced the 19-word API line the
previous version had been reporting OK over.

**Which means an earlier "COPY OK" in §20 was partly false confidence.** Recorded
here rather than quietly corrected: a probe that cannot fail is worth nothing, and
one that fails to *notice* is worth less than nothing, because it is trusted.

**What is left, and why.** Every remaining flagged line is 9–11 prose words at a
one-time decision point, which is where the budget stops applying: the disabled
reason on the document editor (D5), the penny-drop explanation before verifying a
payee, and the drawdown disclosure — *"a miss is reported to the credit bureau"*
stays a sentence, because shortening it to "affects your score" would soften a
fact the borrower is entitled to read in full.

---

## §22 — Ask moved to the bottom

The answer engine sat in the top bar, borrowed from Brex, where a search field
means *"filter a list"*. Ours does not filter — it answers and shows its working
— and every conversational product an owner already uses puts that input at the
**bottom**. Jakob's law: the shape should match what the thing is, not where a
different pattern keeps it. It is also a Fitts win, because on a 90-day statement
the eye is 600px down the page and the trigger was a 32px icon in the top-right
corner, the longest and most precise trip on the screen, for the one feature the
product is built around.

**Placement differs by breakpoint, because the bottom does.** Desktop gets a
centred floating pill. Mobile gets the **centre slot of the tab bar** — the thumb
zone there is already the nav, and a pill floating above it would have covered a
strip of every screen permanently on the smallest one. `MOBILE_PRIMARY` drops to
three so the bar still holds five targets at full width; Sales moves into More.

**The glow is on hover and focus only.** Never persistent: this system allows one
accent per surface (B1) and spends it on the amount that matters, so a control
lit all the time would take that from the ₹1,37,632 it is meant to mark — and a
distinct thing that is always on stops being distinct (Von Restorff). It is a
PNB-maroon bloom, not a multicolour ray; that ray is somebody else's brand and
would read as a toy on a bank.

**Three things fell out of the move.**

The statement's own in-page Ask bar is gone — two ask inputs 400px apart on one
screen is the same fact twice, and the floating one is the better of the two.

Deleting it orphaned the answer-driven row filter, and `See it in the statement`
had always pushed a bare `/statement`: the label promised filtered lines and
delivered an unfiltered page. It carries `?ask=` now and the statement **re-runs
the same `ask()` over the same rows**, because a predicate does not survive a
URL but the question does. 86 lines → 9, and Clear restores.

And `lib/ask.ts` still told everyone to *"Connect Swiggy & Zomato"* — the
hardcoded-platform bug fixed twice before, in the last place still carrying it,
now on every screen. Kaaya Naturals reads *"Connect Amazon and Flipkart"*.

**Worth recording: tsc, lint, build and all three probes passed on a statement
page that crashed on load.** The derived `answer` was declared below the filter
that reads it — a TDZ error, invisible to every static gate, caught only by
opening the page. The probes do not render, and this is the second time in this
sequence that only the browser found the real failure.

---

## §23 — The channels feature was claiming things it could not know

Asked to look at marketplace recon end to end. The UI faults were real, but two
integrity defects sat underneath them and had to go first.

**A printable claim letter, generated from nothing.** With zero rails connected —
`channelsConnected: {}`, `channelSources: []` — `/dispute/AMZ-20260701` rendered a
document headed *"Settlement variance claim"* carrying the company's GSTIN, the
real bank UTR, the settlement account and **79 order rows**: order IDs, item
totals, contracted versus charged fee, per-order shortfall. Every order ID came
out of a twelve-value array and index arithmetic in `buildOrders()`.

The statement page had gated this correctly for months
(`connected ? buildBatches(entity) : []`). `channelView()` never did, so all three
channels screens and the pack ran ungated. This is the rule the whole codebase is
built on — *matched has to mean verified or it means nothing* — broken at the
highest stake in the product: a letter an owner could actually send to Amazon.

**`buildBatches` now takes a required `HasReport`.** Required, not optional, so
the compiler names all thirteen call sites and each has to state its position.
`reportHeld()` in `channels.ts` is the one definition of "we hold this rail's
report", and `buildChannels` and `buildBatches` finally share it — the overview
could previously show a ₹30,600 claim for a rail whose own page said "not
connected", because the two answered that question separately.

`books-probe` asserts it: no batch, no order row and no ledger movement for a
rail with no report. Broken on purpose first — 25 batches and **266 fabricated
order rows** on one persona.

**The same fabrication was on the acquisition screen.** `/try` told a visitor who
had uploaded a bank statement that we had checked their settlements *"against the
platforms' own rate cards"* and found money "kept beyond the contracted rate".
There is no rate card without the platform's file. It now says what a statement
genuinely proves — these came in below what this platform usually pays — which is
still the hook, and is the reason to go and get the report.

### Claim and suspicion are different facts

Removing the fabricated claims left the cold screens empty, which was the wrong
correction: a settlement below its own trailing median IS visible from the bank
alone. So `bankOnlySuspicion()` states that, and only that — no gross, no orders,
no batch. The rails list renders a claim in the alert colour and a suspicion in
ink as `₹30,600 light`, because one has evidence behind it and the other is a
reason to go looking.

The dip rule itself now lives in one place. Three copies of the same `0.95`
existed — the batch builder, the analysis finding, and nearly a third here.

### Two more that fell out

**Absence at hero weight (D6).** Cold, the overview read **"Platforms kept · ₹0"**
at 20px with "not visible yet" beneath in 11px. A big ₹0 there says they kept
nothing, which is the opposite of true, and is precisely the failure the law was
written for. It reads *Not visible · inside 5 settlements — the reports break it
out*.

**An achievement shown to someone who had checked nothing.** The disputes empty
state said *"Every settlement came in at the contracted rate"* with no rail
connected. Nothing found and nothing looked for are not the same fact.

### What this does not fix

The take rate is still a constant. `buildBatches` reconstructs gross as
`expectedNet / (1 − contractedTake − 0.03)`, so every rail lands at 30.7% kept
against 27.7% contracted **by construction** — the 3.9-point gap is arithmetic,
not a measurement. That is the next phase and it needs the seed to carry a
reported gross independent of the rate card.

Research also puts industry leakage at 2–5% of marketplace revenue against the
0.6% this finds, because a settlement report carries five to nine rows per order
and there are seven distinct ways a platform underpays. The plan for both is in
`~/.claude/plans/marketplace-recon.md`.

---

## §24 — The take rate becomes a measurement

§23 left the hero number as arithmetic: gross was reconstructed as
`expectedNet / (1 − contractedTake − 0.03)`, so every rail landed on the
contracted rate plus a constant. "31.6% kept · 27.7% contracted" could not
reveal anything, because nothing about the platform's actual behaviour was an
input to it.

I expected this to need a seed change. It did not — it needed the **3% to stop
being a constant**. Ad spend is the real reason a platform's take moves period to
period, and it is legitimate: they are entitled to net it off. `adsRateFor()`
gives each rail and date a deterministic 1.2–6.0%, independent of the rate card,
so gross follows what was *actually* kept rather than what was agreed.

Amazon's six fortnights now read 30.5 · **36.8** · 30.6 · 31.9 · 30.7 · 32.0.
The 36.8 is the short-settled period standing out from its own baseline, which is
what a take rate is for.

**The gap over contract is now split by whose it is.** The row said "27.7%
contracted + ads", lumping a legitimate deduction together with an overcharge and
naming neither. It reads `27.7% contracted · 3.6% ads · 0.8% over`, with only the
last in the alert colour — an owner cannot act on the difference until the two
are told apart.

### The bug the constant was hiding

Narrowing the plug broke the books immediately: `Unbalanced entry je-bank-t119:
Dr 230813 ≠ Cr 229800`.

`contractedTake()` returns a rate, so it sums only the percentage-of-gross lines
— but Swiggy and Zomato also levy a flat ₹5,400 packaging charge, which
`deductionsFor` duly charged. Gross had been reconstructed from the rate alone, so
the flat fee came out of the ads plug. At a hardcoded 3% the plug was wide enough
to swallow it; at 1.2% it went negative, `if (plug > 0)` silently dropped the
line, and the identity `gross = deductions + net` broke.

So the settlement builder had been wrong since it was written, and a generous
constant was the only thing keeping it consistent. Gross now solves for the flat
term explicitly: `gross = (expectedNet + flat) / (1 − take − ads)`.

### The assertion that was too weak

The first version of the probe check measured the take-rate spread across **all**
of a rail's settlements — and passed on the old, broken code, because the
short-settled period lifts the take on its own. It was measuring the dip it
already knew about rather than the constant it was written to catch.

It now measures only the settlements that came in exactly as expected, which are
the ones that were identical. Against the old code those spread by 0.01–0.08
points across five rails; the assertion trips at 0.3.

---

## §25 — A settlement is not a claim

The recon engine had exactly one finding: a settlement that came in below its own
trailing median. Research on Indian marketplace settlements puts industry leakage
at 2–5% of marketplace revenue; this product was finding **0.6%**, because "the
total was light" is a symptom with at least seven distinct causes and we were
reporting the symptom as though it were the finding.

Three of the seven are now built, and only three. A leak type needs evidence a
reader can act on — an order ID, a rate, a date — and a stub that produces a
plausible rupee figure with nothing behind it is §23's fabrication one level up.

| kind | window | needs |
|---|---|---|
| `commission_above_slab` | the rail's own | settlement report |
| `fee_on_zero_fee_item` | 60 days | settlement report |
| `delivered_not_remitted` | 15 days | the owner's order book |

### What the split actually revealed

Amazon's single "**₹30,600 over · 2 days left**" is two claims:

- **₹19,888** charged above the contracted slab — 2 days left
- **₹10,712** referral fee charged on items Amazon zero-rated below ₹1,000 — **32 days left**

They go to different desks with different evidence. Reported as one line, the
*stronger* claim inherited the *weaker* one's deadline and would have been
abandoned a month early. That is the whole argument for the taxonomy, and it fell
out of the first persona rather than being designed in.

Windows belong to the claim **type**, not the platform. A single
`disputeWindowDays` on the rail could never have said so.

### Four drifts the taxonomy exposed

Every one was two calculations of one fact — the shape this codebase keeps
meeting.

1. **`hasOrders` was inlined in three pages**, and the inlined version read
   `orders || aggregatorsOn`, which hands an order book to Amazon the moment a
   Swiggy connection exists. Unremitted orders are *invented from that
   predicate*, so it prints order IDs for a book nobody gave us. Now
   `ordersHeld()`, beside `reportHeld()`.
2. **The dispute pack quoted a rate that did not exist.** `batch.channel ===
   "Swiggy" ? "22%" : "24%"` — a literal, on the one page a merchant sends to the
   platform's disputes desk. Amazon's own rate card adds to 25.7%. It reads
   `contractedTake(spec)` now, and the letter argues both grounds separately
   instead of calling 25 zero-rated orders "commission above the contracted
   rate".
3. **The sub-nav counted rails while the register counted claims** — "Disputes ·
   2" beside a list saying "5 claims across 2 rails". One `openClaims()`.
4. **The statement said "Amazon · not connected"** for a rail whose report it was
   already reading, because the strip consulted the aggregator toggle rather than
   `hasReport` per rail. It also called ₹54,700 "recoverable" when ₹35,140 of it
   was past its window — a promise that screen cannot keep. It states what it can
   see: *short across 2 settlements*.

### Proven and expired is a third state

A rail with a closed-window claim used to fall through to "₹24,100 **light**" —
the word for a hunch — on a rail whose report we hold and whose orders we can
name. Three states now: claimable (alert), `missed` (ink, nothing left to do),
and `light` (a suspicion, and a reason to fetch the report).

### The probe

Two assertions, each **proven to fail first**:

- leaks off one settlement must sum to its variance → dropping the zero-fee
  bucket reports `leaks sum to ₹19,888, variance is ₹30,600`
- two kinds off one settlement must not share a deadline → forcing the rail
  window on both reports `2 claim types share one window`

Plus: no leak with nothing connected, no leak whose evidence restates its title.

### What only the browser caught

The gates were green on copy that printed a raw ISO date (`zero-rated since
2026-03-16`), an unformatted `₹1000`, and — on every row — a title restating its
own type badge: *"Flipkart charged above your contracted rate"* next to *"Fee
above the contracted slab"*. That is law G2's restatement failure in a slot the
copy probe does not read. The row is now amount · rail · type.

One near-miss in the other direction: I added `pointer-coarse:h-11` to `Button`
after measuring 28px targets at 375px, then found `globals.css` already enforces
44px globally — the desktop browser just reports a fine pointer. Reverted. The
fix for "two rules for one fact" is not a third rule.

---

## §26 — The screens follow the model

§25 gave the engine typed findings. The three screens were still shaped around
the old one — a ledger of settlements, ordered by size.

### The register becomes a pipeline

Sorted by amount, a ₹24,100 claim whose desk shut weeks ago sat above a ₹19,888
one with **two days left**. The register's whole job is *what do I do today*, and
it was answering *where is the most money*.

Open claims now run soonest-deadline first (`byUrgency`), and the closed ones are
a separate group under **Past their window** — kept, because they are the
argument for connecting sooner, but out of the way of the ones that can still be
acted on. An expired row carries no lifecycle verb at all now, rather than a
disabled "Too late to raise" beside a line that already says *window closed*.

### The rail page answers before it explains

It opened with the rate card, then six settlements — five of them saying "As
contracted". The one finding that mattered was reached by scanning past four that
did not.

Order is now: **what we found** (₹48,220 not paid to you · 4 claims · ₹37,180
still open) → **what the contract lets them keep** → **every settlement**, with
the C11 footer triad it never had.

The ledger row used to read `₹30,600 short` while the two claims composing that
figure sat itemised four inches above — one fact, twice on one screen, in two
groupings. It says `2 claims` now: the count is the link between ledger and
findings, and the money is stated once, where it can be acted on.

### The overview ranks by what is worth doing

Rows ran in money order, so a rail with a claim expiring in two days sat wherever
its revenue put it. Rank is now claimable → looks light → never checked →
nothing to do.

Only the **content** is reordered. The sub-nav stays in money order: an index
that rearranges itself every time you mark a claim recovered is not an index.

### "Not visible" was the wrong kind of honest

D6 established that `₹0` lies when nothing is connected. It does not follow that
a refusal is the only truthful answer — the rate card and the credits are both in
hand, so the number is derivable. `unverifiedKept()` states it, every caller
marks it as an estimate, and the rail's own page had been printing exactly this
figure all along while the overview said "Not visible" one click away.

Cold, the overview now reads `Platforms kept · ≈₹16L · From the rate card, no
report yet`, and each unconnected row carries its own share — `≈₹71.6K kept ·
Unchecked · Razorpay dashboard`. A CTA weighted by what it would reveal.

The first version of this printed the estimate in the footnote *and* left "Not
visible · inside 5 settlements" in the slot above it — the same fact twice, which
is the defect this section is otherwise about. The footnote now renders only when
some rail is measured and some is not, which is the only case where it adds
anything.

### `LeakRow`

Two screens render a claim. They had drifted apart within an hour of each other —
one had learnt that the title and the type badge said the same thing twice, the
other had not. One component, `showChannel` off on a rail's own page, `onAdvance`
absent where the list is read-only.

---

## §27 — The connect sheet earns its ask, and a phantom finding dies

The sheet listed two reports and never said what either one buys — a form asking
for work with the payoff left to inference.

Each slot now names the checks it switches on, read from the leak table itself:

- **Settlement report** → fee above the contracted slab · fee on a zero-rated item
- **Order report** → delivered and never paid for

`checksUnlockedBy()` derives these from the same `SPEC` the findings come from,
so the sheet cannot promise a check the engine does not run — and a fourth leak
kind updates the pitch by construction.

The header states the stake at the moment it is being decided: the suspicion
where the bank can already see one (`₹30,600 already looks light`), the rate-card
estimate otherwise (`About ₹8.9K kept, never checked`). No number is offered for
what the order book would reveal, because we cannot know it until we have it, and
inventing one is the fabrication problem the whole feature is built against.

### The finding that was arithmetic

Opening that sheet on Razorpay surfaced this, three screens deep:

> **₹1,26,100 below what Razorpay usually pays** · 39 settlements below its own
> history

Out of 90 credits. A T+1 gateway credit is one day's takings, and days differ —
roughly half sit below the trailing median *by construction*. The test is sound
for a weekly batch of hundreds of orders and pure noise here. It was the largest
number on the page.

The overview had never shown it, because `suspicionsFor` gated on the rail being
report-verifiable and `bankOnlySuspicion` did not. Two gates for one question, so
one screen said ₹1.26L and the other said nothing. The gate now lives inside
`bankOnlySuspicion`, where both callers meet it.

Two assertions, both proven to fail first — removing the gate reports:

```
↑ Kaaya Naturals/razorpay: rail page says 126100, overview says 0
↑ Kaaya Naturals/razorpay: ₹1,26,100 suspected on a rail that settles net
↑ Nadi Foods/bharatpe:     ₹2,00,200 suspected on a rail that settles net
```

Three rails across two personas were doing this. It is the §24 lesson again in a
different costume: a number that cannot help being large is not a measurement.

---

## §28 — The rail that stopped paying

Two bullets from the recon plan were still open, and both were versions of the
same thing: an unconnected rail said nothing about itself.

**It now says what it would look for.** `What the report would check` lists the
checks by name, from the same leak table the findings come from — so the page
cannot advertise a check the engine will not run. On a rail with no order book,
the third is labelled *needs your order report*, which is the honest split.

**And it says when the money stopped.** Delhivery COD's last credit was 12 June,
47 days before the anchor, on a rail that had been remitting every 7 days. The
row printed `last 12 Jun` in the same grey as every other date — a courier that
quietly stops remitting looked exactly like one that paid on Tuesday. It is the
largest possible version of "delivered and never paid for", and one of the few
findings the bank statement can produce alone.

`silentFor()` measures the threshold against the rail's **own median gap**, not
its declared cycle — three missed cycles, floored at three weeks so a T+1 gateway
does not cry over a long weekend. Across Kaaya's five rails exactly one fires.
Staleness had only ever been checked on the *report* (`lastRun`), which a rail
nobody has connected does not have.

A silent rail now outranks one that merely looks light: money that stopped
arriving beats money that arrived short. And the flag appears on both the
overview and the rail's own page — the first version had it on the overview only,
which is the §25 drift in miniature, on the page you land on to act.

---

## §29 — Audited against a competitor, and four things it found

Axis Bank's internal deck for **Neo One** and a prototype of its sole-proprietor
dashboard. It is this product's thesis built for another bank: the bank account
is the one data source needing no integration, same four modules, in places the
same words — *Smart Statement*, *auto-prepared*, *Share with CA*. Even the brand
hue is nearly ours (`#97144D` against `#9b1240`).

Extracted, served locally, walked at 1440 and 375. Rendering changed the verdict
in both directions.

### The verdict

**v2 is the right product for this customer; theirs is the better pitch.** Those
are different competitions.

| | Axis | v2 |
|---|---|---|
| At 375px | **522px document in a 375 viewport**, sidebar fixed, 2–3 words a line | bottom tab bar, no overflow |
| Dark mode · `:focus-visible` · `aria-*` | none · 0 · 0 | full · 4 · throughout |
| Interactivity | 76 buttons, **1** handler | working flows |
| Status contrast | fails AA on 3 of 4 | passes AA on 3 of 4 |

At 1440 it is genuinely well made, and it was never meant to be anything but a
leadership-review artifact. Judging it as a product would flatter us unfairly.

### What it found in us

**1. The evidence line was unreadable.** `--ink-3` at 3.12:1, below AA, meeting
11px text in ~140 places — the dates, counts and references under nearly every
row. Solved against every background it meets. A contrast probe then found a
second failure hand-measurement had missed (`--info`, 4.34). Their equivalent
token has the same fault at 3.25, so neither product had noticed.

**2. The books never said how much of the business they could see.** The trial
balance ties, which proves correctness, not coverage. `completenessOf` now
measures the evidenced share over three tiers. Two rules make it mean something
where theirs does not: it never rounds *up* into 100, and it cannot reach 100 at
all while cash is untracked. Theirs prints "87%" as a literal and implies 100 is
reachable on a bank-only view.

**3. `Cash in hand` (1010) had never been posted to.** Bank-derived books
structurally cannot see a counter sale paid in notes. Four fields, a real double
entry, through the channel the journal sheet already uses.

**4. Income tax was missing entirely.** GST, TDS and PT were tracked; the largest
exposure for a proprietor was not. Gated on constitution — absent, not disabled,
for anyone who files their own return.

### The colour finding, against my own recent work

Their inflow bar is categorical with amounts inside the segments. Ours shipped
four days earlier as an `--ink` opacity ramp, justified by B3. Side by side the
ramp is unreadable past three or four segments. **B3 is about not colouring
amounts**; a category legend is identity.

The replacement hues were *computed, not chosen*. A hand-picked "brand-adjacent"
muted set failed hard — three hues below the chroma floor reading as grey, two
adjacent pairs at ΔE 7.5 for normal vision. The validated set clears every check
on our own surfaces in both themes. Because the guarantee is for **adjacent**
pairs — exactly what a stacked bar has — segments render in category order rather
than by size, and slots are assigned by category rather than rank so changing the
window cannot repaint them.

### Left open, deliberately

- **Nav count.** Theirs consolidates to 11 items by subtraction; ours exposes 16.
  Ours mirrors Vyapar/Tally, theirs mirrors how an owner thinks. It argues with
  the standing "if you build it, it goes in the nav" rule, so it is a decision,
  not a cleanup.
- **Complement or replace.** Their tier 3 offers Tally, Zoho and Vyapar as
  *inputs*. v2's stated direction is to replace Vyapar. Theirs is the lower-risk
  answer.
- **The wedge.** Their statement badges rival-bank rows `Untagged · external
  bank` and offers *"Move your Zomato payouts to Axis CA"*. The sharpest
  commercial idea in either product, and v2 cannot honestly compute it: `Txn` has
  no account field, so every line belongs to the primary account by implication.
  It needs `Txn.accountId` and a handful of seeded external credits — a
  deliberate seed change, listed in the backlog rather than done by default.

### What not to copy

Prose AI summaries with bolded fragments (law G2 exists for this); a `92/100`
health score with nothing behind it; six competing hues; 9–11px as the floor for
anything load-bearing.

---

## Part 5 — Remaining backlog

1. **`Txn.accountId`, and the wedge it unlocks** — §29. A rival-bank marketplace
   credit is the strongest reason a bank has to ask for the primary relationship,
   and v2 cannot say one exists: transactions are not account-tagged, so every
   line belongs to the primary account by implication. Needs the field, a few
   seeded external credits, and an *external, untagged* recon state. Same seed
   blocker as the per-account balance series below, now with a much larger prize
   behind it.
2. **Four of the seven leak types** — `refund_not_returned`, `rto_wrongly_charged`,
   `weight_slab_mismatch` and `reimbursement_unclaimed` (SAFE-T). Deferred
   deliberately, not forgotten: each needs a returns file, a courier manifest or a
   reimbursement feed that the seed does not carry, and a stub producing a
   plausible rupee figure with nothing behind it is §23's fabrication one level
   up. Three real checks beat seven invented ones. The taxonomy is built to take
   them — add a `SPEC` row and the register, the windows and the connect sheet's
   promises all follow.
3. **Per-account balance series** — blocked on the seed: transactions aren't
   account-tagged, and splitting them would invent data the statement would
   contradict. Needs a seed change first, deliberately deferred.
4. **Saved statement views** (`Save as`, per C13) — deferred on purpose, see
   §16: nothing in a `sessionStorage` prototype can outlive the session it was
   saved in.
5. **The 60-day zero-fee window is a demo value**, called out as one in
   `leaks.ts` rather than presented as a citation. It wants confirming against
   Amazon's actual fee-correction policy before this goes near a real seller.
