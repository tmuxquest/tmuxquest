export class Stopwatch {
  private everStarted = false;
  private paused = false;
  private stopped = false;
  private runningSince: number | null = null;
  private accumulated = 0;

  get started(): boolean { return this.everStarted; }
  get running(): boolean { return this.everStarted && !this.paused && !this.stopped; }

  elapsed(now: number): number {
    return this.accumulated + (this.runningSince !== null ? now - this.runningSince : 0);
  }

  start(now: number): void {
    if (this.everStarted || this.stopped) return;
    this.everStarted = true;
    if (!this.paused) this.runningSince = now;
  }

  setPaused(paused: boolean, now: number): void {
    if (this.stopped || paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      if (this.runningSince !== null) { this.accumulated += now - this.runningSince; this.runningSince = null; }
    } else if (this.everStarted && this.runningSince === null) {
      this.runningSince = now;
    }
  }

  stop(now: number): void {
    if (this.stopped) return;
    if (this.runningSince !== null) { this.accumulated += now - this.runningSince; this.runningSince = null; }
    this.stopped = true;
  }

  reset(): void {
    this.everStarted = false; this.paused = false; this.stopped = false;
    this.runningSince = null; this.accumulated = 0;
  }
}

export interface PauseFlags {
  engineComplete: boolean; menuOpen: boolean; pendingBrief: boolean; overlayActive: boolean; hidden: boolean;
}
export function shouldPause(f: PauseFlags): boolean {
  return f.engineComplete || f.menuOpen || f.pendingBrief || f.overlayActive || f.hidden;
}

export function formatStopwatch(ms: number): string {
  const clamped = Math.max(0, ms);
  const tenths = Math.floor(clamped / 100) % 10;
  const totalSec = Math.floor(clamped / 1000);
  return `${totalSec}.${tenths}s`;
}
