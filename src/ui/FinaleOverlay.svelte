<script lang="ts">
  import { focusReturn } from './focusReturn';
  import { GITHUB_URL, SUPPORT_URL, AWESOME_TMUX_URL, openLink } from './links';

  let { onClose, goldGap = 0 }: { onClose: () => void; goldGap?: number } = $props();

  const goldNudge = $derived(
    goldGap <= 0
      ? null
      : goldGap === 1
        ? "there's still one level without three stars - how about solidifying your knowledge by fixing that?"
        : `there are still ${goldGap} levels without three stars - how about solidifying your knowledge by fixing that?`,
  );

  let closeBtn: HTMLButtonElement | undefined = $state();

  $effect(() => {
    closeBtn?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault(); e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault(); e.stopImmediatePropagation();
        openLink(GITHUB_URL);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault(); e.stopImmediatePropagation();
        openLink(SUPPORT_URL);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
</script>

<div use:focusReturn class="help-pane finale-overlay" role="presentation">
  <div class="help-pane-doc finale-doc" role="dialog" aria-modal="true" aria-label="congratulations">
    <div class="finale-body">
      <div class="finale-title">all levels cleared.</div>
      <p class="finale-copy">
        you should be pretty comfortable with tmux now.
      </p>
      <p class="finale-copy">
        good time to make tmux your own. get familiar with
        <button class="finale-inline" onclick={() => openLink(AWESOME_TMUX_URL)}>awesome-tmux</button>
        - a curated list of plugins, configs and guides.
      </p>
      {#if goldNudge}<p class="finale-copy finale-copy-dim">{goldNudge}</p>{/if}

      <div class="finale-ask">
        <span class="finale-ask-label">liked it?</span>
        <button class="finale-link" onclick={() => openLink(GITHUB_URL)}>
          <svg class="finale-ico" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
          </svg>
          star on github
        </button>
        <button class="finale-link" onclick={() => openLink(SUPPORT_URL)}>
          <svg class="finale-ico" viewBox="-2 -2 20 20" width="15" height="15" aria-hidden="true">
            <path fill="currentColor" d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.17a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/>
          </svg>
          support
        </button>
      </div>
    </div>
    <div class="overlay-actions finale-foot">
      <button bind:this={closeBtn} class="confirm-btn confirm-btn-primary is-active" onclick={onClose}>
        close
      </button>
    </div>
  </div>
</div>

<style>
  .finale-doc { width: min(460px, 92vw); }
  .finale-body { padding: 22px 22px 8px 22px; }
  .finale-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink-bright);
    line-height: 1.25;
    margin-bottom: 10px;
  }
  .finale-copy {
    margin: 0 0 10px 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink);
  }
  .finale-copy-dim { color: var(--ink-dim); }

  .finale-inline {
    background: none; border: none; padding: 0;
    font: inherit;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .finale-inline:hover, .finale-inline:focus-visible { color: var(--ink-bright); outline: none; }

  .finale-ask {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 20px;
  }
  .finale-ask-label { color: var(--ink-dim); font-size: 12px; }
  .finale-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 4px 6px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-dim);
    cursor: pointer;
    transition: color 80ms linear;
  }
  .finale-link:hover, .finale-link:focus-visible { color: var(--ink-bright); outline: none; }
  .finale-ico { display: block; }

  .overlay-actions { justify-content: center; }
  .finale-foot { margin: 4px 22px 16px 22px; }
</style>
