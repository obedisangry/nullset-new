"use client";

import { useSyncExternalStore } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Badge } from "./ui";
import { clock, formatAgo, shorten, TOKEN, type Denom, type LedgerEvent, type MixRecord } from "@/lib/nullset/sim";

interface Row {
  id: string;
  denom: Denom;
  from: string;
  leaf: number;
  /** Absolute time (this session) or age at page load (earlier examples). */
  at?: number;
  ageAtLoad?: number;
  withdrawn: boolean;
  earlier: boolean;
}

/** Every simulated deposit you made, newest first, with its current status. */
export function DepositHistory({ events, mixes }: { events: LedgerEvent[]; mixes: MixRecord[] }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);

  const spent = new Set(events.filter((e) => e.kind === "withdraw" && e.mine && e.spentLeaf).map((e) => `${e.denom}:${e.spentLeaf}`));
  const rows: Row[] = [
    ...events
      .filter((e) => e.kind === "deposit" && e.mine && e.leaf)
      .map((e) => ({ id: e.id, denom: e.denom, from: e.address, leaf: e.leaf!, at: e.at, withdrawn: spent.has(`${e.denom}:${e.leaf}`), earlier: false })),
    ...mixes
      .filter((m) => !m.depositAt)
      .sort((a, b) => (a.depositAge ?? 0) - (b.depositAge ?? 0))
      .map((m) => ({ id: "d-" + m.id, denom: m.denom, from: m.from, leaf: m.leaf, ageAtLoad: m.depositAge, withdrawn: m.withdrawAge != null || m.withdrawAt != null, earlier: true })),
  ];

  const total = rows.reduce((s, r) => s + Number(r.denom), 0);
  const inPool = rows.filter((r) => !r.withdrawn).reduce((s, r) => s + Number(r.denom), 0);
  const age = (r: Row) => (r.at ? now - r.at : now - clock.loadedAt() + (r.ageAtLoad ?? 0));
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <section id="deposits" className="mt-5 scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <ArrowDownToLine className="size-4 text-ns-teal" /> Deposit history
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ns-muted">Every simulated deposit you&apos;ve made, and whether it has been withdrawn yet.</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Deposits" value={rows.length.toLocaleString()} />
        <Stat label={`Total deposited (${TOKEN})`} value={fmt(total)} />
        <Stat label={`Still in pools (${TOKEN})`} value={fmt(inPool)} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-ns-border text-[11px] uppercase tracking-wider text-ns-muted">
              <th className="py-2 pr-3 font-semibold">Amount</th>
              <th className="py-2 pr-3 font-semibold">From</th>
              <th className="py-2 pr-3 font-semibold">Leaf</th>
              <th className="py-2 pr-3 font-semibold">When</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ns-muted">
                  No deposits yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ns-border/60">
                <td className="py-2.5 pr-3 font-semibold">
                  {r.denom} {TOKEN}
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs">{shorten(r.from)}</td>
                <td className="py-2.5 pr-3 font-mono text-xs text-ns-muted">#{r.leaf.toLocaleString()}</td>
                <td className="py-2.5 pr-3 text-ns-muted">
                  {now ? formatAgo(age(r)) : "…"}
                  {r.earlier && <span className="ml-2 text-[11px]">(earlier)</span>}
                </td>
                <td className="py-2.5">{r.withdrawn ? <Badge tone="violet">Withdrawn</Badge> : <Badge tone="teal">In pool</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-ns-border bg-ns-surface-2 p-3 sm:p-4">
      <p className="text-[11px] font-medium text-ns-muted sm:text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight sm:text-xl">{value}</p>
    </div>
  );
}
