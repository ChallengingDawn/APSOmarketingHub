// A delivery the hub's chain could not finish - its copy restarted mid-run, most likely
// out of memory - is tried again on the next tick, because its download record is saved
// only after the run (sftp.ts, `defer`). Twice is the limit: the run itself may be what
// restarts the copy, and a third try would take a server down every 15 minutes. Pure, so
// the rule is tested on its own.

export const MAX_CHAIN_TRIES = 2;

export type ChainTry = { sig: string; n: number; at: number };

/** The same delivery = the same files at the same sizes and times. */
export function deliverySig(files: { remote: string; size: number; mtime: number }[]): string {
  return files.map((f) => `${f.remote}:${f.size}:${f.mtime}`).sort().join("|");
}

/** Before a run: start it (and count it), or give up on this delivery. */
export function nextTry(prev: ChainTry | null, sig: string, now: number): { giveUp: boolean; save: ChainTry } {
  const n = prev && prev.sig === sig ? prev.n : 0;
  if (n >= MAX_CHAIN_TRIES) return { giveUp: true, save: { sig, n, at: now } };
  return { giveUp: false, save: { sig, n: n + 1, at: now } };
}
