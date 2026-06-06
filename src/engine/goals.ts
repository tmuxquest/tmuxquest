import type { TmuxState, GameEvent, PresetName, LayoutNode } from './types';
import { paneOrder } from './layout';
import { attached, activeWin } from './tmuxModel';

export interface StateCheck {
  windowCount?: number;
  sessionCount?: number;
  activeWindowName?: string;
  panesInActiveWindow?: number;
  activeWindowZoomed?: boolean;
  attached?: boolean;
  attachedSessionName?: string;
  attachedSessionNameNot?: string;
  inCopyMode?: boolean;
  pasteBufferContains?: string;
  pasteBufferEquals?: string;
  lastPasteEquals?: string;
  activePaneLastLineContains?: string;
  windowNamesInOrder?: string[];
  activeWindowLayout?: PresetName;
  activeWindowSplitDir?: 'v' | 'h';
  activeWindowSplitDirs?: ('v' | 'h')[];
  pasteBufferCount?: number;
  activePaneLineCount?: number;
  paneOutputContains?: { paneRole: string; substring: string };
  sessionByName?: { name: string; windowNamesInOrder?: string[] };
  options?: Record<string, string>;
  minCopyCursorRow?: number;
  copyReturnedToBottom?: boolean;
}

export type Goal =
  | { kind: 'state'; check: StateCheck }
  | { kind: 'events'; sequence: GameEvent['type'][] }
  | { kind: 'all'; of: Goal[] };

function checkState(c: StateCheck, s: TmuxState): boolean {
  const se = attached(s);
  if (c.attached !== undefined && (se != null) !== c.attached) return false;
  if (c.sessionCount !== undefined && s.sessions.length !== c.sessionCount) return false;
  if (c.attachedSessionName !== undefined && se?.name !== c.attachedSessionName) return false;
  if (c.attachedSessionNameNot !== undefined && se?.name === c.attachedSessionNameNot) return false;
  if (c.inCopyMode !== undefined && (s.mode === 'copy') !== c.inCopyMode) return false;
  if (c.pasteBufferContains !== undefined &&
      !(s.pasteBuffer ?? '').includes(c.pasteBufferContains)) return false;
  if (c.pasteBufferEquals !== undefined &&
      (s.pasteBuffer ?? '') !== c.pasteBufferEquals) return false;
  if (c.lastPasteEquals !== undefined &&
      (s.lastPaste ?? '') !== c.lastPasteEquals) return false;
  if (c.pasteBufferCount !== undefined &&
      (s.pasteBuffers?.length ?? 0) !== c.pasteBufferCount) return false;
  if (se) {
    const w = activeWin(se);
    if (c.windowCount !== undefined && se.windows.length !== c.windowCount) return false;
    if (c.activeWindowName !== undefined && w.name !== c.activeWindowName) return false;
    if (c.panesInActiveWindow !== undefined &&
        paneOrder(w.layout).length !== c.panesInActiveWindow) return false;
    if (c.activeWindowZoomed !== undefined &&
        (w.zoomedPaneId !== null) !== c.activeWindowZoomed) return false;
    if (c.activePaneLineCount !== undefined) {
      const cl = w.paneContent?.[w.activePaneId];
      if ((cl?.length ?? 0) !== c.activePaneLineCount) return false;
    }
    if (c.activePaneLastLineContains !== undefined) {
      const cl = w.paneContent?.[w.activePaneId];
      if (!cl || cl.length === 0 ||
          !cl[cl.length - 1]!.includes(c.activePaneLastLineContains)) return false;
    }
    if (c.activeWindowLayout !== undefined &&
        w.currentLayout !== c.activeWindowLayout) return false;
    if (c.activeWindowSplitDir !== undefined &&
        (w.layout.kind !== 'split' || w.layout.dir !== c.activeWindowSplitDir)) return false;
    if (c.activeWindowSplitDirs !== undefined) {
      const present = new Set<'v' | 'h'>();
      const walk = (n: LayoutNode) => {
        if (n.kind === 'split') { present.add(n.dir); walk(n.a); walk(n.b); }
      };
      walk(w.layout);
      if (!c.activeWindowSplitDirs.every(d => present.has(d))) return false;
    }
    if (c.windowNamesInOrder !== undefined) {
      const target = c.windowNamesInOrder;
      if (se.windows.length !== target.length) return false;
      for (let i = 0; i < target.length; i++) {
        if (se.windows[i]!.name !== target[i]) return false;
      }
    }
  } else if (c.windowCount !== undefined || c.activeWindowName !== undefined ||
             c.panesInActiveWindow !== undefined || c.activeWindowZoomed !== undefined ||
             c.activePaneLastLineContains !== undefined ||
             c.windowNamesInOrder !== undefined ||
             c.activeWindowLayout !== undefined ||
             c.activeWindowSplitDir !== undefined ||
             c.activeWindowSplitDirs !== undefined ||
             c.activePaneLineCount !== undefined) {
    return false;
  }
  if (c.sessionByName !== undefined) {
    const target = s.sessions.find(x => x.name === c.sessionByName!.name);
    if (!target) return false;
    if (c.sessionByName.windowNamesInOrder !== undefined) {
      const want = c.sessionByName.windowNamesInOrder;
      if (target.windows.length !== want.length) return false;
      for (let i = 0; i < want.length; i++) {
        if (target.windows[i]!.name !== want[i]) return false;
      }
    }
  }
  if (c.options !== undefined) {
    const stateOpts = s.options ?? {};
    for (const [k, v] of Object.entries(c.options)) {
      if (stateOpts[k] !== v) return false;
    }
  }
  if (c.minCopyCursorRow !== undefined) {
    if (s.minCopyCursorRow === undefined) return false;
    if (s.minCopyCursorRow > c.minCopyCursorRow) return false;
  }
  if (c.copyReturnedToBottom !== undefined) {
    if ((s.copyReturnedToBottom ?? false) !== c.copyReturnedToBottom) return false;
  }
  if (c.paneOutputContains !== undefined) {
    const se2 = attached(s);
    const w2 = se2 ? activeWin(se2) : null;
    if (!w2 || !w2.paneRoles || !w2.paneContent) return false;
    const pid = w2.paneRoles[c.paneOutputContains.paneRole];
    if (!pid) return false;
    const arr = w2.paneContent[pid];
    if (!arr) return false;
    return arr.some(line => line.includes(c.paneOutputContains!.substring));
  }
  return true;
}

function matchesSequence(seq: GameEvent['type'][], evs: GameEvent[]): boolean {
  let i = 0;
  for (const e of evs) if (e.type === seq[i]) { i++; if (i === seq.length) return true; }
  return seq.length === 0;
}

export function evaluateGoal(g: Goal, s: TmuxState, evs: GameEvent[]): boolean {
  if (g.kind === 'state') return checkState(g.check, s);
  if (g.kind === 'events') return matchesSequence(g.sequence, evs);
  return g.of.every(sub => evaluateGoal(sub, s, evs));
}

export function evaluateMissionSteps(
  steps: ReadonlyArray<{ readonly goal: Goal }>,
  s: TmuxState,
  evs: GameEvent[],
): boolean[] {
  const flags = steps.map(st => evaluateGoal(st.goal, s, evs));
  for (let i = flags.length - 2; i >= 0; i--) {
    if (flags[i + 1]) flags[i] = true;
  }
  return flags;
}
