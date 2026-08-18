/*
 * Turning values into speech, server-side and once.
 *
 * The model must never format a rupee figure. Two reasons, and the second is the
 * one that bites: an LLM will happily say "fifty thousand four hundred" for
 * 50,450, and it will format the same number differently on two different calls.
 * Formatting here means the figure Simran speaks and the figure `/balance`
 * renders come from the same code, which is what makes them checkable against
 * each other.
 *
 * Written for the ear, not the eye. "21 lakh 66 thousand" is what a person says;
 * "₹21,65,900" is what a screen shows. Both are correct and they are not
 * interchangeable.
 */

/**
 * Indian numbering, spoken. Rounded deliberately — reading out
 * "twenty-one lakh sixty-five thousand nine hundred" is worse than
 * "about 21 lakh 66 thousand" for a caller trying to hold it in their head,
 * and the app has the exact figure.
 */
export function rupees(paise: number): string {
  const n = Math.round(paise);
  if (n === 0) return "nothing";

  const abs = Math.abs(n);
  const sign = n < 0 ? "minus " : "";

  if (abs >= 1_00_00_000) {
    const cr = abs / 1_00_00_000;
    return `${sign}${trim(cr)} crore rupees`;
  }
  if (abs >= 1_00_000) {
    const lakh = Math.floor(abs / 1_00_000);
    const rest = Math.round((abs % 1_00_000) / 1000);
    return rest > 0
      ? `${sign}${lakh} lakh ${rest} thousand rupees`
      : `${sign}${lakh} lakh rupees`;
  }
  /*
   * Whole thousands and then the remainder, never a decimal. "86.2 thousand" is
   * not something a person says, and it is the same machine-formatting this file
   * exists to keep out of Simran's mouth — one decimal earns its place at
   * "1.5 crore" and loses it here, where the spoken form is "86 thousand 200".
   * Exact rather than rounded, because figures in this range are the ones a
   * caller is confirming rather than getting a feel for.
   */
  if (abs >= 1000) {
    const th = Math.floor(abs / 1000);
    const rest = abs % 1000;
    return rest > 0
      ? `${sign}${th} thousand ${rest} rupees`
      : `${sign}${th} thousand rupees`;
  }
  return `${sign}${abs} rupees`;
}

function trim(v: number): string {
  // One decimal, and only when it earns its place: "1.5 crore" but not "2.0".
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "22 July" — never "22/07", which is ambiguous the moment anyone repeats it. */
export function dateSpoken(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

export function count(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? one + "s")}`;
}

/**
 * Digit-by-digit, for anything a caller has to write down or check.
 *
 * "four four two one" survives a bad line; "four thousand four hundred and
 * twenty-one" does not, and it is the exact string where a mis-hearing costs
 * real money.
 */
export function digits(value: string): string {
  return value.replace(/\D/g, "").split("").join(" ");
}

/** Last four only. A full account number is never spoken aloud. */
export function maskedTail(masked: string): string {
  return digits(masked.replace(/\D/g, "").slice(-4));
}
