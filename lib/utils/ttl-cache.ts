// A tiny cross-request read cache.
//
// Every page render, ISR regeneration and API call used to re-query Firestore
// for data that only changes when a cron runs (every 5-15 minutes). React's
// cache() only dedupes inside a single render pass, so identical reads were
// billed over and over — the dominant line item on this project's bill.
// Wrapping a read in a TtlCache keeps repeated calls off Firestore for a
// window shorter than the cron cadence that changes the data (5-15 min), so
// cached values are never staler than the source itself.

type Entry<T> = { at: number; value: T };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at >= this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { at: Date.now(), value });
  }

  /** Run `load` only when the key is absent or stale. */
  async wrap(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await load();
    this.set(key, value);
    return value;
  }
}
