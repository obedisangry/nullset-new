"use client";

import { useSyncExternalStore } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Eye, GraduationCap, Link2, Plus } from "lucide-react";
import { Badge, Button, InfoTip } from "./ui";
import { clock, formatAgo, shorten, TOKEN, type LedgerEvent } from "@/lib/nullset/sim";

interface ObserverCardProps {
  events: LedgerEvent[];
  teacher: boolean;
  /** Whether the presenter tools (teacher view) are unlocked for this visitor. */
  presenter: boolean;
  onTeacherChange: (v: boolean) => void;
  onStrangerActivity: () => void;
}

/**
 * The public record: everything any observer of the chain can read. With
 * teacher view on, it also shows the private link that only the note holder
 * knows, so a class can compare the two.
 */
export function ObserverCard({ events, teacher, presenter, onTeacherChange, onStrangerActivity }: ObserverCardProps) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);

  return (
    <section id="observer" className="mt-5 scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Eye className="size-4 text-ns-teal" /> What the blockchain sees
            <InfoTip>
              Every deposit and withdrawal is public. Try to match a withdrawal to a deposit using only these columns. Nothing in them connects the two.
            </InfoTip>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ns-muted">The public record of this session. Anyone can read it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onStrangerActivity}>
            <Plus className="size-3.5" /> Other users&apos; activity
          </Button>
          {presenter && (
            <label className="flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-ns-border px-3 text-xs font-semibold">
              <GraduationCap className="size-3.5 text-ns-violet" />
              Teacher view
              <input type="checkbox" checked={teacher} onChange={(e) => onTeacherChange(e.target.checked)} className="peer sr-only" />
              <span
                className="relative h-4 w-7 rounded-full bg-ns-surface-3 transition peer-checked:bg-ns-violet after:absolute after:left-0.5 after:top-0.5 after:size-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3"
                aria-hidden
              />
            </label>
          )}
        </div>
      </div>

      {teacher && (
        <div className="mt-4 rounded-sm border border-ns-violet/30 bg-ns-violet-soft/60 p-3.5 text-sm text-ns-muted">
          <b className="text-ns-violet">Teacher view</b> shows private knowledge in violet: which deposit each of <i>your</i> withdrawals spent. Only
          the note holder knows this. The chain, the contract and the relayer never see it. The withdrawal steps above also show their hashes now.
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-ns-border text-[11px] uppercase tracking-wider text-ns-muted">
              <th className="py-2 pr-3 font-semibold">Event</th>
              <th className="py-2 pr-3 font-semibold">Pool</th>
              <th className="py-2 pr-3 font-semibold">Address</th>
              <th className="py-2 pr-3 font-semibold">Published hash</th>
              <th className="py-2 pr-3 font-semibold">When</th>
              {teacher && <th className="py-2 font-semibold text-ns-violet">Private link</th>}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={teacher ? 6 : 5} className="py-6 text-center text-sm text-ns-muted">
                  Nothing yet. Make a deposit, or add other users&apos; activity.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className={`border-b border-ns-border/60 ${teacher && e.mine ? "bg-ns-violet-soft/40" : ""}`}>
                <td className="py-2.5 pr-3">
                  {e.kind === "deposit" ? (
                    <Badge tone="teal">
                      <ArrowDownToLine className="size-3" /> Deposit
                    </Badge>
                  ) : (
                    <Badge tone="violet">
                      <ArrowUpFromLine className="size-3" /> Withdraw
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  {e.denom} {TOKEN}
                </td>
                <td className="py-2.5 pr-3 font-mono">{e.kind === "deposit" ? "from " : "to "}{shorten(e.address)}</td>
                <td className="py-2.5 pr-3 font-mono text-ns-muted">
                  {e.kind === "deposit" ? "commitment " : "nullifierHash "}
                  {shorten(e.hash)}
                  {e.kind === "deposit" && e.leaf ? <span className="text-ns-muted"> · leaf #{e.leaf.toLocaleString()}</span> : null}
                </td>
                <td className="py-2.5 pr-3 text-ns-muted">{now ? formatAgo(now - e.at) : "…"}</td>
                {teacher && (
                  <td className="py-2.5 font-mono text-ns-violet">
                    {e.mine && e.kind === "withdraw" && e.spentLeaf ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="size-3" /> spent leaf #{e.spentLeaf.toLocaleString()}
                      </span>
                    ) : e.mine ? (
                      "your deposit"
                    ) : (
                      <span className="text-ns-muted">unknown</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
