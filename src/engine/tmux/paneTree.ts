import type { LayoutNode, Window, PresetName } from '../types';
import { paneOrder, buildPreset } from '../layout';

export const PRESET_CYCLE: PresetName[] = ['even-h', 'even-v', 'main-h', 'main-v', 'tiled'];

export function applyPreset(w: Window, preset: PresetName): void {
  const panes = paneOrder(w.layout);
  w.layout = buildPreset(preset, panes);
  w.currentLayout = preset;
  w.zoomedPaneId = null;
  w.lastPaneId = undefined;
}

export function replaceLeafWithSplit(
  layout: LayoutNode, oldId: string, newPaneId: string, dir: 'v' | 'h',
): LayoutNode {
  if (layout.kind === 'leaf') {
    if (layout.paneId !== oldId) return layout;
    return {
      kind: 'split', dir, ratio: 0.5,
      a: { kind: 'leaf', paneId: oldId },
      b: { kind: 'leaf', paneId: newPaneId },
    };
  }
  return {
    ...layout,
    a: replaceLeafWithSplit(layout.a, oldId, newPaneId, dir),
    b: replaceLeafWithSplit(layout.b, oldId, newPaneId, dir),
  };
}

export function removeLeaf(
  layout: LayoutNode, paneId: string,
): { layout: LayoutNode | null; neighbor: string | null } {
  if (layout.kind === 'leaf') {
    return layout.paneId === paneId
      ? { layout: null, neighbor: null }
      : { layout, neighbor: null };
  }
  const aHas = paneOrder(layout.a).includes(paneId);
  const bHas = paneOrder(layout.b).includes(paneId);
  if (!aHas && !bHas) return { layout, neighbor: null };
  if (aHas && layout.a.kind === 'leaf' && layout.a.paneId === paneId) {
    return { layout: layout.b, neighbor: paneOrder(layout.b)[0]! };
  }
  if (bHas && layout.b.kind === 'leaf' && layout.b.paneId === paneId) {
    return { layout: layout.a, neighbor: paneOrder(layout.a)[0]! };
  }
  const inner = aHas
    ? removeLeaf(layout.a, paneId)
    : removeLeaf(layout.b, paneId);
  const rebuilt: LayoutNode = aHas
    ? { ...layout, a: inner.layout ?? layout.a }
    : { ...layout, b: inner.layout ?? layout.b };
  return { layout: rebuilt, neighbor: inner.neighbor };
}
