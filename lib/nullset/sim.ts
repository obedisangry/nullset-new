// Nullset: local, in-browser simulation helpers.
//
// Nothing in this file touches a network, wallet, or blockchain. Hashes are
// real SHA-256 (Web Crypto) so the note → commitment → nullifier flow is
// genuine, but "deposits", "proofs" and "withdrawals" only change React state.

/** Preset deposit amounts shown as quick buttons. Any positive amount is allowed. */
export const DENOMS = ["5", "10", "20", "30", "40", "50"] as const;
export type Denom = string;
export const TOKEN = "ETH";

/** Fixed display rate used only to show a USD estimate next to the balance. */
export const ETH_USD = 3400;

export function formatUsd(eth: number, rate: number = ETH_USD): string {
  return (eth * rate).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randAddress(): string {
  return "0x" + randHex(20);
}

export async function sha256(...parts: string[]): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(parts.join("|"))));
}

export function shorten(h: string, head = 6, tail = 4): string {
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function isAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a.trim());
}

// ---- notes ---------------------------------------------------------------

export interface Note {
  denom: Denom;
  nullifier: string;
  secret: string;
}

export function makeNote(denom: Denom): Note {
  return { denom, nullifier: randHex(31), secret: randHex(31) };
}

export function encodeNote(n: Note, prefix = "nullset"): string {
  return `${prefix}-${n.denom}${TOKEN.toLowerCase()}-${n.nullifier}${n.secret}`;
}

export function parseNote(raw: string): Note | null {
  const m = raw.trim().match(/^[a-z0-9]{1,24}-(\d+(?:\.\d+)?)eth-([0-9a-f]{62})([0-9a-f]{62})$/);
  if (!m) return null;
  return { denom: m[1] as Denom, nullifier: m[2], secret: m[3] };
}

export const commitmentOf = (n: Note) => sha256(n.nullifier, n.secret);
export const nullifierHashOf = (n: Note) => sha256("nf", n.nullifier);

// ---- seeded pool data (deterministic so server and client render match) ---

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PoolDeposit {
  index: number;
  /** Absolute time (ms) for deposits made in this session. */
  at?: number;
  /** Age in ms at page load, for seeded deposits. */
  ageAtLoad?: number;
  mine?: boolean;
}

export interface Pool {
  count: number;
  withdrawn: number;
  recent: PoolDeposit[]; // newest first
  leaves: Record<string, number>; // commitment → leaf number, for deposits made this session
  spent: string[];
}

const SEED_COUNTS: Record<Denom, number> = { "5": 412, "10": 286, "20": 154, "30": 97, "40": 63, "50": 41 };
const SEED_SPACING_MIN: Record<Denom, number> = { "5": 25, "10": 40, "20": 70, "30": 110, "40": 160, "50": 220 };

export function seedPools(): Record<Denom, Pool> {
  const rnd = mulberry32(20261106);
  const out = {} as Record<Denom, Pool>;
  for (const d of DENOMS) {
    const count = SEED_COUNTS[d];
    let age = rnd() * SEED_SPACING_MIN[d] * 60_000;
    const recent: PoolDeposit[] = [];
    for (let i = 0; i < 40; i++) {
      recent.push({ index: count - i, ageAtLoad: age });
      age += (0.3 + rnd() * 1.4) * SEED_SPACING_MIN[d] * 60_000;
    }
    out[d] = { count, withdrawn: Math.floor(count * (0.55 + rnd() * 0.2)), recent, leaves: {}, spent: [] };
  }
  return out;
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ---- clock store (for useSyncExternalStore; 0 on the server) -------------

let now = 0;
let loadedAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

export const clock = {
  subscribe(cb: () => void) {
    subs.add(cb);
    if (!timer) {
      timer = setInterval(() => {
        now = Date.now();
        subs.forEach((f) => f());
      }, 15_000);
    }
    return () => {
      subs.delete(cb);
      if (!subs.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  },
  getSnapshot() {
    if (!now) now = loadedAt = Date.now();
    return now;
  },
  getServerSnapshot() {
    return 0;
  },
  loadedAt: () => loadedAt,
  tick() {
    now = Date.now();
    subs.forEach((f) => f());
  },
};

export function depositAge(d: PoolDeposit, nowMs: number): number {
  if (d.at) return nowMs - d.at;
  return nowMs - clock.loadedAt() + (d.ageAtLoad ?? 0);
}

export interface LedgerEvent {
  id: string;
  kind: "deposit" | "withdraw";
  denom: Denom;
  /** Depositor (deposit) or recipient (withdraw). Public. */
  address: string;
  /** Commitment (deposit) or nullifier hash (withdraw). Public. */
  hash: string;
  at: number;
  fee?: number;
  leaf?: number;
  mine?: boolean;
  /** Private knowledge only the note holder has: which leaf a withdrawal spent. */
  spentLeaf?: number;
  /** Pool size when a withdrawal happened. */
  setSize?: number;
  /** Seconds to wait before animating this event (staggers batches). */
  delay?: number;
}

export interface MixRecord {
  id: string;
  denom: Denom;
  from: string;
  to: string;
  /** Absolute times for this session's mixes. */
  depositAt?: number;
  withdrawAt?: number;
  /** Ages at page load (ms) for earlier example mixes. */
  depositAge?: number;
  withdrawAge?: number;
  setSize: number;
  leaf: number;
}

function seededHex(rnd: () => number, bytes: number) {
  let out = "";
  for (let i = 0; i < bytes; i++) out += Math.floor(rnd() * 256).toString(16).padStart(2, "0");
  return out;
}

/** A few earlier mixes so the history isn't empty on first load (deterministic for SSR). */
export function seedMixHistory(): MixRecord[] {
  const rnd = mulberry32(7331);
  const H = 3_600_000;
  const D = 24 * H;
  const rows: [Denom, number | undefined, number, number, number][] = [
    ["14.2", undefined, 4 * H, 184, 179],
    ["20", 2 * H, 10 * H, 148, 139],
    ["30", 8.5 * D, 10 * D, 91, 84],
    ["10", 11 * D, 12 * D, 268, 251],
    ["50", 13 * D, 14 * D, 37, 33],
    ["5", 15 * D, 16 * D, 405, 389],
  ];
  return rows.map(([denom, wAge, dAge, setSize, leaf], i) => ({
    id: "seed" + i,
    denom,
    from: "0x" + seededHex(rnd, 20),
    to: "0x" + seededHex(rnd, 20),
    depositAge: dAge,
    withdrawAge: wAge,
    setSize,
    leaf,
  }));
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.round(h / 24)} days`;
}


/** Build an editable example mix for the presenter's history. */
export function makeExampleMix(denom: Denom, depositAgeMs: number, withdrawn: boolean): MixRecord {
  const setSize = 60 + Math.floor(Math.random() * 320);
  return {
    id: "ex" + randHex(6),
    denom,
    from: randAddress(),
    to: randAddress(),
    depositAge: depositAgeMs,
    withdrawAge: withdrawn ? Math.max(0, depositAgeMs * 0.5) : undefined,
    setSize,
    leaf: 1 + Math.floor(Math.random() * setSize),
  };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
