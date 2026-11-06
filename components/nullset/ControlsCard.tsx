"use client";

import { useState } from "react";
import { Clock, Palette, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "./ui";
import { DENOMS, TOKEN, type Denom, type MixRecord, type Pool } from "@/lib/nullset/sim";
import { BRAND_PRESETS, brandStore, DEFAULT_BRAND, isHex, useBrand } from "@/lib/nullset/brand";

export interface Controls {
  feeRate: number;
  speed: number;
}

interface ControlsCardProps {
  walletBalance: number | null;
  onBalanceChange: (b: number) => void;
  controls: Controls;
  onControlsChange: (c: Controls) => void;
  pools: Record<Denom, Pool>;
  onPoolSizeChange: (d: Denom, count: number) => void;
  mixes: MixRecord[];
  onHistoryChange: (id: string, patch: Partial<MixRecord>) => void;
  onHistoryAdd: () => void;
  onHistoryRemove: (id: string) => void;
  onReset: () => void;
}

const SPEEDS = [
  { v: 0.35, label: "Fast" },
  { v: 1, label: "Normal" },
  { v: 2.2, label: "Slow (explain each step)" },
];

/** Presenter-only panel, shown with teacher view, for setting up classroom scenarios. */
export function ControlsCard(p: ControlsCardProps) {
  return (
    <section className="mb-5 rounded-sm border border-ns-violet/40 bg-ns-surface p-4 sm:p-6">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={p.onReset}>
          <RotateCcw className="size-3.5" /> Reset session
        </Button>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Wallet balance (${TOKEN})`}>
          {p.walletBalance === null ? (
            <p className="text-xs text-ns-muted">Connect the wallet first.</p>
          ) : (
            <NumberInput key={p.walletBalance} value={p.walletBalance} min={0} step={0.01} onCommit={p.onBalanceChange} />
          )}
        </Field>
        <Field label="Relayer fee (%)">
          <NumberInput
            key={p.controls.feeRate}
            value={+(p.controls.feeRate * 100).toFixed(3)}
            min={0}
            max={20}
            step={0.1}
            onCommit={(v) => p.onControlsChange({ ...p.controls, feeRate: v / 100 })}
          />
        </Field>
        <Field label="Animation speed">
          <select
            value={p.controls.speed}
            onChange={(e) => p.onControlsChange({ ...p.controls, speed: Number(e.target.value) })}
            className="h-10 w-full rounded-sm border border-ns-border bg-ns-surface-2 px-3 text-sm focus:border-ns-violet focus:outline-none"
          >
            {SPEEDS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Coins mixed (per pool)">
          <div className="grid grid-cols-2 gap-2">
            {DENOMS.map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <span className="w-8 shrink-0 text-[11px] text-ns-muted">
                  {d}
                </span>
                <NumberInput key={p.pools[d].count} value={p.pools[d].count} min={1} step={1} compact onCommit={(v) => p.onPoolSizeChange(d, Math.round(v))} />
              </div>
            ))}
          </div>
        </Field>
      </div>
      <BrandingControls />
      <HistoryControls mixes={p.mixes} onChange={p.onHistoryChange} onAdd={p.onHistoryAdd} onRemove={p.onHistoryRemove} />
    </section>
  );
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function HistoryControls({
  mixes,
  onChange,
  onAdd,
  onRemove,
}: {
  mixes: MixRecord[];
  onChange: (id: string, patch: Partial<MixRecord>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  // Only the seeded / presenter-added examples are editable (not live-session mixes).
  const examples = mixes.filter((m) => !m.depositAt);
  return (
    <div className="mt-4 rounded-sm border border-ns-border bg-ns-surface-2/60 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ns-muted">
          <Clock className="size-3.5" /> Example history
        </p>
        <button onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-semibold text-ns-teal hover:underline">
          <Plus className="size-3.5" /> Add entry
        </button>
      </div>
      {examples.length === 0 ? (
        <p className="text-xs text-ns-muted">No example entries. Add one to pre-fill the history for your presentation.</p>
      ) : (
        <div className="space-y-2">
          {examples.map((m) => (
            <HistoryRow key={m.id} mix={m} onChange={onChange} onRemove={onRemove} />
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-ns-muted">Edits show in Deposit history and Previous mixes. They reset with the session.</p>
    </div>
  );
}

const fieldCls = "h-9 w-full rounded-sm border border-ns-border bg-ns-surface-2 px-2.5 text-xs text-ns-text focus:border-ns-violet focus:outline-none";

function HistoryRow({ mix, onChange, onRemove }: { mix: MixRecord; onChange: (id: string, patch: Partial<MixRecord>) => void; onRemove: (id: string) => void }) {
  const ageMs = mix.depositAge ?? DAY;
  const withdrawn = mix.withdrawAge != null || mix.withdrawAt != null;

  // Controlled drafts so values always display (the remount approach went blank on iOS).
  const [unit, setUnit] = useState<"h" | "d">(ageMs >= DAY ? "d" : "h");
  const unitMs = unit === "d" ? DAY : HOUR;
  const [amountDraft, setAmountDraft] = useState(mix.denom);
  const [whenDraft, setWhenDraft] = useState(String(+(ageMs / unitMs).toFixed(2)));
  const [fromDraft, setFromDraft] = useState(mix.from);

  const commitAmount = () => {
    const n = Number(amountDraft);
    if (Number.isFinite(n) && n > 0) onChange(mix.id, { denom: String(n) });
    else setAmountDraft(mix.denom);
  };
  const commitWhen = (u: "h" | "d" = unit) => {
    const ms = Math.max(0, Number(whenDraft) || 0) * (u === "d" ? DAY : HOUR);
    onChange(mix.id, { depositAge: ms, withdrawAge: withdrawn ? ms * 0.5 : undefined });
  };
  const changeUnit = (u: "h" | "d") => {
    setUnit(u);
    setWhenDraft(String(+(ageMs / (u === "d" ? DAY : HOUR)).toFixed(2)));
  };
  const commitFrom = () => {
    const v = fromDraft.trim();
    if (v) onChange(mix.id, { from: v });
    else setFromDraft(mix.from);
  };

  return (
    <div className="rounded-sm border border-ns-border bg-ns-surface-2/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ns-muted">Entry</span>
        <button onClick={() => onRemove(mix.id)} aria-label="Delete entry" className="grid size-7 place-items-center rounded-sm border border-ns-border text-ns-muted hover:text-ns-danger">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Labeled label={`Amount (${TOKEN})`}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={fieldCls}
            aria-label="Amount"
          />
        </Labeled>
        <Labeled label="Status">
          <select
            value={withdrawn ? "w" : "p"}
            onChange={(e) => onChange(mix.id, { withdrawAge: e.target.value === "w" ? ageMs * 0.5 : undefined })}
            className={fieldCls}
            aria-label="Status"
          >
            <option value="w">Withdrawn</option>
            <option value="p">In pool</option>
          </select>
        </Labeled>
        <Labeled label="How long ago">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={whenDraft}
            onChange={(e) => setWhenDraft(e.target.value)}
            onBlur={() => commitWhen()}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={fieldCls}
            aria-label="How long ago"
          />
        </Labeled>
        <Labeled label="Unit">
          <select value={unit} onChange={(e) => changeUnit(e.target.value as "h" | "d")} className={fieldCls} aria-label="Unit">
            <option value="h">hours ago</option>
            <option value="d">days ago</option>
          </select>
        </Labeled>
      </div>
      <div className="mt-2">
        <Labeled label="From address">
          <input
            type="text"
            spellCheck={false}
            value={fromDraft}
            onChange={(e) => setFromDraft(e.target.value)}
            onBlur={commitFrom}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="0x…"
            className={`${fieldCls} font-mono`}
            aria-label="From address"
          />
        </Labeled>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-ns-muted">{label}</span>
      {children}
    </label>
  );
}

function BrandingControls() {
  const brand = useBrand();
  const [name, setName] = useState(brand.name);
  const commitName = () => {
    const v = name.trim().slice(0, 32);
    if (!v) return setName(brand.name);
    setName(v);
    if (v !== brand.name) brandStore.set({ name: v });
  };
  const custom = brand.primary !== DEFAULT_BRAND.primary || brand.secondary !== DEFAULT_BRAND.secondary || brand.name !== DEFAULT_BRAND.name;

  return (
    <div className="mt-4 rounded-sm border border-ns-border bg-ns-surface-2/60 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ns-muted">
          <Palette className="size-3.5" /> Branding
        </p>
        {custom && (
          <button
            onClick={() => {
              brandStore.reset();
              setName(DEFAULT_BRAND.name);
            }}
            className="text-xs font-semibold text-ns-teal hover:underline"
          >
            Reset branding
          </button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1.4fr] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[11px] text-ns-muted">Name</span>
          <input
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-10 w-full rounded-sm border border-ns-border bg-ns-surface-2 px-3 text-sm focus:border-ns-violet focus:outline-none"
          />
        </label>
        <div className="flex gap-3">
          <ColorField label="Primary" value={brand.primary} onChange={(v) => brandStore.set({ primary: v })} />
          <ColorField label="Secondary" value={brand.secondary} onChange={(v) => brandStore.set({ secondary: v })} />
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] text-ns-muted">Presets</span>
          <div className="flex flex-wrap gap-2">
            {BRAND_PRESETS.map((pr) => {
              const active = pr.primary === brand.primary && pr.secondary === brand.secondary;
              return (
                <button
                  key={pr.label}
                  title={pr.label}
                  aria-label={pr.label}
                  aria-pressed={active}
                  onClick={() => brandStore.set({ primary: pr.primary, secondary: pr.secondary })}
                  className={`flex h-10 items-center gap-1 rounded-sm border px-2.5 ${active ? "border-ns-text" : "border-ns-border hover:border-ns-border-strong"}`}
                >
                  <span className="size-4 rounded-full" style={{ background: pr.primary }} />
                  <span className="size-4 rounded-full" style={{ background: pr.secondary }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] text-ns-muted">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-sm border border-ns-border bg-ns-surface-2 pl-1.5 pr-3">
        <input
          type="color"
          value={value}
          onChange={(e) => isHex(e.target.value) && onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"
        />
        <span className="font-mono text-xs uppercase">{value}</span>
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-ns-border bg-ns-surface-2/60 p-3.5">
      <p className="mb-2 text-xs font-semibold text-ns-muted">{label}</p>
      {children}
    </div>
  );
}

/** Edits a local draft and commits on blur or Enter, so typing isn't fighting re-renders. */
function NumberInput({
  value,
  min,
  max,
  step,
  compact,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  compact?: boolean;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || draft.trim() === "") return setDraft(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`w-full rounded-sm border border-ns-border bg-ns-surface-2 px-3 font-mono focus:border-ns-violet focus:outline-none ${compact ? "h-8 text-xs" : "h-10 text-sm"}`}
    />
  );
}
