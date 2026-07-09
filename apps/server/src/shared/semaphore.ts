// Semaphore — classic counting semaphore (~15 loc), lighter than the npm
// "semaphore" package and `bun build --compile` friendly (zero deps).
export class Semaphore {
  private available: number;
  private waiters: (() => void)[] = [];

  constructor(count: number) {
    this.available = count;
  }

  /** Acquire a permit. Returns a release function. */
  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available--;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => {
        this.available--;
        resolve(() => this.release());
      });
    });
  }

  /** Running count of acquired permits. */
  running(): number {
    return this.waiters.length;
  }

  private release() {
    this.available++;
    this.waiters.shift()?.();
  }
}
