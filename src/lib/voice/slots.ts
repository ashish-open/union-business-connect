/*
 * Slot filling — how the agent knows what still to ask for.
 *
 * The requirement: if the caller says only "create an invoice", Simran must
 * probe for the customer, the item, the amount, and so on. The naive way is to
 * write that list into the prompt and hope. This does it the other way round:
 * the API owns the schema, returns what is still missing, and hands back the
 * exact sentence to say next. The agent asks; it does not decide.
 *
 * Two reasons that matters. A prompt-held checklist drifts from the real
 * required fields the moment either changes, and it degrades under a long or
 * code-mixed conversation. And the API has to validate anyway — so validating
 * once, in the place that already must, removes the second source of truth.
 *
 * One question at a time, deliberately. "Who is it for, what item, how much,
 * and when is it due?" is unanswerable on a phone call.
 */

export type SlotKind =
  | "text"
  | "amount"
  | "date"
  | "party"
  | "item"
  | "qty"
  | "account"
  | "ifsc";

export interface SlotSpec {
  key: string;
  /** Shown as the field label in the approval screen. */
  label: string;
  kind: SlotKind;
  required: boolean;
  /** What Simran says to ask for it. Written to be spoken. */
  prompt: string;
  /**
   * False for values the caller must not dictate. Account number and IFSC are
   * the case that matters: one wrong digit is irrecoverable, and speech
   * recognition on digits is the weakest link in the whole flow, so these are
   * captured in the app instead. See §1.2 of the plan.
   */
  viaVoice: boolean;
  /** Whether the approval screen lets the value be corrected before executing. */
  editable: boolean;
}

export type DraftKind = "invoice" | "beneficiary" | "item" | "payout";

export const SLOTS: Record<DraftKind, SlotSpec[]> = {
  invoice: [
    {
      key: "party",
      label: "Customer",
      kind: "party",
      required: true,
      prompt: "Who is the invoice for?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "item",
      label: "Item",
      kind: "item",
      required: true,
      prompt: "What are you billing for?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "qty",
      label: "Quantity",
      kind: "qty",
      required: false,
      prompt: "How many?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "amount",
      label: "Amount",
      kind: "amount",
      required: true,
      prompt: "And the amount?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "dueDays",
      label: "Payment terms",
      kind: "qty",
      required: false,
      prompt: "How many days do they have to pay?",
      viaVoice: true,
      editable: true,
    },
  ],

  beneficiary: [
    {
      key: "party",
      label: "Payee name",
      kind: "party",
      required: true,
      prompt: "What name should I put on the payee?",
      viaVoice: true,
      editable: true,
    },
    {
      // Never dictated. Simran collects the name; these two are typed in the
      // app before Execute unlocks.
      key: "account",
      label: "Account number",
      kind: "account",
      required: true,
      prompt: "",
      viaVoice: false,
      editable: true,
    },
    {
      key: "ifsc",
      label: "IFSC",
      kind: "ifsc",
      required: true,
      prompt: "",
      viaVoice: false,
      editable: true,
    },
  ],

  item: [
    {
      key: "name",
      label: "Item name",
      kind: "text",
      required: true,
      prompt: "What should I call the item?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "rate",
      label: "Rate",
      kind: "amount",
      required: true,
      prompt: "What do you charge for it?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "taxPct",
      label: "GST rate",
      kind: "qty",
      required: false,
      prompt: "What GST rate applies?",
      viaVoice: true,
      editable: true,
    },
  ],

  payout: [
    {
      key: "party",
      label: "Payee",
      kind: "party",
      required: true,
      prompt: "Who is the payment going to?",
      viaVoice: true,
      editable: true,
    },
    {
      key: "amount",
      label: "Amount",
      kind: "amount",
      required: true,
      prompt: "How much?",
      viaVoice: true,
      editable: true,
    },
  ],
};

/**
 * A captured slot keeps what we *heard* alongside what we *resolved it to*.
 *
 * This pair is the whole reason the edit step can work. "Amal" heard, "Amul
 * Distributors" matched — the approval screen shows both, so the caller can see
 * the substitution and correct it. Storing only the resolved value would hide
 * exactly the error the edit step exists to catch.
 */
export interface SlotValue {
  key: string;
  /** Raw transcript fragment, when it came from speech. */
  heard?: string;
  /** Resolved/normalised value. Amounts in rupees, dates ISO. */
  value: string | number | null;
  /** Set when a fuzzy match changed the value. Drives the "check this" flag. */
  substituted?: boolean;
  source: "voice" | "app" | "derived";
}

export interface FillResult {
  complete: boolean;
  /** Required, still empty, and askable by voice. */
  missing: SlotSpec[];
  /** Required, still empty, but must be typed in the app. */
  pendingInApp: SlotSpec[];
  /** The single next thing to say. Empty when nothing is askable. */
  nextPrompt: string;
}

function isEmpty(v: SlotValue | undefined): boolean {
  return !v || v.value === null || v.value === "" || v.value === undefined;
}

export function fill(kind: DraftKind, values: SlotValue[]): FillResult {
  const specs = SLOTS[kind];
  const byKey = new Map(values.map((v) => [v.key, v]));

  const unfilled = specs.filter((s) => s.required && isEmpty(byKey.get(s.key)));
  const missing = unfilled.filter((s) => s.viaVoice);
  const pendingInApp = unfilled.filter((s) => !s.viaVoice);

  return {
    // "Complete" means complete enough to put in front of a human. Fields the
    // app owns are not a reason to keep the caller on the phone — they are
    // filled at approval time, and Execute stays disabled until they are.
    complete: missing.length === 0,
    missing,
    pendingInApp,
    nextPrompt: missing[0]?.prompt ?? "",
  };
}

/** True when everything required is present, whatever its source. Gates Execute. */
export function executable(kind: DraftKind, values: SlotValue[]): boolean {
  const byKey = new Map(values.map((v) => [v.key, v]));
  return SLOTS[kind].every((s) => !s.required || !isEmpty(byKey.get(s.key)));
}

export function specFor(kind: DraftKind, key: string): SlotSpec | undefined {
  return SLOTS[kind].find((s) => s.key === key);
}
