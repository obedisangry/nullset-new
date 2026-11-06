// Presenter-editable branding (name + two accent colours), kept in this
// browser's localStorage. Exposed as an external store so server render
// (defaults) and client render (saved values) reconcile cleanly.

import { useSyncExternalStore } from "react";

export interface Brand {
  name: string;
  primary: string; // hex, e.g. #ededed
  secondary: string; // hex, e.g. #a3a3a3
}

export const DEFAULT_BRAND: Brand = { name: "Nullset", primary: "#ededed", secondary: "#a3a3a3" };

export const BRAND_PRESETS: { label: string; primary: string; secondary: string }[] = [
  { label: "Mono", primary: "#ededed", secondary: "#a3a3a3" },
  { label: "Teal / violet", primary: "#2dd4bf", secondary: "#9b87ff" },
  { label: "Blue / pink", primary: "#60a5fa", secondary: "#f472b6" },
  { label: "Orange / gold", primary: "#fb923c", secondary: "#facc15" },
  { label: "Green / lime", primary: "#4ade80", secondary: "#a3e635" },
  { label: "Red / rose", primary: "#f87171", secondary: "#fda4af" },
  { label: "Indigo / cyan", primary: "#818cf8", secondary: "#22d3ee" },
];

const KEY = "nullset-brand";
const subs = new Set<() => void>();
let current: Brand | null = null;

function load(): Brand {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = JSON.parse(raw) as Partial<Brand>;
      return {
        name: typeof b.name === "string" && b.name.trim() ? b.name.slice(0, 32) : DEFAULT_BRAND.name,
        primary: isHex(b.primary) ? b.primary : DEFAULT_BRAND.primary,
        secondary: isHex(b.secondary) ? b.secondary : DEFAULT_BRAND.secondary,
      };
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return DEFAULT_BRAND;
}

export function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export const brandStore = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  getSnapshot(): Brand {
    if (!current) current = load();
    return current;
  },
  getServerSnapshot(): Brand {
    return DEFAULT_BRAND;
  },
  set(patch: Partial<Brand>) {
    current = { ...brandStore.getSnapshot(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* ignore */
    }
    subs.forEach((f) => f());
  },
  reset() {
    current = DEFAULT_BRAND;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    subs.forEach((f) => f());
  },
};

export function useBrand(): Brand {
  return useSyncExternalStore(brandStore.subscribe, brandStore.getSnapshot, brandStore.getServerSnapshot);
}

/** Lower-case, alphanumeric form of the name, used as the note prefix. */
export function brandSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "note";
}

/** Dark or light text, whichever reads better on this colour. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#0a0a0a" : "#ffffff";
}

/** CSS variable overrides that re-theme every component below the element. */
export function brandStyle(b: Brand): React.CSSProperties {
  return {
    "--color-ns-teal": b.primary,
    "--color-ns-teal-soft": `color-mix(in srgb, ${b.primary} 16%, #0a0a0a)`,
    "--color-ns-teal-ink": inkFor(b.primary),
    "--color-ns-violet": b.secondary,
    "--color-ns-violet-soft": `color-mix(in srgb, ${b.secondary} 16%, #0a0a0a)`,
  } as React.CSSProperties;
}
