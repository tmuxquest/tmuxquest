<script lang="ts">
  import type { TmuxState } from '../engine/types';

  let {
    lines,
    copy = null,
    liveCursor = null,
    promptRow = null,
    isActive = false,
    pasteRanges = {},
  }: {
    lines: string[];
    copy?: TmuxState['copy'] | null;
    liveCursor?: { row: number; col: number } | null;
    promptRow?: number | null;
    isActive?: boolean;
    pasteRanges?: Record<number, { start: number; end: number }>;
  } = $props();
  void isActive;

  const cursor = $derived(copy ? copy.cursor : liveCursor);

  let gridEl = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (!copy) return;
    const _r = copy.cursor.row; const _c = copy.cursor.col;
    void _r; void _c;
    const cell = gridEl?.querySelector('.cm-cell.cursor');
    if (cell && typeof cell.scrollIntoView === 'function') {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });

  const range = $derived.by(() => {
    if (!copy || copy.anchor === null) return null;
    const a = copy.anchor; const b = copy.cursor;
    const before = a.row < b.row || (a.row === b.row && a.col <= b.col);
    const lo = before ? a : b; const hi = before ? b : a;
    return { lo, hi, mode: copy.selectMode };
  });

  function selSpan(row: number): { start: number; end: number } | null {
    if (!range) return null;
    const lineLen = lines[row]?.length ?? 0;
    if (range.mode === 'line') {
      if (row < range.lo.row || row > range.hi.row) return null;
      return { start: 0, end: lineLen };
    }
    if (row < range.lo.row || row > range.hi.row) return null;
    const start = row === range.lo.row ? range.lo.col : 0;
    const endCol = row === range.hi.row ? range.hi.col + 1 : lineLen;
    return { start, end: Math.min(endCol, lineLen) };
  }

  function matchCols(row: number): Set<number> {
    const term = copy?.search ?? null;
    const set = new Set<number>();
    if (!term) return set;
    const line = lines[row] ?? '';
    let i = line.indexOf(term);
    while (i >= 0) {
      for (let c = i; c < i + term.length; c++) set.add(c);
      i = line.indexOf(term, i + term.length);
    }
    return set;
  }

  function promptClassMap(line: string): string[] | null {
    const m = line.match(/^(➜) (\S+) (.*)$/);
    if (!m) return null;
    const where = m[2]!;
    const cmd = m[3]!;
    const classes: string[] = ['pc-arrow', ''];
    for (let i = 0; i < where.length; i++) classes.push('pc-where');
    classes.push('');
    for (let i = 0; i < cmd.length; i++) classes.push('pc-cmd');
    return classes;
  }
</script>

<div bind:this={gridEl} class="pane-grid {copy ? 'copy-mode' : ''}" aria-label="pane scrollback">
  {#if copy}
    <div class="cm-indicator-anchor" aria-hidden="true">
      <div class="cm-indicator">[{copy.cursor.row + 1}/{lines.length}]</div>
    </div>
  {/if}
  {#each lines as line, i}
    {@const span = selSpan(i)}
    {@const isCursorRow = cursor != null && cursor.row === i}
    {@const ccol = cursor != null ? cursor.col : -1}
    {@const promptCls =
      promptRow != null && i > promptRow
        ? Array.from({ length: line.length }, () => 'pc-cmd')
        : promptClassMap(line)}
    {@const matches = matchCols(i)}
    {@const paste = pasteRanges[i] ?? null}
    {@const isPromptRow = promptRow != null && i === promptRow}
    <div class="line cm-line {isPromptRow ? 'cm-prompt' : ''}">
      {#each Array.from({ length: Math.max(line.length, isCursorRow ? ccol + 1 : 0) }) as _, c}
        {@const ch = c < line.length ? line[c] : ' '}
        {@const inSel = span !== null && c >= span.start && c < span.end}
        {@const isCursor = isCursorRow && c === ccol}
        {@const inMatch = matches.has(c)}
        {@const inPaste = paste !== null && c >= paste.start && c < paste.end}
        {@const segCls = promptCls?.[c] ?? ''}
        {#if inSel || isCursor || segCls || inMatch || inPaste}
          <span class="cm-cell {inSel ? 'selected' : ''} {isCursor ? 'cursor' : ''} {inMatch ? 'match' : ''} {inPaste ? 'pasted' : ''} {segCls}">{ch}</span>
        {:else}{ch}{/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  .pane-grid { font: inherit; height: auto; position: relative; }
  .cm-line { min-height: 1.55em; white-space: pre-wrap; word-break: break-word; }
  .cm-line.cm-prompt { margin-top: 6px; }
  .cm-cell { background: transparent; }
  .cm-cell.pasted { background: var(--paste-hl, rgba(128,128,128,.34)); }
  .cm-cell.match { background: var(--match-bg, rgba(80,200,220,.30)); }
  .cm-cell.selected { background: var(--warn, #d7af5f); color: var(--bg, #1e1e1e); }
  .cm-cell.cursor {
    background: var(--ink-bright, #fff);
    color: var(--bg, #111);
    white-space: pre;
    padding: 1.6px 0;
  }
  .cm-cell.pc-arrow { color: var(--accent); }
  .cm-cell.pc-where { color: var(--path, var(--accent)); }
  .cm-cell.pc-cmd   { color: var(--ink-bright); }
  .cm-cell.selected.pc-arrow,
  .cm-cell.selected.pc-where,
  .cm-cell.selected.pc-cmd { color: var(--bg, #1e1e1e); }
  .cm-indicator-anchor {
    position: sticky;
    top: 0;
    height: 0;
    z-index: 2;
  }
  .cm-indicator {
    position: absolute;
    top: -1px;
    right: 4px;
    padding: 0 4px;
    background: var(--warn, #d4a017);
    color: var(--bg, #111);
    font-weight: 700;
    border-radius: 2px;
  }
</style>
