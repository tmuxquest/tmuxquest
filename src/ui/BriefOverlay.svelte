<script lang="ts">
  import type { Mission } from '../missions/schema';
  import BriefPanel from './BriefPanel.svelte';
  import { focusReturn } from './focusReturn';

  let { mission, onStart, isEntry = true }: {
    mission: Mission;
    onStart: () => void;
    isEntry?: boolean;
  } = $props();

  const primaryLabel = $derived(isEntry ? 'start level' : 'close');

  let primaryBtn: HTMLButtonElement | undefined = $state();
  let scrollBody: HTMLDivElement | undefined = $state();

  $effect(() => {
    scrollBody?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onStart();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
</script>

<div
  use:focusReturn
  class="help-pane brief-overlay"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onStart(); }}
>
  <div class="help-pane-doc brief-overlay-doc" role="dialog" aria-modal="true" aria-label="level brief">
    <div class="help-pane-head">
      <span>brief.md</span>
      <button class="help-pane-x" onclick={onStart} aria-label="close brief">esc</button>
    </div>
    <div
      class="brief-overlay-body"
      bind:this={scrollBody}
      tabindex="0"
      role="document"
      aria-label="brief contents (use arrow keys to scroll)"
    >
      <BriefPanel {mission} />
    </div>
    {#if isEntry}
      <div class="brief-overlay-foot">
        <button bind:this={primaryBtn} class="confirm-btn confirm-btn-primary" onclick={onStart}>
          {primaryLabel}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .brief-overlay-doc {
    max-width: 760px;
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
  }
  .brief-overlay-body {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
    outline: none;
  }
  .brief-overlay-body:focus-visible {
    outline: 1px solid var(--line-soft);
    outline-offset: -1px;
  }
  .brief-overlay-body :global(.brief-panel) {
    max-height: none;
    border-bottom: none;
  }
  .brief-overlay-foot {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 12px 18px;
    border-top: 1px solid var(--line-soft);
    background: var(--bg);
    gap: 12px;
  }
</style>
