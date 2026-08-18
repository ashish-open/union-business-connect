"use client";

// The workspace frame.
//
// Structure follows the reference teardown (Brex sandbox, 55 screens):
//   · identity lives at the TOP of the sidebar — who am I, which business —
//     because that question is answered once per session and never scrolls;
//   · the page title lives in the TOP BAR, so orientation survives scrolling
//     and the content area can open with actions instead of a heading;
//   · the top-bar right cluster runs Ask → alerts → help: find it yourself,
//     then see what found you, then ask a human. Escalation left to right;
//   · the nav is three whitespace-separated clusters (the daily beat, the
//     month-end, then what you reach for occasionally), flat, with NO badges
//     — the bell is the one counter.
// Selection is a surface change (tinted pill), never a hue: colour is spent
// on meaning, not on structure.

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookCheck,
  ChevronsUpDown,
  Ellipsis,
  FileText,
  HardHat,
  House,
  Link2,
  Package,
  Plus,
  LifeBuoy,
  LogOut,
  Receipt,
  Scale,
  ScrollText,
  Store,
  ShoppingCart,
  Users,
  Wallet,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { detectRera } from "@/lib/rera";
import type { Entity } from "@/data/seed";
import { maskAccount } from "@/lib/format";
import { brand } from "@/config/brand";
import { useCustomer, useEntity, useStore } from "@/store/useStore";
import { BrandMark } from "./BrandMark";
import { AskAnywhere } from "./AskAnywhere";
import { ThemeChoice } from "./ThemeChoice";
import { NeedsYouBell } from "./NeedsYouBell";
import { useDismissable } from "@/lib/useDismissable";
import { useHydrated } from "@/lib/useHydrated";

// Four clusters, separated by whitespace rather than headings: what you watch,
// what you run the business with, the month-end, and the money products.
//
// Collections folded into Sales once documents arrived — its invoice list had
// become the same list Sales shows, and two screens answering one question is
// exactly what this rebuild set out to stop. Payment links live in the Sales
// sub-nav; the page itself is unchanged.
//
// The third cluster exists because a feature nobody can find is a feature
// nobody has. The rail carries what you CAN do here, not only what you do
// daily — GST spent a version buried behind the identity menu, which is the
// same as not shipping it.
//
// Rail items are NOT data-gated: a section exists for every business and may
// simply not apply, and its page says so in words. The one exception is
// Project, because a RERA workspace does not exist at all unless there is a
// project — there would be nothing for the page to explain.
//
// Credit and Cards were here and are gone. They were bank cross-sell surfaces
// on a rail that otherwise answers "where is my money and do the books tie" —
// two destinations of sixteen that no accounting question ever leads to. The
// working-capital drawdown they fed into the ledger went with them rather than
// being left as postings nothing could reach.
type NavItem = {
  label: string;
  icon: typeof House;
  href: string;
  group: 1 | 2 | 3 | 4;
  only?: (e: Entity) => boolean;
};

/** The tab bar's centre slot: raised, accent-filled, and the only lit thing down there. */
function AskTab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      data-ask-trigger
      aria-label="Ask about your money"
      className="flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px] text-ink-3 cursor-pointer"
    >
      <span className="ask-halo -mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(var(--brand-grad-angle),var(--brand-grad-a),var(--brand-grad-b))] text-white shadow-(--shadow-btn)">
        <Sparkles size={18} strokeWidth={2} />
      </span>
      Ask
    </button>
  );
}

const NAV: NavItem[] = [
  // what you watch
  { label: "Today", icon: House, href: "/today", group: 1 },
  { label: "Balance", icon: Wallet, href: "/balance", group: 1 },
  { label: "Statement", icon: ScrollText, href: "/statement", group: 1 },

  // what you run the business with
  { label: "Sales", icon: FileText, href: "/sales", group: 2 },
  { label: "Purchases", icon: ShoppingCart, href: "/purchases", group: 2 },
  { label: "Payouts", icon: ArrowUpRight, href: "/payouts", group: 2 },
  // Beside Reconcile on purpose: both answer "does what arrived match what
  // should have". For a QSR or a D2C brand this is where most revenue lands,
  // and it spent this whole build reachable only through a modal inside the
  // statement — §13's mistake, repeated on the biggest rail in the product.
  { label: "Channels", icon: Store, href: "/channels", group: 2 },
  { label: "Reconcile", icon: Link2, href: "/reconcile", group: 2 },
  { label: "Parties", icon: Users, href: "/parties", group: 2 },
  { label: "Items", icon: Package, href: "/items", group: 2 },

  // the month-end
  { label: "Project", icon: HardHat, href: "/project", group: 3, only: detectRera },
  { label: "Reports", icon: Scale, href: "/reports", group: 3 },
  { label: "GST", icon: Receipt, href: "/compliance", group: 3 },
  { label: "Close", icon: BookCheck, href: "/close", group: 3 },

  // money products
];

// Four destinations plus More is what fits a 375px bar without crowding.
// Three, not four: Ask takes the centre slot of the tab bar, so the bar still
// holds five targets and each keeps its width. Sales moves into More — on a
// phone, Statement is the more likely destination.
const MOBILE_PRIMARY = 3;

/** Longest-prefix match so detail routes keep their parent's title. */
const TITLES: Array<[string, string]> = [
  ["/today", "Today"],
  ["/balance", "Balance"],
  ["/statement", "Statement"],
  ["/payouts", "Payouts"],
  ["/collections", "Collections"],
  ["/close", "Close"],
  ["/sales", "Sales"],
  ["/purchases", "Purchases"],
  ["/channels/disputes", "Settlement claims"],
  ["/channels", "Channels"],
  ["/reconcile", "Reconcile"],
  ["/parties", "Parties"],
  ["/items", "Items"],
  ["/reports", "Reports"],
  ["/compliance", "GST and compliance"],
  ["/project/qpr", "Quarterly report"],
  ["/project", "Project"],
  ["/team", "People & roles"],
];

function titleFor(pathname: string): string {
  const hit = [...TITLES]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([href]) => pathname === href || pathname.startsWith(href + "/"));
  return hit?.[1] ?? brand.productName;
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const customer = useCustomer();
  const entity = useEntity();
  const mobile = useStore((s) => s.mobile);

  // Twenty pages carried a byte-identical copy of this effect, each gated on
  // its own `mounted` flag. One copy, in the component that already knows who
  // is signed in — and the frame stays on screen while the redirect happens
  // rather than the page going blank first.
  useEffect(() => {
    if (hydrated && (!mobile || !entity)) router.replace("/signin");
  }, [hydrated, mobile, entity, router]);

  const selectEntity = useStore((s) => s.selectEntity);
  const signOut = useStore((s) => s.signOut);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  // the rail this business actually has
  const nav = useMemo(() => NAV.filter((i) => !i.only || (entity && i.only(entity))), [entity]);
  // Ask is opened from two places — the desktop pill and the mobile tab bar —
  // so the state lives here and both triggers drive the same panel.
  const [askOpen, setAskOpen] = useState(false);
  // the More tab lights up when you're inside anything it holds
  const restActive = nav.slice(MOBILE_PRIMARY).some((i) => pathname.startsWith(i.href));
  // Doherty threshold: the shell paints on the first frame, always.
  //
  // Every page used to carry `if (!mounted) return null`, and so did this
  // component — so the whole screen, rail and title included, was blank for a
  // frame and then complete. That is a wait with no feedback AND change
  // blindness: the entire frame disappears and reappears. Now the frame is
  // constant and only the identity block and the content region resolve.
  //
  // The flag is needed because the store rehydrates from sessionStorage
  // synchronously, so without it the client's first render would disagree
  // with the server's.
  if (!hydrated || !customer || !entity) return <ShellFrame pathname={pathname} />;

  const primaryAccount = entity.accounts.find((a) => !a.readOnly);

  return (
    <div className="min-h-dvh bg-bg">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-surface md:flex">
        {/* Whose product this is. Stated once, quietly, and never interactive
            — the mark carries the bank, so the rail does not spend a second
            line repeating "Union Bank of India" under it. */}
        <div className="px-3.5 pb-3 pt-4">
          <BrandMark size="sm" withBank={false} />
        </div>

        {/* Which business you are acting as — the only interactive thing up
            here, so it is the only thing that looks interactive.

            It used to carry a solid-black monogram circle directly beneath
            the brand tile: two stacked chips competing to be the identity,
            and the heaviest ink on the page spent on a fact the name already
            gives you. The rule the rest of the rail follows (A4: the nav
            spends zero colour) applies to weight too. */}
        <div className="relative px-2.5">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-expanded={switcherOpen}
            aria-label={`${entity.name} — switch business`}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left transition-colors cursor-pointer",
              switcherOpen ? "bg-surface-2" : "hover:bg-surface-2",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-4 text-ink">
                {entity.name}
              </span>
              {primaryAccount && (
                <span className="mt-0.5 block truncate text-[10.5px] leading-3.5 text-ink-3 tnum">
                  {maskAccount(primaryAccount.masked)}
                </span>
              )}
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-ink-3" />
          </button>
          {switcherOpen && (
            <div className="absolute left-2.5 right-2.5 top-[calc(100%+4px)] z-30 rounded-[10px] bg-surface p-1.5 shadow-(--shadow-pop) animate-scale-in">
              {customer.entities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    selectEntity(e.id);
                    setSwitcherOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-2 cursor-pointer",
                    e.id === entity.id ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {e.name}
                  <span className="block text-[11px] text-ink-3">{e.constitution}</span>
                </button>
              ))}
              {/* Only what is about the BUSINESS rather than its money —
                  GST, credit and cards live in the rail, and repeating them
                  here would teach that this menu is where features hide. */}
              <div className="mt-1 border-t border-border pt-1">
                <Link
                  href="/team"
                  onClick={() => setSwitcherOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-[13px] text-ink-2 transition-colors hover:bg-surface-2"
                >
                  People &amp; roles
                </Link>
                <Link
                  href="/apply"
                  onClick={() => setSwitcherOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-[13px] text-ink-2 transition-colors hover:bg-surface-2"
                >
                  Open another business account
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* `overflow-y-auto`: sixteen items plus header and footer run past 700px,
            and the rail is `fixed inset-y-0` — on a 650px laptop the last items
            were unreachable with no scrollbar to suggest they existed. */}
        <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2.5">
          {nav.map((item, i) => {
            const active = pathname.startsWith(item.href);
            // whitespace, not headings — a break reads as a change of rhythm
            // without spending a line on a label nobody needs twice
            const gap = i > 0 && item.group !== nav[i - 1].group;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "mb-0.5 flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px]",
                  gap && "mt-3",
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors",
                )}
              >
                <item.icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* The person, and what you can do as them. Sign out used to be a
            26px unlabelled icon in the corner — findable only if you already
            knew it was there. The whole row is the target now, and the action
            carries its word. */}
        <div className="relative border-t border-border p-2.5">
          {userOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setUserOpen(false)} aria-hidden />
              <div className="absolute bottom-[52px] left-2.5 right-2.5 z-30 rounded-[10px] bg-surface p-1.5 shadow-(--shadow-pop) animate-scale-in">
                {/* Appearance belongs to the person, not the business, so it
                    sits with sign-out rather than in the business switcher. */}
                <ThemeChoice />
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => {
                    setUserOpen(false);
                    signOut();
                    router.push("/signin");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2">
              {customer.firstName[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">
                {customer.name}
              </span>
              <span className="block text-[10.5px] text-ink-3 tnum">
                {customer.mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-ink-3" />
          </button>
        </div>
      </aside>

      {/* main column */}
      <div className="md:pl-56">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
          <span className="md:hidden">
            <BrandMark withName={false} />
          </span>
          {/* the page title — persistent orientation while the content scrolls */}
          <h1 className="truncate text-[14px] font-semibold text-ink">{titleFor(pathname)}</h1>

          <div className="ml-auto flex items-center gap-1.5">
            <NeedsYouBell entity={entity} />
            <a
              href={`tel:${brand.supportLine.replace(/\s/g, "")}`}
              className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:bg-surface-2 sm:flex"
            >
              <LifeBuoy size={15} />
              Help
            </a>
          </div>
        </header>

        {/* The cap is deliberate — an unbounded column is worse than a narrow
            one — but 5xl was set before sections had a sub-nav, and that
            192px column was being paid for out of the content rather than out
            of the gutter. A section page was down to ~800px of usable width
            while 672px sat empty on either side at 1920.

            7xl puts a section page back at roughly the 1024 it was designed
            for, and gives the tables on plain pages the room they always
            wanted. Law G left this product with almost no prose, and it is
            rows and numbers that benefit from width. */}
        {/* pb clears the tab bar on a phone and the floating pill on desktop —
            without it the pill sits exactly on the table footer triad. */}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 md:pb-24">{children}</main>
      </div>

      <AskAnywhere entity={entity} open={askOpen} onOpenChange={setAskOpen} />

      {/* mobile bottom nav — four destinations plus everything else, rather
          than nine squeezed to the point where none of them is tappable */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {nav.slice(0, MOBILE_PRIMARY).map((item, i) => {
          const active = pathname.startsWith(item.href);
          return (
            <Fragment key={item.label}>
              {/* Ask sits in the middle of the bar rather than floating above
                  it: the thumb zone on a phone IS the nav, and a pill hovering
                  over it would have covered a strip of every screen. */}
              {i === 2 && <AskTab onOpen={() => setAskOpen(true)} />}
              <Link
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px]",
                  active ? "font-medium text-accent" : "text-ink-3",
                )}
              >
                <item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            </Fragment>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px] cursor-pointer",
            restActive ? "font-medium text-accent" : "text-ink-3",
          )}
        >
          <Ellipsis size={18} strokeWidth={restActive ? 2.2 : 1.8} />
          More
        </button>
      </nav>

      {/* the overflow sheet — a real destination list, not a hamburger dump */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-ink/25"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <MorePanel onClose={() => setMoreOpen(false)}>
            {/* On a phone the sidebar is gone, so this sheet has to answer the
                question it answered: WHICH BUSINESS am I in, and can I change
                it. Without this a two-entity owner was stuck in whichever one
                the session opened with. */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
              <span className="flex min-w-0 items-center gap-2.5">
                {/* No monogram. Everything in this sheet belongs to this
                    business, so a solid black chip spends the page's heaviest
                    ink restating what the line under it already says. */}
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {entity.name}
                  </span>
                  {primaryAccount && (
                    <span className="block truncate text-[11px] text-ink-3 tnum">
                      {maskAccount(primaryAccount.masked)}
                    </span>
                  )}
                </span>
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {customer.entities.length > 1 && (
              <div className="border-t border-border py-1">
                {customer.entities
                  .filter((e) => e.id !== entity.id)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        selectEntity(e.id);
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] text-ink-2 cursor-pointer"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[9.5px] font-semibold text-ink-2">
                        {e.name.slice(0, 2).toUpperCase()}
                      </span>
                      Switch to {e.name}
                    </button>
                  ))}
              </div>
            )}

            {/* The rail groups these four ways; the sheet used to render them
                as one flat run of ten, so every phone user got the ungrouped
                version of a nav we grouped on purpose. Same whitespace break
                as the sidebar, same reason. */}
            <div className="border-t border-border pt-1" />
            {nav.slice(MOBILE_PRIMARY).map((item, i, rest) => {
              const active = pathname.startsWith(item.href);
              const gap = i > 0 && item.group !== rest[i - 1].group;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-[14px]",
                    gap && "mt-2",
                    active ? "font-medium text-accent" : "text-ink-2",
                  )}
                >
                  <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
            {/* the sidebar is desktop-only, so without these two rows there
                is no way to reach roles or sign out on a phone at all */}
            <div className="mt-1 border-t border-border pt-1">
              <Link
                href="/team"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[14px] text-ink-2"
              >
                <Users size={17} strokeWidth={1.8} />
                People &amp; roles
              </Link>
              <Link
                href="/apply"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[14px] text-ink-2"
              >
                <Plus size={17} strokeWidth={1.8} />
                Open another business account
              </Link>
              {/* Help is `hidden sm:flex` in the top bar, so on a phone this
                  is the only route to a human. */}
              <a
                href={`tel:${brand.supportLine.replace(/\s/g, "")}`}
                className="flex items-center gap-3 px-4 py-3 text-[14px] text-ink-2"
              >
                <LifeBuoy size={17} strokeWidth={1.8} />
                Help
                <span className="ml-auto text-[12px] text-ink-3 tnum">{brand.supportLine}</span>
              </a>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                  router.push("/signin");
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-ink-2 cursor-pointer"
              >
                <LogOut size={17} strokeWidth={1.8} />
                Sign out
                <span className="ml-auto truncate text-[12px] text-ink-3">{customer.name}</span>
              </button>
            </div>
            {/* The rail is desktop-only, so this sheet is the only place a
                phone can reach a personal setting. */}
            <div className="mt-1 border-t border-border px-1.5 pt-1.5">
              <ThemeChoice />
            </div>
          </MorePanel>
        </div>
      )}
    </div>
  );
}

/**
 * The frame with nothing in it yet: brand, rail, title. Everything here is
 * derivable from the URL alone, so the server and the client's first render
 * produce identical HTML and nothing flickers when the real shell arrives.
 *
 * Project is left out because it is the one data-gated rail item — adding it
 * a frame later is the smaller lie than showing it to a business that has no
 * project.
 */
function ShellFrame({ pathname }: { pathname: string }) {
  const nav = NAV.filter((i) => !i.only);
  return (
    <div className="min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-surface md:flex">
        {/* Same metrics as the live rail, so nothing shifts when it arrives. */}
        <div className="px-3.5 pb-3 pt-4">
          <BrandMark size="sm" withBank={false} />
        </div>
        <div className="px-2.5">
          <div className="rounded-lg border border-border px-2.5 py-2">
            <span className="block h-3.5 w-28 rounded bg-surface-2" />
            <span className="mt-1 block h-2.5 w-14 rounded bg-surface-2" />
          </div>
        </div>
        {/* `overflow-y-auto`: sixteen items plus header and footer run past 700px,
            and the rail is `fixed inset-y-0` — on a 650px laptop the last items
            were unreachable with no scrollbar to suggest they existed. */}
        <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2.5">
          {nav.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "mb-0.5 flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px]",
                i > 0 && item.group !== nav[i - 1].group && "mt-3",
                pathname.startsWith(item.href)
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-3",
              )}
            >
              <item.icon size={15} strokeWidth={pathname.startsWith(item.href) ? 2.2 : 1.8} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-2.5">
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <span className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
            <span className="h-3 w-20 rounded bg-surface-2" />
          </div>
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
          <span className="md:hidden">
            <BrandMark withName={false} />
          </span>
          <h1 className="truncate text-[14px] font-semibold text-ink">{titleFor(pathname)}</h1>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 md:pb-24" />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {nav.slice(0, MOBILE_PRIMARY).map((item, i) => (
          <Fragment key={item.label}>
            {/* The skeleton holds the same five slots, or the bar would shift
                sideways the moment the real nav mounts. */}
            {i === 2 && <AskTab onOpen={() => {}} />}
            <Link
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px]",
                pathname.startsWith(item.href) ? "font-medium text-accent" : "text-ink-3",
              )}
            >
              <item.icon size={18} strokeWidth={pathname.startsWith(item.href) ? 2.2 : 1.8} />
              {item.label}
            </Link>
          </Fragment>
        ))}
        <span className="flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px] text-ink-3">
          <Ellipsis size={18} strokeWidth={1.8} />
          More
        </span>
      </nav>
    </div>
  );
}

/** The More sheet's panel — a component so the dismiss hook mounts with it. */
function MorePanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useDismissable<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[16px] bg-surface pb-[max(env(safe-area-inset-bottom),1rem)] animate-rise"
    >
      {children}
    </div>
  );
}
