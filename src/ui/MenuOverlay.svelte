<script lang="ts">
  import type { Progress } from '../store/progress';
  import { SPINE_COUNT } from '../missions/missions';
  import { spineClearedCount, campaignComplete } from '../store/gameStore.svelte';
  import { focusReturn } from './focusReturn';
  import { fitWidth } from './fitWidth';
  import { GITHUB_URL, SUPPORT_URL, X_URL, CONTACT_EMAIL, openLink } from './links';
  import MissionBrowser from './MissionBrowser.svelte';
  import PrefixCaptureOverlay from './PrefixCaptureOverlay.svelte';
  import { formatPrefix } from '../store/prefixSpec';

  type SettingsLike = { theme: 'auto' | 'dark' | 'light'; prefix: string };
  let {
    progress,
    engineAlive,
    onPlay,
    onLaunchMission,
    onSkip,
    skipTitle,
    onToggleTheme,
    settings,
    onClose,
    visible,
    onSetPrefix,
  }: {
    progress: Progress;
    engineAlive: boolean;
    onPlay: () => void;
    onLaunchMission: (i: number) => void;
    onSkip: () => void;
    skipTitle: string | null;
    onToggleTheme: () => void;
    settings: SettingsLike;
    onClose: () => void;
    visible: boolean;
    onSetPrefix: (token: string) => void;
  } = $props();

  const spineCleared = $derived(spineClearedCount(progress));
  const campaignDone = $derived(campaignComplete(progress));
  const allCleared = $derived(campaignDone);
  const playLabel = $derived(spineCleared > 0 ? 'continue' : 'play');

  let view = $state<'welcome' | 'browse'>('welcome');
  let playBtn: HTMLButtonElement | undefined = $state();
  let browseBtn: HTMLButtonElement | undefined = $state();

  let capturing = $state(false);

  function startCapture() { capturing = true; }
  function setPrefix(token: string) { capturing = false; onSetPrefix(token); }

  function onChipKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      startCapture();
    }
  }

  function gotoBrowse() { view = 'browse'; }
  function gotoWelcome() { view = 'welcome'; }

  function cyclePrimary(dir: 1 | -1) {
    const order = [playBtn, browseBtn].filter((b): b is HTMLButtonElement => !!b);
    if (order.length < 2) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = order.findIndex((b) => b === active);
    const next = order[(idx === -1 ? 0 : idx + dir + order.length) % order.length];
    next?.focus();
  }

  $effect(() => {
    if (visible && view === 'welcome') {
      if (allCleared) browseBtn?.focus(); else playBtn?.focus();
    }
  });

  $effect(() => {
    if (!visible) {
      view = 'welcome';
      capturing = false;
    }
  });

  $effect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') { e.preventDefault(); return; }
      if (view === 'welcome') {
        if (e.key === 'Enter') {
          const active = document.activeElement as HTMLElement | null;
          if (active && (active === playBtn || active === browseBtn)) {
            e.preventDefault();
            active.click();
            return;
          }
          e.preventDefault();
          if (allCleared) gotoBrowse(); else onPlay();
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          cyclePrimary(1);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault();
          cyclePrimary(-1);
          return;
        }
        if (e.key === 'b' || e.key === 'B') { e.preventDefault(); gotoBrowse(); return; }
        if (e.key === 'Escape' && engineAlive) {
          e.preventDefault();
          onClose();
          return;
        }
      } else {
        if (e.key === 'b' || e.key === 'B') { e.preventDefault(); gotoWelcome(); return; }
        if (e.key === 'Escape') { e.preventDefault(); gotoWelcome(); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div
  use:focusReturn
  class="menu-overlay shell-body"
  data-menu-overlay
  aria-hidden={!visible}
  style:display={visible ? 'flex' : 'none'}
>
  {#if view === 'welcome'}
    <div class="menu-view-welcome">
      <pre class="menu-banner" aria-label="tmux quest"><span class="menu-banner-ink" use:fitWidth>████████╗███╗   ███╗██╗   ██╗██╗  ██╗     ██████╗ ██╗   ██╗███████╗███████╗████████╗
╚══██╔══╝████╗ ████║██║   ██║╚██╗██╔╝    ██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝
   ██║   ██╔████╔██║██║   ██║ ╚███╔╝     ██║   ██║██║   ██║█████╗  ███████╗   ██║
   ██║   ██║╚██╔╝██║██║   ██║ ██╔██╗     ██║   ██║██║   ██║██╔══╝  ╚════██║   ██║
   ██║   ██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗    ╚██████╔╝╚██████╔╝███████╗███████║   ██║
   ╚═╝   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝     ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝</span></pre>
      <div class="menu-tagline">learn tmux by playing</div>

      <div class="menu-primary">
        {#if !allCleared}
          <button bind:this={playBtn} class="menu-btn menu-play" onclick={onPlay}>
            <span class="menu-btn-label">{playLabel}</span>
          </button>
        {/if}
        <button bind:this={browseBtn} class="menu-btn menu-browse {allCleared ? 'is-primary' : ''}" onclick={gotoBrowse}>
          <span class="menu-btn-label">browse levels</span>
        </button>
      </div>
      <div class="menu-secondary menu-settings">
        <span class="menu-prefix">
          <button
            class="menu-link menu-prefix-btn"
            data-testid="prefix-chip"
            onclick={startCapture}
            onkeydown={onChipKey}
            aria-label="set tmux prefix key"
          >
            <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
                 fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <g transform="translate(8 8) scale(1.12) translate(-8 -8)">
                <rect x="1.5" y="4" width="13" height="8" rx="1.5"/>
                <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M4.5 9.5h6"/>
              </g>
            </svg>
            prefix {formatPrefix(settings.prefix)}
          </button>
        </span>
        <button class="menu-link" onclick={onToggleTheme} aria-label="cycle theme">
          {#if settings.theme === 'auto'}
            <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="7.35"/>
              <path d="M8 0.65a7.35 7.35 0 0 1 0 14.7z" fill="currentColor" stroke="none"/>
            </svg>
            auto
          {:else if settings.theme === 'dark'}
            <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 10A7.2 7.2 0 0 1 5.9 1.4a7.2 7.2 0 1 0 8.6 8.6Z"/>
            </svg>
            dark
          {:else}
            <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="3"/>
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/>
            </svg>
            light
          {/if}
        </button>
      </div>

      <div class="menu-secondary menu-social">
        <button class="menu-link" onclick={() => openLink(GITHUB_URL)} aria-label="github">
          <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <g transform="translate(8 8) scale(0.93) translate(-8 -8)">
              <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
            </g>
          </svg>
        </button>
        <button class="menu-link" onclick={() => openLink(X_URL)} aria-label="x / twitter">
          <svg class="menu-ico" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path fill="currentColor" d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/>
          </svg>
        </button>
        <a class="menu-link menu-contact-link" href="mailto:{CONTACT_EMAIL}" aria-label="email {CONTACT_EMAIL}">
          <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
               fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="0.7" y="2.3" width="14.6" height="11.4" rx="2"/>
            <path d="M1.3 3.2 8 8.6 14.7 3.2"/>
          </svg>
        </a>
        <button class="menu-link" onclick={() => openLink(SUPPORT_URL)}>
          <svg class="menu-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <g transform="translate(8 8) scale(0.93) translate(-8 -8)">
              <path fill="currentColor" d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.17a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/>
            </g>
          </svg>
          support
        </button>
      </div>

      {#if engineAlive}
        <div class="menu-hint dim">esc · back to level · still running</div>
      {/if}
    </div>
  {:else}
    <div class="menu-view-browse">
      <div class="browse-head">
        <span class="browse-head-label">choose level</span>
        <span class="browse-head-count">{spineCleared}/{SPINE_COUNT} cleared</span>
        {#if skipTitle}
          <button
            class="browse-skip"
            onclick={onSkip}
            title="mark “{skipTitle}” cleared and unlock the next level - for when a level blocks you"
          >skip level</button>
        {/if}
        <span class="browse-head-hint">
          <span class="kbd-chip">esc</span> back
        </span>
      </div>
      <div class="browse-body">
        <MissionBrowser {progress} {onLaunchMission} />
      </div>
    </div>
  {/if}

  {#if capturing}
    <PrefixCaptureOverlay
      current={settings.prefix}
      onSet={setPrefix}
      onCancel={() => { capturing = false; }}
    />
  {/if}
</div>

<style>
  .menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    background: var(--bg);
    overflow: hidden;
  }
  .menu-view-welcome {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    box-sizing: border-box;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: max(2vh, 20px) 24px 28vh;
    overflow: hidden auto;
  }
  .menu-view-browse {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 18px 24px 16px 24px;
    gap: 8px;
    min-height: 0;
  }
  .browse-body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .browse-body > :global(*) { width: 100%; }
  .menu-banner {
    width: 100%;
    margin: 0;
    display: flex;
    justify-content: center;
    line-height: 1.1;
  }
  .menu-banner-ink {
    font-family: ui-monospace, "SF Mono", "Cascadia Mono", "DejaVu Sans Mono",
                 Menlo, Consolas, "Liberation Mono", monospace;
    display: inline-block;
    font-size: 11px;
    color: var(--accent, currentColor);
    white-space: pre;
    transform-origin: 50% 50%;
    font-feature-settings: normal;
    font-variant-ligatures: none;
    font-synthesis: none;
  }
  .menu-tagline {
    color: var(--ink);
    font-size: 13px;
    margin-top: 9px;
    text-align: center;
  }

  .menu-primary { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 14px; }
  .menu-secondary { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .menu-settings { margin-top: 14px; }
  .menu-social { margin-top: 16px; }
  .menu-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 4px 6px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-dim);
    cursor: pointer;
    transition: color 80ms linear;
  }
  .menu-link:hover, .menu-link:focus-visible { color: var(--ink-bright); }
  .menu-contact-link { text-decoration: none; }
  .menu-ico { display: block; }
  .menu-prefix { display: inline-flex; align-items: baseline; gap: 4px; }
  .menu-prefix-btn { white-space: nowrap; }
  .menu-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 264px;
    padding: 13px 32px;
    font-family: var(--font-body);
    font-size: 14px;
    letter-spacing: .02em;
    color: var(--ink);
    background: var(--bg-2);
    border: 1px solid var(--line);
    cursor: pointer;
    transition: background .14s ease, border-color .14s ease, color .14s ease,
                transform .12s ease, box-shadow .14s ease;
  }
  .menu-btn-label { display: inline-block; }
  .menu-browse:hover {
    background: color-mix(in srgb, var(--accent) 9%, var(--bg-2));
    border-color: var(--accent);
    color: var(--ink-bright);
    transform: translateY(-1px);
    box-shadow: 0 3px 12px color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .menu-btn:active { transform: translateY(1px); box-shadow: none; }

  .menu-play {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
    font-weight: 600;
  }
  .menu-play:hover {
    background: color-mix(in srgb, var(--accent) 85%, #fff);
    border-color: color-mix(in srgb, var(--accent) 85%, #fff);
    color: var(--bg);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 32%, transparent);
  }
  .menu-play:active { transform: translateY(0); box-shadow: none; }

  .menu-browse.is-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
    font-weight: 600;
  }
  .menu-browse.is-primary:hover {
    background: color-mix(in srgb, var(--accent) 85%, #fff);
    border-color: color-mix(in srgb, var(--accent) 85%, #fff);
    color: var(--bg);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 32%, transparent);
  }

  .menu-btn:focus {
    outline: none;
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 5px 16px color-mix(in srgb, var(--accent) 24%, transparent);
  }

  .menu-hint { font-size: 11px; margin-top: 12px; }

  .browse-head {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 4px 4px 12px 4px;
    margin-bottom: 4px;
    font-size: 13px;
    color: var(--ink-dim);
    font-family: var(--font-body);
  }
  .browse-head-label { color: var(--ink-bright); font-size: 14px; letter-spacing: 0.04em; }
  .browse-head-count {
    margin-left: auto;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .browse-head-hint { font-size: 11px; }
  .browse-skip {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ink-dim);
    font-family: var(--font-body);
    font-size: 11px;
    letter-spacing: 0.02em;
    padding: 2px 9px;
    cursor: pointer;
    align-self: center;
    transition: background 80ms linear, border-color 80ms linear, color 80ms linear;
  }
  .browse-skip:hover, .browse-skip:focus-visible {
    color: var(--ink-bright);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
  }
  .kbd-chip {
    display: inline-block;
    color: var(--ink-dim);
    background: var(--bg-2);
    border: 1px solid var(--line);
    padding: 0 5px;
    font-size: 11px;
    margin-right: 2px;
    letter-spacing: 0;
    font-family: var(--font-body);
  }
</style>
