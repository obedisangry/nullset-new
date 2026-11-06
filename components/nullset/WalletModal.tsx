"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CircleCheck, Fingerprint, LoaderCircle, Mail, Puzzle, ShieldCheck, Smartphone, Usb, X } from "lucide-react";
import { Button } from "./ui";
import { sleep } from "@/lib/nullset/sim";
import { useBrand } from "@/lib/nullset/brand";

export const WALLET_OPTIONS = [
  { id: "browser", name: "Browser wallet", hint: "Extension in this browser", icon: Puzzle, popular: true },
  { id: "mobile", name: "Mobile wallet", hint: "Connect with your phone", icon: Smartphone },
  { id: "hardware", name: "Hardware wallet", hint: "USB or Bluetooth device", icon: Usb },
  { id: "passkey", name: "Passkey wallet", hint: "Face ID or fingerprint", icon: Fingerprint },
  { id: "email", name: "Email wallet", hint: "Sign in with a one-time code", icon: Mail },
] as const;

export type WalletKind = (typeof WALLET_OPTIONS)[number]["id"];

type Phase = { step: "pick" } | { step: "opening" | "approve" | "done"; kind: WalletKind };

/**
 * Wallet picker. Every option runs the same simulated handshake. Nothing is
 * contacted, and no secret (seed phrase, private key) is ever requested.
 */
export function WalletModal({ speed, onClose, onConnected }: { speed: number; onClose: () => void; onConnected: (kind: WalletKind) => void }) {
  const [phase, setPhase] = useState<Phase>({ step: "pick" });
  const { name } = useBrand();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function choose(kind: WalletKind) {
    setPhase({ step: "opening", kind });
    await sleep(900 * speed);
    setPhase({ step: "approve", kind });
  }

  async function approve(kind: WalletKind) {
    setPhase({ step: "done", kind });
    await sleep(700 * speed);
    onConnected(kind);
  }

  const option = phase.step === "pick" ? null : WALLET_OPTIONS.find((o) => o.id === phase.kind)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-sm border border-ns-border bg-ns-surface p-5 sm:rounded-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="wallet-title" className="text-lg font-bold">
            {phase.step === "pick" ? "Connect a wallet" : option!.name}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-sm border border-ns-border text-ns-muted hover:text-ns-text">
            <X className="size-4" />
          </button>
        </div>

        {phase.step === "pick" && (
          <>
            <ul className="space-y-2">
              {WALLET_OPTIONS.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => choose(o.id)}
                    className="group flex w-full items-center gap-3 rounded-sm border border-ns-border bg-ns-surface-2 p-3 text-left transition hover:border-ns-teal/60 hover:bg-ns-surface-3"
                  >
                    <span className="grid size-10 place-items-center rounded-sm bg-ns-bg text-ns-teal">
                      <o.icon className="size-5" />
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {o.name}
                        {"popular" in o && o.popular && <span className="rounded-sm bg-ns-teal-soft px-1.5 py-0.5 text-[10px] font-semibold text-ns-teal">Popular</span>}
                      </span>
                      <span className="text-xs text-ns-muted">{o.hint}</span>
                    </span>
                    <ChevronRight className="size-4 text-ns-muted transition group-hover:translate-x-0.5 group-hover:text-ns-teal" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2 text-xs text-ns-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ns-teal" />
              {name} never asks for your seed phrase or private key. Anyone who does is trying to steal your funds.
            </p>
          </>
        )}

        {phase.step !== "pick" && option && (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="relative grid size-20 place-items-center rounded-sm bg-ns-surface-2 text-ns-teal">
              <option.icon className="size-9" />
              {phase.step === "done" && <CircleCheck className="absolute -bottom-1 -right-1 size-7 rounded-full bg-ns-surface text-ns-ok" />}
            </span>
            {phase.step === "opening" && (
              <>
                <p className="mt-5 font-semibold">Opening {option.name.toLowerCase()}…</p>
                <p className="mt-1 text-sm text-ns-muted">{option.hint}</p>
                <LoaderCircle className="mt-5 size-6 animate-spin text-ns-teal" />
              </>
            )}
            {phase.step === "approve" && (
              <>
                <p className="mt-5 font-semibold">Approve the connection</p>
                <p className="mt-1 max-w-xs text-sm text-ns-muted">{name} is requesting to view your address and balance. It can&apos;t move funds without your approval.</p>
                <div className="mt-5 grid w-full grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setPhase({ step: "pick" })}>
                    Back
                  </Button>
                  <Button onClick={() => approve(option.id)}>Approve</Button>
                </div>
              </>
            )}
            {phase.step === "done" && <p className="mt-5 font-semibold text-ns-ok">Connected</p>}
          </div>
        )}
      </div>
    </div>
  );
}
