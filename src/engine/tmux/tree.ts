import type { TmuxState, Session, GameEvent, TreeState } from '../types';
import { clearActivePaneCopy } from './primitives';

export type TreeRow =
  | { kind: 'session'; sessionId: string }
  | { kind: 'window'; sessionId: string; windowId: string };

export function rowKey(r: TreeRow): string {
  return r.kind === 'session'
    ? `s:${r.sessionId}`
    : `w:${r.sessionId}::${r.windowId}`;
}

function compareRows(
  a: TreeRow, b: TreeRow, s: TmuxState, mode: 'index' | 'name' | 'time',
): number {
  if (mode === 'index') return 0;
  const meta = (r: TreeRow): { label: string; t: number } => {
    if (r.kind === 'session') {
      const se = s.sessions.find(x => x.id === r.sessionId);
      return { label: (se?.name ?? r.sessionId).toLowerCase(), t: se?.createdAt ?? 0 };
    }
    const se = s.sessions.find(x => x.id === r.sessionId);
    const w = se?.windows.find(x => x.id === r.windowId);
    return { label: (w?.name ?? r.windowId).toLowerCase(), t: w?.createdAt ?? 0 };
  };
  const A = meta(a), B = meta(b);
  if (mode === 'name') {
    return A.label < B.label ? -1 : A.label > B.label ? 1 : 0;
  }
  return A.t - B.t;
}

export function visibleRows(
  s: TmuxState,
  treeOrExpanded: TreeState | Record<string, boolean>,
): TreeRow[] {
  const isFullState = (x: unknown): x is TreeState =>
    typeof x === 'object' && x !== null && 'sortMode' in x;
  const t: TreeState | null = isFullState(treeOrExpanded) ? treeOrExpanded : null;
  const expanded: Record<string, boolean> = t ? t.expanded : treeOrExpanded as Record<string, boolean>;
  const mode: 'index' | 'name' | 'time' = t?.sortMode ?? 'index';
  const reverse = t?.reverseSort ?? false;
  const filter = (t?.filter ?? '').toLowerCase();

  const sessions = [...s.sessions].sort((a, b) =>
    compareRows({ kind: 'session', sessionId: a.id }, { kind: 'session', sessionId: b.id }, s, mode));
  if (reverse) sessions.reverse();

  const matches = (label: string): boolean =>
    !filter || label.toLowerCase().includes(filter);

  const rows: TreeRow[] = [];
  for (const se of sessions) {
    const sessRow: TreeRow = { kind: 'session', sessionId: se.id };
    const wins = [...se.windows].sort((a, b) =>
      compareRows(
        { kind: 'window', sessionId: se.id, windowId: a.id },
        { kind: 'window', sessionId: se.id, windowId: b.id }, s, mode));
    if (reverse) wins.reverse();
    const childRows: TreeRow[] = expanded[se.id]
      ? wins.map(w => ({ kind: 'window', sessionId: se.id, windowId: w.id } as TreeRow))
      : [];
    const sessHit = matches(se.name);
    const visibleChildren = childRows.filter(r => {
      if (r.kind !== 'window') return false;
      const w = se.windows.find(x => x.id === r.windowId);
      return matches(w?.name ?? '');
    });
    if (filter) {
      const childMatchAnywhere = se.windows.some(w => matches(w.name));
      if (!sessHit && !childMatchAnywhere) continue;
    }
    rows.push(sessRow);
    rows.push(...visibleChildren);
  }
  return rows;
}

export function openWindowTree(s: TmuxState, se: Session, events: GameEvent[]): void {
  clearActivePaneCopy(s);
  const expanded: Record<string, boolean> = { [se.id]: true };
  s.mode = 'tree';
  s.tree = {
    kind: 'window', cursor: 0, expanded,
    tagged: {}, filter: '', filterMode: false,
    sortMode: 'index', reverseSort: false, showPreview: true,
  };
  const rows = visibleRows(s, s.tree);
  const i = rows.findIndex(
    r => r.kind === 'window' && r.windowId === se.activeWindowId);
  if (i >= 0) s.tree.cursor = i;
  events.push({ type: 'tree-opened', kind: 'window' });
}
