<script lang="ts">
  import type { Session, TmuxState, Segment, SegmentStyle, Window } from '../engine/types';
  import { visibleCompletionItems, DEFAULT_OPTIONS } from '../engine/tmuxModel';
  import type { MouseAction } from '../engine/tmuxModel';
  import { evaluateFormat } from '../engine/formatString';
  import { routeMouseEvent } from './mouseRouter';

  let {
    tmuxState,
    session,
    prefix,
    prefixKey = 'C-b',
    commandBuffer,
    renameBuffer = null,
    renameTarget = null,
    findBuffer = null,
    statusMessage = null,
    copyMode = null,
    cmdMenuCursor = 0,
    cmdMenuOpen = false,
    promptCursor = null,
    dispatchMouseAction,
  }: {
    tmuxState: TmuxState;
    session: Session;
    prefix: boolean;
    prefixKey?: string;
    commandBuffer: string | null;
    renameBuffer?: string | null;
    renameTarget?: 'window' | 'session' | null;
    findBuffer?: string | null;
    statusMessage?: string | null;
    copyMode?: { search: string | null; searchDir?: 'fwd' | 'bwd' } | null;
    cmdMenuCursor?: number;
    cmdMenuOpen?: boolean;
    promptCursor?: number | null;
    dispatchMouseAction?: (action: MouseAction) => void;
  } = $props();

  function caretAt(buf: string): number {
    const c = promptCursor ?? buf.length;
    return Math.min(Math.max(c, 0), buf.length);
  }

  function formatPrefix(k: string): string {
    if (k.startsWith('C-')) return `^${k.slice(2).toUpperCase()}`;
    if (k.startsWith('M-')) return `M-${k.slice(2).toUpperCase()}`;
    return k;
  }

  function onWindowClick(windowId: string, e: MouseEvent) {
    if (!dispatchMouseAction) return;
    const action = routeMouseEvent(tmuxState, 'click', {
      kind: 'status-window', windowId, sessionId: session.id,
    });
    if (action) {
      e.preventDefault();
      dispatchMouseAction(action);
    }
  }

  function onSessionNameClick(e: MouseEvent) {
    if (!dispatchMouseAction) return;
    const action = routeMouseEvent(tmuxState, 'click',
      { kind: 'status-session-name' });
    if (action) {
      e.preventDefault();
      dispatchMouseAction(action);
    }
  }

  function opt(name: string): string {
    return tmuxState.options?.[name] ?? DEFAULT_OPTIONS[name] ?? '';
  }

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(id);
  });

  function bgStyle(optName: string): SegmentStyle | undefined {
    const v = opt(optName);
    if (!v) return undefined;
    const segs = evaluateFormat(tmuxState, `#[${v}]X`, { now });
    return segs[0]?.style;
  }

  function cssFromStyle(st?: SegmentStyle): string {
    if (!st) return '';
    const parts: string[] = [];
    const fg = st.reverse ? st.bg : st.fg;
    const bg = st.reverse ? st.fg : st.bg;
    if (fg) parts.push(`color: var(--tmux-fg-${fg}, ${fg})`);
    if (bg) parts.push(`background: var(--tmux-bg-${bg}, ${bg})`);
    if (st.bold) parts.push('font-weight: 700');
    if (st.italic) parts.push('font-style: italic');
    if (st.underscore) parts.push('text-decoration: underline');
    return parts.join('; ');
  }

  function computeFlags(w: Window, se: Session, _st: TmuxState): string {
    let f = '';
    if (w.id === se.activeWindowId) f += '*';
    if (w.id === se.lastWindowId) f += '-';
    if (w.zoomedPaneId) f += 'Z';
    return f;
  }

  let leftSegments = $derived.by<Segment[]>(() =>
    evaluateFormat(tmuxState, opt('status-left'), { now })
  );
  let rightSegments = $derived.by<Segment[]>(() =>
    evaluateFormat(tmuxState, opt('status-right'), { now })
  );

  function windowEntries(): { id: string; isActive: boolean; segs: Segment[]; baseStyle: SegmentStyle | undefined }[] {
    const out: { id: string; isActive: boolean; segs: Segment[]; baseStyle: SegmentStyle | undefined }[] = [];
    for (let i = 0; i < session.windows.length; i++) {
      const w = session.windows[i]!;
      const isActive = w.id === session.activeWindowId;
      const fmt = isActive ? opt('window-status-current-format') : opt('window-status-format');
      const styleName = isActive ? 'window-status-current-style' : 'window-status-style';
      const baseStyle = bgStyle(styleName);
      const flag = computeFlags(w, session, tmuxState);
      const segs = evaluateFormat(tmuxState, fmt, {
        now,
        pin: { session, window: w, windowIndex: i, flag },
      });
      out.push({ id: w.id, isActive, segs, baseStyle });
    }
    return out;
  }
  let windows = $derived.by(() => windowEntries());

  let cmdHints = $derived.by<string[]>(() => {
    if (commandBuffer == null || !cmdMenuOpen) return [];
    return visibleCompletionItems(commandBuffer);
  });
  let cmdHintsPad = $derived.by<number>(() =>
    cmdHints.reduce((m, n) => (n.length > m ? n.length : m), 0)
  );

  let inMessageMode = $derived(
    statusMessage != null && commandBuffer == null && renameBuffer == null && findBuffer == null && copyMode == null
  );
  let inPromptMode = $derived(
    commandBuffer != null || renameBuffer != null || findBuffer != null || copyMode != null
  );

  let barStyle = $derived(cssFromStyle(bgStyle('status-style')));
</script>

<div
  class="statusbar"
  class:sb-message-mode={inMessageMode}
  class:sb-prompt-mode={inPromptMode}
  style={inMessageMode || inPromptMode ? '' : barStyle}
  onmousedown={(e) => e.preventDefault()}
>
  {#if inMessageMode}
    <div class="statusbar-msg" role="status" aria-live="polite">{statusMessage}</div>
  {:else if inPromptMode}
    <div class="statusbar-prompt">
      {#if commandBuffer != null}
        {@const cc = caretAt(commandBuffer)}
        <span class="sb-cmd">:{commandBuffer.slice(0, cc)}<span class="sb-caret">{commandBuffer.slice(cc, cc + 1) || ' '}</span>{commandBuffer.slice(cc + 1)}</span>
      {/if}
      {#if renameBuffer != null}
        {@const rc = caretAt(renameBuffer)}
        <span class="sb-cmd sb-rename">({renameTarget === 'session' ? 'rename-session' : 'rename-window'}) {renameBuffer.slice(0, rc)}<span class="sb-caret">{renameBuffer.slice(rc, rc + 1) || ' '}</span>{renameBuffer.slice(rc + 1)}</span>
      {/if}
      {#if findBuffer != null}
        <span class="sb-cmd sb-find">(find-window) {findBuffer}<span class="term-cursor"></span></span>
      {/if}
      {#if copyMode != null}
        <span class="sb-cmd sb-copy">({copyMode.searchDir === 'bwd' ? 'search up' : 'search down'}) {copyMode.search ?? ''}<span class="term-cursor"></span></span>
      {/if}
    </div>
  {:else}
    <div class="statusbar-l">
      <span class="sb-session" role="button" tabindex="-1"
        onclick={onSessionNameClick}
      >{#each leftSegments as seg, i (i)}<span style={cssFromStyle(seg.style)}>{seg.text}</span>{/each}</span>
      {#each windows as w (w.id)}
        <span
          class="sb-win {w.isActive ? 'active' : ''}"
          style={cssFromStyle(w.baseStyle)}
          role="button" tabindex="-1"
          data-window-id={w.id}
          onclick={(e) => onWindowClick(w.id, e)}
        >{#each w.segs as seg, i (i)}<span style={cssFromStyle(seg.style)}>{seg.text}</span>{/each}</span>
        {#if w.id !== windows[windows.length - 1]?.id}<span class="sb-win-sep"> </span>{/if}
      {/each}
      {#if prefix}<span class="sb-prefix" title="prefix armed">{formatPrefix(prefixKey)}</span>{/if}
    </div>
    <div class="statusbar-r">
      {#each rightSegments as seg, i (i)}<span style={cssFromStyle(seg.style)}>{seg.text}</span>{/each}
    </div>
  {/if}
  {#if commandBuffer != null && cmdHints.length > 0}
    <div class="sb-cmd-menu" role="listbox" aria-label="command completion">
      {#each cmdHints as name, i (name)}
        {@const sel = i === Math.min(Math.max(cmdMenuCursor, 0), cmdHints.length - 1)}
        <div class="sb-cmd-menu-row" class:active={sel} role="option" aria-selected={sel}>
          <span class="sb-cmd-menu-name">{name.padEnd(cmdHintsPad, ' ')}</span>
          <span class="sb-cmd-menu-idx">({i})</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
