<script lang="ts">
  import type { Mission } from '../missions/schema';
  import { segmentLine, type Segment } from './markdownLine';

  let { mission }: { mission: Mission } = $props();

  function stripBullet(line: string): string | null {
    const m = /^\s*[-*•]\s+(.*)$/.exec(line);
    return m ? m[1]! : null;
  }
  type Row = { kind: 'plain' | 'bullet' | 'blank'; segs: Segment[] };
  function classifyLine(raw: string): Row {
    if (raw.trim() === '') return { kind: 'blank', segs: [] };
    const body = stripBullet(raw);
    if (body !== null) return { kind: 'bullet', segs: segmentLine(body) };
    return { kind: 'plain', segs: segmentLine(raw) };
  }

  const lines = $derived(mission.teachCopy.split('\n').map(classifyLine));
  const objectiveSegs = $derived(segmentLine(mission.objective));
  const keyColW = $derived(
    Math.max(8, ...mission.keys.map(([k]) => k.length)) + 2,
  );
</script>

<section class="brief-panel" aria-label="level brief" tabindex="-1">
  <pre class="brief-doc"><span class="b-rule">── </span><span class="b-title">{mission.title}</span><span class="b-rule"> ──</span>

{#each lines as ln, i (i)}{#if ln.kind === 'blank'}
{:else if ln.kind === 'bullet'}  <span class="b-bullet">•</span> {#each ln.segs as s, j (j)}{#if s.kind === 'code'}<span class="b-key">{s.value}</span>{:else}{s.value}{/if}{/each}
{:else}  {#each ln.segs as s, j (j)}{#if s.kind === 'code'}<span class="b-key">{s.value}</span>{:else}{s.value}{/if}{/each}
{/if}{/each}
<span class="b-section">objective</span>
  {#each objectiveSegs as s, j (j)}{#if s.kind === 'code'}<span class="b-key">{s.value}</span>{:else}{s.value}{/if}{/each}

<span class="b-section">keys</span>
{#each mission.keys as [key, desc] (key)}  <span class="b-key-plain">{key}</span>{' '.repeat(Math.max(1, keyColW - key.length))}<span class="b-dim">{desc}</span>
{/each}</pre>
</section>

<style>
  .brief-panel {
    flex: 0 0 auto;
    background: var(--bg);
    border-bottom: 1px solid var(--line-soft);
    max-height: 48vh;
    overflow-y: auto;
  }
  .brief-doc {
    margin: 0;
    padding: 10px 18px 14px;
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
    white-space: pre-wrap;
    word-break: break-word;
    text-transform: lowercase;
  }
  .b-rule    { color: var(--ink-faint); }
  .b-title   { color: var(--ink-bright); font-weight: 600; letter-spacing: .04em; text-transform: lowercase; }
  .b-section { color: var(--ink-faint); letter-spacing: .12em; }
  .b-key {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    border-radius: 3px;
    padding: 0 3px;
    margin: 0;
    text-transform: none;
  }
  .b-key-plain {
    color: var(--accent);
    font-weight: 600;
    text-transform: none;
  }
  .b-dim     { color: var(--ink-dim); text-transform: none; }
  .b-bullet  { color: var(--accent); }
  [data-theme="light"] .b-key {
    background: color-mix(in srgb, var(--accent) 14%, #fff);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  @media (max-width: 720px) {
    .brief-doc { padding: 8px 12px 12px; font-size: 12px; }
    .brief-panel { max-height: 40vh; }
  }
</style>
