"use client";

import { BookOpen, ChevronDown, CodeXml, Globe, MessageCircle, Send } from "lucide-react";
import { Logo } from "./Header";
import { useBrand } from "@/lib/nullset/brand";

export const NULLSET_VERSION = "0.1.0";

const LINKS = [
  { icon: BookOpen, label: "Docs" },
  { icon: CodeXml, label: "Source" },
  { icon: MessageCircle, label: "Community" },
  { icon: Send, label: "Contact" },
];

export function Footer({ toast }: { toast: (m: string) => void }) {
  const { name } = useBrand();
  return (
    <footer className="mt-16 border-t border-ns-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.3fr_1fr_auto] md:items-start">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ns-muted">
            Zero-knowledge privacy pools. Your notes are generated on your device and never leave it.
          </p>
          <p className="mt-3 text-xs text-ns-muted">
            Version <span className="font-mono text-ns-teal">{NULLSET_VERSION}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LINKS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => toast(`${label}: coming soon`)}
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-ns-border px-3 text-sm text-ns-muted hover:border-ns-border-strong hover:text-ns-text"
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <label className="relative inline-flex h-10 items-center gap-2 rounded-sm border border-ns-border px-3 text-sm text-ns-muted">
          <Globe className="size-4" />
          <span className="sr-only">Language</span>
          <select
            defaultValue="en"
            onChange={(e) => {
              if (e.target.value !== "en") toast("More languages coming soon");
              e.target.value = "en";
            }}
            className="appearance-none bg-transparent pr-6 text-ns-text focus:outline-none"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4" />
        </label>
      </div>
      <div className="border-t border-ns-border py-5 text-center text-xs text-ns-muted">
        © 2026 {name} · Educational simulation. No real wallets, funds or blockchain transactions.
      </div>
    </footer>
  );
}
