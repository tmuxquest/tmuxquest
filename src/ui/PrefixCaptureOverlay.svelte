<script lang="ts">
  import { untrack } from 'svelte';
  import { focusReturn } from './focusReturn';
  import { prefixFromEvent, describeChord, formatPrefix, DEFAULT_PREFIX } from '../store/prefixSpec';

  let { current, onSet, onCancel }: {
    current: string;
    onSet: (token: string) => void;
    onCancel: () => void;
  } = $props();

  let candidate = $state(untrack(() => current));
  let live = $state('');
  let rejectMsg = $state<string | null>(null);

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Enter') { onSet(candidate); return; }
      const r = prefixFromEvent(e);
      if (r === null) {
        live = describeChord(e);
        rejectMsg = null;
        return;
      }
      if ('error' in r) {
        live = describeChord(e);
        rejectMsg = r.error;
        return;
      }
      candidate = r.token;
      live = '';
      rejectMsg = null;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) live = '';
    }
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  });
</script>

<div
  use:focusReturn
  class="help-pane prefix-capture"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
>
  <div class="help-pane-doc prefix-capture-doc" role="dialog" aria-modal="true"
       aria-labelledby="prefix-capture-title" aria-describedby="prefix-capture-hint">
    <div class="help-pane-head">
      <span id="prefix-capture-title">set prefix</span>
      <button class="help-pane-x" onclick={onCancel}>esc</button>
    </div>
    <div class="help-pane-body prefix-capture-body">
      <div class="pc-stage" data-testid="prefix-capture-live" aria-live="polite">
        <span class="pc-keys">{live || formatPrefix(candidate)}</span>
      </div>
      {#if rejectMsg}
        <div class="pc-reject" data-testid="prefix-capture-reject">{rejectMsg}</div>
      {:else}
        <div class="pc-hint dim" id="prefix-capture-hint">
          press your prefix
        </div>
      {/if}
      <div class="overlay-actions pc-actions">
        <button
          class="confirm-btn"
          data-testid="prefix-capture-default"
          onclick={() => { candidate = DEFAULT_PREFIX; live = ''; rejectMsg = null; }}
        >default</button>
        <button
          class="confirm-btn confirm-btn-primary"
          data-testid="prefix-capture-save"
          onclick={() => onSet(candidate)}
        >save</button>
      </div>
    </div>
  </div>
</div>

<style>
  .prefix-capture-doc { width: min(360px, 92vw); }
  .prefix-capture-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 18px 18px 16px;
  }
  .pc-stage {
    width: 100%;
    box-sizing: border-box;
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--bg-2);
    border: 1px solid var(--line);
  }
  .pc-keys {
    font-family: var(--font-mono, var(--font-body));
    font-size: 18px;
    letter-spacing: .02em;
    color: var(--ink-bright);
  }
  .pc-hint { font-size: 11px; }
  .pc-reject { font-size: 12px; color: var(--alarm, var(--accent)); }
  .pc-actions { justify-content: center; width: 100%; }
</style>
