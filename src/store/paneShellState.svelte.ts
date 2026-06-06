import type { Line } from '../ui/shellFs';

export interface HistoryEntry { cwd: string; cmd: string; output: Line[]; }

export interface PaneShellStore {
  readonly transcript: readonly HistoryEntry[];
  readonly input: string;
  readonly cwd: string;
  readonly pasteSeq: number;
  readonly pasteRange: { start: number; end: number } | null;
  setInput(v: string): void;
  setCwd(v: string): void;
  appendInput(text: string): void;
  append(e: HistoryEntry): void;
  clear(): void;
}

function createPaneShellStore(initialCwd: string): PaneShellStore {
  let transcript = $state<HistoryEntry[]>([]);
  let input = $state('');
  let cwd = $state(initialCwd);
  let pasteSeq = $state(0);
  let pasteRange = $state<{ start: number; end: number } | null>(null);
  return {
    get transcript() { return transcript; },
    get input() { return input; },
    get cwd() { return cwd; },
    get pasteSeq() { return pasteSeq; },
    get pasteRange() { return pasteRange; },
    setInput(v) { input = v; pasteRange = null; },
    setCwd(v) { cwd = v; },
    appendInput(text) {
      const start = input.length;
      input = input + text;
      pasteRange = { start, end: input.length };
      pasteSeq++;
    },
    append(e) { transcript = [...transcript, e]; },
    clear() { transcript = []; },
  };
}

const stores = new Map<string, PaneShellStore>();

export const paneShellState = {
  get(paneId: string, initialCwd: string): PaneShellStore {
    let s = stores.get(paneId);
    if (!s) { s = createPaneShellStore(initialCwd); stores.set(paneId, s); }
    return s;
  },
  peek(paneId: string): PaneShellStore | undefined {
    return stores.get(paneId);
  },
  retain(livePaneIds: ReadonlySet<string>): void {
    for (const id of stores.keys()) {
      if (!livePaneIds.has(id)) stores.delete(id);
    }
  },
  reset(): void { stores.clear(); },
};
