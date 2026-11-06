"use client";

import { useCallback, useRef, useState } from "react";
import { Header, type DemoWallet } from "./Header";
import { PoolCard } from "./PoolCard";
import { StatsCard } from "./StatsCard";
import { Footer } from "./Footer";
import { ObserverCard } from "./ObserverCard";
import { ControlsCard, type Controls } from "./ControlsCard";
import { MixingVisual } from "./MixingVisual";
import { MixHistory } from "./MixHistory";
import { DepositHistory } from "./DepositHistory";
import { brandStyle, useBrand } from "@/lib/nullset/brand";
import { usePresenter } from "@/lib/nullset/present";
import { WalletModal, WALLET_OPTIONS, type WalletKind } from "./WalletModal";
import { clock, randAddress, randHex, seedMixHistory, seedPools, sha256, makeExampleMix, type Denom, type LedgerEvent, type MixRecord, type Pool } from "@/lib/nullset/sim";

const HOW = [
  { title: "Make a note", body: "Your browser creates a random nullifier and secret. Their hash, the commitment, is what gets deposited." },
  { title: "Join the tree", body: "Each commitment becomes a leaf in the pool's Merkle tree, alongside every other equal-sized deposit." },
  { title: "Prove, don't reveal", body: "A zero-knowledge proof shows you own some leaf without saying which. The nullifier hash stops double-spends." },
  { title: "Withdraw fresh", body: "Funds go to a new address, optionally through a relayer. On chain, nothing links it to your deposit." },
];

export function MixerApp() {
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pools, setPools] = useState<Record<Denom, Pool>>(seedPools);
  const [denom, setDenom] = useState<Denom>("10");
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [teacher, setTeacher] = useState(false);
  const presenter = usePresenter();
  const [mixes, setMixes] = useState<MixRecord[]>(seedMixHistory);
  const [controls, setControls] = useState<Controls>({ feeRate: 0.005, speed: 1 });
  const brand = useBrand();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const [picker, setPicker] = useState(false);

  function connect() {
    setPicker(true);
    setConnecting(true);
  }

  function closePicker() {
    setPicker(false);
    setConnecting(false);
  }

  function connected(kind: WalletKind) {
    // Always connect at 0; the presenter sets a balance from the controls.
    setWallet({ address: randAddress(), balance: 0 });
    closePicker();
    toast(`${WALLET_OPTIONS.find((o) => o.id === kind)?.name ?? "Wallet"} connected`);
  }

  function log(e: Omit<LedgerEvent, "id" | "at">) {
    setEvents((list) => [{ ...e, id: randHex(8), at: Date.now() }, ...list].slice(0, 100));
  }

  const emptyPool = (): Pool => ({ count: 0, withdrawn: 0, recent: [], leaves: {}, spent: [] });

  // Select an amount, creating its pool on the fly for custom amounts.
  function selectDenom(d: Denom) {
    setPools((p) => (p[d] ? p : { ...p, [d]: emptyPool() }));
    setDenom(d);
  }

  /** Adds a deposit to a pool and returns its leaf number. */
  function addDeposit(d: Denom, commitment: string, address: string, mine: boolean): number {
    const index = (pools[d] ?? emptyPool()).count + 1;
    setPools((p) => {
      const cur = p[d] ?? emptyPool();
      return {
        ...p,
        [d]: {
          ...cur,
          count: cur.count + 1,
          recent: [{ index, at: Date.now(), mine }, ...cur.recent].slice(0, 60),
          leaves: mine ? { ...cur.leaves, [commitment]: index } : cur.leaves,
        },
      };
    });
    log({ kind: "deposit", denom: d, address, hash: commitment, leaf: index, mine });
    clock.tick();
    return index;
  }

  function deposit(d: Denom, commitment: string): number {
    const index = addDeposit(d, commitment, wallet?.address ?? randAddress(), true);
    setWallet((w) => (w ? { ...w, balance: +(w.balance - Number(d)).toFixed(6) } : w));
    setDenom(d);
    return index;
  }

  function withdraw(w: { denom: Denom; commitment: string; nullifierHash: string; recipient: string; payout: number; fee: number }) {
    const d = w.denom;
    setPools((p) => { const cur = p[d] ?? emptyPool(); return { ...p, [d]: { ...cur, withdrawn: cur.withdrawn + 1, spent: [...cur.spent, w.nullifierHash] } }; });
    setWallet((cur) => (cur && cur.address.toLowerCase() === w.recipient.toLowerCase() ? { ...cur, balance: +(cur.balance + w.payout).toFixed(6) } : cur));
    const pool = pools[d] ?? emptyPool();
    const leaf = pool.leaves[w.commitment];
    log({ kind: "withdraw", denom: d, address: w.recipient, hash: w.nullifierHash, fee: w.fee, mine: true, spentLeaf: leaf, setSize: pool.count });
    const dep = events.find((e) => e.kind === "deposit" && e.mine && e.denom === d && e.leaf === leaf);
    setMixes((m) => [
      { id: randHex(8), denom: d, from: dep?.address ?? "0x" + randHex(20), to: w.recipient, depositAt: dep?.at ?? Date.now(), withdrawAt: Date.now(), setSize: pools[d].count, leaf },
      ...m,
    ]);
    setDenom(d);
    clock.tick();
  }

  /** Other users' deposits and withdrawals, so the class can watch the anonymity set grow. */
  async function strangerActivity() {
    const d = denom;
    let count = (pools[d] ?? emptyPool()).count;
    let withdrawn = 0;
    const added: { index: number; at: number }[] = [];
    const newEvents: LedgerEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const at = Date.now();
      if (Math.random() < 0.6) {
        count += 1;
        added.unshift({ index: count, at });
        newEvents.unshift({ id: randHex(8), at, delay: i * 0.7, kind: "deposit", denom: d, address: randAddress(), hash: await sha256(randHex(31), randHex(31)), leaf: count });
      } else {
        withdrawn += 1;
        newEvents.unshift({ id: randHex(8), at, delay: i * 0.7, kind: "withdraw", denom: d, address: randAddress(), hash: await sha256("nf", randHex(31)), fee: 0 });
      }
    }
    setPools((p) => ({
      ...p,
      [d]: (() => { const cur = p[d] ?? emptyPool(); return { ...cur, count: cur.count + added.length, withdrawn: cur.withdrawn + withdrawn, recent: [...added, ...cur.recent].slice(0, 60) }; })(),
    }));
    setEvents((list) => [...newEvents, ...list].slice(0, 100));
    clock.tick();
  }

  function setPoolSize(d: Denom, count: number) {
    setPools((p) => {
      const pool = p[d];
      const shift = count - pool.count;
      return {
        ...p,
        [d]: {
          ...pool,
          count,
          withdrawn: Math.min(pool.withdrawn, count),
          recent: pool.recent.map((r) => ({ ...r, index: r.index + shift })).filter((r) => r.index > 0),
          leaves: Object.fromEntries(Object.entries(pool.leaves).map(([c, i]) => [c, i + shift])),
        },
      };
    });
  }

  function reset() {
    setPools(seedPools());
    setDenom("10");
    setEvents([]);
    setMixes(seedMixHistory());
    setWallet(null);
    setControls({ feeRate: 0.005, speed: 1 });
    toast("Session reset");
  }
  // Presenter history editing (teacher view).
  function editMix(id: string, patch: Partial<MixRecord>) {
    setMixes((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function addMix() {
    setMixes((list) => [makeExampleMix("10", 24 * 3_600_000, true), ...list]);
  }
  function removeMix(id: string) {
    setMixes((list) => list.filter((m) => m.id !== id));
  }


  return (
    <div id="top" className="ns-shell flex min-h-screen flex-col" style={brandStyle(brand)}>
      <title>{`${brand.name}: private transfers`}</title>
      <Header wallet={wallet} connecting={connecting} onConnect={connect} onDisconnect={() => setWallet(null)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <div className="pb-10 pt-12 sm:pt-20">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Private transfers.
            <br />
            <span className="text-ns-muted">No link on chain.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ns-muted sm:text-base">
            Deposit into a shared pool, keep your secret note, and withdraw to a fresh address. A zero-knowledge proof
            breaks the on-chain link between the two.
          </p>
        </div>

        {teacher && (
          <ControlsCard
            walletBalance={wallet?.balance ?? null}
            onBalanceChange={(b) => setWallet((w) => (w ? { ...w, balance: b } : w))}
            controls={controls}
            onControlsChange={setControls}
            pools={pools}
            onPoolSizeChange={setPoolSize}
            mixes={mixes}
            onHistoryChange={editMix}
            onHistoryAdd={addMix}
            onHistoryRemove={removeMix}
            onReset={reset}
          />
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <PoolCard
            wallet={wallet}
            connecting={connecting}
            pools={pools}
            denom={denom}
            onDenomChange={selectDenom}
            onConnect={connect}
            onDeposit={deposit}
            onWithdraw={withdraw}
            toast={toast}
            teacher={teacher}
            feeRate={controls.feeRate}
            speed={controls.speed}
          />
          <StatsCard pools={pools} denom={denom} onDenomChange={selectDenom} />
        </div>

        <MixingVisual events={events} pools={pools} denom={denom} teacher={teacher} wallet={wallet} mixes={mixes} />
        <ObserverCard events={events} teacher={teacher} presenter={presenter} onTeacherChange={setTeacher} onStrangerActivity={strangerActivity} />
        <DepositHistory events={events} mixes={mixes} />
        <MixHistory mixes={mixes} />

        <section id="how" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-2xl text-sm text-ns-muted">
            Four steps from deposit to an unlinked withdrawal. Your note never leaves your device.
          </p>
          <ol className="mt-6 grid border-l border-t border-ns-border sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map(({ title, body }, i) => (
              <li key={title} className="border-b border-r border-ns-border p-5">
                <span className="text-xs text-ns-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ns-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer toast={toast} />

      {picker && <WalletModal speed={controls.speed} onClose={closePicker} onConnected={connected} />}

      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4 transition ${toastMsg ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
      >
        {toastMsg && <div className="rounded-sm border border-ns-border bg-ns-surface-3 px-4 py-2.5 text-sm">{toastMsg}</div>}
      </div>
    </div>
  );
}
