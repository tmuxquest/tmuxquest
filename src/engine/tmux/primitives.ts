import type { TmuxState, Window, Session } from '../types';
import { paneOrder } from '../layout';

export const clone = <T>(v: T): T => structuredClone(v);

export const REPEAT_TIME_MS = 500;

export const attached = (s: TmuxState): Session | undefined =>
  s.sessions.find(x => x.id === s.attachedSessionId);

export const activeWin = (se: Session): Window =>
  se.windows.find(w => w.id === se.activeWindowId)!;

export function reconcileCopy(s: TmuxState): void {
  const map = s.copyByPane;
  if (!map) { if (s.mode === 'copy') s.mode = 'normal'; delete s.copy; return; }
  if (Object.keys(map).length > 0) {
    const live = new Set<string>();
    for (const se of s.sessions) for (const w of se.windows) {
      for (const id of paneOrder(w.layout)) live.add(id);
    }
    for (const id of Object.keys(map)) if (!live.has(id)) delete map[id];
  }
  const se = attached(s);
  const ap = se ? activeWin(se).activePaneId : undefined;
  const entry = ap ? map[ap] : undefined;
  if (entry) {
    s.copy = entry;
    if (s.mode === 'normal') s.mode = 'copy';
  } else {
    delete s.copy;
    if (s.mode === 'copy') s.mode = 'normal';
  }
}

export function clearActivePaneCopy(s: TmuxState): void {
  const se = attached(s);
  if (!se || !s.copyByPane) return;
  delete s.copyByPane[activeWin(se).activePaneId];
}

export function migrateCopyState(s: TmuxState): void {
  if (s.mode === 'copy' && s.copy && !s.copyByPane?.[s.copy.paneId]) {
    (s.copyByPane ??= {})[s.copy.paneId] = s.copy;
  }
}

export function pushBuffer(s: TmuxState, text: string): string {
  if (!s.pasteBuffers) s.pasteBuffers = [];
  if (s.nextBufferIdx == null) s.nextBufferIdx = 0;
  const name = `buffer${s.nextBufferIdx++}`;
  s.pasteBuffers.unshift({ name, text });
  if (s.pasteBuffers.length > 9) s.pasteBuffers.length = 9;
  s.pasteBuffer = s.pasteBuffers[0]!.text;
  return name;
}

export function syncBufferAlias(s: TmuxState): void {
  s.pasteBuffer = s.pasteBuffers?.[0]?.text;
}

export function cleanupPaneRoles(w: Window, removedPid: string): void {
  if (!w.paneRoles) return;
  for (const role of Object.keys(w.paneRoles)) {
    if (w.paneRoles[role] === removedPid) delete w.paneRoles[role];
  }
  if (Object.keys(w.paneRoles).length === 0) delete w.paneRoles;
}
