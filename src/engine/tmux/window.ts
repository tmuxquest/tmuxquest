import type { TmuxState, Session, Window, GameEvent, LayoutNode } from '../types';
import { paneOrder } from '../layout';
import { attached, activeWin } from './primitives';

export function removeWindowAdjacent(se: Session, deadId: string): boolean {
  if (se.windows.length <= 1) return false;
  const idx = se.windows.findIndex(w => w.id === deadId);
  if (idx < 0) return false;
  const wasActive = se.activeWindowId === deadId;
  se.windows = se.windows.filter(w => w.id !== deadId);
  if (wasActive) {
    const newIdx = Math.min(idx, se.windows.length - 1);
    se.activeWindowId = se.windows[newIdx]!.id;
  }
  if (se.lastWindowId === deadId) se.lastWindowId = undefined;
  return true;
}

export function killWindow(
  s: TmuxState, se: Session, deadId: string, e: GameEvent[],
): boolean {
  if (!removeWindowAdjacent(se, deadId)) return false;
  e.push({ type: 'window-killed' });
  return true;
}

export function killSession(s: TmuxState, deadId: string, e: GameEvent[]): boolean {
  const target = s.sessions.find(x => x.id === deadId);
  if (!target) return false;
  if (s.sessions.length === 1) {
    s.statusMessage = `can't kill the only session`;
    return false;
  }
  const wasAttached = target.id === s.attachedSessionId;
  const deadIdx = s.sessions.findIndex(x => x.id === target.id);
  s.sessions = s.sessions.filter(x => x.id !== target.id);
  if (wasAttached) {
    s.attachedSessionId = null;
    const newIdx = Math.min(deadIdx, s.sessions.length - 1);
    s.activeSessionId = s.sessions[newIdx]!.id;
    e.push({ type: 'detached' });
  } else if (!s.sessions.some(x => x.id === s.activeSessionId)) {
    s.activeSessionId = s.attachedSessionId!;
  }
  e.push({ type: 'session-killed' });
  return true;
}

export function newWindow(s: TmuxState, name: string): Window {
  const id = `w${s.nextId++}`;
  const paneId = `p${s.nextId++}`;
  return { id, name, createdAt: Date.now(),
    layout: { kind: 'leaf', paneId }, activePaneId: paneId, zoomedPaneId: null,
    paneContent: { [paneId]: [] } };
}

export function swapWindows(se: Session, aIdx: number, bIdx: number): void {
  const tmp = se.windows[aIdx]!;
  se.windows[aIdx] = se.windows[bIdx]!;
  se.windows[bIdx] = tmp;
}

export function moveWindowAt(se: Session, fromIdx: number, toIdx: number): void {
  const [w] = se.windows.splice(fromIdx, 1);
  se.windows.splice(toIdx, 0, w!);
}

export function findMatch(
  s: TmuxState, query: string,
): { sessionId: string; windowId: string } | null {
  const q = query.toLowerCase();
  if (!q) return null;
  const ordered = [
    ...s.sessions.filter(x => x.id === s.attachedSessionId),
    ...s.sessions.filter(x => x.id !== s.attachedSessionId),
  ];
  for (const se of ordered) {
    for (const w of se.windows) {
      if (w.name.toLowerCase().includes(q)) {
        return { sessionId: se.id, windowId: w.id };
      }
    }
  }
  return null;
}

export function swapPaneByDelta(s: TmuxState, delta: -1 | 1, e: GameEvent[]): void {
  const se = attached(s);
  if (!se) return;
  const w = activeWin(se);
  const order = paneOrder(w.layout);
  if (order.length < 2) return;
  const i = order.indexOf(w.activePaneId);
  const j = (i + delta + order.length) % order.length;
  if (i === j) return;
  const a = order[i]!, b = order[j]!;
  const swap = (n: LayoutNode): LayoutNode => {
    if (n.kind === 'leaf') {
      if (n.paneId === a) return { ...n, paneId: b };
      if (n.paneId === b) return { ...n, paneId: a };
      return n;
    }
    return { ...n, a: swap(n.a), b: swap(n.b) };
  };
  w.layout = swap(w.layout);
  e.push({ type: 'pane-swapped', aPaneId: a, bPaneId: b });
}
