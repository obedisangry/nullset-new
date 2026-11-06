"use client";

import { useState } from "react";
import {
  ArrowUpFromLine,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Button, InfoTip } from "./ui";
import type { DemoWallet } from "./Header";
import {
  commitmentOf,
  isAddress,
  nullifierHashOf,
  parseNote,
  randAddress,
  randHex,
  shorten,
  sleep,
  TOKEN,
  type Denom,
  type Pool,
} from "@/lib/nullset/sim";
import { brandSlug, useBrand } from "@/lib/nullset/brand";

interface PoolCardProps {
  wallet: DemoWallet | null;
  connecting: boolean;
  pools: Record<Denom, Pool>;
  denom: Denom;
  onDenomChange: (d: Denom) => void;
  onConnect: () => void;
  onDeposit: (denom: Denom, commitment: string) => number;
  onWithdraw: (w: { denom: Denom; commitment: string; nullifierHash: string; recipient: string; payout: number; fee: number }) => void;
  toast: (msg: string) => void;
  teacher: boolean;
  /** Relayer fee as a fraction, e.g. 0.005 for 0.5 %. */
  feeRate: number;
  /** Multiplier for the simulated waiting times (1 = normal). */
  speed: number;
}

export function PoolCard(props: PoolCardProps) {
  return (
    <section id="pool" className="scroll-mt-24 rounded-sm border border-ns-border bg-ns-surface p-2">
      <div className="rounded-sm bg-ns-bg/60 p-1">
        <div className="flex h-11 items-center justify-center gap-2 rounded-sm bg-ns-surface-3 text-sm font-semibold text-ns-text shadow">
          <ArrowUpFromLine className="size-4 text-ns-teal" />
          Withdraw
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <WithdrawTab {...props} initialNote="" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Withdraw
// ---------------------------------------------------------------------------

type StepState = "todo" | "active" | "done" | "error";
const STEPS = [
  "Parse note and recompute the commitment",
  "Find the leaf and build its Merkle path",
  "Generate the zero-knowledge proof",
  "Relayer submits; contract verifies",
] as const;

function WithdrawTab({ wallet, pools, onWithdraw, toast, initialNote, teacher, feeRate, speed }: PoolCardProps & { initialNote: string }) {
  const { name } = useBrand();
  const [note, setNote] = useState(initialNote);
  const [recipient, setRecipient] = useState("");
  const [relayer, setRelayer] = useState(true);
  const [steps, setSteps] = useState<StepState[] | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; msg: string; tx?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = parseNote(note);
  const amount = parsed ? Number(parsed.denom) : 0;
  const fee = relayer ? +(amount * feeRate).toFixed(6) : 0;
  const linksBack = !!wallet && recipient.trim().toLowerCase() === wallet.address.toLowerCase();

  const noteError = note.trim() && !parsed ? `That doesn't look like a valid ${name} note.` : null;
  const addrError = recipient.trim() && !isAddress(recipient) ? "Enter a 0x address with 40 hex characters." : null;

  async function withdraw() {
    if (!parsed || !isAddress(recipient)) return;
    setBusy(true);
    setResult(null);
    const s: StepState[] = ["active", "todo", "todo", "todo"];
    const update = (i: number, v: StepState) => {
      s[i] = v;
      setSteps([...s]);
    };
    setSteps([...s]);
    const det: string[] = [];
    const explain = (i: number, t: string) => {
      det[i] = t;
      setDetails([...det]);
    };
    setDetails([]);
    const fail = (i: number, msg: string) => {
      update(i, "error");
      setResult({ ok: false, msg });
      setBusy(false);
    };

    await sleep(500 * speed);
    const pool = pools[parsed.denom];
    const commitment = await commitmentOf(parsed);
    if (!(commitment in pool.leaves)) {
      return fail(0, "No deposit in this pool matches the note, so a real prover couldn't build a proof.");
    }
    explain(0, `commitment = H(nullifier, secret) = ${shorten(commitment, 10, 6)}`);
    update(0, "done");
    update(1, "active");
    await sleep(700 * speed);
    explain(1, `Leaf #${pool.leaves[commitment].toLocaleString()} of ${pool.count.toLocaleString()}. The real proof hides which leaf.`);
    update(1, "done");
    update(2, "active");
    await sleep(1600 * speed);
    const nullifierHash = await nullifierHashOf(parsed);
    explain(2, `Public output: nullifierHash = H(nullifier) = ${shorten(nullifierHash, 10, 6)}`);
    update(2, "done");
    update(3, "active");
    await sleep(900 * speed);
    if (pool.spent.includes(nullifierHash)) {
      return fail(3, `Nullifier hash ${shorten(nullifierHash)} has already been spent. Rejected as a double-spend.`);
    }
    const payout = +(amount - fee).toFixed(6);
    onWithdraw({ denom: parsed.denom, commitment, nullifierHash, recipient: recipient.trim(), payout, fee });
    explain(3, `nullifierHash not in the spent set, so it is accepted and added. Recipient ${shorten(recipient.trim())}.`);
    update(3, "done");
    const tx = "0x" + randHex(32);
    setResult({ ok: true, msg: `Sent ${payout} ${TOKEN} to ${shorten(recipient.trim())}.`, tx });
    toast("Withdrawal complete");
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <label htmlFor="ns-note" className="text-sm font-medium text-ns-muted">
          Note
        </label>
        <InfoTip>The secret note you saved when you deposited. It stays in this browser tab and is never uploaded.</InfoTip>
      </div>
      <textarea
        id="ns-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        spellCheck={false}
        placeholder={`${brandSlug(name)}-10eth-…`}
        className="w-full resize-none rounded-sm border border-ns-border bg-ns-surface-2 px-4 py-3 font-mono text-xs leading-relaxed text-ns-text placeholder:text-ns-muted/60 focus:border-ns-teal focus:outline-none"
      />
      {noteError && <p className="mt-1.5 text-xs text-ns-danger">{noteError}</p>}

      <div className="mb-2 mt-4 flex items-center justify-between">
        <label htmlFor="ns-recipient" className="text-sm font-medium text-ns-muted">
          Recipient address
        </label>
        <button onClick={() => setRecipient(randAddress())} className="inline-flex items-center gap-1 text-xs font-semibold text-ns-teal hover:underline">
          <RefreshCw className="size-3" /> Use a fresh address
        </button>
      </div>
      <input
        id="ns-recipient"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        spellCheck={false}
        placeholder="0x…"
        className="h-12 w-full rounded-sm border border-ns-border bg-ns-surface-2 px-4 font-mono text-xs text-ns-text placeholder:text-ns-muted/60 focus:border-ns-teal focus:outline-none"
      />
      {addrError && <p className="mt-1.5 text-xs text-ns-danger">{addrError}</p>}
      {linksBack && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ns-warn">
          <CircleAlert className="size-3.5" /> This is your connected address. Withdrawing here links the two sides again.
        </p>
      )}

      <div className="mt-4 rounded-sm border border-ns-border bg-ns-surface-2 p-4 text-sm">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            Use relayer
            <InfoTip>A fresh address has no coins to pay gas. A relayer submits the transaction and takes a small fee from the withdrawal.</InfoTip>
          </span>
          <input type="checkbox" checked={relayer} onChange={(e) => setRelayer(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-11 rounded-full bg-ns-surface-3 transition peer-checked:bg-ns-teal after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" aria-hidden />
        </label>
        <dl className="mt-3 space-y-1.5 border-t border-ns-border pt-3 text-xs">
          <Row k="Pool" v={parsed ? `${parsed.denom} ${TOKEN}` : "—"} />
          <Row k={`Relayer fee (${+(feeRate * 100).toFixed(2)}%)`} v={parsed ? `${fee} ${TOKEN}` : "—"} />
          <Row k="You receive" v={parsed ? `${+(amount - fee).toFixed(6)} ${TOKEN}` : "—"} strong />
        </dl>
      </div>

      <Button size="lg" className="mt-5 w-full" onClick={withdraw} loading={busy} disabled={!parsed || !isAddress(recipient)}>
        {busy ? "Working…" : "Withdraw"}
      </Button>

      {steps && (
        <ol className="mt-5 space-y-2.5">
          {STEPS.map((label, i) => (
            <li key={label} className="text-sm">
              <div className="flex items-center gap-2.5">
                {steps[i] === "done" && <CircleCheck className="size-4 shrink-0 text-ns-ok" />}
                {steps[i] === "active" && <LoaderCircle className="size-4 shrink-0 animate-spin text-ns-teal" />}
                {steps[i] === "error" && <CircleAlert className="size-4 shrink-0 text-ns-danger" />}
                {steps[i] === "todo" && <span className="size-4 shrink-0 rounded-full border border-ns-border-strong" />}
                <span className={steps[i] === "todo" ? "text-ns-muted" : ""}>{label}</span>
              </div>
              {teacher && details[i] && <p className="ml-[26px] mt-1 break-all font-mono text-[11px] text-ns-violet">{details[i]}</p>}
            </li>
          ))}
        </ol>
      )}

      {result && (
        <div className={`mt-4 rounded-sm border p-3.5 text-sm ${result.ok ? "border-ns-ok/30 bg-ns-teal-soft text-ns-text" : "border-ns-danger/30 bg-ns-danger-soft text-ns-danger"}`}>
          <p>{result.msg}</p>
          {result.tx && (
            <p className="mt-1 font-mono text-xs text-ns-muted">
              Tx {shorten(result.tx, 10, 8)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ns-muted">{k}</dt>
      <dd className={strong ? "font-semibold text-ns-teal" : ""}>{v}</dd>
    </div>
  );
}
