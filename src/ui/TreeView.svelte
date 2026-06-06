<script lang="ts">
  import type { TmuxState, TreeState } from '../engine/types';
  import { visibleRows, rowKey } from '../engine/tmuxModel';
  import { paneShellState } from '../store/paneShellState.svelte';

  let {
    state,
    tree,
    dispatchTmuxKey,
  }: {
    state: TmuxState;
    tree: TreeState;
    dispatchTmuxKey?: (t: string) => void;
  } = $props();

  const rows = $derived(visibleRows(state, tree));
  const cursorRow = $derived(rows[tree.cursor]);

  function sessionOf(id: string) {
    return state.sessions.find(x => x.id === id);
  }

  function winOf(sid: string, wid: string) {
    return sessionOf(sid)?.windows.find(w => w.id === wid);
  }

  function paneLines(sid: string, wid: string): string[] {
    const w = winOf(sid, wid);
    if (!w) return [];
    const lines = w.paneContent?.[w.activePaneId] ?? [];
    return lines.slice(-40);
  }

  function promptFor(sid: string, wid: string): { cwd: string; input: string } | null {
    const w = winOf(sid, wid);
    if (!w) return null;
    const live = paneShellState.peek(w.activePaneId);
    const cwd = w.paneCwd?.[w.activePaneId] ?? live?.cwd ?? '~/tmuxquest';
    const input = live?.input ?? '';
    return { cwd, input };
  }

  function windowFlag(sid: string, wid: string): string {
    const se = sessionOf(sid);
    const w = winOf(sid, wid);
    if (!w) return ' ';
    if (w.zoomedPaneId) return 'Z';
    if (se?.lastWindowId === wid) return '-';
    return ' ';
  }

  type Token = { text: string; cls?: string };
  function tokenize(line: string): Token[] {
    const out: Token[] = [];
    const re = /(\s+|\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const t = m[0];
      if (/^\s+$/.test(t)) out.push({ text: t });
      else if (t.endsWith('/')) out.push({ text: t, cls: 'tok-dir' });
      else if (t.endsWith('*')) out.push({ text: t, cls: 'tok-exec' });
      else out.push({ text: t });
    }
    return out;
  }

  function onRowClick(idx: number) {
    if (state.options?.mouse !== 'on' || !dispatchTmuxKey) return;
    const delta = idx - tree.cursor;
    if (delta === 0) return;
    const key = delta > 0 ? 'j' : 'k';
    const n = Math.abs(delta);
    for (let i = 0; i < n; i++) dispatchTmuxKey(key);
  }

  function onRowDblClick(idx: number) {
    if (state.options?.mouse !== 'on' || !dispatchTmuxKey) return;
    onRowClick(idx);
    dispatchTmuxKey('Enter');
  }
</script>

<div class="tree-root" class:preview-off={!tree.showPreview}>
  <div class="tree-list" role="listbox" aria-label="choose-tree">
    {#each rows as r, i (rowKey(r))}
      {@const isCur = i === tree.cursor}
      {@const isTagged = !!tree.tagged[rowKey(r)]}
      {#if r.kind === 'session'}
        {@const se = sessionOf(r.sessionId)}
        {@const wc = se?.windows.length ?? 0}
        {@const isAttached = state.attachedSessionId === r.sessionId}
        <div class="tv-row tv-session" class:cursor={isCur} class:tagged={isTagged}
          role="option" aria-selected={isCur} tabindex="-1"
          data-row-idx={i}
          onclick={() => onRowClick(i)}
          ondblclick={() => onRowDblClick(i)}>
          <span class="tv-tag">{isTagged ? '*' : ' '}</span>
          <span class="tv-idx">({i})</span>
          <span class="tv-dash">-</span>
          <span class="tv-sname">{se?.name ?? r.sessionId}</span>
          <span class="tv-meta">: {wc} window{wc === 1 ? '' : 's'}</span>
          {#if isAttached}<span class="tv-attached">(attached)</span>{/if}
        </div>
      {:else}
        {@const se = sessionOf(r.sessionId)}
        {@const w = se?.windows.find(x => x.id === r.windowId)}
        {@const idx = se?.windows.findIndex(x => x.id === r.windowId) ?? -1}
        {@const isActive = se?.activeWindowId === r.windowId}
        <div class="tv-row tv-window" class:cursor={isCur} class:tagged={isTagged}
          role="option" aria-selected={isCur} tabindex="-1"
          data-row-idx={i}
          onclick={() => onRowClick(i)}
          ondblclick={() => onRowDblClick(i)}>
          <span class="tv-tag">{isTagged ? '*' : ' '}</span>
          <span class="tv-idx">({i})</span>
          <span class="tv-branch">└─&gt;</span>
          <span class="tv-flag">{windowFlag(r.sessionId, r.windowId)}</span>
          <span class="tv-widx">{idx}:</span>
          <span class="tv-wname">{w?.name ?? r.windowId}</span>
          {#if isActive}<span class="tv-active">*</span>{/if}
        </div>
      {/if}
    {/each}
    {#if rows.length === 0}
      <div class="tv-empty">{tree.filter ? '(no matches)' : '(no sessions)'}</div>
    {/if}
    {#if tree.filterMode}
      <div class="tv-prompt">(filter): {tree.filter}_</div>
    {:else if tree.filter}
      <div class="tv-prompt">(filter): {tree.filter}</div>
    {/if}
  </div>
  {#if tree.showPreview && cursorRow}
    <div class="tree-preview" aria-label="preview">
      {#if cursorRow.kind === 'session'}
        {@const se = sessionOf(cursorRow.sessionId)}
        {@const w0 = se?.windows.find(x => x.id === se?.activeWindowId) ?? se?.windows[0]}
        {@const lines = w0 ? (w0.paneContent?.[w0.activePaneId] ?? []).slice(-40) : []}
        {@const prompt = w0 ? promptFor(cursorRow.sessionId, w0.id) : null}
        {#each lines as pl, i (i)}
          {@const promptM = pl.match(/^(➜) (\S+) (.+)$/)}
          {#if promptM}
            <div class="prev-line"><span class="ps-arrow">{promptM[1]}</span><span class="ps-where">{promptM[2]}</span><span class="ps-cmd">{promptM[3]}</span></div>
          {:else}
            <div class="prev-line">{#each tokenize(pl) as t, k (k)}<span class={t.cls ?? ''}>{t.text}</span>{/each}</div>
          {/if}
        {/each}
        {#if prompt}
          <div class="prev-line"><span class="ps-arrow">➜</span><span class="ps-where">{prompt.cwd}</span>{#if prompt.input}<span class="ps-cmd">{prompt.input}</span>{/if}</div>
        {/if}
      {:else}
        {@const prompt = promptFor(cursorRow.sessionId, cursorRow.windowId)}
        {#each paneLines(cursorRow.sessionId, cursorRow.windowId) as pl, i (i)}
          {@const promptM = pl.match(/^(➜) (\S+) (.+)$/)}
          {#if promptM}
            <div class="prev-line"><span class="ps-arrow">{promptM[1]}</span><span class="ps-where">{promptM[2]}</span><span class="ps-cmd">{promptM[3]}</span></div>
          {:else}
            <div class="prev-line">{#each tokenize(pl) as t, k (k)}<span class={t.cls ?? ''}>{t.text}</span>{/each}</div>
          {/if}
        {/each}
        {#if prompt}
          <div class="prev-line"><span class="ps-arrow">➜</span><span class="ps-where">{prompt.cwd}</span>{#if prompt.input}<span class="ps-cmd">{prompt.input}</span>{/if}</div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tree-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
    color: var(--ink);
  }
  .tree-list {
    flex: 1 1 auto;
    min-height: 40%;
    overflow-y: auto;
    padding: .25rem .5rem;
  }
  .tree-preview {
    flex: 1 1 auto;
    max-height: 55%;
    overflow-y: auto;
    padding: .25rem .5rem;
    font: inherit;
    color: var(--ink);
    border-top: 1px solid var(--line-soft);
  }
  .tree-root.preview-off .tree-list {
    flex: 1;
    max-height: none;
  }
  .tv-row {
    padding: 0 .25rem;
    white-space: pre;
    line-height: 1.5;
  }
  .tv-row.cursor {
    background: var(--tmux-bg-yellow);
    color: var(--tmux-fg-black);
  }
  .tv-row.tagged .tv-tag { color: var(--accent); font-weight: 700; }
  .tv-row.cursor.tagged .tv-tag,
  .tv-row.cursor .tv-tag,
  .tv-row.cursor .tv-idx,
  .tv-row.cursor .tv-dash,
  .tv-row.cursor .tv-branch,
  .tv-row.cursor .tv-flag,
  .tv-row.cursor .tv-widx,
  .tv-row.cursor .tv-sname,
  .tv-row.cursor .tv-wname,
  .tv-row.cursor .tv-active,
  .tv-row.cursor .tv-attached,
  .tv-row.cursor .tv-meta {
    color: var(--tmux-fg-black);
  }
  .tv-tag      { display: inline-block; width: 1ch; margin-right: .25rem; color: var(--accent); }
  .tv-idx      { color: var(--ink-dim); margin-right: .5ch; }
  .tv-dash     { color: var(--ink); margin-right: .5ch; }
  .tv-branch   { color: var(--ink); margin-right: .5ch; }
  .tv-flag     { color: var(--ink); margin-right: .5ch; }
  .tv-widx     { color: var(--ink); margin-right: .5ch; }
  .tv-sname    { color: var(--ink-bright); font-weight: 600; }
  .tv-wname    { color: var(--ink-bright); }
  .tv-active   { color: var(--accent); font-weight: 700; margin-left: 1px; }
  .tv-attached { color: var(--accent); margin-left: .5ch; }
  .tv-meta     { color: var(--ink); }
  .tv-empty    { padding: .5rem; color: var(--ink-dim); font-style: italic; }
  .tv-prompt {
    position: sticky;
    bottom: 0;
    background: var(--bg);
    color: var(--ink);
    padding: .15rem .25rem;
    border-top: 1px solid var(--line-soft);
    margin-top: .35rem;
  }
  .prev-line {
    white-space: pre-wrap;
    line-height: 1.4;
  }
  .ps-arrow { color: var(--accent); font-weight: 700; margin-right: 6px; }
  .ps-where { color: var(--path); font-weight: 500; margin-right: 6px; }
  .ps-cmd   { color: var(--ink-bright); }
  :global(.tree-preview .tok-dir)  { color: var(--path); }
  :global(.tree-preview .tok-exec) { color: var(--accent); }
</style>
