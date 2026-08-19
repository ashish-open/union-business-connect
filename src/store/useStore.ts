"use client";

// Session store. Only identifiers persist (sessionStorage); customer and
// entity objects always rehydrate from the seed registry so seed stays the
// single source of truth.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ANCHOR_DATE, BankCustomer, Entity, findCustomer } from "@/data/seed";
import type { JournalEntry } from "@/lib/ledger";
import type { Doc } from "@/lib/docs";
import type { CashEntry } from "@/lib/cash";
import type { ConnectMethod } from "@/lib/channels";

interface SessionState {
  mobile: string | null;
  entityId: string | null;
  onboarded: boolean; // signed in and past the picker — the app is reachable
  /**
   * entityId → this business has allowed us to read its statements.
   *
   * Consent used to be a sign-in step. It is now the first card over the
   * workspace and it is the ONE card with no way out: `giveConsent` is the only
   * thing that clears it, so no part of the app is usable before the permission
   * exists. Keyed per entity, because consent is given by a business, not by the
   * person holding the phone — one owner can run two.
   */
  consented: Record<string, true>;
  /**
   * entityId → the first-run findings have been shown and closed.
   *
   * The findings used to be the last step of sign-in, which spent the one
   * moment the product has to prove itself on a screen the owner had to leave
   * before they could touch anything. They now arrive over the workspace, so
   * the app is already behind them and closing the card leaves them somewhere
   * rather than nowhere. This flag is what stops it opening twice.
   */
  findingsSeen: Record<string, true>;
  /** Reopened from the bell — the findings are a recap, not a one-time gate. */
  findingsOpen: boolean;
  resolved: Record<string, true>; // Today-queue items acted on, keyed entityId/itemId
  channelsConnected: Record<string, true>; // entityId → marketplace channels linked
  lineResolutions: Record<string, "accepted" | "rejected">; // entityId/txnId
  sessionPayments: Record<string, SessionPayment[]>; // entityId → payments made this session
  sessionPayees: Record<string, SessionPayee[]>; // entityId → payees verified this session
  remindersSent: Record<string, true>; // entityId/invoiceNumber
  closedPeriods: Record<string, true>; // entityId/period
  application: CAApplication | null; // Journey C — new current-account application
  applicationTasks: Record<string, true>; // dead-zone day-one tasks completed
  teamInvites: Record<string, TeamInvite>; // entityId → invited second user
  makerChecker: Record<string, boolean>; // entityId → two-person payouts (offered, never forced)
  reraCaSigned: Record<string, true>; // entityId → Form 3 signed this session
  reraWithdrawn: Record<string, number>; // entityId → withdrawn from designated this session
  sweepMandate: Record<string, SweepMandate>; // entityId → eNACH pull mandate (rung 5)
  /** entityId/txnId → ledger account the owner posted an unexplained line to */
  explainedLines: Record<string, string>;
  /** entityId → journal entries the owner wrote by hand */
  manualEntries: Record<string, JournalEntry[]>;
  /**
   * Cash the owner logged by hand — the money that never touched the bank.
   *
   * Kept as entries rather than journal lines so the surface can list, count
   * and eventually edit them; `useBooks` turns them into postings at the one
   * place the books are assembled.
   */
  cashEntries: Record<string, CashEntry[]>;
  /**
   * entityId/masked → when a view-only account was last read, and whether the
   * consent behind it has been revoked.
   *
   * The accounts themselves come from the seed. What the owner can change is
   * the consent — which is the point: an account you can see and cannot
   * disconnect is the same defect as a channel you can connect and cannot
   * leave.
   */
  aaLinks: Record<string, { lastSync: string; revoked?: true }>;
  /** entityId → documents created this session, on top of the seeded ones */
  docs: Record<string, Doc[]>;
  /** entityId/txnId → document number the owner confirmed this pays */
  confirmedMatches: Record<string, string>;
  /** entityId/txnId → the owner said this is not a document payment */
  rejectedMatches: Record<string, true>;
  /**
   * entityId/batchId → where a settlement claim has got to.
   *
   * A dispute pack used to be generated and then forgotten — the product
   * produced a claim and kept no record that it had. A claim whose status you
   * cannot see is a claim you will not chase.
   */
  disputes: Record<string, DisputeStatus>;
  /**
   * entityId/channelId → what we hold for that rail, and how it got here.
   *
   * A boolean said "connected" and could not answer the question the whole
   * feature turns on: connected to WHICH side. Holding the platform's
   * settlement report tells you what they kept; holding your own order book
   * tells you what they never paid for at all. They are different reports,
   * they arrive by different routes, and one without the other leaves a
   * different half of the picture missing.
   */
  channelSources: Record<string, ChannelSource>;

  signIn: (mobile: string) => void;
  selectEntity: (entityId: string) => void;
  finishOnboarding: () => void;
  giveConsent: (entityId: string) => void;
  openFindings: () => void;
  /** Closing marks them seen: dismissing is an answer, not a postponement. */
  closeFindings: (entityId: string) => void;
  resolveItem: (entityId: string, itemId: string) => void;
  connectChannels: (entityId: string) => void;
  resolveLine: (entityId: string, txnId: string, res: "accepted" | "rejected") => void;
  addPayment: (entityId: string, payment: SessionPayment) => void;
  addPayee: (entityId: string, payee: SessionPayee) => void;
  sendReminder: (entityId: string, invoiceNumber: string) => void;
  closePeriod: (entityId: string, period: string) => void;
  submitApplication: (app: CAApplication) => void;
  completeAppTask: (taskId: string) => void;
  inviteTeammate: (entityId: string, invite: TeamInvite) => void;
  setMakerChecker: (entityId: string, on: boolean) => void;
  signReraCert: (entityId: string) => void;
  withdrawRera: (entityId: string, amount: number) => void;
  setSweepMandate: (entityId: string, mandate: SweepMandate) => void;
  cancelSweepMandate: (entityId: string) => void;
  explainLine: (entityId: string, txnId: string, account: string) => void;
  addJournalEntry: (entityId: string, je: JournalEntry) => void;
  addCashEntry: (entityId: string, entry: CashEntry) => void;
  syncLinked: (entityId: string, masked: string, on: string) => void;
  revokeLinked: (entityId: string, masked: string) => void;
  /** Upsert by id: parking a document then finishing it must not leave two. */
  saveDoc: (entityId: string, doc: Doc) => void;
  confirmMatch: (entityId: string, txnId: string, docNumber: string) => void;
  rejectMatch: (entityId: string, txnId: string) => void;
  /** Keyed by CLAIM, not by settlement — one period can carry two, and they
   *  are marked sent and recovered independently. */
  setDispute: (entityId: string, claimId: string, status: DisputeStatus) => void;
  connectPortal: (entityId: string, channelId: string, source: ChannelSource) => void;
  disconnectPortal: (entityId: string, channelId: string) => void;
  runChannel: (entityId: string, channelId: string, on: string) => void;
  signOut: () => void;
}

export interface SweepMandate {
  /** masked number of the external account the mandate pulls from */
  source: string;
  /** the balance the destination is kept above */
  floor: number;
  cadence: "floor" | "weekly" | "manual";
  /** total pulled in this session, so the demo can show it working */
  pulled: number;
}

export interface TeamInvite {
  name: string;
  role: "Accountant" | "Manager";
}

export interface SessionPayment {
  id: string;
  payee: string;
  amount: number;
  mode: string;
  lands: string;
  tag?: string;
}

/** What we hold for one rail, and how it arrived. */
export interface ChannelSource {
  method: ConnectMethod;
  /** The platform's settlement report — gross, fees, what they sent. */
  settlement: boolean;
  /** The owner's own order book — what was sold and shipped. */
  orders: boolean;
  /** ISO date it was connected, so the UI can say how fresh it is. */
  since: string;
  /**
   * ISO date the reports were last pulled.
   *
   * "Connected" and "current" are different facts, and a reconciliation
   * screen that cannot tell you which one it is showing is asking to be
   * trusted for no reason. An agent that refreshes daily and an upload from
   * three weeks ago both read as connected; only this separates them.
   */
  lastRun: string;
}

/** Where a settlement claim has got to. */
export type DisputeStatus = "drafted" | "sent" | "recovered" | "rejected";

/** A beneficiary added and penny-drop verified during this session. */
export interface SessionPayee {
  name: string;
  account: string;
  ifsc: string;
  /**
   * What the penny drop said the account is called.
   *
   * Stored rather than recomputed at each screen: it is evidence obtained at a
   * moment in time, and the whole point of showing it before a payment is that
   * it comes from the bank and not from us.
   */
  legalName?: string;
  /**
   * Who accepted a name that did not match, when one did not.
   *
   * An override that leaves no trace is indistinguishable from a check that
   * never happened. Absent means the names agreed.
   */
  mismatchAcceptedBy?: string;
}

export interface CAApplication {
  constitution: "Proprietorship" | "Private Limited" | "LLP";
  gstin: string;
  legalName: string;
  city: string;
  slot: string; // chosen video-KYC slot label
  submittedOn: string; // ISO date
  ref: string; // application reference shown on the tracker
  viaTry: boolean; // arrived from the uploaded-statement journey (bank already connected)
}

/**
 * Everything a session accumulates, back to nothing.
 *
 * Used by BOTH sign-out and sign-in, because signing in only ever set the
 * mobile number — so signing in as a second customer without signing out
 * first inherited the previous one's resolved items, withdrawals, closed
 * periods and account application. Demo state or not, one customer seeing
 * another's actions is not a thing a bank app may do.
 */
const BLANK_SESSION = {
  entityId: null,
  onboarded: false,
  consented: {},
  findingsSeen: {},
  findingsOpen: false,
  resolved: {},
  channelsConnected: {},
  lineResolutions: {},
  sessionPayments: {},
  sessionPayees: {},
  remindersSent: {},
  closedPeriods: {},
  application: null,
  applicationTasks: {},
  teamInvites: {},
  makerChecker: {},
  reraCaSigned: {},
  reraWithdrawn: {},
  sweepMandate: {},
  explainedLines: {},
  manualEntries: {},
  cashEntries: {},
  aaLinks: {},
  docs: {},
  confirmedMatches: {},
  rejectedMatches: {},
  disputes: {},
  channelSources: {},
} as const;

const AGGREGATOR_IDS = ["swiggy", "zomato"] as const;

const AGGREGATOR_PULL: ChannelSource = {
  method: "agent",
  settlement: true,
  orders: true,
  since: ANCHOR_DATE,
  lastRun: ANCHOR_DATE,
};

export const useStore = create<SessionState>()(
  persist(
    (set) => ({
      mobile: null,
      entityId: null,
      onboarded: false,
      consented: {},
      findingsSeen: {},
      findingsOpen: false,
      resolved: {},
      channelsConnected: {},
      lineResolutions: {},
      sessionPayments: {},
      sessionPayees: {},
      remindersSent: {},
      closedPeriods: {},
      application: null,
      applicationTasks: {},
      teamInvites: {},
      makerChecker: {},
      reraCaSigned: {},
      reraWithdrawn: {},
      sweepMandate: {},
      explainedLines: {},
      manualEntries: {},
      cashEntries: {},
      aaLinks: {},
      docs: {},
      confirmedMatches: {},
      rejectedMatches: {},
      disputes: {},
      channelSources: {},

      signIn: (mobile) =>
        set((s) => {
          const next = mobile.replace(/\D/g, "").slice(-10);
          // A different person signing in gets a clean session, not the last
          // one's. Same number = the same person coming back, so keep it.
          return next === s.mobile ? { mobile: next } : { ...BLANK_SESSION, mobile: next };
        }),
      selectEntity: (entityId) => set({ entityId }),
      finishOnboarding: () => set({ onboarded: true }),
      giveConsent: (entityId) =>
        set((s) => ({ consented: { ...s.consented, [entityId]: true as const } })),
      openFindings: () => set({ findingsOpen: true }),
      closeFindings: (entityId) =>
        set((s) => ({
          findingsOpen: false,
          findingsSeen: { ...s.findingsSeen, [entityId]: true as const },
        })),
      resolveItem: (entityId, itemId) =>
        set((s) => ({ resolved: { ...s.resolved, [`${entityId}/${itemId}`]: true as const } })),
      connectChannels: (entityId) =>
        set((s) => ({
          channelsConnected: { ...s.channelsConnected, [entityId]: true as const },
          // The statement's one-tap aggregator flow is an `agent` connection
          // that brings both sides — it is the 60-second demo, and it should
          // land in the same shape as any other route in.
          channelSources: {
            ...s.channelSources,
            [`${entityId}/swiggy`]: AGGREGATOR_PULL,
            [`${entityId}/zomato`]: AGGREGATOR_PULL,
          },
        })),
      resolveLine: (entityId, txnId, res) =>
        set((s) => ({
          lineResolutions: { ...s.lineResolutions, [`${entityId}/${txnId}`]: res },
        })),
      addPayment: (entityId, payment) =>
        set((s) => ({
          sessionPayments: {
            ...s.sessionPayments,
            [entityId]: [payment, ...(s.sessionPayments[entityId] ?? [])],
          },
        })),
      // A payee you verified has to still be there when you go to pay them.
      // The list is otherwise derived from payment history, so a brand-new
      // beneficiary had nowhere to live and vanished on close.
      addPayee: (entityId, payee) =>
        set((s) => ({
          sessionPayees: {
            ...s.sessionPayees,
            [entityId]: [payee, ...(s.sessionPayees[entityId] ?? []).filter((p) => p.name !== payee.name)],
          },
        })),
      sendReminder: (entityId, invoiceNumber) =>
        set((s) => ({
          remindersSent: { ...s.remindersSent, [`${entityId}/${invoiceNumber}`]: true as const },
        })),
      closePeriod: (entityId, period) =>
        set((s) => ({
          closedPeriods: { ...s.closedPeriods, [`${entityId}/${period}`]: true as const },
        })),
      submitApplication: (application) => set({ application }),
      completeAppTask: (taskId) =>
        set((s) => ({
          applicationTasks: { ...s.applicationTasks, [taskId]: true as const },
        })),
      inviteTeammate: (entityId, invite) =>
        set((s) => ({ teamInvites: { ...s.teamInvites, [entityId]: invite } })),
      setMakerChecker: (entityId, on) =>
        set((s) => ({ makerChecker: { ...s.makerChecker, [entityId]: on } })),
      signReraCert: (entityId) =>
        set((s) => ({ reraCaSigned: { ...s.reraCaSigned, [entityId]: true as const } })),
      setSweepMandate: (entityId, mandate) =>
        set((s) => ({ sweepMandate: { ...s.sweepMandate, [entityId]: mandate } })),

      explainLine: (entityId, txnId, account) =>
        set((s) => ({
          explainedLines: { ...s.explainedLines, [`${entityId}/${txnId}`]: account },
        })),
      confirmMatch: (entityId, txnId, docNumber) =>
        set((s) => ({
          confirmedMatches: { ...s.confirmedMatches, [`${entityId}/${txnId}`]: docNumber },
        })),
      setDispute: (entityId, claimId, status) =>
        set((s) => ({ disputes: { ...s.disputes, [`${entityId}/${claimId}`]: status } })),
      // Connecting one rail says nothing about the others, so each is its own
      // key. `connectChannels` stays the aggregator shortcut the statement's
      // modal already drives, and writes through here so the two agree.
      connectPortal: (entityId, channelId, source) =>
        set((s) => ({
          channelSources: { ...s.channelSources, [`${entityId}/${channelId}`]: source },
        })),
      // Anything you can switch on, you can switch off. A connection with no
      // way out is a decision the owner made once and can never revisit.
      runChannel: (entityId, channelId, on) =>
        set((s) => {
          const key = `${entityId}/${channelId}`;
          const cur = s.channelSources[key];
          if (!cur) return {};
          return { channelSources: { ...s.channelSources, [key]: { ...cur, lastRun: on } } };
        }),
      disconnectPortal: (entityId, channelId) =>
        set((s) => {
          const next = { ...s.channelSources };
          // The statement's one-tap flow connects Swiggy and Zomato with a
          // single entity-level flag rather than a source each. Deleting one
          // rail's source cannot turn that flag off — the OTHER rail is still
          // relying on it — and leaving it on turns the disconnected rail
          // straight back on. So write the flag down as explicit sources
          // first, then delete the one asked for, then clear the flag.
          if (s.channelsConnected[entityId]) {
            for (const id of AGGREGATOR_IDS) {
              const k = `${entityId}/${id}`;
              if (id !== channelId && !next[k]) next[k] = AGGREGATOR_PULL;
            }
          }
          delete next[`${entityId}/${channelId}`];
          const channelsConnected = { ...s.channelsConnected };
          delete channelsConnected[entityId];
          return { channelSources: next, channelsConnected };
        }),
      rejectMatch: (entityId, txnId) =>
        set((s) => ({
          rejectedMatches: { ...s.rejectedMatches, [`${entityId}/${txnId}`]: true as const },
        })),
      saveDoc: (entityId, doc) =>
        set((s) => {
          const mine = s.docs[entityId] ?? [];
          const at = mine.findIndex((d) => d.id === doc.id);
          const next = at < 0 ? [...mine, doc] : mine.map((d) => (d.id === doc.id ? doc : d));
          return { docs: { ...s.docs, [entityId]: next } };
        }),
      addJournalEntry: (entityId, je) =>
        set((s) => ({
          manualEntries: {
            ...s.manualEntries,
            [entityId]: [...(s.manualEntries[entityId] ?? []), je],
          },
        })),
      syncLinked: (entityId, masked, on) =>
        set((s) => ({
          aaLinks: { ...s.aaLinks, [`${entityId}/${masked}`]: { lastSync: on } },
        })),
      revokeLinked: (entityId, masked) =>
        set((s) => ({
          aaLinks: {
            ...s.aaLinks,
            [`${entityId}/${masked}`]: {
              lastSync: s.aaLinks[`${entityId}/${masked}`]?.lastSync ?? ANCHOR_DATE,
              revoked: true,
            },
          },
        })),
      addCashEntry: (entityId, entry) =>
        set((s) => ({
          cashEntries: {
            ...s.cashEntries,
            [entityId]: [...(s.cashEntries[entityId] ?? []), entry],
          },
        })),
      cancelSweepMandate: (entityId) =>
        set((s) => {
          const next = { ...s.sweepMandate };
          delete next[entityId];
          return { sweepMandate: next };
        }),
      withdrawRera: (entityId, amount) =>
        set((s) => ({
          reraWithdrawn: {
            ...s.reraWithdrawn,
            [entityId]: (s.reraWithdrawn[entityId] ?? 0) + amount,
          },
        })),
      signOut: () => set({ ...BLANK_SESSION, mobile: null }),
    }),
    {
      name: "bc-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function useCustomer(): BankCustomer | undefined {
  const mobile = useStore((s) => s.mobile);
  return mobile ? findCustomer(mobile) : undefined;
}

export function useEntity(): Entity | undefined {
  const customer = useCustomer();
  const entityId = useStore((s) => s.entityId);
  return customer?.entities.find((e) => e.id === entityId);
}
