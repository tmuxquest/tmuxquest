import type { TmuxState, Window, LayoutNode } from '../engine/types';
import type { MouseAction } from '../engine/tmuxModel';

export type MouseEventKind =
  | 'click' | 'dblclick'
  | 'mousedown' | 'mousemove' | 'mouseup'
  | 'contextmenu'
  | 'wheel';

export type MouseTarget =
  | { kind: 'pane'; paneId: string; row?: number; col?: number }
  | { kind: 'divider'; paneId: string; edge: 'L'|'R'|'U'|'D' }
  | { kind: 'status-window'; windowId: string; sessionId: string }
  | { kind: 'status-session-name' }
  | { kind: 'tree-row'; index: number; double?: boolean };

export interface MouseModifiers {
  wheelDelta?: number;
  shift?: boolean;
}

export function routeMouseEvent(
  state: TmuxState,
  kind: MouseEventKind,
  target: MouseTarget,
  modifiers?: MouseModifiers,
): MouseAction | null {
  if (state.options?.mouse !== 'on') return null;

  switch (target.kind) {
    case 'pane': {
      if (kind === 'contextmenu') {
        if (state.copyByPane?.[target.paneId]) return null;
        const loc = locatePane(state, target.paneId);
        if (!loc) return null;
        return {
          kind: 'open-pane-menu',
          sessionId: loc.sessionId, windowId: loc.windowId,
          paneId: target.paneId,
        };
      }
      if (state.copy && state.copy.paneId === target.paneId) {
        if (kind === 'mousedown') {
          return {
            kind: 'copy-mode-anchor',
            row: target.row ?? 0, col: target.col ?? 0,
          };
        }
        if (kind === 'mousemove' || kind === 'click') {
          return {
            kind: 'copy-mode-set-cursor',
            row: target.row ?? 0, col: target.col ?? 0,
          };
        }
        if (kind === 'mouseup') {
          return { kind: 'copy-mode-commit' };
        }
      }
      if (kind === 'click' || kind === 'mousedown') {
        const loc = locatePane(state, target.paneId);
        if (!loc) return null;
        return {
          kind: 'focus-pane',
          sessionId: loc.sessionId, windowId: loc.windowId,
          paneId: target.paneId,
        };
      }
      if (kind === 'wheel') {
        const delta = modifiers?.wheelDelta ?? 0;
        const dir: 'up' | 'down' = delta < 0 ? 'up' : 'down';
        return { kind: 'wheel', dir, lines: 3 };
      }
      return null;
    }
    case 'divider': {
      if (kind === 'mousemove') {
        return {
          kind: 'resize-pane-edge',
          paneId: target.paneId, edge: target.edge,
          deltaRatio: 0.02,
        };
      }
      return null;
    }
    case 'status-window': {
      if (kind === 'click') {
        return {
          kind: 'switch-window',
          sessionId: target.sessionId, windowId: target.windowId,
        };
      }
      return null;
    }
    case 'status-session-name': {
      if (kind === 'click') return { kind: 'open-tree-sessions' };
      return null;
    }
    case 'tree-row': {
      return null;
    }
  }
}

function locatePane(
  state: TmuxState, paneId: string,
): { sessionId: string; windowId: string } | null {
  for (const se of state.sessions) {
    for (const w of se.windows) {
      const order = panesInWindow(w);
      if (order.includes(paneId)) {
        return { sessionId: se.id, windowId: w.id };
      }
    }
  }
  return null;
}

function panesInWindow(w: Window): string[] {
  const out: string[] = [];
  const walk = (n: LayoutNode) => {
    if (n.kind === 'leaf') { out.push(n.paneId); return; }
    walk(n.a); walk(n.b);
  };
  walk(w.layout);
  return out;
}
