<script lang="ts">
  import { MISSIONS } from '../missions/missions';
  import { CHAPTERS } from '../missions/schema';
  import { isUnlocked } from './shellFs';
  import { untrack } from 'svelte';
  import type { Progress } from '../store/progress';
  import type { Mission } from '../missions/schema';

  let { progress, onLaunchMission }: {
    progress: Progress;
    onLaunchMission: (i: number) => void;
  } = $props();

  type Row = {
    m: Mission;
    i: number;
    chapter: number;
    cleared: boolean;
    locked: boolean;
    num: string;
    bestStars: 0 | 1 | 2 | 3;
  };

  const rows: Row[] = $derived.by(() => {
    let counter = 0;
    let lastChapter = 0;
    return MISSIONS
      .map((m, i) => {
        if (m.chapter !== lastChapter) { counter = 1; lastChapter = m.chapter; }
        else counter++;
        return {
          m, i,
          chapter: m.chapter,
          cleared: !!progress.results[m.id],
          locked: !isUnlocked(i, progress),
          num: `${m.chapter}.${counter}`,
          bestStars: progress.results[m.id]?.bestStars ?? 0,
        };
      });
  });

  const firstUncleared = $derived(rows.findIndex(r => !r.cleared && !r.locked));

  type ChapterStat = { num: number; title: string; total: number; done: number };
  const chapters: ChapterStat[] = $derived.by(() => {
    const map = new Map<number, ChapterStat>();
    for (const r of rows) {
      let s = map.get(r.chapter);
      if (!s) {
        s = { num: r.chapter, title: CHAPTERS[r.chapter - 1]?.title ?? '', total: 0, done: 0 };
        map.set(r.chapter, s);
      }
      s.total++;
      if (r.cleared) s.done++;
    }
    return [...map.values()].sort((a, b) => a.num - b.num);
  });

  let userOverrides = $state(new Map<number, boolean>());

  const focusChapter = $derived.by(() => {
    if (firstUncleared >= 0) return rows[firstUncleared]!.chapter;
    if (rows.length > 0) return rows[rows.length - 1]!.chapter;
    return -1;
  });

  const lockedChapters: Set<number> = $derived.by(() => {
    const set = new Set<number>();
    for (const c of chapters) {
      if (c.done === 0 && c.num !== focusChapter) set.add(c.num);
    }
    return set;
  });

  const collapsed: Set<number> = $derived.by(() => {
    const set = new Set<number>();
    for (const c of chapters) {
      const override = userOverrides.get(c.num);
      if (override !== undefined) {
        if (override) set.add(c.num);
        continue;
      }
      if (c.num !== focusChapter) set.add(c.num);
    }
    return set;
  });

  type Item = { kind: 'header'; chapter: number } | { kind: 'row'; rowIdx: number };
  const items: Item[] = $derived.by(() => {
    const out: Item[] = [];
    let lastCh = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.chapter !== lastCh) {
        lastCh = r.chapter;
        if (!lockedChapters.has(r.chapter)) out.push({ kind: 'header', chapter: r.chapter });
      }
      if (!collapsed.has(r.chapter) && !r.locked) out.push({ kind: 'row', rowIdx: i });
    }
    return out;
  });

  let cursor = $state(0);
  let lastMoveSrc: 'kbd' | 'mouse' | 'init' = $state('init');
  let lastMouseMoveAt = $state(0);
  const itemEls: (HTMLButtonElement | null)[] = $state([]);

  $effect(() => {
    function onMove() { lastMouseMoveAt = Date.now(); }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  });

  $effect(() => {
    void rows;
    void firstUncleared;
    untrack(() => {
      if (rows.length === 0) { cursor = 0; lastMoveSrc = 'init'; return; }
      const targetRow = firstUncleared >= 0 ? firstUncleared : rows.length - 1;
      let next = items.findIndex(it => it.kind === 'row' && it.rowIdx === targetRow);
      if (next < 0) {
        const ch = rows[targetRow]!.chapter;
        next = items.findIndex(it => it.kind === 'header' && it.chapter === ch);
      }
      cursor = next < 0 ? 0 : next;
      lastMoveSrc = 'init';
    });
  });

  $effect(() => {
    void cursor;
    if (lastMoveSrc === 'mouse') return;
    const el = itemEls[cursor];
    if (cursor === 0) {
      const scroller = (el?.closest('.browse-list') ?? el?.closest('.menu-overlay') ?? null) as HTMLElement | null;
      if (scroller) scroller.scrollTop = 0;
    } else if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
    if (lastMoveSrc === 'kbd' && el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
    }
  });

  function moveCursor(delta: 1 | -1) {
    const probe = cursor + delta;
    if (probe < 0 || probe >= items.length) return;
    cursor = probe;
    lastMoveSrc = 'kbd';
  }

  function jumpHomeEnd(end: boolean) {
    if (items.length === 0) return;
    cursor = end ? items.length - 1 : 0;
    lastMoveSrc = 'kbd';
  }

  function cursorChapter(): number {
    const it = items[cursor];
    if (!it) return -1;
    if (it.kind === 'header') return it.chapter;
    return rows[it.rowIdx]!.chapter;
  }

  function toggleChapter(n: number) {
    const willCollapse = !collapsed.has(n);
    const next = new Map(userOverrides);
    next.set(n, willCollapse);
    userOverrides = next;
    const headerIdx = items.findIndex(it => it.kind === 'header' && it.chapter === n);
    if (headerIdx >= 0) { cursor = headerIdx; lastMoveSrc = 'kbd'; }
  }

  function adjacentChapter(dir: 1 | -1) {
    const cur = cursorChapter();
    if (cur < 0) return;
    const order = chapters.map(c => c.num);
    const idx = order.indexOf(cur);
    if (idx < 0) return;
    const target = order[idx + dir];
    if (target === undefined) return;
    const headerIdx = items.findIndex(it => it.kind === 'header' && it.chapter === target);
    if (headerIdx >= 0) { cursor = headerIdx; lastMoveSrc = 'kbd'; }
  }

  function activateItem(idx: number) {
    const it = items[idx];
    if (!it) return;
    if (it.kind === 'row') {
      const r = rows[it.rowIdx];
      if (r && !r.locked) onLaunchMission(r.i);
    } else {
      toggleChapter(it.chapter);
    }
  }

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); return; }
      if (e.key === 'h' || e.key === 'ArrowLeft') { e.preventDefault(); adjacentChapter(-1); return; }
      if (e.key === 'l' || e.key === 'ArrowRight') { e.preventDefault(); adjacentChapter(1); return; }
      if (e.key === 'G' || e.key === 'End') { e.preventDefault(); jumpHomeEnd(true); return; }
      if (e.key === 'Home') { e.preventDefault(); jumpHomeEnd(false); return; }
      if (e.key === ' ') {
        e.preventDefault();
        const ch = cursorChapter();
        if (ch >= 0) toggleChapter(ch);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        adjacentChapter(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); activateItem(cursor); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function glyph(cleared: boolean, isNext: boolean): string {
    if (cleared) return '';
    if (isNext) return '>';
    return '·';
  }

  function chapterGlyph(c: ChapterStat): string {
    if (c.total > 0 && c.done === c.total) return '';
    if (c.num === focusChapter) return '>';
    return '';
  }
</script>

<div class="mission-browser">
  <div class="browse-list" role="list" aria-label="levels">
    {#each items as item, idx (item.kind === 'header' ? `h-${item.chapter}` : `r-${item.rowIdx}`)}
      {#if item.kind === 'header'}
        {@const chap = chapters.find(c => c.num === item.chapter)}
        {#if chap}
          <button
            type="button"
            class="browser-chapter-header"
            class:is-collapsed={collapsed.has(item.chapter)}
            class:is-cursor={idx === cursor}
            aria-current={idx === cursor ? 'true' : undefined}
            aria-expanded={!collapsed.has(item.chapter)}
            bind:this={itemEls[idx]}
            onclick={() => toggleChapter(item.chapter)}
            onmouseenter={() => {
              if (Date.now() - lastMouseMoveAt > 120) return;
              cursor = idx; lastMoveSrc = 'mouse';
            }}
          >
            <span class="ch-bar" aria-hidden="true">▌</span>
            <span class="ch-caret">{collapsed.has(item.chapter) ? '▸' : '▾'}</span>
            <span class="ch-num">{chap.num}.</span>
            <span class="ch-title">
              {chap.title}
            </span>
            <span class="ch-state" class:is-focus={chap.num === focusChapter} aria-hidden="true">{collapsed.has(item.chapter) ? chapterGlyph(chap) : ''}</span>
            <span class="sr-only">{chap.done} of {chap.total} cleared</span>
          </button>
        {/if}
      {:else}
        {@const row = rows[item.rowIdx]}
        {#if row}
          <button
            type="button"
            class="browser-row"
            class:is-cursor={idx === cursor}
            class:is-cleared={row.cleared}
            class:is-locked={row.locked}
            class:is-next={item.rowIdx === firstUncleared}
            aria-current={idx === cursor ? 'true' : undefined}
            aria-disabled={row.locked ? 'true' : undefined}
            bind:this={itemEls[idx]}
            onclick={row.locked ? undefined : () => onLaunchMission(row.i)}
            onmouseenter={() => {
              if (Date.now() - lastMouseMoveAt > 120) return;
              cursor = idx; lastMoveSrc = 'mouse';
            }}
          >
            <span class="browser-bar" aria-hidden="true">▌</span>
            <span class="browser-glyph" aria-hidden="true">{glyph(row.cleared, item.rowIdx === firstUncleared)}</span>
            <span class="sr-only">{row.locked ? 'locked' : row.cleared ? 'cleared' : item.rowIdx === firstUncleared ? 'next' : 'available'}</span>
            <span class="browser-id">{row.num}</span>
            <span class="browser-title">{row.m.title}</span>
            {#if row.cleared}
              <span
                class="browser-stars {row.bestStars > 0 ? `medal-tier-${row.bestStars}` : ''}"
                class:untimed={row.bestStars === 0}
                aria-label={row.bestStars > 0 ? `best ${row.m.id}: ${row.bestStars} of 3 stars` : `${row.m.id}: cleared, not yet timed`}
              ><span class="bs-on" aria-hidden="true">{'★'.repeat(row.bestStars)}</span><span class="bs-off" aria-hidden="true">{'☆'.repeat(3 - row.bestStars)}</span></span>
            {/if}
          </button>
        {/if}
      {/if}
    {/each}
  </div>
</div>

<style>
  .mission-browser {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-family: var(--font-body);
    min-height: 0;
  }

  .browse-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 8px 16px 4px;
  }

  .browser-chapter-header {
    width: 100%;
    display: grid;
    grid-template-columns: 10px 14px auto 1fr auto;
    align-items: baseline;
    column-gap: 8px;
    background: transparent;
    border: 0;
    padding: 14px 6px 8px 4px;
    text-align: left;
    color: var(--ink-dim);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.02em;
    transition: background 60ms linear, color 60ms linear;
  }
  .browser-chapter-header:first-child { padding-top: 4px; }
  .browser-chapter-header.is-collapsed { color: var(--ink-faint); }
  .browser-chapter-header.is-cursor {
    background: var(--bg-2);
    color: var(--ink-bright);
  }
  .browser-chapter-header.is-cursor.is-collapsed { color: var(--ink); }
  .ch-bar { color: transparent; font-size: 13px; line-height: 1; align-self: center; }
  .browser-chapter-header.is-cursor .ch-bar { color: var(--accent); }
  .ch-caret { color: var(--accent); font-size: 10px; line-height: 1; text-align: center; }
  .browser-chapter-header.is-collapsed .ch-caret { color: var(--ink-faint); }
  .browser-chapter-header.is-cursor .ch-caret { color: var(--accent); }
  .ch-num { color: var(--accent); font-variant-numeric: tabular-nums; }
  .browser-chapter-header.is-collapsed .ch-num { color: var(--ink-faint); }
  .browser-chapter-header.is-cursor.is-collapsed .ch-num { color: var(--accent); }
  .ch-title { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: lowercase; }
  .browser-chapter-header.is-collapsed .ch-title { color: var(--ink-faint); }
  .browser-chapter-header.is-cursor.is-collapsed .ch-title { color: var(--ink-bright); }
  .ch-state { color: var(--ink-faint); font-size: 12px; justify-self: end; line-height: 1; align-self: center; }
  .ch-state.is-focus { color: var(--accent); }

  .browser-row {
    background: transparent;
    border: 0;
    text-align: left;
    padding: 5px 12px 5px 4px;
    cursor: pointer;
    color: var(--ink-dim);
    display: grid;
    grid-template-columns: 10px 14px 38px minmax(0, max-content) auto 1fr;
    align-items: center;
    column-gap: 10px;
    font-family: inherit;
    font-size: 14px;
    transition: background 60ms linear, color 60ms linear;
  }
  .browser-bar { color: transparent; font-size: 14px; line-height: 1; }
  .browser-row.is-cursor {
    background: var(--bg-2);
    color: var(--ink-bright);
  }
  .browser-row.is-cursor .browser-bar { color: var(--accent); }
  .browser-row.is-cleared { color: var(--ink-faint); }
  .browser-row.is-cleared.is-cursor { color: var(--ink); }
  .browser-row.is-next { color: var(--ink-bright); font-weight: 600; }
  .browser-row.is-next .browser-glyph { color: var(--accent); font-weight: 700; }
  .browser-glyph { color: var(--ink-faint); text-align: center; }
  .browser-id {
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }
  .browser-row.is-cursor .browser-id { color: var(--ink-dim); }
  .browser-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: lowercase; }
  .browser-stars { grid-column: 5; grid-row: 1; font-size: 16px; letter-spacing: 2px; white-space: nowrap; line-height: 1; }
  .browser-stars .bs-on  { color: var(--medal, var(--star)); }
  .browser-stars .bs-off { color: var(--star-track); }

  .browser-row.is-locked { color: var(--ink-faint); cursor: default; }
  .browser-row.is-locked .browser-glyph { color: var(--ink-faint); }
  .browser-row.is-locked.is-cursor { color: var(--ink-dim); }
  .browser-row.is-locked.is-cursor .browser-bar { color: var(--ink-faint); }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    margin: -1px; padding: 0; border: 0;
    overflow: hidden; clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
