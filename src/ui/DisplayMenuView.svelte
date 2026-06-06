<script lang="ts">
  import type { TmuxState } from '../engine/types';

  let {
    menu,
    anchor,
    dispatchTmuxKey,
  }: {
    menu: NonNullable<TmuxState['menu']>;
    anchor: { x: number; y: number } | null;
    dispatchTmuxKey: (t: string) => void;
  } = $props();

  const BOX_W = 240;

  const pos = $derived.by(() => {
    const x0 = anchor?.x ?? 40;
    const y0 = anchor?.y ?? 40;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const h = menu.items.length * 26 + 60;
    const x = Math.min(x0, vw - BOX_W - 8);
    const y = Math.min(y0, vh - h - 8);
    return { x: Math.max(8, x), y: Math.max(8, y) };
  });

  function pick(item: typeof menu.items[number]) {
    if (item.disabled) return;
    dispatchTmuxKey(item.key);
  }
</script>

<div
  class="menu-backdrop"
  role="presentation"
  onmousedown={() => dispatchTmuxKey('Esc')}
  oncontextmenu={(e) => { e.preventDefault(); dispatchTmuxKey('Esc'); }}
>
  <div
    class="menu-box"
    role="menu"
    tabindex="-1"
    aria-label="pane menu"
    style="left:{pos.x}px;top:{pos.y}px;width:{BOX_W}px"
    onmousedown={(e) => e.stopPropagation()}
    oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
  >
    <div class="menu-title">
      <span class="ln"></span><span class="ttl">{menu.title}</span><span class="ln"></span>
    </div>
    {#each menu.items as item, i (item.key)}
      {#if item.separatorBefore}<div class="menu-sep"></div>{/if}
      <button
        type="button"
        role="menuitem"
        class="menu-row"
        class:active={i === menu.cursor}
        class:disabled={item.disabled}
        disabled={item.disabled}
        onmousedown={(e) => { e.stopPropagation(); e.preventDefault(); pick(item); }}
      >
        <span class="menu-label">{item.label}</span>
        {#if !item.disabled}<span class="menu-key">({item.key})</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
  }
  .menu-box {
    position: fixed;
    display: flex;
    flex-direction: column;
    padding: 2px 0 4px;
    background: var(--bg);
    border: 1px solid var(--line);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
    font-family: var(--font-body);
    font-size: 13px;
  }
  .menu-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 10px 5px;
    color: var(--ink-dim);
  }
  .menu-title .ttl { white-space: nowrap; }
  .menu-title .ln { flex: 1; border-top: 1px solid var(--line); height: 0; }
  .menu-sep {
    height: 0;
    border-top: 1px solid var(--line);
    margin: 4px 0;
  }
  .menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 3px 12px;
    background: transparent;
    border: 0;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .menu-row.active,
  .menu-row:hover:not(.disabled) {
    background: var(--tmux-bg-yellow);
    color: var(--tmux-fg-black);
  }
  .menu-row.active .menu-key,
  .menu-row:hover:not(.disabled) .menu-key {
    color: var(--tmux-fg-black);
    opacity: 0.7;
  }
  .menu-row.disabled {
    color: var(--ink-dim);
    cursor: default;
  }
  .menu-key {
    color: var(--ink-dim);
    font-weight: 600;
    letter-spacing: 0.05em;
  }
</style>
