"use client";

import { useSyncExternalStore } from "react";
import { History } from "lucide-react";
import { Badge } from "./ui";
import { clock, formatAgo, formatDuration, shorten, TOKEN, type MixRecord } from "@/lib/nullset/sim";

/** Completed mixes: the holder's own view, pairing each deposit with the withdrawal it funded. */
export function MixHistory({ mixes }: { mixes: MixRecord[] }) {
  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const since = now ? now - clock.loadedAt() : 0;
  const age = (abs: number | undefined, atLoad: number | undefined) => (abs ? now - abs : since + (atLoad ?? 0));

  return (
    <section id="history" className="mt-5 scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <History className="size-4 text-ns-teal" /> Previous mixes
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ns-muted">
        Your own history. You can pair each deposit with its withdrawal because you held the note. Nobody else can.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {mixes.map((m) => {
          const dAge = age(m.depositAt, m.depositAge);
          const withdrawn = m.withdrawAt != null || m.withdrawAge != null;
          const wAge = age(m.withdrawAt, m.withdrawAge);
          return (
            <article key={m.id} className="rounded-sm border border-ns-border bg-ns-surface-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {m.denom} {TOKEN}
                </span>
                {m.depositAt ? <Badge tone="teal">this session</Badge> : <Badge tone="muted">earlier</Badge>}
              </div>
              <ol className="mt-3 space-y-2 text-xs">
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ns-teal" /> In from <span className="font-mono">{shorten(m.from)}</span>
                  </span>
                  <span className="text-ns-muted">{now ? formatAgo(dAge) : "…"}</span>
                </li>
                <li className="ml-[3px] border-l border-dashed border-ns-border-strong py-1 pl-4 text-ns-muted">
                  {!withdrawn ? "still being mixed" : now ? `${formatDuration(dAge - wAge)} in the pool` : "…"} · leaf #{m.leaf.toLocaleString()}
                </li>
                {withdrawn ? (
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-ns-violet" /> Out to <span className="font-mono">{shorten(m.to)}</span>
                    </span>
                    <span className="text-ns-muted">{now ? formatAgo(wAge) : "…"}</span>
                  </li>
                ) : (
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ns-teal/50" /> <span className="text-ns-teal">In pool</span>
                  </li>
                )}
              </ol>
              <p className="mt-3 border-t border-ns-border pt-3 text-xs text-ns-muted">
                Hidden among <b className="text-ns-text">{m.setSize.toLocaleString()}</b> equal deposits
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
