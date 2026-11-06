"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info, LoaderCircle } from "lucide-react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-teal";
  const variants = {
    primary: "bg-ns-teal text-ns-teal-ink hover:brightness-110",
    ghost: "border border-ns-border bg-transparent text-ns-text hover:border-ns-border-strong hover:bg-ns-surface-2",
    subtle: "bg-ns-surface-2 text-ns-text hover:bg-ns-surface-3",
  } as const;
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-[15px]" } as const;
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Small (i) button that toggles an explanatory popover. */
export function InfoTip({ children, label = "More info" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="grid size-5 place-items-center rounded-full text-ns-muted hover:text-ns-violet"
      >
        <Info className="size-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-7 z-30 w-64 -translate-x-1/2 rounded-sm border border-ns-border bg-ns-surface-3 p-3 text-xs font-normal leading-relaxed text-ns-muted"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export function Badge({ tone = "teal", children }: { tone?: "teal" | "violet" | "warn" | "muted"; children: React.ReactNode }) {
  const tones = {
    teal: "bg-ns-teal-soft text-ns-teal",
    violet: "bg-ns-violet-soft text-ns-violet",
    warn: "bg-ns-warn-soft text-ns-warn",
    muted: "bg-ns-surface-3 text-ns-muted",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
