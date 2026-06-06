<script lang="ts">
  import type { TmuxState } from '../engine/types';
  import type { Progress } from '../store/progress';
  import type { CmdResult } from './shellFs';
  import { paneShellState } from '../store/paneShellState.svelte';
  import TerminalShell from './TerminalShell.svelte';
  import { routeMouseEvent } from './mouseRouter';
  import type { MouseAction } from '../engine/tmuxModel';

  let {
    paneId,
    isActive,
    tmuxState,
    dispatchTmuxKey,
    dispatchMouseAction,
    progress,
    onRequestExit,
    onContextMenuAt,
  }: {
    paneId: string;
    isActive: boolean;
    tmuxState: TmuxState;
    dispatchTmuxKey: (t: string) => void;
    dispatchMouseAction?: (action: MouseAction) => void;
    progress: Progress;
    onRequestExit?: () => void;
    onContextMenuAt?: (x: number, y: number) => void;
  } = $props();

  const paneStore = $derived(paneShellState.get(paneId, '~/tmuxquest'));

  const paneContentLines = $derived.by(() => {
    for (const se of tmuxState.sessions) {
      for (const w of se.windows) {
        const arr = w.paneContent?.[paneId];
        if (arr) return arr;
      }
    }
    return undefined;
  });
  const copyForThisPane = $derived(tmuxState.copyByPane?.[paneId] ?? null);

  let dragOrigin: { x: number; y: number; row: number; col: number } | null = null;
  const DRAG_THRESHOLD_PX = 4;

  function handleMouseDown(e: MouseEvent) {
    if (!dispatchMouseAction) return;
    if (tmuxState.options?.mouse !== 'on') return;
    if (e.button !== 0) return;
    const cell = cellAt(e);
    dragOrigin = (!copyForThisPane && cell)
      ? { x: e.clientX, y: e.clientY, row: cell.row, col: cell.col }
      : null;
    const action = routeMouseEvent(tmuxState, 'mousedown',
      { kind: 'pane', paneId, row: cell?.row, col: cell?.col });
    if (action) {
      e.preventDefault();
      dispatchMouseAction(action);
    }
  }
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (!dispatchMouseAction) return;
    if (tmuxState.options?.mouse !== 'on') return;
    const action = routeMouseEvent(tmuxState, 'contextmenu', { kind: 'pane', paneId });
    if (action) {
      onContextMenuAt?.(e.clientX, e.clientY);
      dispatchMouseAction(action);
    }
  }
  function handleMouseMove(e: MouseEvent) {
    if (!dispatchMouseAction) return;
    if (tmuxState.options?.mouse !== 'on') return;
    if (e.buttons !== 1) return;
    if (!copyForThisPane) {
      if (!dragOrigin) return;
      const cell = cellAt(e);
      if (!cell) return;
      const dist = Math.hypot(e.clientX - dragOrigin.x, e.clientY - dragOrigin.y);
      if (dist < DRAG_THRESHOLD_PX) return;
      e.preventDefault();
      dispatchMouseAction({
        kind: 'copy-mode-begin-drag',
        anchorRow: dragOrigin.row, anchorCol: dragOrigin.col,
        row: cell.row, col: cell.col,
      });
      return;
    }
    const cell = cellAt(e);
    if (!cell) return;
    const action = routeMouseEvent(tmuxState, 'mousemove',
      { kind: 'pane', paneId, row: cell.row, col: cell.col });
    if (action) {
      e.preventDefault();
      dispatchMouseAction(action);
    }
  }
  function handleMouseUp(e: MouseEvent) {
    dragOrigin = null;
    if (!dispatchMouseAction) return;
    if (tmuxState.options?.mouse !== 'on') return;
    if (!copyForThisPane?.anchor) return;
    const action = routeMouseEvent(tmuxState, 'mouseup',
      { kind: 'pane', paneId });
    if (action) {
      e.preventDefault();
      dispatchMouseAction(action);
    }
  }

  let wheelAccum = 0;
  const NOTCH_PX = 80;
  $effect(() => {
    if (tmuxState.mode !== 'copy') wheelAccum = 0;
  });
  function handleWheel(e: WheelEvent) {
    if (!dispatchMouseAction) return;
    if (tmuxState.options?.mouse !== 'on') return;
    if (e.deltaY > 0 && tmuxState.mode !== 'copy') return;
    let lines: number;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      lines = Math.round(e.deltaY) * 3;
    } else {
      wheelAccum += e.deltaY;
      const notches = Math.trunc(wheelAccum / NOTCH_PX);
      if (notches === 0) {
        e.preventDefault();
        return;
      }
      wheelAccum -= notches * NOTCH_PX;
      lines = notches * 3;
    }
    if (lines === 0) return;
    e.preventDefault();
    const dir: 'up' | 'down' = lines < 0 ? 'up' : 'down';
    dispatchMouseAction({ kind: 'wheel', dir, lines: Math.abs(lines) });
  }

  function cellAt(e: MouseEvent): { row: number; col: number } | null {
    const tgt = e.target as HTMLElement | null;
    if (!tgt) return null;
    const lineEl = tgt.closest('.cm-line');
    if (!lineEl) return null;
    const cmRoot = lineEl.closest('.pane-grid');
    if (!cmRoot) return null;
    const lines = Array.from(cmRoot.querySelectorAll('.cm-line'));
    const row = lines.indexOf(lineEl);
    if (row < 0) return null;
    const lineRect = lineEl.getBoundingClientRect();
    const xRel = e.clientX - lineRect.left;
    let charW = 0;
    const firstCell = lineEl.querySelector('.cm-cell');
    if (firstCell) charW = firstCell.getBoundingClientRect().width;
    if (!charW) {
      const txt = lineEl.textContent ?? '';
      if (txt.length > 0) charW = lineRect.width / txt.length;
    }
    if (!charW) return { row, col: 0 };
    const col = Math.max(0, Math.floor(xRel / charW));
    return { row, col };
  }

  function intercept(raw: string): CmdResult | null {
    const t = raw.trim();
    if (!t) return null;
    if (t === 'exit' || t === 'logout') {
      onRequestExit?.();
      return { output: [] };
    }
    if (t === 'tmux' || t.startsWith('tmux ')) {
      return { output: [
        { text: 'sessions should be nested with care, unset $TMUX to force.', cls: 'err' },
      ] };
    }
    return null;
  }
</script>

<div
  class="pane-shell"
  role="presentation"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onwheel={handleWheel}
  oncontextmenu={handleContextMenu}
>
  <TerminalShell
    {progress}
    initialCwd={'~/tmuxquest'}
    {isActive}
    {tmuxState}
    {dispatchTmuxKey}
    extraCommand={intercept}
    ariaLabel={'pane ' + paneId}
    {paneStore}
    paneContent={paneContentLines}
    paneContentCopy={copyForThisPane}
  />
</div>
