<script lang="ts">
  import type { TmuxState, LayoutNode, Rect } from '../engine/types';
  import { computeRects, paneOrder } from '../engine/layout';
  import { attached, activeWin } from '../engine/tmuxModel';
  import type { MouseAction } from '../engine/tmuxModel';
  import type { Progress } from '../store/progress';
  import StatusBar from './StatusBar.svelte';
  import PaneShell from './PaneShell.svelte';
  import TreeView from './TreeView.svelte';
  import PopupView from './PopupView.svelte';
  import DisplayPanesOverlay from './DisplayPanesOverlay.svelte';
  import DisplayMenuView from './DisplayMenuView.svelte';

  let {
    state,
    dispatchTmuxKey,
    dispatchMouseAction,
    progress,
    onRequestExit,
    onContextMenuAt,
    menuAnchor,
  }: {
    state: TmuxState;
    dispatchTmuxKey: (t: string) => void;
    dispatchMouseAction?: (action: import('../engine/tmuxModel').MouseAction) => void;
    progress: Progress;
    onRequestExit?: () => void;
    onContextMenuAt?: (x: number, y: number) => void;
    menuAnchor?: { x: number; y: number } | null;
  } = $props();

  const se = $derived(attached(state));
  const w = $derived(se ? activeWin(se) : null);
  const rects = $derived(
    w
      ? (w.zoomedPaneId
          ? new Map([[w.zoomedPaneId, { x: 0, y: 0, w: 100, h: 100 }]])
          : computeRects(w.layout, { x: 0, y: 0, w: 100, h: 100 }))
      : new Map()
  );
  const panes = $derived(
    w ? (w.zoomedPaneId ? [w.zoomedPaneId] : paneOrder(w.layout)) : []
  );
  const paneRects = $derived(
    Array.from(rects.entries()).map(([paneId, r]) => ({ paneId, ...r }))
  );
  const fullPaneOrder = $derived(w ? paneOrder(w.layout) : []);

  const statusPosition = $derived(state.options?.['status-position'] === 'top' ? 'top' : 'bottom');

  type Divider = {
    pos: number; start: number; len: number; span: number;
    dir: 'v' | 'h'; paneId: string; edge: 'L'|'R'|'U'|'D';
  };
  function dividersOf(node: LayoutNode, area: Rect): Divider[] {
    const out: Divider[] = [];
    const walk = (n: LayoutNode, a: Rect): void => {
      if (n.kind === 'leaf') return;
      if (n.dir === 'v') {
        const wa = a.w * n.ratio;
        const splitX = a.x + wa;
        const aPid = paneOrder(n.a)[0]!;
        out.push({
          pos: splitX, start: a.y, len: a.h, span: a.w,
          dir: 'v', paneId: aPid, edge: 'R',
        });
        walk(n.a, { x: a.x, y: a.y, w: wa, h: a.h });
        walk(n.b, { x: splitX, y: a.y, w: a.w - wa, h: a.h });
      } else {
        const ha = a.h * n.ratio;
        const splitY = a.y + ha;
        const aPid = paneOrder(n.a)[0]!;
        out.push({
          pos: splitY, start: a.x, len: a.w, span: a.h,
          dir: 'h', paneId: aPid, edge: 'D',
        });
        walk(n.a, { x: a.x, y: a.y, w: a.w, h: ha });
        walk(n.b, { x: a.x, y: splitY, w: a.w, h: a.h - ha });
      }
    };
    walk(node, area);
    return out;
  }

  const dividers = $derived(
    w && !w.zoomedPaneId && state.options?.mouse === 'on'
      ? dividersOf(w.layout, { x: 0, y: 0, w: 100, h: 100 })
      : []
  );

  type TwoPaneInd = { orient: 'v' | 'h'; pos: number; start: number };
  const twoPane: TwoPaneInd | null = $derived.by(() => {
    if (!w || w.zoomedPaneId || panes.length !== 2) return null;
    const p0 = panes[0]!, p1 = panes[1]!;
    const r0 = rects.get(p0), r1 = rects.get(p1);
    if (!r0 || !r1) return null;
    const active = w.activePaneId;
    const ra = active === p0 ? r0 : active === p1 ? r1 : null;
    if (!ra) return null;
    if (Math.abs(r0.x - r1.x) > 0.5) {
      const boundary = Math.max(r0.x, r1.x);
      return { orient: 'v', pos: boundary, start: ra.x < boundary ? 0 : 50 };
    }
    const boundary = Math.max(r0.y, r1.y);
    return { orient: 'h', pos: boundary, start: ra.y < boundary ? 0 : 50 };
  });

  type Line = { orient: 'v' | 'h'; pos: number; start: number; len: number; key: string };
  function splitLines(node: LayoutNode, a: Rect, acc: Line[], key: string): void {
    if (node.kind === 'leaf') return;
    if (node.dir === 'v') {
      const wa = Math.round(a.w * node.ratio);
      const splitX = a.x + wa;
      acc.push({ orient: 'v', pos: splitX, start: a.y, len: a.h, key });
      splitLines(node.a, { x: a.x, y: a.y, w: wa, h: a.h }, acc, key + 'a');
      splitLines(node.b, { x: splitX, y: a.y, w: a.w - wa, h: a.h }, acc, key + 'b');
    } else {
      const ha = Math.round(a.h * node.ratio);
      const splitY = a.y + ha;
      acc.push({ orient: 'h', pos: splitY, start: a.x, len: a.w, key });
      splitLines(node.a, { x: a.x, y: a.y, w: a.w, h: ha }, acc, key + 'a');
      splitLines(node.b, { x: a.x, y: splitY, w: a.w, h: a.h - ha }, acc, key + 'b');
    }
  }

  const borderStrips = $derived.by((): Line[] => {
    if (!w || w.zoomedPaneId || panes.length < 2) return [];
    const acc: Line[] = [];
    splitLines(w.layout, { x: 0, y: 0, w: 100, h: 100 }, acc, 'd');
    return acc;
  });
  const activeStrips = $derived.by((): Line[] => {
    if (!w || w.zoomedPaneId || panes.length < 2) return [];
    if (twoPane) {
      return [{ orient: twoPane.orient, pos: twoPane.pos, start: twoPane.start, len: 50, key: 'a' }];
    }
    const ra = rects.get(w.activePaneId);
    if (!ra) return [];
    const out: Line[] = [];
    if (ra.x > 0.5)         out.push({ orient: 'v', pos: ra.x,         start: ra.y, len: ra.h, key: 'al' });
    if (ra.x + ra.w < 99.5) out.push({ orient: 'v', pos: ra.x + ra.w,  start: ra.y, len: ra.h, key: 'ar' });
    if (ra.y > 0.5)         out.push({ orient: 'h', pos: ra.y,         start: ra.x, len: ra.w, key: 'at' });
    if (ra.y + ra.h < 99.5) out.push({ orient: 'h', pos: ra.y + ra.h,  start: ra.x, len: ra.w, key: 'ab' });
    return out;
  });
  const activeInCopy = $derived(!!w && !!state.copyByPane?.[w.activePaneId]);

  type DragState = {
    paneId: string; edge: 'L'|'R'|'U'|'D'; dir: 'v'|'h';
    axisPx: number;
    lastX: number; lastY: number;
    onMove: (e: MouseEvent) => void;
    onUp: () => void;
  };
  let dragState: DragState | null = null;
  let screenEl: HTMLElement | undefined;

  function onDividerMouseDown(d: Divider, e: MouseEvent) {
    if (state.options?.mouse !== 'on') return;
    e.preventDefault();
    if (dragState) {
      window.removeEventListener('mousemove', dragState.onMove);
      window.removeEventListener('mouseup', dragState.onUp);
    }
    const rect = screenEl?.getBoundingClientRect();
    const screenAxis = rect ? (d.dir === 'v' ? rect.width : rect.height) : 0;
    const axisPx = screenAxis > 0 ? (screenAxis * d.span) / 100 : 400;

    const onMove = (ev: MouseEvent) => {
      if (!dragState) return;
      const dx = ev.clientX - dragState.lastX;
      const dy = ev.clientY - dragState.lastY;
      const moved = dragState.dir === 'v' ? dx : dy;
      const THRESHOLD = 6;
      if (Math.abs(moved) < THRESHOLD) return;
      const deltaRatio = Math.min(0.5, Math.abs(moved) / dragState.axisPx);
      const grow = moved > 0;
      let edge: 'L'|'R'|'U'|'D' = dragState.edge;
      if (dragState.dir === 'v') edge = grow ? 'R' : 'L';
      else edge = grow ? 'D' : 'U';
      const action: MouseAction = {
        kind: 'resize-pane-edge',
        paneId: dragState.paneId, edge, deltaRatio,
      };
      dispatchMouseAction?.(action);
      dragState.lastX = ev.clientX;
      dragState.lastY = ev.clientY;
    };
    const onUp = () => {
      if (dragState) {
        window.removeEventListener('mousemove', dragState.onMove);
        window.removeEventListener('mouseup', dragState.onUp);
      }
      dragState = null;
    };
    dragState = {
      paneId: d.paneId, edge: d.edge, dir: d.dir,
      axisPx,
      lastX: e.clientX, lastY: e.clientY,
      onMove, onUp,
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
</script>

{#snippet statusBar()}
  {#if se}
    <StatusBar
      tmuxState={state}
      session={se}
      prefix={state.mode === 'prefix'}
      prefixKey={state.prefixKey}
      commandBuffer={state.mode === 'command' ? state.buffer : null}
      renameBuffer={state.mode === 'rename' ? state.buffer : null}
      renameTarget={state.renameTarget ?? null}
      findBuffer={state.mode === 'find' ? state.buffer : null}
      statusMessage={state.statusMessage ?? null}
      copyMode={state.copy?.searchActive
        ? { search: state.buffer, searchDir: state.copy?.searchDir ?? 'fwd' }
        : null}
      cmdMenuCursor={state.cmdMenuCursor ?? 0}
      cmdMenuOpen={state.cmdMenuOpen ?? false}
      promptCursor={state.mode === 'command' || state.mode === 'rename'
        ? (state.bufferCursor ?? state.buffer.length)
        : null}
      {dispatchMouseAction}
    />
  {/if}
{/snippet}

<div class="term-wrap status-{statusPosition}">
  {#if statusPosition === 'top'}{@render statusBar()}{/if}
  <div class="term-screen" bind:this={screenEl}>
    {#if state.mode === 'tree' && state.tree}
      <div class="term-pane active solo" style="left:0;top:0;width:100%;height:100%">
        <TreeView {state} tree={state.tree} {dispatchTmuxKey} />
      </div>
    {:else if se && w}
      {#each panes as pid (pid)}
        {@const r = rects.get(pid)!}
        {@const isActive = pid === w.activePaneId}
        <div
          class="term-pane {isActive ? 'active' : ''} {w.zoomedPaneId ? 'zoomed' : ''} {panes.length === 1 ? 'solo' : ''}"
          style="left:{r.x}%;top:{r.y}%;width:{r.w}%;height:{r.h}%"
        >
          <PaneShell
            paneId={pid}
            isActive={isActive && state.mode !== 'popup'}
            tmuxState={state}
            {dispatchTmuxKey}
            {dispatchMouseAction}
            {progress}
            {onRequestExit}
            {onContextMenuAt}
          />
        </div>
      {/each}
      {#each borderStrips as st (st.key)}
        <div
          class="pane-indicator dim {st.orient === 'h' ? 'horizontal' : ''}"
          style={st.orient === 'v'
            ? `left:${st.pos}%;top:${st.start}%;height:${st.len}%`
            : `top:${st.pos}%;left:${st.start}%;width:${st.len}%`}
        ></div>
      {/each}
      {#each activeStrips as st (st.key)}
        <div
          class="pane-indicator {st.orient === 'h' ? 'horizontal' : ''}"
          class:copy={activeInCopy}
          style={st.orient === 'v'
            ? `left:${st.pos}%;top:${st.start}%;height:${st.len}%`
            : `top:${st.pos}%;left:${st.start}%;width:${st.len}%`}
        ></div>
      {/each}
    {/if}
    {#each dividers as d (d.paneId + ':' + d.edge + ':' + d.pos + ',' + d.start)}
      <div
        class="pane-divider {d.dir === 'h' ? 'horizontal' : ''}"
        role="separator"
        aria-orientation={d.dir === 'v' ? 'vertical' : 'horizontal'}
        data-edge={d.edge}
        data-pane-id={d.paneId}
        style={d.dir === 'v'
          ? `left:${d.pos}%;top:${d.start}%;height:${d.len}%`
          : `top:${d.pos}%;left:${d.start}%;width:${d.len}%`}
        onmousedown={(e) => onDividerMouseDown(d, e)}
      ></div>
    {/each}
    {#if state.mode === 'popup' && state.popup}
      <PopupView
        {state}
        {progress}
        {dispatchTmuxKey}
      />
    {/if}
    {#if state.mode === 'display-panes' && w}
      <DisplayPanesOverlay
        {paneRects}
        activePaneId={w.activePaneId}
        paneOrder={fullPaneOrder}
      />
    {/if}
    {#if state.mode === 'menu' && state.menu}
      <DisplayMenuView
        menu={state.menu}
        anchor={menuAnchor ?? null}
        {dispatchTmuxKey}
      />
    {/if}
  </div>
  {#if statusPosition === 'bottom'}{@render statusBar()}{/if}
</div>
