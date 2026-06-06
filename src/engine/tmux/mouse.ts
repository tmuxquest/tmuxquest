import type {
  TmuxState, KeyToken, DispatchResult, GameEvent, PaneMenuItem,
} from '../types';
import { paneOrder, resizeActive } from '../layout';
import { clone, attached, activeWin, pushBuffer, reconcileCopy, clearActivePaneCopy } from './primitives';
import { clampCol, clampRow, colForGoal, copyLines, yankSelection } from './copyMode';
import type { ApplyOpts } from './commands';

export type MouseAction =
  | { kind: 'focus-pane'; sessionId: string; windowId: string; paneId: string }
  | { kind: 'switch-window'; sessionId: string; windowId: string }
  | { kind: 'open-tree-sessions' }
  | { kind: 'open-pane-menu'; sessionId: string; windowId: string; paneId: string }
  | { kind: 'resize-pane-edge'; paneId: string; edge: 'L'|'R'|'U'|'D'; deltaRatio: number }
  | { kind: 'wheel'; dir: 'up'|'down'; lines: number }
  | { kind: 'copy-mode-set-cursor'; row: number; col: number }
  | { kind: 'copy-mode-anchor'; row: number; col: number }
  | { kind: 'copy-mode-begin-drag'; anchorRow: number; anchorCol: number; row: number; col: number }
  | { kind: 'copy-mode-commit' };

export function enterCopyMode(s: TmuxState, events: GameEvent[], opts?: ApplyOpts): void {
  const se = attached(s);
  if (!se) return;
  const w = activeWin(se);
  const pid = w.activePaneId;
  if (s.copyByPane?.[pid]) return;
  const promptLine = opts?.promptLineFor?.(pid);
  const lines = copyLines(w.paneContent?.[pid] ?? [], { promptLine });
  const last = Math.max(0, lines.length - 1);
  const entry = {
    paneId: pid,
    cursor: { row: last, col: Math.max(0, (lines[last] ?? '').length - 1) },
    anchor: null,
    selectMode: 'char' as const,
    search: null,
    searchActive: false,
    goalCol: null,
    ...(promptLine != null ? { promptLine } : {}),
  };
  (s.copyByPane ??= {})[pid] = entry;
  s.copy = entry;
  s.mode = 'copy';
  s.buffer = '';
  events.push({ type: 'copy-mode-entered' });
}

function buildPaneMenu(s: TmuxState, _paneId: string): PaneMenuItem[] {
  const se = attached(s);
  const w = se ? activeWin(se) : null;
  const zoomed = w?.zoomedPaneId != null;
  return [
    { label: 'Horizontal Split', key: 'h', command: 'split-window -h' },
    { label: 'Vertical Split',   key: 'v', command: 'split-window -v' },
    { label: 'Swap Up',     key: 'u', command: 'swap-pane -U', separatorBefore: true },
    { label: 'Swap Down',   key: 'd', command: 'swap-pane -D' },
    { label: 'Kill',    key: 'X', command: 'kill-pane', separatorBefore: true },
    { label: zoomed ? 'Unzoom' : 'Zoom', key: 'z', command: 'resize-pane -Z' },
  ];
}

function paneMenuTitle(s: TmuxState, paneId: string): string {
  const se = attached(s);
  const w = se ? activeWin(se) : null;
  const idx = w ? paneOrder(w.layout).indexOf(paneId) : -1;
  return `${idx < 0 ? 0 : idx} (${paneId.replace(/^p/, '%')})`;
}

export function firstEnabled(items: PaneMenuItem[]): number {
  const i = items.findIndex(it => !it.disabled);
  return i < 0 ? 0 : i;
}

export function stepMenuCursor(items: PaneMenuItem[], cursor: number, dir: 1 | -1): number {
  const n = items.length;
  if (n === 0) return cursor;
  let i = cursor;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (!items[i]!.disabled) return i;
  }
  return cursor;
}

export function dispatchAction(state: TmuxState, action: MouseAction, opts?: ApplyOpts): DispatchResult {
  const r = dispatchActionInner(state, action, opts);
  reconcileCopy(r.state);
  return r;
}

function dispatchActionInner(state: TmuxState, action: MouseAction, opts?: ApplyOpts): DispatchResult {
  const s = clone(state);
  const events: GameEvent[] = [];
  delete s.statusMessage;

  switch (action.kind) {
    case 'focus-pane': {
      const se = s.sessions.find(x => x.id === action.sessionId);
      if (!se) return { state: s, events };
      const w = se.windows.find(x => x.id === action.windowId);
      if (!w) return { state: s, events };
      const order = paneOrder(w.layout);
      if (!order.includes(action.paneId)) return { state: s, events };
      if (w.activePaneId === action.paneId) return { state: s, events };
      w.lastPaneId = w.activePaneId;
      w.activePaneId = action.paneId;
      events.push({ type: 'pane-navigated', paneId: action.paneId });
      return { state: s, events };
    }
    case 'switch-window': {
      const se = s.sessions.find(x => x.id === action.sessionId);
      if (!se) return { state: s, events };
      if (!se.windows.some(w => w.id === action.windowId)) {
        return { state: s, events };
      }
      if (se.activeWindowId === action.windowId) return { state: s, events };
      if (s.attachedSessionId !== action.sessionId) {
        s.attachedSessionId = action.sessionId;
        s.activeSessionId = action.sessionId;
        events.push({ type: 'session-switched', sessionId: action.sessionId });
      }
      se.lastWindowId = se.activeWindowId;
      se.activeWindowId = action.windowId;
      events.push({ type: 'window-switched', windowId: action.windowId });
      return { state: s, events };
    }
    case 'open-tree-sessions': {
      clearActivePaneCopy(s);
      const expanded: Record<string, boolean> = {};
      const i = s.sessions.findIndex(x => x.id === s.attachedSessionId);
      s.mode = 'tree';
      s.tree = {
        kind: 'session', cursor: Math.max(0, i), expanded,
        tagged: {}, filter: '', filterMode: false,
        sortMode: 'index', reverseSort: false, showPreview: true,
      };
      events.push({ type: 'tree-opened', kind: 'session' });
      return { state: s, events };
    }
    case 'open-pane-menu': {
      const se = s.sessions.find(x => x.id === action.sessionId);
      if (!se) return { state: s, events };
      const w = se.windows.find(x => x.id === action.windowId);
      if (!w) return { state: s, events };
      if (!paneOrder(w.layout).includes(action.paneId)) {
        return { state: s, events };
      }
      if (w.activePaneId !== action.paneId) {
        w.lastPaneId = w.activePaneId;
        w.activePaneId = action.paneId;
        events.push({ type: 'pane-navigated', paneId: action.paneId });
      }
      const items = buildPaneMenu(s, action.paneId);
      s.mode = 'menu';
      s.menu = {
        paneId: action.paneId,
        title: paneMenuTitle(s, action.paneId),
        items, cursor: firstEnabled(items),
      };
      events.push({ type: 'menu-opened', paneId: action.paneId });
      return { state: s, events };
    }
    case 'resize-pane-edge': {
      const se = attached(s);
      if (!se) return { state: s, events };
      const w = activeWin(se);
      const keyMap: Record<'L'|'R'|'U'|'D', KeyToken> = {
        L: 'C-Left', R: 'C-Right', U: 'C-Up', D: 'C-Down',
      };
      const delta = Math.max(0.001, Math.min(0.5, action.deltaRatio));
      w.layout = resizeActive(w.layout, action.paneId, keyMap[action.edge], delta);
      events.push({
        type: 'pane-resized',
        paneId: action.paneId, dir: action.edge, amount: 1,
      });
      return { state: s, events };
    }
    case 'wheel': {
      if (action.dir === 'up') {
        if (s.mode !== 'copy') enterCopyMode(s, events, opts);
        if (s.mode === 'copy' && s.copy) {
          const se = attached(s);
          if (se) {
            const w = activeWin(se);
            const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
            const row = clampRow(lines, s.copy.cursor.row - action.lines);
            s.copy.cursor = { row, col: colForGoal(lines, row, s.copy.goalCol) };
          }
        }
      } else {
        if (s.mode === 'copy' && s.copy) {
          const se = attached(s);
          if (se) {
            const w = activeWin(se);
            const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
            const atBottom = s.copy.cursor.row >= lines.length - 1;
            if (atBottom) {
              if (s.copyByPane) delete s.copyByPane[s.copy.paneId];
              s.buffer = '';
              events.push({ type: 'copy-mode-exited' });
            } else {
              const row = clampRow(lines, s.copy.cursor.row + action.lines);
              s.copy.cursor = { row, col: colForGoal(lines, row, s.copy.goalCol) };
            }
          }
        }
      }
      return { state: s, events };
    }
    case 'copy-mode-set-cursor': {
      if (s.mode !== 'copy' || !s.copy) return { state: s, events };
      const se = attached(s);
      if (!se) return { state: s, events };
      const w = activeWin(se);
      const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
      const row = clampRow(lines, action.row);
      const col = clampCol(lines, row, action.col);
      s.copy.cursor = { row, col };
      s.copy.goalCol = col;
      return { state: s, events };
    }
    case 'copy-mode-anchor': {
      if (s.mode !== 'copy' || !s.copy) return { state: s, events };
      const se = attached(s);
      if (!se) return { state: s, events };
      const w = activeWin(se);
      const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
      const row = clampRow(lines, action.row);
      const col = clampCol(lines, row, action.col);
      s.copy.anchor = { row, col };
      s.copy.cursor = { row, col };
      s.copy.goalCol = col;
      s.copy.selectMode = 'char';
      return { state: s, events };
    }
    case 'copy-mode-begin-drag': {
      if (s.mode !== 'copy') enterCopyMode(s, events, opts);
      if (s.mode !== 'copy' || !s.copy) return { state: s, events };
      const se = attached(s);
      if (!se) return { state: s, events };
      const w = activeWin(se);
      const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
      const ar = clampRow(lines, action.anchorRow);
      const ac = clampCol(lines, ar, action.anchorCol);
      const cr = clampRow(lines, action.row);
      const cc = clampCol(lines, cr, action.col);
      s.copy.anchor = { row: ar, col: ac };
      s.copy.cursor = { row: cr, col: cc };
      s.copy.goalCol = cc;
      s.copy.selectMode = 'char';
      return { state: s, events };
    }
    case 'copy-mode-commit': {
      if (s.mode !== 'copy' || !s.copy) return { state: s, events };
      if (s.copy.anchor === null) return { state: s, events };
      const se = attached(s);
      if (!se) return { state: s, events };
      const w = activeWin(se);
      const lines = copyLines(w.paneContent?.[s.copy.paneId] ?? [], s.copy);
      const text = yankSelection(lines, s.copy.selectMode, s.copy.anchor, s.copy.cursor);
      pushBuffer(s, text);
      events.push({ type: 'text-copied', text });
      if (s.copyByPane) delete s.copyByPane[s.copy.paneId];
      s.buffer = '';
      events.push({ type: 'copy-mode-exited' });
      return { state: s, events };
    }
  }
}
