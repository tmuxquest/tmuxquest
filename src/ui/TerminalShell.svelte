<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { TmuxState } from '../engine/types';
  import type { Progress } from '../store/progress';
  import { shellHistory } from '../store/shellHistory.svelte';
  import type { PaneShellStore } from '../store/paneShellState.svelte';
  import PaneGrid from './PaneGrid.svelte';
  import { buildPromptLine, promptCaretCol } from './promptLine';
  import {
    SHELL_HOME, buildShellFS, getCompletions, commonPrefix,
    type CmdResult, type Line,
  } from './shellFs';

  const BUILTINS = [
    'cat', 'cd', 'clear', 'echo', 'exit', 'help', 'ls',
    'pwd', 'tmux', 'tree',
  ];

  let {
    progress,
    initialCwd = SHELL_HOME,
    isActive = true,
    tmuxState,
    dispatchTmuxKey,
    extraCommand,
    ariaLabel = 'level shell',
    containerClass = '',
    paneStore,
    paneContent,
    paneContentCopy = null,
    readOnly = false,
    seedHistory,
  }: {
    progress: Progress;
    initialCwd?: string;
    isActive?: boolean;
    tmuxState?: TmuxState;
    dispatchTmuxKey?: (t: string) => void;
    extraCommand?: (raw: string, cwd: string) => CmdResult | null;
    ariaLabel?: string;
    containerClass?: string;
    paneStore?: PaneShellStore;
    paneContent?: string[];
    paneContentCopy?: TmuxState['copy'] | null;
    readOnly?: boolean;
    seedHistory?: HistoryEntry[];
  } = $props();

  let copyFrozen = $state<string[] | null>(null);
  $effect(() => {
    if (paneContentCopy && copyFrozen === null) {
      const base = paneContent ? [...paneContent] : [];
      const promptRows = paneContentCopy.promptLine != null
        ? paneContentCopy.promptLine.split('\n')
        : [];
      copyFrozen = [...base, ...promptRows];
    } else if (!paneContentCopy && copyFrozen !== null) {
      copyFrozen = null;
    }
  });

  let wasInCopy = false;
  $effect(() => {
    const inCopy = !!paneContentCopy;
    if (wasInCopy && !inCopy) {
      stickToBottom = true;
      void tick().then(() => {
        const host = scrollHost();
        if (host) host.scrollTop = host.scrollHeight + 9999;
      });
    }
    wasInCopy = inCopy;
  });

  let tmuxPromptActive = $derived(
    !!dispatchTmuxKey && !!tmuxState &&
    (tmuxState.mode === 'command' || tmuxState.mode === 'rename' || tmuxState.mode === 'find')
  );

  const isPane = $derived(paneContent !== undefined);

  interface HistoryEntry { cwd: string; cmd: string; output: Line[]; }

  let localCwd = $state(paneStore?.cwd ?? initialCwd);
  const cwd = $derived(paneStore ? paneStore.cwd : localCwd);
  function setCwd(next: string) {
    if (paneStore) paneStore.setCwd(next);
    else localCwd = next;
  }
  let localHistory = $state<HistoryEntry[]>(seedHistory ? [...seedHistory] : []);
  const history = $derived<HistoryEntry[]>(
    paneStore ? paneStore.transcript as HistoryEntry[] : localHistory
  );
  function appendHistory(entry: HistoryEntry) {
    if (paneStore) paneStore.append(entry);
    else localHistory = [...localHistory, entry];
  }
  function clearHistory() {
    if (paneStore) paneStore.clear();
    else localHistory = [];
  }
  let localInput = $state(paneStore?.input ?? '');
  const input = $derived(paneStore ? paneStore.input : localInput);
  function setInput(next: string) {
    if (paneStore) paneStore.setInput(next);
    else localInput = next;
  }
  let caretPos = $state(0);
  function syncCaret() { if (inputEl) caretPos = inputEl.selectionStart ?? input.length; }
  let hCursor = $state(-1);

  let tabCycle:
    | { matches: string[]; index: number; before: string; base: string; committed: string }
    | null = null;

  let search = $state<{ query: string; matchIdx: number } | null>(null);
  const searchMatch = $derived.by(() => {
    if (!search) return '';
    const q = search.query;
    const hist = shellHistory.list;
    let seen = 0;
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i]!;
      if (q === '' || h.includes(q)) {
        if (seen === search.matchIdx) return h;
        seen++;
      }
    }
    return '';
  });

  let stashed: string | null = null;

  const SCROLL_EPS = 32;
  let stickToBottom = true;

  let inputEl = $state<HTMLTextAreaElement | undefined>(undefined);
  let sentinelEl = $state<HTMLDivElement | undefined>(undefined);

  const fs = $derived(buildShellFS(progress));

  function scrollHost(): HTMLElement | null {
    let el: HTMLElement | null = sentinelEl ?? null;
    while (el && !(el.classList &&
      (el.classList.contains('shell-body') || el.classList.contains('pane-shell') ||
       el.classList.contains('popup-body')))) {
      el = el.parentElement;
    }
    return el;
  }

  function refocus() {
    if (isActive && inputEl) inputEl.focus({ preventScroll: true });
  }

  $effect(() => {
    if (isActive && inputEl) {
      inputEl.focus({ preventScroll: true });
      void tick().then(syncCaret);
    }
  });

  $effect(() => {
    if (!paneStore) return;
    paneStore.pasteSeq;
    caretPos = untrack(() => paneStore!.input.length);
    void tick().then(() => {
      if (!inputEl) return;
      inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
    });
    if (!paneContentCopy) scheduleScrollToBottom();
  });

  $effect(() => {
    if (!isActive) return;
    if (!stickToBottom) return;
    void tick().then(() => {
      const host = scrollHost();
      if (host) host.scrollTop = host.scrollHeight;
    });
  });

  $effect(() => {
    void isActive;
    const host = scrollHost();
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('a, button, input, textarea, select, [data-action]')) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.toString && sel.toString().length > 0) return;
      refocus();
    };
    host.addEventListener('click', onClick);
    return () => host.removeEventListener('click', onClick);
  });

  function captureStick() {
    const host = scrollHost();
    if (!host) { stickToBottom = true; return; }
    const dist = host.scrollHeight - host.scrollTop - host.clientHeight;
    stickToBottom = dist <= SCROLL_EPS;
  }

  function scrollPaneToBottom() {
    if (sentinelEl && typeof sentinelEl.scrollIntoView === 'function') {
      sentinelEl.scrollIntoView({ block: 'end' });
    }
    const host = scrollHost();
    if (host) host.scrollTop = host.scrollHeight + 9999;
  }
  function scheduleScrollToBottom() {
    void tick().then(() => {
      requestAnimationFrame(() => requestAnimationFrame(scrollPaneToBottom));
      setTimeout(scrollPaneToBottom, 100);
    });
  }

  const transcriptSize = $derived.by(() => {
    let n = history.length;
    for (const h of history) n += h.output.length;
    if (paneContent) n += paneContent.length;
    return n;
  });
  $effect(() => {
    void transcriptSize;
    if (!stickToBottom) return;
    if (paneContentCopy) return;
    scheduleScrollToBottom();
  });

  async function setCaret(pos: number) {
    caretPos = pos;
    await tick();
    if (inputEl) { try { inputEl.setSelectionRange(pos, pos); } catch { } }
  }

  function exec(rawCmd: string) {
    captureStick();
    if (rawCmd.trim() && !rawCmd.trimStart().startsWith('!')) {
      shellHistory.push(rawCmd);
    }
    stashed = null;
    if (!rawCmd.trim()) {
      appendHistory({ cwd, cmd: '', output: [] });
      setInput(''); hCursor = -1;
      return;
    }
    if (paneContent !== undefined) {
      setInput(''); hCursor = -1;
      return;
    }
    const result = (extraCommand && extraCommand(rawCmd, cwd)) || { output: [] };
    if (result.clear) {
      if (paneContent === undefined) clearHistory();
      setInput(''); hCursor = -1;
      return;
    }
    appendHistory({ cwd, cmd: rawCmd, output: result.output });
    if (result.cwd != null) setCwd(result.cwd);
    setInput('');
    hCursor = -1;
  }

  function tmuxTokenFromEvent(e: KeyboardEvent): string | null {
    const k = e.key;
    if (e.ctrlKey && k.length === 1) return `C-${k.toLowerCase()}`;
    if (e.ctrlKey && k === 'ArrowUp') return 'C-Up';
    if (e.ctrlKey && k === 'ArrowDown') return 'C-Down';
    if (e.ctrlKey && k === 'ArrowLeft') return 'C-Left';
    if (e.ctrlKey && k === 'ArrowRight') return 'C-Right';
    if (e.altKey && k === 'ArrowUp') return 'M-Up';
    if (e.altKey && k === 'ArrowDown') return 'M-Down';
    if (e.altKey && k === 'ArrowLeft') return 'M-Left';
    if (e.altKey && k === 'ArrowRight') return 'M-Right';
    if (k === 'Enter') return 'Enter';
    if (k === 'Escape') return 'Esc';
    if (k === 'Backspace') return 'Backspace';
    if (k === 'Tab') return e.shiftKey ? 'S-Tab' : 'Tab';
    if (k === 'ArrowUp') return 'Up';
    if (k === 'ArrowDown') return 'Down';
    if (k === 'ArrowLeft') return 'Left';
    if (k === 'ArrowRight') return 'Right';
    if (k.length === 1) return k;
    return null;
  }

  async function onKeyDown(e: KeyboardEvent) {
    const inp = e.currentTarget as HTMLTextAreaElement;
    const value = inp.value;

    if (dispatchTmuxKey && tmuxState) {
      const pk = tmuxState.prefixKey ?? 'C-b';
      const pkLetter = /^C-([a-z])$/.exec(pk)?.[1] ?? 'b';
      if (e.ctrlKey && e.key.toLowerCase() === pkLetter) {
        e.preventDefault(); e.stopPropagation();
        dispatchTmuxKey(pk);
        return;
      }
      const mode = tmuxState.mode || 'normal';
      if (mode === 'repeat') {
        const token = tmuxTokenFromEvent(e);
        const REPEAT_KEYS = new Set([
          'Up', 'Down', 'Left', 'Right',
          'C-Up', 'C-Down', 'C-Left', 'C-Right',
          'M-Up', 'M-Down', 'M-Left', 'M-Right',
        ]);
        if (token && REPEAT_KEYS.has(token)) {
          e.preventDefault(); e.stopPropagation();
          dispatchTmuxKey(token);
          return;
        }
        if (token) dispatchTmuxKey(token);
      }
      if (
        mode === 'prefix' || mode === 'command' || mode === 'rename' ||
        mode === 'confirm' || mode === 'copy' ||
        mode === 'find' || mode === 'display-panes' || mode === 'menu'
      ) {
        const token = tmuxTokenFromEvent(e);
        if (token) {
          e.preventDefault(); e.stopPropagation();
          dispatchTmuxKey(token);
          return;
        }
        if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
          e.preventDefault();
          return;
        }
      }
    }

    if (search) {
      if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        const cur = search;
        const probe = { query: cur.query, matchIdx: cur.matchIdx + 1 };
        if (matchAt(cur.query, probe.matchIdx) !== null) {
          search = probe;
        }
        return;
      }
      if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'c' || e.key === 'C' ||
          e.key === 'g' || e.key === 'G'))) {
        e.preventDefault();
        search = null;
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const m = searchMatch;
        search = null;
        if (m) { setInput(m); setCaret(m.length); }
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        search = { query: search.query.slice(0, -1), matchIdx: 0 };
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        search = { query: search.query + e.key, matchIdx: 0 };
        return;
      }
      if (e.key !== 'Shift' && e.key !== 'Control' &&
          e.key !== 'Alt' && e.key !== 'Meta') {
        const m = searchMatch;
        if (m) { setInput(m); setCaret(m.length); }
        search = null;
      }
      return;
    }

    if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      search = { query: '', matchIdx: 0 };
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      exec(value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = shellHistory.list;
      const next = Math.min(hist.length - 1, hCursor + 1);
      if (hist[next] != null) {
        if (hCursor === -1) stashed = input;
        hCursor = next;
        const val = hist[next]!;
        setInput(val);
        setCaret(val.length);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = shellHistory.list;
      const next = hCursor - 1;
      if (next < 0) {
        hCursor = -1;
        const val = stashed ?? '';
        setInput(val);
        stashed = null;
        setCaret(val.length);
      } else {
        const val = hist[next] || '';
        hCursor = next; setInput(val);
        setCaret(val.length);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();

      const cycle = tabCycle;
      if (cycle && cycle.committed === value && cycle.matches.length > 1) {
        const dir = e.shiftKey ? -1 : 1;
        const n = (cycle.index + dir + cycle.matches.length) % cycle.matches.length;
        const c = cycle.matches[n]!;
        const newInput = cycle.before + cycle.base + c;
        tabCycle = { ...cycle, index: n, committed: newInput };
        setInput(newInput); setCaret(newInput.length);
        return;
      }

      let comp = getCompletions(value, cwd, fs);
      const firstToken = comp.before === '' && comp.base === '';
      if (firstToken && comp.matches.length === 0 && comp.frag !== '') {
        const cmds = BUILTINS.filter(c => c.startsWith(comp.frag));
        comp = { ...comp, matches: cmds.sort((a, b) => a.localeCompare(b)) };
      }

      if (comp.matches.length === 0) { tabCycle = null; return; }
      if (comp.matches.length === 1) {
        const c = comp.matches[0]!;
        const newInput = comp.before + comp.base + c +
          (c.endsWith('/') ? '' : ' ');
        tabCycle = null; setInput(newInput); setCaret(newInput.length);
        return;
      }

      const cp = commonPrefix(comp.matches);
      if (!e.shiftKey && cp.length > comp.frag.length) {
        const newInput = comp.before + comp.base + cp;
        tabCycle = {
          matches: comp.matches, index: -1,
          before: comp.before, base: comp.base, committed: newInput,
        };
        setInput(newInput); setCaret(newInput.length);
        return;
      }
      const startIdx = e.shiftKey ? comp.matches.length - 1 : 0;
      const c = comp.matches[startIdx]!;
      const newInput = comp.before + comp.base + c;
      tabCycle = {
        matches: comp.matches, index: startIdx,
        before: comp.before, base: comp.base, committed: newInput,
      };
      setInput(newInput); setCaret(newInput.length);
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      clearHistory();
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      captureStick();
      appendHistory({ cwd, cmd: value + '^C', output: [] });
      setInput(''); hCursor = -1; stashed = null;
    } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (value === '') {
        exec('exit');
      } else {
        const pos = inp.selectionStart || 0;
        if (pos < value.length) {
          setInput(value.slice(0, pos) + value.slice(pos + 1));
          setCaret(pos);
        }
      }
    } else if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      const pos = inp.selectionStart || 0;
      setInput(value.slice(pos)); setCaret(0);
    } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const pos = inp.selectionStart || 0;
      setInput(value.slice(0, pos));
    } else if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      const pos = inp.selectionStart || 0;
      const left = value.slice(0, pos);
      const right = value.slice(pos);
      const trimmed = left.replace(/\s*\S+\s?$/, '');
      setInput(trimmed + right); setCaret(trimmed.length);
    } else if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      try { inp.setSelectionRange(0, 0); } catch { }
    } else if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch { }
    }
  }

  function matchAt(q: string, idx: number): string | null {
    const hist = shellHistory.list;
    let seen = 0;
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i]!;
      if (q === '' || h.includes(q)) {
        if (seen === idx) return h;
        seen++;
      }
    }
    return null;
  }

  const inPaneLines = $derived.by<string[]>(() => {
    if (!isPane) return [];
    if (paneContentCopy) return copyFrozen ?? paneContent ?? [];
    const base = paneContent ?? [];
    if (readOnly) return base;
    if (search) return [...base, `(reverse-i-search)\`${search.query}': ${searchMatch}`];
    return [...base, ...buildPromptLine(cwd, input).split('\n')];
  });
  const promptRowIdx = $derived.by<number | null>(() => {
    if (!isPane) return null;
    if (paneContentCopy) {
      if (paneContentCopy.promptLine == null) return null;
      const n = paneContentCopy.promptLine.split('\n').length;
      return inPaneLines.length - n;
    }
    if (readOnly) return null;
    return (paneContent ?? []).length;
  });
  const liveCursorPos = $derived.by<{ row: number; col: number } | null>(() => {
    if (!isPane || paneContentCopy) return null;
    if (readOnly || !isActive || tmuxPromptActive || search) return null;
    const baseRows = (paneContent ?? []).length;
    if (!input.includes('\n')) {
      return { row: baseRows, col: promptCaretCol(cwd, Math.min(caretPos, input.length)) };
    }
    const rows = buildPromptLine(cwd, input).split('\n');
    const last = rows[rows.length - 1] ?? '';
    return { row: baseRows + rows.length - 1, col: Math.max(0, last.length - 1) };
  });
  const pasteRanges = $derived.by<Record<number, { start: number; end: number }>>(() => {
    if (!isPane || paneContentCopy || readOnly) return {};
    const range = paneStore?.pasteRange;
    if (!range) return {};
    const baseRows = (paneContent ?? []).length;
    const prefixLen = 3 + cwd.length;
    const rows = input.split('\n');
    const out: Record<number, { start: number; end: number }> = {};
    let offset = 0;
    for (let r = 0; r < rows.length; r++) {
      const len = rows[r]!.length;
      const s = Math.max(range.start, offset);
      const e = Math.min(range.end, offset + len);
      if (s < e) {
        const colBase = r === 0 ? prefixLen : 0;
        out[baseRows + r] = { start: colBase + (s - offset), end: colBase + (e - offset) };
      }
      offset += len + 1;
    }
    return out;
  });
</script>

<div
  class="terminal-shell {containerClass}"
  role="presentation"
  onclick={refocus}
  aria-label={ariaLabel}
>
  {#if isPane}
    <PaneGrid
      lines={inPaneLines}
      copy={paneContentCopy}
      liveCursor={liveCursorPos}
      promptRow={promptRowIdx}
      {pasteRanges}
      {isActive}
    />
  {:else}
    {#each history as h, i (i)}
      <div class="line prompt-line">
        <span class="ps-arrow">➜</span><span class="ps-where">{h.cwd}</span>{#if h.cmd}<span class="ps-cmd">{h.cmd}</span>{/if}
      </div>
      {#each h.output as o, j (j)}
        {#if o.parts}
          <div class="line {o.cls || ''}">{#each o.parts as p, k (k)}<span class={p.cls || ''}>{p.text}</span>{/each}</div>
        {:else}
          <div class="line {o.cls || ''}">{o.text || ' '}</div>
        {/if}
      {/each}
    {/each}
    {#if isActive}
      <div class="prompt-line shell-input-line">
        {#if search}
          <span class="ps-search" aria-live="polite"
            >(reverse-i-search)`{search.query}':&nbsp;</span
          ><span class="ps-search-match">{searchMatch}</span>
        {:else}
          <span class="ps-arrow">➜</span><span class="ps-where">{cwd}</span
          >{#if tmuxPromptActive}{#if input}<span class="ps-cmd">{input}</span>{/if}{:else}<span
              class="ps-cmd"
              >{input.slice(0, caretPos)}<span class="term-cursor ti-block"
                >{input.charAt(caretPos) || ' '}</span
              >{input.slice(caretPos + 1)}</span
            >{/if}
        {/if}
      </div>
    {:else}
      <div class="prompt-line shell-input-line">
        <span class="ps-arrow">➜</span><span class="ps-where">{cwd}</span>{#if input}<span class="ps-cmd">{input}</span>{/if}
      </div>
    {/if}
  {/if}

  {#if isActive && !(isPane && readOnly)}
    <textarea
      bind:this={inputEl}
      class="term-input term-input-sink"
      rows="1"
      value={input}
      oninput={(e) => {
        const t = e.currentTarget as HTMLTextAreaElement;
        setInput(t.value);
        caretPos = t.selectionStart ?? t.value.length;
      }}
      onkeyup={syncCaret}
      onclick={syncCaret}
      onkeydown={onKeyDown}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label={ariaLabel + ' input'}
    ></textarea>
  {/if}
  <div bind:this={sentinelEl}></div>
</div>

<style>
  .ps-search {
    color: var(--ink, inherit);
    opacity: 0.85;
  }
  .ps-search-match {
    color: var(--ink-bright, inherit);
  }
</style>
