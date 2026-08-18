"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[10px] bg-surface px-3.5 text-[14.5px] text-ink placeholder:text-ink-3",
        "shadow-(--shadow-ctl) transition-shadow focus:outline-none focus:shadow-(--shadow-focus)",
        className,
      )}
      {...props}
    />
  );
}

/** Six-box OTP input; calls onComplete when all digits are in. */
export function OtpInput({
  onComplete,
  disabled,
}: {
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(idx: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const el = refs.current[idx];
    if (el) el.value = digit;
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
    const code = refs.current.map((r) => r?.value ?? "").join("");
    if (code.length === 6) onComplete(code);
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !refs.current[idx]?.value && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    digits.split("").forEach((d, i) => {
      const el = refs.current[i];
      if (el) el.value = d;
    });
    refs.current[Math.min(digits.length, 5)]?.focus();
    if (digits.length === 6) onComplete(digits);
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`OTP digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "tnum h-12 w-10.5 rounded-[10px] bg-surface text-center text-lg font-semibold text-ink",
            "shadow-(--shadow-ctl) transition-shadow focus:outline-none focus:shadow-(--shadow-focus)",
            "disabled:opacity-40",
          )}
        />
      ))}
    </div>
  );
}
