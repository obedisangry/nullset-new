"use client";

import { useSyncExternalStore } from "react";
import { Activity, Coins, Users } from "lucide-react";
import { Badge, InfoTip } from "./ui";
import { clock, DENOMS, depositAge, formatAgo, TOKEN, type Denom, type Pool } from "@/lib/nullset/sim";

export function StatsCard({ pools, denom, onDenomChange }: { pools: Record<Denom, Pool>; denom: Denom; onDenomChange: (d: Denom) => void }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const pool = pools[denom];
  if (!pool) return null;
  const held = (pool.count - pool.withdrawn) * Number(denom);

  return (
    <section id="stats" className="scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Activity className="size-4 text-ns-teal" /> Statistics
        </h2>
        <div className="flex flex-wrap gap-1 rounded-sm bg-ns-bg/60 p-1" role="tablist" aria-label="Pool">
          {DENOMS.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={d === denom}
              onClick={() => onDenomChange(d)}
              className={`h-8 rounded-sm px-2.5 text-xs font-semibold transition ${d === denom ? "bg-ns-surface-3 text-ns-teal" : "text-ns-muted hover:text-ns-text"}`}
            >
              {d} {TOKEN}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-ns-border bg-ns-surface-2 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ns-muted">
            <Users className="size-3.5" /> Anonymity set
            <InfoTip>
              How many equal deposits a withdrawal from this pool could belong to. Bigger is better, but timing and behavior can still narrow it down.
            </InfoTip>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{pool.count.toLocaleString()}</p>
          <p className="text-xs text-ns-muted">equal deposits</p>
        </div>
        <div className="rounded-sm border border-ns-border bg-ns-surface-2 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ns-muted">
            <Coins className="size-3.5" /> Held in pool
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{held.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
          <p className="text-xs text-ns-muted">
            {TOKEN} · {pool.withdrawn.toLocaleString()} withdrawals
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Latest deposits</h3>
          <span className="text-xs text-ns-muted">this pool</span>
        </div>
        <ul className="ns-scroll max-h-64 space-y-1 overflow-y-auto pr-1">
          {pool.recent.map((d) => (
            <li
              key={d.index}
              className={`flex items-center justify-between rounded-sm px-3 py-2 text-sm ${d.mine ? "bg-ns-teal-soft" : "odd:bg-ns-surface-2"}`}
            >
              <span className="font-mono text-xs text-ns-muted">#{d.index.toLocaleString()}</span>
              <span className="flex items-center gap-2">
                {d.mine && <Badge tone="teal">you</Badge>}
                <span className="text-ns-text">{now ? formatAgo(depositAge(d, now)) : "…"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
