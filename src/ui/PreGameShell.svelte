<script lang="ts">
  import type { Session } from '../engine/types';
  import type { Progress } from '../store/progress';
  import type { CmdResult } from './shellFs';
  import TerminalShell from './TerminalShell.svelte';

  let {
    engineState,
    progress,
    onAttachTmux,
    onRequestExit,
  }: {
    engineState: { sessions: Session[]; attachedSessionId: string | null; activeSessionId?: string };
    progress: Progress;
    onAttachTmux: (target?: string) => void;
    onRequestExit: () => void;
  } = $props();

  const hasSessions = $derived(engineState.sessions.length > 0);
  const attached = $derived(!!engineState.attachedSessionId);

  const detachedFrom = $derived(
    engineState.sessions.find((s) => s.id === engineState.activeSessionId)?.name
      ?? engineState.sessions[0]?.name
      ?? 'main',
  );

  function intercept(raw: string): CmdResult | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const tokens = trimmed.split(/\s+/);
    const head = tokens[0];

    if (head === 'tmux') {
      const sub = tokens[1] || 'new-session';
      if (sub === 'new-session' || sub === 'new' || sub === 'new-window') {
        return { output: [
          { text: 'duplicate session: a tmux server is already running.', cls: 'err' },
          { text: 'try `tmux attach` to reattach to the existing session.', cls: 'dim' },
        ] };
      }
      if (sub === 'attach' || sub === 'a' || sub === 'at' || sub === 'attach-session') {
        if (!hasSessions) {
          return { output: [
            { text: 'no sessions', cls: 'err' },
            { text: 'try `tmux` to start a new one.', cls: 'dim' },
          ] };
        }
        if (attached) {
          return { output: [{ text: 'sessions should be nested with care, unset $TMUX to force.', cls: 'err' }] };
        }
        let target: string | undefined;
        for (let i = 2; i < tokens.length; i++) {
          const t = tokens[i]!;
          if (t === '-t' && tokens[i + 1]) { target = tokens[i + 1]; break; }
          if (t.startsWith('-t')) { target = t.slice(2); break; }
        }
        if (target) {
          const found = engineState.sessions.find(se => se.name === target);
          if (!found) {
            return { output: [
              { text: `can't find session: ${target}`, cls: 'err' },
              { text: 'try `tmux ls` to see what is running.', cls: 'dim' },
            ] };
          }
        }
        const t = target;
        setTimeout(() => onAttachTmux(t), 120);
        const landing = target ?? engineState.sessions.find(
          se => se.id === (engineState.attachedSessionId ?? engineState.sessions[0]?.id)
        )?.name ?? engineState.sessions[0]?.name ?? '?';
        return { output: [{ text: `[attaching to session ${landing}]`, cls: 'dim' }] };
      }
      if (sub === 'ls' || sub === 'list-sessions') {
        if (!hasSessions) {
          return { output: [{ text: 'no server running on /tmp/tmux-1000/default', cls: 'err' }] };
        }
        return { output: engineState.sessions.map((s) => ({
          text: s.name + ': ' + s.windows.length + ' windows' +
            (s.id === engineState.attachedSessionId ? ' (attached)' : ''),
        })) };
      }
      if (sub === 'kill-server' || sub === 'kill-session') {
        onRequestExit();
        return { output: [] };
      }
      if (sub === '--help' || sub === '-h' || sub === 'help') {
        return { output: [
          { text: 'usage: tmux [command]', cls: 'h' },
          { text: '' },
          { text: '  tmux                       alias for `tmux new-session`' },
          { text: '  tmux new-session  | new    start a new tmux server + session' },
          { text: '  tmux attach       | a      attach to an existing session' },
          { text: '  tmux ls                    list sessions' },
          { text: '  tmux kill-server           kill the running server' },
        ] };
      }
      return { output: [{ text: 'tmux: unknown command: ' + sub, cls: 'err' }] };
    }

    if (head === 'exit' || head === 'logout') {
      onRequestExit();
      return { output: [] };
    }

    return { output: [{ text: 'zsh: command not found: ' + head, cls: 'err' }] };
  }
</script>

<div class="pre-game-shell">
  <div class="pre-game-hint dim">
    [detached (from session {detachedFrom})]
  </div>
  <TerminalShell
    {progress}
    initialCwd={'~/tmuxquest'}
    isActive={true}
    extraCommand={intercept}
    ariaLabel="detached shell"
  />
</div>

