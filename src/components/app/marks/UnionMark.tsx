"use client";

import { useId } from "react";

/**
 * Union Bank of India's device: a red "U" and a blue "n" interlocked — the
 * "Un" of Union.
 *
 * Traced from the bank's own lockup rather than drawn by eye. The master
 * (`unionbankofindia.bank.in/img/header/ubi_logo.png`, 375×56) was sampled a
 * row at a time and the two colour regions reduced to their centrelines; the
 * paths below are those centrelines stroked at the measured width, normalised
 * into a 54-unit box. The colours are the sampled pixel values, not the
 * website's CSS tokens — the CSS navy (#00569b) is the site chrome and is a
 * different blue from the mark's (#006cb7).
 *
 * Logo colours are deliberately literal. They are the bank's asset, fixed in
 * both themes, and must not follow `--accent` — a mark that changes colour
 * with a theme toggle is not a mark.
 *
 * TODO: replace with the official vector when the bank supplies it. This is
 * accurate to the raster it came from — overlaid on the original at 10x, the
 * two register to within the raster's own antialiasing — but a traced logo is
 * still a traced logo.
 */
export function UnionMark({ title }: { title: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 54 54" role="img" aria-labelledby={id} className="h-full w-full">
      <title id={id}>{title}</title>
      <g fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {/* the U */}
        <path
          stroke="#ed1c24"
          d="M8 14.5C6.5 22 3.5 29 3.5 35c0 7.5 5 11.5 11 11.5 6.5 0 11.5-3 15-8 3.5-5 6-11.5 7-17"
        />
        {/* the n, sitting across it */}
        <path
          stroke="#006cb7"
          d="M16.5 37c1-6 2.5-12.5 5-19.5 2.5-7 8.5-11 16-10.5 7.5.5 12.5 4.5 13 11.5.5 7.5-3 17.5-5.5 23"
        />
      </g>
    </svg>
  );
}
