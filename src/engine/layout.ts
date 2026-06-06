import type { LayoutNode, Rect, KeyToken, PresetName } from './types';

export const WINDOW_COLS = 120;
export const WINDOW_ROWS = 40;

export const PANE_MINIMUM = 1;

function evenSplit(dir: 'v' | 'h', panes: string[]): LayoutNode {
  if (panes.length === 1) return { kind: 'leaf', paneId: panes[0]! };
  return {
    kind: 'split', dir, ratio: 1 / panes.length,
    a: { kind: 'leaf', paneId: panes[0]! },
    b: evenSplit(dir, panes.slice(1)),
  };
}

function mainSplit(majorDir: 'v' | 'h', panes: string[]): LayoutNode {
  if (panes.length === 1) return { kind: 'leaf', paneId: panes[0]! };
  const minor: 'v' | 'h' = majorDir === 'v' ? 'h' : 'v';
  return {
    kind: 'split', dir: majorDir, ratio: 0.5,
    a: { kind: 'leaf', paneId: panes[0]! },
    b: evenSplit(minor, panes.slice(1)),
  };
}

function tiledLayout(panes: string[]): LayoutNode {
  if (panes.length === 1) return { kind: 'leaf', paneId: panes[0]! };
  const cols = Math.ceil(Math.sqrt(panes.length));
  const columns: string[][] = Array.from({ length: cols }, () => []);
  for (let i = 0; i < panes.length; i++) columns[i % cols]!.push(panes[i]!);
  const columnTrees = columns.map(col => evenSplit('h', col));
  const combine = (i: number): LayoutNode => {
    const t = columnTrees[i]!;
    if (i === columnTrees.length - 1) return t;
    return {
      kind: 'split', dir: 'v', ratio: 1 / (columnTrees.length - i),
      a: t, b: combine(i + 1),
    };
  };
  return combine(0);
}

export function buildPreset(preset: PresetName, panes: string[]): LayoutNode {
  switch (preset) {
    case 'even-h': return evenSplit('v', panes);
    case 'even-v': return evenSplit('h', panes);
    case 'main-h': return mainSplit('h', panes);
    case 'main-v': return mainSplit('v', panes);
    case 'tiled':  return tiledLayout(panes);
  }
}

export function computeRects(node: LayoutNode, area: Rect): Map<string, Rect> {
  const out = new Map<string, Rect>();
  const walk = (n: LayoutNode, a: Rect) => {
    if (n.kind === 'leaf') { out.set(n.paneId, a); return; }
    if (n.dir === 'v') {
      const wa = Math.round(a.w * n.ratio);
      walk(n.a, { x: a.x, y: a.y, w: wa, h: a.h });
      walk(n.b, { x: a.x + wa, y: a.y, w: a.w - wa, h: a.h });
    } else {
      const ha = Math.round(a.h * n.ratio);
      walk(n.a, { x: a.x, y: a.y, w: a.w, h: ha });
      walk(n.b, { x: a.x, y: a.y + ha, w: a.w, h: a.h - ha });
    }
  };
  walk(node, area);
  return out;
}

export function canSplitPane(
  layout: LayoutNode, paneId: string, dir: 'v' | 'h',
): boolean {
  const r = computeRects(layout, { x: 0, y: 0, w: WINDOW_COLS, h: WINDOW_ROWS }).get(paneId);
  if (!r) return false;
  const minimum = PANE_MINIMUM * 2 + 1;
  return dir === 'v' ? r.w >= minimum : r.h >= minimum;
}

export function paneOrder(node: LayoutNode): string[] {
  if (node.kind === 'leaf') return [node.paneId];
  return [...paneOrder(node.a), ...paneOrder(node.b)];
}

export function resizeActive(
  node: LayoutNode, active: string, dir: KeyToken, delta = 0.1,
): LayoutNode {
  const wantDir: 'v' | 'h' =
    dir === 'C-Left' || dir === 'C-Right' ||
    dir === 'M-Left' || dir === 'M-Right' ? 'v' : 'h';
  let done = false;
  const walk = (n: LayoutNode): LayoutNode => {
    if (done || n.kind === 'leaf') return n;
    const aHas = paneOrder(n.a).includes(active);
    const bHas = paneOrder(n.b).includes(active);
    if (!aHas && !bHas) return n;
    const child = aHas ? walk(n.a) : walk(n.b);
    const rebuilt: LayoutNode = aHas ? { ...n, a: child } : { ...n, b: child };
    if (done) return rebuilt;
    if (n.dir === wantDir) {
      const grow = dir === 'C-Right' || dir === 'C-Down' ||
                   dir === 'M-Right' || dir === 'M-Down';
      const sign = (aHas ? 1 : -1) * (grow ? 1 : -1);
      const next = Math.min(0.9, Math.max(0.1, n.ratio + sign * delta));
      done = true;
      return { ...rebuilt, ratio: next } as LayoutNode;
    }
    return rebuilt;
  };
  return walk(node);
}

export function resizeActiveAbsolute(
  node: LayoutNode, active: string, want: 'v' | 'h', target: number,
): LayoutNode {
  let done = false;
  const walk = (n: LayoutNode): LayoutNode => {
    if (done || n.kind === 'leaf') return n;
    const aHas = paneOrder(n.a).includes(active);
    const bHas = paneOrder(n.b).includes(active);
    if (!aHas && !bHas) return n;
    const child = aHas ? walk(n.a) : walk(n.b);
    const rebuilt: LayoutNode = aHas ? { ...n, a: child } : { ...n, b: child };
    if (done) return rebuilt;
    if (n.dir === want) {
      const ratioForActive = aHas ? target : 1 - target;
      const next = Math.min(0.9, Math.max(0.1, ratioForActive));
      done = true;
      return { ...rebuilt, ratio: next } as LayoutNode;
    }
    return rebuilt;
  };
  return walk(node);
}

export function paneInDirection(
  from: string, dir: KeyToken, rects: Map<string, Rect>
): string | null {
  const me = rects.get(from);
  if (!me) return null;
  const overlapsV = (r: Rect) => r.y < me.y + me.h && r.y + r.h > me.y;
  const overlapsH = (r: Rect) => r.x < me.x + me.w && r.x + r.w > me.x;
  const qualifies = (r: Rect): boolean => {
    if (dir === 'Right') return r.x >= me.x + me.w && overlapsV(r);
    if (dir === 'Left')  return r.x + r.w <= me.x && overlapsV(r);
    if (dir === 'Down')  return r.y >= me.y + me.h && overlapsH(r);
    if (dir === 'Up')    return r.y + r.h <= me.y && overlapsH(r);
    return false;
  };
  const mcx = me.x + me.w / 2, mcy = me.y + me.h / 2;
  let best: string | null = null, bestDist = Infinity;
  for (const [id, r] of rects) {
    if (id === from || !qualifies(r)) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const d = Math.abs(cx - mcx) + Math.abs(cy - mcy);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}
