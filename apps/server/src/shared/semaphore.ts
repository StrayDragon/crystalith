// Semaphore — concurrency limiter (binary semaphore with acquire/release).
//
// Used by research agent for RAII-style concurrency control.
// import { Semaphore } from './semaphore.ts';

export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];
  constructor(private max: number) {}

  async acquire(): Promise<() => void> {
    if (this.current < this.max) {
      this.current++;
      return this._release.bind(this);
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve(this._release.bind(this));
      });
    });
  }

  private _release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}
