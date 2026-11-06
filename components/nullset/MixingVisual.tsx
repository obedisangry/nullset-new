"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import { clock, formatUsd, shorten, TOKEN, type Denom, type LedgerEvent, type MixRecord, type Pool } from "@/lib/nullset/sim";
import { useEthUsd } from "@/lib/nullset/price";
import type { DemoWallet } from "./Header";

interface MixingVisualProps {
  events: LedgerEvent[];
  pools: Record<Denom, Pool>;
  denom: Denom;
  teacher: boolean;
  wallet: DemoWallet | null;
  mixes: MixRecord[];
}

const MAX_DOTS = 48;

/** Deterministic pseudo-random in [0,1) per index, so server and client markup match. */
const frac = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Animated picture of the pool: coins fly in from depositors, orbit together
 * where they all look the same, and fly out to new addresses.
 */
export function MixingVisual({ events, pools, denom, teacher, wallet, mixes }: MixingVisualProps) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const rate = useEthUsd();
  const pool = pools[denom];
  if (!pool) return null;

  // Coins of yours still in this pool: your deposits here minus your withdrawals here.
  const myDeposits = events.filter((e) => e.kind === "deposit" && e.mine && e.denom === denom).length;
  const myWithdrawals = events.filter((e) => e.kind === "withdraw" && e.mine && e.denom === denom).length;
  const mixingCount = Math.max(0, myDeposits - myWithdrawals);
  const mixingAmount = mixingCount * Number(denom);
  const inPoolMixes = mixes.filter((m) => m.withdrawAge == null && m.withdrawAt == null);
  const inPoolAmount = inPoolMixes.reduce((s, m) => s + Number(m.denom), 0);
  const orderAmount = inPoolAmount || mixingAmount || 14.2;
  const userAddress = wallet?.address ?? inPoolMixes[0]?.from;
  const dots = Math.min(MAX_DOTS, pool.count);
  const mineSlots = new Set(Object.values(pool.leaves).map((leaf) => leaf % dots));

  const inPool = events.filter((e) => e.denom === denom);
  const deposits: LedgerEvent[] = [
    ...inPool.filter((e) => e.kind === "deposit"),
    ...inPoolMixes.map((m) => ({ id: m.id, kind: "deposit" as const, denom: m.denom, address: m.from, hash: "", at: 0, mine: true })),
  ].slice(0, 4);
  const withdrawals = inPool.filter((e) => e.kind === "withdraw").slice(0, 4);
  // Only animate events that just happened.
  const flights = now ? inPool.filter((e) => now - e.at < 9000).slice(0, 10) : [];

  return (
    <section id="mixing" className="mt-5 scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Shuffle className="size-4 text-ns-teal" /> Live pool: {orderAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {TOKEN}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ns-muted">
            Coins go in from many addresses and come out to new ones. Inside the pool every coin looks the same, and nothing records which one
            comes out.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-ns-muted">
          <Legend color="bg-ns-teal" label="your deposit" />
          <Legend color="bg-ns-violet" label="your withdrawal" />
          <Legend color="bg-ns-muted" label="other users" />
        </div>
      </div>

      <div className="relative mt-5 h-[300px] overflow-hidden rounded-sm border border-ns-border bg-ns-bg/60 sm:h-[340px]">
        {/* side lists */}
        <Side title="Deposits in" items={deposits} align="left" />
        <Side title="Withdrawals out" items={withdrawals} align="right" />

        {/* guide arrows */}
        <ArrowRight className="absolute left-[27%] top-1/2 hidden size-5 -translate-y-1/2 text-ns-border-strong sm:block" />
        <ArrowRight className="absolute right-[27%] top-1/2 hidden size-5 -translate-y-1/2 text-ns-border-strong sm:block" />

        {/* the pool */}
        <div className="ns-pulse absolute left-1/2 top-1/2 size-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ns-teal/40 bg-ns-surface-2/40 sm:size-[270px]">
          {Array.from({ length: dots }, (_, i) => {
            const r = 34 + frac(i, 1) * 66;
            const dur = 9 + frac(i, 2) * 14;
            const mine = teacher && mineSlots.has(i);
            return (
              <span
                key={i}
                className={`ns-orbit absolute left-1/2 top-1/2 -ml-[5px] -mt-[5px] size-[10px] rounded-full ${mine ? "bg-ns-teal" : "bg-ns-muted/70"}`}
                style={
                  {
                    "--r": `${r}px`,
                    "--a0": `${Math.round(frac(i, 3) * 360)}deg`,
                    "--d": `${dur.toFixed(1)}s`,
                    "--dl": `-${(frac(i, 4) * dur).toFixed(1)}s`,
                  } as React.CSSProperties
                }
              />
            );
          })}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-ns-surface/90 px-3 py-1.5 text-center">
            <p className="text-lg font-bold leading-tight">{pool.count.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-wider text-ns-muted">coins mixed</p>
          </div>
        </div>

        {/* coins in flight */}
        {flights.map((e) => (
          <span
            key={e.id}
            className={`${e.kind === "deposit" ? "ns-enter" : "ns-exit"} absolute top-1/2 z-10 grid size-7 place-items-center rounded-full text-[10px] font-black ${
              e.mine ? (e.kind === "deposit" ? "bg-ns-teal text-ns-teal-ink" : "bg-ns-violet text-white") : "bg-ns-surface-3 text-ns-muted ring-1 ring-ns-border-strong"
            }`}
            style={{ animationDelay: `${e.delay ?? 0}s` }}
            aria-hidden
          >
            Ξ
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-ns-muted">
        {userAddress ? (
          <>
            <span className="font-mono font-semibold text-ns-text">{shorten(userAddress)}</span>, you
          </>
        ) : (
          "You"
        )}{" "}
        currently have an ongoing order of{" "}
        <span className="font-semibold text-ns-teal">
          {orderAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {TOKEN}
        </span>{" "}
        ({formatUsd(orderAmount, rate)}) which will be ready in some days from now.
      </p>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} /> {label}
    </span>
  );
}

function Side({ title, items, align }: { title: string; items: LedgerEvent[]; align: "left" | "right" }) {
  return (
    <div className={`absolute top-4 hidden w-[22%] sm:block ${align === "left" ? "left-4" : "right-4 text-right"}`}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ns-muted">{title}</p>
      <ul className="space-y-1.5">
        {items.length === 0 && <li className="text-xs text-ns-muted/70">waiting…</li>}
        {items.map((e) => (
          <li
            key={e.id}
            className={`truncate rounded-sm border px-2 py-1 font-mono text-[11px] ${
              e.mine ? (e.kind === "deposit" ? "border-ns-teal/40 text-ns-teal" : "border-ns-violet/40 text-ns-violet") : "border-ns-border text-ns-muted"
            }`}
          >
            {shorten(e.address)}
          </li>
        ))}
      </ul>
    </div>
  );
}
