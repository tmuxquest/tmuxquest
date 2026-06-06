import { CHAPTERS, type Mission } from './schema';
import { fresh, withWindows, rescueScenario, copyLogScenario, copyRescueScenario, verticalSplitTwoPanes, fourPanesTiled, preSeededLogScrollback, twoPaneLiveAndCat, withSinglePreloadedBuffer, paneWithSeededScrollback, serverLogScrollback, twoNamedSessions, windowsForFind } from './seed';
import { buildPreset } from '../engine/layout';

const CHAPTER_OF: Record<string, number> = {
  'm00-the-brief': 1, 'm01-first-contact': 1,
  'm02-new-window': 2, 'm03-housekeeping': 2,
  'm04-the-split': 3, 'm05-pane-dance': 3, 'm06-focus-mode': 3,
  'm30-jump-by-number': 3, 'm17-shuffle': 3,
  'm43-cli-sessions': 4, 'm46-rename-session': 4, 'm19-pick-session': 4,
  'm50-find-window': 4, 'm08-session-hop': 4, 'm10-boss-rescue': 4,
  'm11-scroll-back': 5, 'm12-find-it': 5, 'm13-grab-the-error': 5,
  'm40-search-backward': 5, 'm14-character-copy': 5,
  'm15-prompt-power': 6, 'm07-many-lives': 6, 'm16-clean-house': 6,
  'm53-popup': 6,
  'm29-resize-it': 7, 'm20-shape-it': 7, 'm21-break-it-out': 7, 'm18-drop-here': 7,
};

const ORDER_OF: Record<string, number> = {
  'm00-the-brief': 1, 'm01-first-contact': 2,
  'm02-new-window': 1, 'm03-housekeeping': 2,
  'm04-the-split': 1, 'm05-pane-dance': 2, 'm06-focus-mode': 3,
  'm30-jump-by-number': 4, 'm17-shuffle': 5,
  'm43-cli-sessions': 1, 'm46-rename-session': 2, 'm19-pick-session': 3,
  'm50-find-window': 4, 'm08-session-hop': 5, 'm10-boss-rescue': 6,
  'm11-scroll-back': 1, 'm12-find-it': 2, 'm13-grab-the-error': 3,
  'm40-search-backward': 4, 'm14-character-copy': 5,
  'm15-prompt-power': 1, 'm07-many-lives': 2, 'm16-clean-house': 3, 'm53-popup': 4,
  'm29-resize-it': 1, 'm20-shape-it': 2, 'm21-break-it-out': 3, 'm18-drop-here': 4,
};

const RAW: Omit<Mission, 'chapter' | 'order' | 'optional'>[] = [
  {
    id: 'm00-the-brief',
    title: 'The Brief',
    teachCopy:
      'Every mission opens with a brief like this one - the why, the objective, the keys.\n' +
      'Lost mid-mission? Pull it back anytime:\n' +
      '- `Ctrl+/` toggles this panel\n' +
      '- or click `brief.md` in the bar up top',
    objective: 'Reopen this brief mid-mission, then close it to finish.',
    keys: [['Ctrl+/', 'open / close the brief'],
           ['brief.md', 'toggle from the top bar']],
    initialState: fresh,
    goal: { kind: 'events', sequence: ['brief-opened', 'brief-closed'] },
    steps: [
      { label: 'Bring the brief back up', goal: { kind: 'events', sequence: ['brief-opened'] } },
      { label: 'Close the brief to finish', goal: { kind: 'events', sequence: ['brief-opened', 'brief-closed'] } },
    ],
    par: 2,
    hints: ['Press Ctrl+/ to bring the brief back.',
            'Or click the brief.md button in the bar at the top.'],
    successCopy: 'That\'s your safety net - the brief is always a keystroke away. Now: tmux.',
    referenceSolution: ['C-b'],
  },
  {
    id: 'm01-first-contact',
    title: 'First Contact',
    teachCopy:
      'tmux waits for a PREFIX before its commands. Default prefix is `C-b` (Ctrl-b).\n' +
      '- `prefix d`  detaches (your session keeps running in the background)\n' +
      '- back at the parent shell, type `tmux attach` (or `tmux a`) to reattach',
    objective: 'Detach the session, then reattach to it.',
    keys: [['prefix d', 'detach'], ['tmux attach', 'reattach']],
    initialState: fresh,
    goal: { kind: 'events', sequence: ['detached', 'attached'] },
    steps: [
      { label: 'Detach the session', goal: { kind: 'events', sequence: ['detached'] } },
      { label: 'Reattach', goal: { kind: 'events', sequence: ['detached', 'attached'] } },
    ],
    par: 3,
    hints: ['Press C-b, then d.', 'Detached now - type `tmux attach` at the prompt to come back.'],
    successCopy: 'Detach + reattach. Sessions keep running in the background between connections - state and processes preserved.',
    referenceSolution: ['C-b', 'd', 'Enter']
  },
  {
    id: 'm02-new-window',
    title: 'Open and Hop',
    teachCopy:
      'Windows are independent shells inside one session:\n' +
      '- `prefix c`  create a new window and switch to it\n' +
      '- `prefix n` / `prefix p`  next / previous window\n' +
      '- `prefix <number>`  jump straight to a window by index',
    objective: 'Open a second window, then hop between them.',
    keys: [['prefix c', 'new window'],
           ['prefix n', 'next'],
           ['prefix p', 'previous'],
           ['prefix 0-9', 'by index']],
    initialState: fresh,
    goal: { kind: 'events', sequence: ['window-created', 'window-switched', 'window-switched'] },
    steps: [
      { label: 'Open a second window',
        goal: { kind: 'events', sequence: ['window-created'] } },
      { label: 'Hop back to window 0',
        goal: { kind: 'events', sequence: ['window-created', 'window-switched'] } },
      { label: 'Hop forward again',
        goal: { kind: 'events', sequence: ['window-created', 'window-switched', 'window-switched'] } },
    ],
    par: 6,
    hints: ['C-b then c opens a new window.',
            'Then C-b p to go back, C-b n to come forward.',
            'Or C-b 0 / C-b 1 to jump by index.'],
    successCopy: '`prefix c` creates windows; `prefix n`/`p`/`<n>` navigate. Each window is its own shell, switched without touching the mouse.',
    referenceSolution: ['C-b', 'c', 'C-b', 'p', 'C-b', 'n']
  },
  {
    id: 'm03-housekeeping',
    title: 'Housekeeping',
    teachCopy:
      'Two window-housekeeping keys:\n' +
      '- `prefix ,`  rename the active window - prompt is prefilled with the current name; `C-u` clears it in one stroke (`Backspace` also works), then type the new name and press `Enter`\n' +
      '- `prefix &`  kill the active window - confirms with a `kill-window? (y/n)` prompt; press `y`',
    objective: 'End with one window, named "main".',
    keys: [['prefix ,', 'rename (prefilled)'], ['prefix &', 'kill window (y to confirm)']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'events', sequence: ['window-created', 'window-killed', 'window-renamed'] },
      { kind: 'state', check: { windowCount: 1, activeWindowName: 'main' } },
    ] },
    steps: [
      { label: 'Open a new window',
        goal: { kind: 'events', sequence: ['window-created'] } },
      { label: 'Kill the extra window',
        goal: { kind: 'all', of: [
          { kind: 'events', sequence: ['window-created', 'window-killed'] },
          { kind: 'state', check: { windowCount: 1 } },
        ] } },
      { label: 'Rename the window to "main"',
        goal: { kind: 'all', of: [
          { kind: 'events', sequence: ['window-created', 'window-killed', 'window-renamed'] },
          { kind: 'state', check: { windowCount: 1, activeWindowName: 'main' } },
        ] } },
    ],
    par: 17,
    hints: [
      'First open the spare with C-b c.',
      'Rename: C-b , - the prompt shows "bash"; press `C-u` to clear it in one stroke, type "main", `Enter`.',
      'Kill the other: switch to it, C-b & , then `y` to confirm.',
    ],
    successCopy: 'Renamed one window, killed the extra. `prefix ,` and `prefix &` are the housekeeping pair.',
    referenceSolution: [
      'C-b', 'c',
      'C-b', 'n',
      'C-b', '&', 'y',
      'C-b', ',', 'C-u',
      'm','a','i','n','Enter',
    ]
  },
  {
    id: 'm04-the-split',
    title: 'Splits',
    teachCopy:
      'A window can hold multiple `panes`. The two split keys:\n' +
      '- `prefix %` (percent)  panes side by side (tmux\'s `split-window -h`)\n' +
      '- `prefix "` (double-quote)  panes stacked (tmux\'s `split-window -v`)',
    objective: 'Use both split keys - three panes in one window.',
    keys: [['prefix %', 'side-by-side panes (split-window -h)'],
           ['prefix "', 'stacked panes (split-window -v)']],
    initialState: fresh,
    goal: { kind: 'state', check: { panesInActiveWindow: 3, activeWindowSplitDirs: ['v', 'h'] } },
    steps: [
      { label: 'Split vertically',
        goal: { kind: 'state', check: { activeWindowSplitDirs: ['v'] } } },
      { label: 'Split horizontally',
        goal: { kind: 'state', check: { panesInActiveWindow: 3, activeWindowSplitDirs: ['v', 'h'] } } },
    ],
    par: 4,
    hints: ['C-b then % (shift-5) splits vertically.',
            'C-b then " (shift-apostrophe) splits horizontally.'],
    successCopy: '`%` and `"` - the two split keys. Side-by-side and stacked, in one window.',
    referenceSolution: ['C-b', '%', 'C-b', '"']
  },
  {
    id: 'm05-pane-dance',
    title: 'Move Between Panes',
    teachCopy:
      'Two ways to move focus between panes:\n' +
      '- `prefix o`  cycle to the next pane.\n' +
      '- `prefix ↑↓←→`  move by direction (arrows are repeatable - after the first `prefix`, press an arrow again without re-pressing prefix).',
    objective: 'Split twice, then move focus.',
    keys: [['prefix o', 'cycle pane'], ['prefix ←↑↓→', 'by direction (repeatable)']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { panesInActiveWindow: 3 } },
      { kind: 'events', sequence: ['pane-split', 'pane-split', 'pane-navigated'] }
    ] },
    steps: [
      { label: "Split vertical",
        goal: { kind: 'events', sequence: ['pane-split'] } },
      { label: 'Split again',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-split'] } },
      { label: 'Move focus to another pane', goal: { kind: 'all', of: [
        { kind: 'state', check: { panesInActiveWindow: 3 } },
        { kind: 'events', sequence: ['pane-split', 'pane-split', 'pane-navigated'] }
      ] } },
    ],
    par: 6,
    hints: ['Split twice (C-b %), then C-b o to move.', 'Or use C-b then an arrow key.'],
    successCopy: 'Pane navigation with `prefix o` or `prefix` + arrows. Focus moves without touching the mouse.',
    referenceSolution: ['C-b', '%', 'C-b', '%', 'C-b', 'o']
  },
  {
    id: 'm06-focus-mode',
    title: 'Focus Mode',
    teachCopy:
      'Two pane-level verbs:\n' +
      '- `prefix z`  expand the active pane to fill the window (toggle).\n' +
      '- `prefix x`  close the active pane - confirms with a `kill-pane <index>? (y/n)` prompt; press `y`.',
    objective: 'Split, expand and shrink the pane, then close one pane.',
    keys: [['prefix z', 'zoom toggle (expand/restore)'], ['prefix x', 'close pane (y to confirm)']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { panesInActiveWindow: 1 } },
      { kind: 'events', sequence: ['pane-split', 'pane-zoom-toggled', 'pane-zoom-toggled', 'pane-closed'] }
    ] },
    steps: [
      { label: "Split vertical",
        goal: { kind: 'events', sequence: ['pane-split'] } },
      { label: 'Zoom the pane to fullscreen',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-zoom-toggled'] } },
      { label: 'Un-zoom the pane',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-zoom-toggled', 'pane-zoom-toggled'] } },
      { label: 'Close one pane', goal: { kind: 'all', of: [
        { kind: 'state', check: { panesInActiveWindow: 1 } },
        { kind: 'events', sequence: ['pane-split', 'pane-zoom-toggled', 'pane-zoom-toggled', 'pane-closed'] }
      ] } },
    ],
    par: 8,
    hints: ['Split (C-b %), expand & restore (C-b z twice).', 'Then close one pane: C-b x , then `y` to confirm.'],
    successCopy: '`prefix z` toggles a pane to fullscreen without rebuilding the layout. `prefix x` closes the active pane after a confirm.',
    referenceSolution: ['C-b', '%', 'C-b', 'z', 'C-b', 'z', 'C-b', 'x', 'y']
  },
  {
    id: 'm07-many-lives',
    title: 'Many Lives',
    teachCopy:
      'You already met sessions from the host shell (`tmux ls` / `tmux a`).\n' +
      'From INSIDE tmux the command prompt drives them. Bare `new -s <name>`\n' +
      'would create a session AND jump you straight into it. The `-d` flag is\n' +
      'the difference: it spins the session up DETACHED - running in the\n' +
      'background while you keep your seat:\n' +
      '- `:new -d -s <name>` creates a session detached - you stay put\n' +
      '\n' +
      '`prefix :` opens the command prompt (just learned it).',
    objective: 'Start a "logs" session in the background, without leaving "main".',
    keys: [['prefix :', 'command prompt'],
           [':new -d -s <name>', 'create detached - you stay put']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { sessionCount: 2, attachedSessionName: 'main', sessionByName: { name: 'logs' } } },
      { kind: 'events', sequence: ['session-created'] },
    ] },
    steps: [
      { label: 'Spin up a detached "logs" session, staying on "main"',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { sessionCount: 2, attachedSessionName: 'main', sessionByName: { name: 'logs' } } },
          { kind: 'events', sequence: ['session-created'] },
        ] } },
    ],
    par: 13,
    hints: ['C-b : opens the command prompt.',
            'Type  `new -d -s logs`  then `Enter` - `-d` keeps you on main.',
            '`-d` = detached: the session runs in the background, you stay put.'],
    successCopy: '`:new -d -s <name>` creates a session detached - it runs in the background and you keep your seat. Without `-d`, `new` would have dropped you straight into it.',
    referenceSolution: [
      'C-b', ':', ...'new -d -s logs'.split(''), 'Enter',
    ]
  },
  {
    id: 'm08-session-hop',
    title: 'Session Hop',
    teachCopy:
      'Session-level navigation:\n' +
      '- `prefix )`  next session\n' +
      '- `prefix (`  previous session\n' +
      '- `prefix d`  detach - back at the parent shell, `tmux attach` reattaches',
    objective: 'Hop to the other session, then detach and come back.',
    keys: [['prefix )', 'next session'], ['prefix (', 'prev session'],
           ['prefix d', 'detach (reattach with tmux attach)']],
    initialState: twoNamedSessions,
    goal: { kind: 'events', sequence: ['session-switched', 'detached', 'attached'] },
    steps: [
      { label: 'Hop to the other session',
        goal: { kind: 'events', sequence: ['session-switched'] } },
      { label: 'Detach',
        goal: { kind: 'events', sequence: ['session-switched', 'detached'] } },
      { label: 'Come back to it',
        goal: { kind: 'events', sequence: ['session-switched', 'detached', 'attached'] } },
    ],
    par: 8,
    hints: ['C-b ) hops to the next session - two are already running.',
            'Then C-b d to detach; type `tmux attach` at the parent shell to come back.'],
    successCopy: 'Session switching with `prefix (`/`)` and detach/reattach via `prefix d` + `tmux attach`. Nothing is lost while detached.',
    referenceSolution: ['C-b', ')', 'C-b', 'd', 'Enter']
  },
  {
    id: 'm10-boss-rescue',
    title: 'Jump, Split, Detach',
    teachCopy:
      'Session has windows: logs(0) db(1) api(2).\n' +
      'Jump to "api", split it into two panes,\n' +
      'then detach - the session keeps running in the background.',
    objective: 'Jump to api, split the pane, detach.',
    keys: [['prefix 2', 'jump to api'], ['prefix %', 'split'], ['prefix d', 'detach']],
    initialState: rescueScenario,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { attached: false } },
      { kind: 'events', sequence: ['window-switched', 'pane-split', 'detached'] }
    ] },
    steps: [
      { label: 'Jump to the "api" window', goal: { kind: 'events', sequence: ['window-switched'] } },
      { label: 'Split the pane in two', goal: { kind: 'events', sequence: ['window-switched', 'pane-split'] } },
      { label: 'Detach from the session', goal: { kind: 'all', of: [
        { kind: 'state', check: { attached: false } },
        { kind: 'events', sequence: ['window-switched', 'pane-split', 'detached'] }
      ] } },
    ],
    par: 6,
    hints: ['Jump straight: C-b 2.', 'Split: C-b %. Then detach: C-b d.'],
    successCopy: 'Three keystrokes: jump → split → detach. The session keeps running until killed explicitly.',
    referenceSolution: ['C-b', '2', 'C-b', '%', 'C-b', 'd']
  },
  {
    id: 'm11-scroll-back',
    title: 'Scroll Back',
    teachCopy:
      "`prefix [`  enters copy-mode - a frozen view of this pane’s history.\n" +
      'Once inside, move like a pager:\n' +
      '- `g` / `G`  jump to the top / bottom of the scrollback\n' +
      '- `C-u` / `C-d`  scroll up / down half a page\n' +
      '- `q` leaves copy-mode (`Esc` only clears a selection, it does NOT leave)\n' +
      '\n' +
      '(Bindings shown are vi mode-keys - enable with `set -g mode-keys vi` in your tmux.conf. Default tmux uses emacs mode-keys with different bindings.)',
    objective: 'Enter copy-mode, look around the history, then leave.',
    keys: [['prefix [', 'copy-mode'], ['g / G', 'top / bottom'],
           ['C-u / C-d', 'half-page'], ['q', 'leave']],
    initialState: copyLogScenario,
    goal: { kind: 'all', of: [
      { kind: 'events', sequence: ['copy-mode-entered', 'copy-mode-exited'] },
      { kind: 'state', check: { minCopyCursorRow: 5 } },
    ] },
    steps: [
      { label: 'Enter copy-mode', goal: { kind: 'events', sequence: ['copy-mode-entered'] } },
      { label: 'Scroll back through the log', goal: { kind: 'state', check: { minCopyCursorRow: 5 } } },
      { label: 'Leave copy-mode', goal: { kind: 'all', of: [
        { kind: 'events', sequence: ['copy-mode-entered', 'copy-mode-exited'] },
        { kind: 'state', check: { minCopyCursorRow: 5 } },
      ] } },
    ],
    par: 6,
    hints: [
      'C-b then `[` to enter.',
      'Use `g` to jump to the top of the scrollback, or `C-u` to scroll up half a page.',
      'Press `q` to leave copy-mode.',
    ],
    successCopy: 'Copy-mode entered with `prefix [`, exited with `q`. Scrollback is readable without losing position in the live pane.',
    referenceSolution: ['C-b', '[', 'G', 'g', 'C-u', 'q'],
  },
  {
    id: 'm12-find-it',
    title: 'Find It',
    teachCopy:
      'In copy-mode, `/` starts a search (vi mode-keys; emacs mode-keys uses `C-s` / `C-r` instead).\n' +
      '- type the text, then `Enter` jumps to it\n' +
      '- `n` repeats the search\n' +
      '- `q` leaves copy-mode',
    objective: 'Enter copy-mode, search the history, then leave.',
    keys: [['prefix [', 'copy-mode'], ['/text Enter', 'search'], ['n', 'repeat'], ['q', 'leave']],
    initialState: copyLogScenario,
    goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched', 'copy-mode-exited'] },
    steps: [
      { label: "Enter copy-mode",
        goal: { kind: 'events', sequence: ['copy-mode-entered'] } },
      { label: 'Search the history',
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched'] } },
      { label: 'Leave copy-mode',
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched', 'copy-mode-exited'] } },
    ],
    par: 9,
    hints: ['C-b `[` , then `/` to search.', 'Type `deploy` then `Enter`, then `q`.'],
    successCopy: 'Copy-mode search: `/` forward, `n` repeats. Faster than scrolling on long logs.',
    referenceSolution: ['C-b', '[', '/', 'd', 'e', 'p', 'l', 'o', 'y', 'Enter', 'q'],
  },
  {
    id: 'm13-grab-the-error',
    title: 'Grab the Error',
    teachCopy:
      'Real workflow: find a line, copy it, paste it where you need it.\n' +
      '`prefix [` , `/` to search to the line you want, then start a selection:\n' +
      '- `Space`  begins a character selection - move with arrows to extend it\n' +
      '- `V`      grabs the whole line in one key\n' +
      '`Enter` copies the selection (and leaves copy-mode). `prefix o` to the\n' +
      'notes pane, `prefix ]` to paste.\n' +
      '\n' +
      'You decide how much to take - a whole line, or just the part you care\n' +
      'about. (Selection keys are vi mode-keys: `Enter` is the default copy key,\n' +
      '`y` a common user-added one this trainer also wires; emacs mode-keys uses\n' +
      '`M-w`. Enable with `set -g mode-keys vi`.)',
    objective: 'Find the error line, copy it, and paste it into the notes pane.',
    keys: [['prefix [', 'copy-mode'], ['/text Enter', 'search'], ['Space', 'char select'],
           ['V', 'whole line'], ['Enter', 'copy'], ['prefix o', 'other pane'], ['prefix ]', 'paste']],
    initialState: copyRescueScenario,
    goal: { kind: 'events',
      sequence: ['copy-mode-entered', 'copy-searched', 'text-copied', 'text-pasted'] },
    steps: [
      { label: "Enter copy-mode",
        goal: { kind: 'events', sequence: ['copy-mode-entered'] } },
      { label: "Search to the error line",
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched'] } },
      { label: 'Select and copy',
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched', 'text-copied'] } },
      { label: 'Paste it into the notes pane',
        goal: { kind: 'events',
          sequence: ['copy-mode-entered', 'copy-searched', 'text-copied', 'text-pasted'] } },
    ],
    par: 14,
    hints: [
      'C-b `[` , then `/ERROR Enter` to land on the line.',
      '`V` selects the whole line, then `Enter` copies and exits. C-b o, then C-b `]` pastes.',
      'A selection must come first (`Space` or `V`) - Enter alone just leaves copy-mode.',
    ],
    successCopy: 'find → select → copy → paste: `/` to it, `V` (or `Space`) to select, `Enter`, then `prefix ]`. Copy whatever you need.',
    referenceSolution: [
      'C-b', '[', '/', 'E', 'R', 'R', 'O', 'R', 'Enter',
      'V', 'Enter', 'C-b', 'o', 'C-b', ']',
    ],
  }
  ,{
    id: 'm15-prompt-power',
    title: 'Prompt Power',
    teachCopy:
      '`prefix :` opens the command prompt - it does more than sessions:\n' +
      '- `new-window -n <name>`  makes a named window (short: `neww`)\n' +
      '- `select-window -t <n>`  jumps to window n (short: `selectw`)\n' +
      '\n' +
      '`-n` sets the window name; `-t` is the target window. Targets accept an index (`0`), a name (`logs`), or a fully-qualified `session:window` (`work:logs`).',
    objective: 'Use the command prompt to make and switch windows.',
    keys: [['prefix : new-window -n', 'named window'],
           ['prefix : select-window -t', 'jump to window']],
    initialState: fresh,
    goal: { kind: 'events', sequence: ['window-created', 'window-switched'] },
    steps: [
      { label: 'Open a named window with the prompt',
        goal: { kind: 'events', sequence: ['window-created'] } },
      { label: 'Jump back to window 0',
        goal: { kind: 'events', sequence: ['window-created', 'window-switched'] } },
    ],
    par: 21,
    hints: [
      'C-b : then  `neww -n build`  Enter.',
      'C-b : then  `selectw -t 0`  Enter.',
    ],
    successCopy: 'Command prompt (`prefix :`) drives `neww -n <name>` and `selectw -t <n>` - the built-in short aliases of new-window/select-window.',
    referenceSolution: [
      'C-b', ':', ...'neww -n build'.split(''), 'Enter',
      'C-b', ':', ...'selectw -t 0'.split(''), 'Enter',
    ],
  },
  {
    id: 'm19-pick-session',
    title: 'The Picker',
    teachCopy:
      'tmux ships one interactive picker, two flavors of `choose-tree`:\n' +
      '- `prefix s` opens it scoped to SESSIONS (all collapsed)\n' +
      '- `prefix w` opens it scoped to WINDOWS (current session pre-expanded)\n' +
      '\n' +
      'Inside the picker:\n' +
      '- `j` / `k` (or arrows) move the cursor\n' +
      '- `Enter` selects (attaches a session, switches to a window)\n' +
      '- `q` / `Esc` cancels',
    objective: 'Attach to "api" via prefix s, then jump to its "deploy" window via prefix w.',
    keys: [['prefix s', 'choose-tree -s (sessions)'],
           ['prefix w', 'choose-tree -w (windows)'],
           ['j / k', 'cursor'],
           ['Enter', 'select'],
           ['q', 'cancel']],
    initialState: () => {
      const s = fresh();
      const sid = `s${s.nextId++}`;
      const w1 = `w${s.nextId++}`, p1 = `p${s.nextId++}`;
      const w2 = `w${s.nextId++}`, p2 = `p${s.nextId++}`;
      s.sessions.push({
        id: sid, name: 'api', createdAt: Date.now(),
        windows: [
          { id: w1, name: 'server', createdAt: Date.now(),
            layout: { kind: 'leaf', paneId: p1 },
            activePaneId: p1, zoomedPaneId: null },
          { id: w2, name: 'deploy', createdAt: Date.now(),
            layout: { kind: 'leaf', paneId: p2 },
            activePaneId: p2, zoomedPaneId: null },
        ],
        activeWindowId: w1,
      });
      return s;
    },
    goal: { kind: 'all', of: [
      { kind: 'state', check: {
        attachedSessionName: 'api', activeWindowName: 'deploy' } },
      { kind: 'events', sequence:
        ['tree-opened', 'session-switched', 'tree-opened', 'window-switched'] },
    ] },
    steps: [
      { label: 'Open the session picker',
        goal: { kind: 'events', sequence: ['tree-opened'] } },
      { label: 'Attach to "api"',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { attachedSessionName: 'api' } },
          { kind: 'events', sequence: ['tree-opened', 'session-switched'] },
        ] } },
      { label: 'Open the window picker and jump to "deploy"',
        goal: { kind: 'all', of: [
          { kind: 'state', check: {
            attachedSessionName: 'api', activeWindowName: 'deploy' } },
          { kind: 'events', sequence:
            ['tree-opened', 'session-switched', 'tree-opened', 'window-switched'] },
        ] } },
    ],
    par: 8,
    hints: [
      'C-b then s opens the session picker.',
      'j to move down, Enter to attach.',
      'Then C-b then w for the window picker; j to "deploy", Enter.',
    ],
    successCopy: '`prefix s` and `prefix w` open the same picker - sessions or windows. Faster than memorising names or indices.',
    referenceSolution: [
      'C-b', 's', 'j', 'Enter',
      'C-b', 'w', 'j', 'Enter',
    ],
  },
  {
    id: 'm29-resize-it',
    title: 'Resize It',
    teachCopy:
      '`:resize-pane -L|-R|-U|-D N` (alias `resizep`) shifts the boundary\n' +
      'between the active pane and its sibling by N cells. The bare form\n' +
      '`prefix C-arrow` (or `prefix M-arrow` = Option/Alt-arrow) does the\n' +
      'same incrementally - both are `-r` repeatable, so you can keep\n' +
      'tapping arrows without re-pressing the prefix.\n' +
      '\n' +
      'macOS note: `Ctrl+arrow` is bound to Mission Control by default,\n' +
      'so `prefix C-arrow` may not reach tmux. Use `prefix M-arrow`\n' +
      '(Option+arrow) - both are real tmux defaults, no rebind needed.',
    objective: 'Split the window, then resize the pane - shrink it, then grow it back. Any amount works.',
    keys: [
      [':resize-pane -L 5', 'shrink the active pane leftward'],
      ['prefix C-Right', 'grow the active pane rightward (repeatable)'],
      ['prefix M-Right', 'grow rightward in 5-cell steps; use on macOS (Option+arrow)'],
    ],
    initialState: fresh,
    goal: {
      kind: 'events',
      sequence: ['pane-split', 'pane-resized', 'pane-resized'],
    },
    steps: [
      {
        label: 'Split the window',
        goal: { kind: 'events', sequence: ['pane-split'] },
      },
      {
        label: 'Shrink the active pane',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-resized'] },
      },
      {
        label: 'Grow the active pane back the other way',
        goal: {
          kind: 'events',
          sequence: ['pane-split', 'pane-resized', 'pane-resized'],
        },
      },
    ],
    par: 26,
    hints: [
      'Split first: C-b then %.',
      'Type `:resize-pane -L 5` then Enter to shrink - any number works.',
      'Then C-b C-Right (or C-b M-Right on macOS) to grow it back.',
    ],
    successCopy: 'Layout shaped to fit your eyes, not the default.',
    referenceSolution: [
      'C-b', '%',
      'C-b', ':',
      ...'resize-pane -L 5'.split(''),
      'Enter',
      'C-b', 'C-Right',
    ],
  },
  {
    id: 'm30-jump-by-number',
    title: 'Jump by Number',
    teachCopy:
      '`prefix q` overlays each pane with its number for one second; press\n' +
      'a digit while the numbers are showing to jump to that pane directly.\n' +
      'Faster than `prefix o` chains when you have 4+ panes and you know\n' +
      'which one you want.',
    objective: 'Show the pane numbers, then jump straight to a different pane.',
    keys: [
      ['prefix q', 'show pane numbers for 1 second'],
      ['<digit>', 'jump to that pane while numbers are showing'],
    ],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { panesInActiveWindow: 3 } },
      { kind: 'events', sequence: ['pane-split', 'pane-split', 'display-panes-entered', 'pane-navigated'] },
    ] },
    steps: [
      {
        label: 'Split into three panes',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { panesInActiveWindow: 3 } },
          { kind: 'events', sequence: ['pane-split', 'pane-split'] },
        ] },
      },
      {
        label: 'Show the pane numbers',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-split', 'display-panes-entered'] },
      },
      {
        label: 'Jump straight to a different pane',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { panesInActiveWindow: 3 } },
          { kind: 'events', sequence: ['pane-split', 'pane-split', 'display-panes-entered', 'pane-navigated'] },
        ] },
      },
    ],
    par: 9,
    hints: [
      'Split twice to make a three-pane window: C-b %, then C-b ".',
      'C-b then q shows the pane numbers.',
      'While the numbers are visible, press the digit of a pane you are NOT on.',
    ],
    successCopy: 'No more pane-o-marathon to reach the one you wanted.',
    referenceSolution: ['C-b', '%', 'C-b', '"', 'C-b', 'q', '0'],
  },
  {
    id: 'm50-find-window',
    title: 'Find by Name',
    teachCopy:
      'Once you have more than four windows, counting indices wastes\n' +
      'time. `prefix f` opens a find-window prompt: type any substring\n' +
      'of a window name, press Enter, and tmux jumps to the first\n' +
      'matching window across every session.\n' +
      '\n' +
      'Here we jump straight to the first match. Real tmux instead\n' +
      'drops you into a filtered choose-tree list - matching window\n' +
      'name, title, AND visible pane content - that you pick from. The\n' +
      'opening move (`prefix f`, then type a filter) is identical, so\n' +
      'the muscle memory transfers either way.\n' +
      '\n' +
      'Modern power-user pattern: pair this with descriptive names\n' +
      '(`prefix ,` to rename) so `prefix f api Enter` always lands on\n' +
      'the right pane regardless of where it drifted in the index.',
    objective: 'Find the `deploy` window by name without counting indices.',
    keys: [
      ['prefix f', 'open the find-window prompt'],
      ['<substring>', 'type any part of the window name'],
      ['Enter', 'jump to the first match'],
    ],
    initialState: windowsForFind,
    goal: {
      kind: 'all',
      of: [
        { kind: 'events', sequence: ['find-opened', 'window-switched'] },
        { kind: 'state', check: { activeWindowName: 'deploy' } },
      ],
    },
    steps: [
      {
        label: 'open the find prompt',
        goal: { kind: 'events', sequence: ['find-opened'] },
      },
      {
        label: 'land on the deploy window',
        goal: {
          kind: 'all',
          of: [
            { kind: 'events', sequence: ['find-opened', 'window-switched'] },
            { kind: 'state', check: { activeWindowName: 'deploy' } },
          ],
        },
      },
    ],
    par: 12,
    hints: [
      'C-b f opens the find-window prompt - same key family as choose-tree.',
      'Type any substring of the target name (`dep` is enough), then Enter.',
      'tmux searches every window in every session; you do not need to be on the right session first.',
    ],
    successCopy: 'Find by name beats counting once windows multiply. Pair with descriptive renames and you never lose a workspace.',
    referenceSolution: [
      'C-b', 'f',
      ...'deploy'.split(''),
      'Enter',
    ],
  },

  {
    id: 'm46-rename-session',
    title: 'Name Your Session',
    teachCopy:
      '`prefix $` opens a prompt prefilled with the current session name.\n' +
      'Clear with `C-u`, type a new name, press Enter. Persistent until\n' +
      'you rename again or kill the server.\n' +
      '\n' +
      'Equivalent from the command prompt: `:rename-session <name>`.\n' +
      'Equivalent from the host shell: `tmux rename-session -t old new`.\n' +
      '\n' +
      'Session names show up in `tmux ls`, in the choose-tree picker, and\n' +
      'in `tmux a -t <name>`. This trainer seeds your session as `main` (a\n' +
      "friendly default); real tmux auto-names the first unnamed session `0`.\n" +
      'Either way, a generic default renamed to `api-prod` is searchable -\n' +
      'that is the whole point.',
    objective: 'Rename your current session from the default to a name of your choice.',
    keys: [
      ['prefix $', 'rename current session (prompt prefilled with the existing name)'],
      ['C-u', 'clear the prefilled name before typing the new one'],
      [':rename-session <name>', 'same thing from the command prompt'],
    ],
    initialState: fresh,
    goal: {
      kind: 'state',
      check: { attachedSessionNameNot: 'main' },
    },
    steps: [
      {
        label: 'Give the session a name of your own',
        goal: { kind: 'state', check: { attachedSessionNameNot: 'main' } },
      },
    ],
    par: 15,
    hints: [
      'C-b $ opens the rename prompt. The current name is already there.',
      'Clear it with C-u, type any name you like, press Enter.',
      'The status bar reflects the change immediately; `tmux ls` would show the new name from the host shell.',
    ],
    successCopy: 'Named sessions are findable sessions. `tmux a -t <name>` from anywhere lands you here.',
    referenceSolution: [
      'C-b', '$', 'C-u',
      ...'work'.split(''),
      'Enter',
    ],
  },

  {
    id: 'm43-cli-sessions',
    title: 'List, Attach, Switch',
    teachCopy:
      'tmux runs as a server. Sessions live INSIDE the server, not\n' +
      'inside any one terminal - closing a terminal does not kill them,\n' +
      'they just become "detached." From the host shell:\n' +
      '  `tmux ls`             list every running session\n' +
      '  `tmux a` / `tmux a -t <name>`   attach (defaults to most-recent)\n' +
      '  `tmux new -A -s <name>`        attach if exists, create if not\n' +
      '\n' +
      'Start state: attached to session `dev`. A second session `logs`\n' +
      'is already running in the background.\n' +
      'Target state: attached to `logs` instead, with both sessions\n' +
      'still alive on the server.',
    objective: 'Detach from dev, confirm both sessions persist, then attach to logs.',
    keys: [
      ['prefix d', 'detach (keeps the session running in the background)'],
      ['tmux ls', 'list running sessions from the host shell'],
      ['tmux a -t <name>', 'attach to a specific session by name'],
    ],
    initialState: twoNamedSessions,
    goal: {
      kind: 'all',
      of: [
        { kind: 'events', sequence: ['detached', 'attached'] },
        { kind: 'state', check: { attachedSessionName: 'logs' } },
      ],
    },
    steps: [
      {
        label: 'detach the current session',
        goal: { kind: 'events', sequence: ['detached'] },
      },
      {
        label: 'come back attached to the OTHER session',
        goal: {
          kind: 'all',
          of: [
            { kind: 'events', sequence: ['detached', 'attached'] },
            { kind: 'state', check: { attachedSessionName: 'logs' } },
          ],
        },
      },
    ],
    par: 35,
    hints: [
      'C-b d detaches - your session keeps running. Try `tmux ls` from the shell to prove it.',
      'From the detached shell: `tmux a -t logs` reattaches you to the OTHER session.',
      'Inside tmux the equivalent is `:switch-client -t logs` - useful when you forgot to detach first.',
    ],
    successCopy: 'Sessions outlive terminals. `tmux ls` to inspect, `tmux a -t <name>` to land on one - the workflow every tmux user runs ten times a day.',
    referenceSolution: [
      'C-b', ':', ...'switch-client -t logs'.split(''), 'Enter',
      'C-b', 'd',
      'Enter',
    ],
  },
  {
    id: 'm14-character-copy',
    title: 'Skim the Log',
    teachCopy:
      'A long log scrolled past - you do not have to crawl it line by line.\n' +
      'Copy-mode moves like a pager (these are also `less` bindings):\n' +
      '- `g` / `G`  jump to the very top / bottom of the scrollback\n' +
      '- `C-u` / `C-d`  scroll up / down half a page at a time\n' +
      '\n' +
      'Jump to the top to read where it all started, then snap back to the\n' +
      'bottom (the live tail) when you are done. `q` leaves.\n' +
      '\n' +
      '(These are vi mode-keys - enable with `set -g mode-keys vi`. Default\n' +
      'tmux uses emacs mode-keys, which page with `C-Up`/`C-Down` instead.)',
    objective: 'Jump to the top of the log, then back down to the bottom.',
    keys: [
      ['prefix [', 'copy-mode'],
      ['g / G', 'top / bottom'],
      ['C-u / C-d', 'half-page up / down'],
      ['q', 'leave'],
    ],
    initialState: copyLogScenario,
    goal: { kind: 'all', of: [
      { kind: 'events', sequence: ['copy-mode-entered', 'copy-mode-exited'] },
      { kind: 'state', check: { minCopyCursorRow: 0, copyReturnedToBottom: true } },
    ] },
    steps: [
      { label: 'Enter copy-mode',
        goal: { kind: 'events', sequence: ['copy-mode-entered'] } },
      { label: 'Jump to the top of the log',
        goal: { kind: 'state', check: { minCopyCursorRow: 0 } } },
      { label: 'Come back down to the bottom',
        goal: { kind: 'state', check: { minCopyCursorRow: 0, copyReturnedToBottom: true } } },
      { label: 'Leave copy-mode', goal: { kind: 'all', of: [
        { kind: 'events', sequence: ['copy-mode-entered', 'copy-mode-exited'] },
        { kind: 'state', check: { minCopyCursorRow: 0, copyReturnedToBottom: true } },
      ] } },
    ],
    par: 6,
    hints: [
      'C-b `[` to enter, then `g` jumps to the very top.',
      '`G` snaps back to the bottom (or page down with `C-d`).',
      'Press `q` to leave copy-mode.',
    ],
    successCopy: '`g`/`G` jump to the ends of the scrollback; `C-u`/`C-d` page through it. No mouse, no line-by-line scrolling.',
    referenceSolution: ['C-b', '[', 'g', 'G', 'q'],
  },
  {
    id: 'm16-clean-house',
    title: 'Clean House',
    teachCopy:
      'You created and switched into a session a moment ago; this is the\n' +
      'other half - tearing one down.\n' +
      'Two halves of the same lifecycle, both from `prefix :`:\n' +
      '- `new -d -s <name>`  spins up a fresh session detached (you stay put)\n' +
      '- `kill-session -t <name>`  tears it down\n' +
      '\n' +
      'The `-d` matters: bare `new -s` would attach you to the new session, so killing it would detach you. `-d` keeps you on `main`, so killing a different session leaves your attachment alone. (Killing the session you ARE attached to detaches the client - tmux default `detach-on-destroy=on`.)\n' +
      '`-s` names the new session; `-t` picks which one to act on.',
    objective: 'Spin up a detached "scratch" session, then kill it.',
    keys: [['prefix : new -d -s', 'new detached session'],
           ['prefix : kill-session -t', 'kill a session']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { sessionCount: 1, attachedSessionName: 'main' } },
      { kind: 'events', sequence: ['session-created', 'session-killed'] },
    ] },
    steps: [
      { label: 'Spin up a detached session named "scratch"',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { sessionCount: 2, attachedSessionName: 'main' } },
          { kind: 'events', sequence: ['session-created'] },
        ] } },
      { label: 'Kill the "scratch" session',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { sessionCount: 1, attachedSessionName: 'main' } },
          { kind: 'events', sequence: ['session-created', 'session-killed'] },
        ] } },
    ],
    par: 28,
    hints: [
      'C-b : then  `new -d -s scratch`  Enter.',
      'C-b : then  `kill-session -t scratch`  Enter.',
    ],
    successCopy: '`new -d -s <name>` (detached create) and `kill-session -t <name>` - the two halves of session lifecycle.',
    referenceSolution: [
      'C-b', ':', ...'new -d -s scratch'.split(''), 'Enter',
      'C-b', ':', ...'kills -t scratch'.split(''), 'Enter',
    ],
  },
  {
    id: 'm17-shuffle',
    title: 'Shuffle Panes',
    teachCopy:
      'Pane-shuffle keys (real tmux defaults):\n' +
      '- `prefix }`  swap the active pane with the NEXT pane (wraps)\n' +
      '- `prefix {`  swap with the PREVIOUS pane\n' +
      '\n' +
      'Each swap needs its own `prefix` - these are plain bindings, one press, one swap.',
    objective: 'Build three panes, then swap the active pane with its neighbor.',
    keys: [['prefix }', 'swap-pane -D (next)'],
           ['prefix {', 'swap-pane -U (previous)']],
    initialState: fresh,
    goal: { kind: 'all', of: [
      { kind: 'state', check: { panesInActiveWindow: 3 } },
      { kind: 'events', sequence: ['pane-split', 'pane-split', 'pane-swapped'] },
    ] },
    steps: [
      { label: 'Split twice',
        goal: { kind: 'events', sequence: ['pane-split', 'pane-split'] } },
      { label: 'Swap the active pane with its neighbor', goal: { kind: 'all', of: [
        { kind: 'state', check: { panesInActiveWindow: 3 } },
        { kind: 'events', sequence: ['pane-split', 'pane-split', 'pane-swapped'] },
      ] } },
    ],
    par: 7,
    hints: [
      'Split twice: C-b % then C-b %.',
      'C-b then `}` swaps the active pane with the next one.',
      'To swap again, press `prefix }` once more - one prefix per swap.',
    ],
    successCopy: '`prefix }` / `prefix {` run `swap-pane -D`/`-U`. The active pane keeps focus and moves to its new slot.',
    referenceSolution: ['C-b', '%', 'C-b', '%', 'C-b', '}'],
  },
  {
    id: 'm18-drop-here',
    title: 'Reorder by Prompt',
    teachCopy:
      'Two command-prompt commands reorder windows by index:\n' +
      '- `:move-window -t N` (alias `movew`) - relocate the active window\n' +
      '  to slot N. The active window stays active, just changes position.\n' +
      '- `:swap-window -s X -t Y` (alias `swapw`) - swap two windows by\n' +
      '  index. The active window does not move (unless it is one of the\n' +
      '  indices). Useful for tidying without context-switching.',
    objective: 'Reorder a four-window session by prompt - move and swap.',
    keys: [[':movew -t N', 'move active window to slot N'],
           [':swapw -s X -t Y', 'swap two windows by index']],
    initialState: () => {
      const s = fresh();
      const se = s.sessions[0]!;
      se.windows[0]!.name = 'logs';
      for (const name of ['db', 'main', 'vim']) {
        const wid = `w${s.nextId++}`, pid = `p${s.nextId++}`;
        se.windows.push({
          id: wid, name, createdAt: Date.now(),
          layout: { kind: 'leaf', paneId: pid },
          activePaneId: pid, zoomedPaneId: null,
        });
      }
      se.activeWindowId = se.windows[2]!.id;
      return s;
    },
    goal: { kind: 'all', of: [
      { kind: 'state', check: {
        windowNamesInOrder: ['main', 'vim', 'db', 'logs'] } },
      { kind: 'events', sequence: ['window-moved', 'window-swapped'] },
    ] },
    steps: [
      { label: 'Move main to slot 0',
        goal: { kind: 'all', of: [
          { kind: 'state', check: {
            windowNamesInOrder: ['main', 'logs', 'db', 'vim'] } },
          { kind: 'events', sequence: ['window-moved'] },
        ] } },
      { label: 'Swap logs and vim by index',
        goal: { kind: 'all', of: [
          { kind: 'state', check: {
            windowNamesInOrder: ['main', 'vim', 'db', 'logs'] } },
          { kind: 'events', sequence: ['window-moved', 'window-swapped'] },
        ] } },
    ],
    par: 25,
    hints: [
      'C-b : opens the prompt. Type `movew -t 0` Enter.',
      'Then C-b : again. Type `swapw -s 1 -t 3` Enter.',
    ],
    successCopy: '`:movew -t N` and `:swapw -s X -t Y` - the two prompt commands for reordering windows by index.',
    referenceSolution: [
      'C-b', ':', ...'movew -t 0'.split(''), 'Enter',
      'C-b', ':', ...'swapw -s 1 -t 3'.split(''), 'Enter',
    ],
  },
  {
    id: 'm20-shape-it',
    title: 'Layouts',
    teachCopy:
      'tmux ships seven named layouts - five core presets plus two\n' +
      'mirrored variants (`main-horizontal-mirrored`,\n' +
      '`main-vertical-mirrored`). Two ways to reach them:\n' +
      '- `prefix Space` runs `next-layout` - cycles the core presets\n' +
      '  `even-horizontal` → `even-vertical` → `main-horizontal` → `main-vertical` → `tiled`\n' +
      '- `:select-layout <name>` (alias `selectl`) jumps straight to one by name\n' +
      '\n' +
      'The command shortens by unique prefix, but the layout argument must\n' +
      'be the full canonical name (e.g. `main-vertical`, not `main-v`).',
    objective: 'Cycle once, then snap directly to "main-vertical".',
    keys: [['prefix Space', 'next-layout (cycle)'],
           [':selectl <name>', 'snap to preset'],
           ['Enter', 'commit prompt']],
    initialState: () => {
      const s = fresh();
      const se = s.sessions[0]!;
      const w = se.windows[0]!;
      const p1 = w.activePaneId;
      const p2 = `p${s.nextId++}`;
      const p3 = `p${s.nextId++}`;
      w.layout = buildPreset('even-h', [p1, p2, p3]);
      w.currentLayout = 'even-h';
      return s;
    },
    goal: { kind: 'all', of: [
      { kind: 'state', check: { activeWindowLayout: 'main-v' } },
      { kind: 'events', sequence: ['layout-applied', 'layout-applied'] },
    ] },
    steps: [
      { label: 'Cycle to the next preset layout',
        goal: { kind: 'all', of: [
          { kind: 'events', sequence: ['layout-applied'] },
          { kind: 'state', check: { activeWindowLayout: 'even-v' } },
        ] } },
      { label: 'Snap directly to the main-vertical preset',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { activeWindowLayout: 'main-v' } },
          { kind: 'events', sequence: ['layout-applied', 'layout-applied'] },
        ] } },
    ],
    par: 22,
    hints: [
      'First cycle: C-b then Space.',
      'Then C-b : opens the prompt; type `selectl main-vertical` Enter.',
    ],
    successCopy: '`prefix Space` cycles the core presets; `:select-layout <name>` snaps to any of the seven by name. Two paths to a tidy window.',
    referenceSolution: [
      'C-b', ' ',
      'C-b', ':', ...'selectl main-vertical'.split(''), 'Enter',
    ],
  },
  {
    id: 'm21-break-it-out',
    title: 'Break and Bring Back',
    teachCopy:
      'Two halves of the same pane-relocation arc - both move ONE pane at\n' +
      'a time, never a whole window:\n' +
      '- `prefix !` (break-pane) lifts the active pane out of its window\n' +
      '  into a brand-new window of its own. Scrollback rides along.\n' +
      '- `:join-pane -s N -t M` (alias `joinp`) is the inverse. `-s N` is\n' +
      '  the SOURCE window index, `-t M` is the TARGET window index - it\n' +
      '  grabs window N\'s active pane and drops it as a stacked split\n' +
      '  below window M\'s active pane (pass `-h` for side-by-side).\n' +
      '  If source window N had only that one pane, the now-empty window\n' +
      '  vanishes with it - no orphan windows left behind.',
    objective: 'Break a pane out into its own window, then join it back home.',
    keys: [['prefix !', 'break the active pane into a new window'],
           [':joinp -s 1 -t 0', 'pull window 1\'s pane into window 0'],
           ['Enter', 'commit prompt']],
    initialState: () => {
      const s = fresh();
      const se = s.sessions[0]!;
      const w = se.windows[0]!;
      const p1 = w.activePaneId;
      const p2 = `p${s.nextId++}`;
      w.layout = {
        kind: 'split', dir: 'v', ratio: 0.5,
        a: { kind: 'leaf', paneId: p1 },
        b: { kind: 'leaf', paneId: p2 },
      };
      w.activePaneId = p2;
      return s;
    },
    goal: { kind: 'all', of: [
      { kind: 'state', check: { windowCount: 1, panesInActiveWindow: 2 } },
      { kind: 'events', sequence: ['pane-broken', 'pane-joined'] },
    ] },
    steps: [
      { label: 'Break the active pane into its own window',
        goal: { kind: 'events', sequence: ['pane-broken'] } },
      { label: 'Pull the breakout pane back into the original window',
        goal: { kind: 'all', of: [
          { kind: 'state', check: { windowCount: 1, panesInActiveWindow: 2 } },
          { kind: 'events', sequence: ['pane-broken', 'pane-joined'] },
        ] } },
    ],
    par: 20,
    hints: [
      'C-b then `!` breaks the active pane into a new window.',
      'C-b then : opens the prompt.',
      'Type `joinp -s 1 -t 0` then `Enter` - `-s 1` is the source window, `-t 0` is the target.',
    ],
    successCopy: '`prefix !` lifts one pane into its own window; `:join-pane -s N -t M` pulls a pane between windows. Source window vanishes when its last pane leaves.',
    referenceSolution: [
      'C-b', '!',
      'C-b', ':', ...'joinp -s 1 -t 0'.split(''), 'Enter',
    ],
  },
  {
    id: 'm40-search-backward',
    title: 'Search Backward',
    teachCopy:
      'In copy-mode, `?` is the backward counterpart to `/` - it searches\n' +
      'the scrollback in reverse from the cursor. `n` repeats in the same\n' +
      'direction; `N` reverses. Use `?` when the line you want is above the\n' +
      'cursor - old logs live above new ones, so backward is the fast path.\n' +
      '\n' +
      'The new skill here is the backward direction. Once you land on the line,\n' +
      'copy it however you like - `V` for the whole line, `Space` + arrows for\n' +
      'a slice.',
    objective: 'In copy-mode, search backward to the server URL, then copy it.',
    keys: [
      ['prefix [', 'enter copy-mode'],
      ['?', 'start backward search'],
      ['n / N', 'repeat search / reverse direction'],
      ['Space', 'char select'],
      ['V', 'whole line'],
      ['Enter', 'copy selection'],
    ],
    initialState: serverLogScrollback,
    goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched', 'text-copied'] },
    steps: [
      {
        label: 'Enter copy-mode',
        goal: { kind: 'events', sequence: ['copy-mode-entered'] },
      },
      {
        label: 'Search back to the server URL',
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched'] },
      },
      {
        label: 'Copy it',
        goal: { kind: 'events', sequence: ['copy-mode-entered', 'copy-searched', 'text-copied'] },
      },
    ],
    par: 13,
    hints: [
      'Use prefix [ to enter copy-mode (the cursor starts at the bottom).',
      '`?` starts a backward search - type part of the URL (e.g. `http`) and confirm.',
      '`V` grabs the whole line; `Enter` copies it.',
    ],
    successCopy: 'Forward `/` and backward `?` - both directions covered.',
    referenceSolution: [
      'C-b', '[',
      '?',
      'h', 't', 't', 'p',
      'Enter',
      'V',
      'Enter',
    ],
  },
  {
    id: 'm53-popup',
    title: 'The Popup',
    teachCopy:
      '`:popup` opens a floating terminal centred over your panes - a scratch\n' +
      'shell that leaves your layout completely untouched behind it.\n' +
      '- run a quick command in it, then keep typing; your session waits behind\n' +
      '- `Esc` dismisses the popup and drops you back in your pane\n' +
      '\n' +
      '`:popup` is the built-in alias of `display-popup`. Flags: `-E` auto-closes\n' +
      'it when the command exits; `-w N` / `-h N` hint the width / height.',
    objective: 'Open a floating popup, then dismiss it.',
    keys: [
      [':popup', 'open a floating popup'],
      ['Esc', 'dismiss it'],
    ],
    initialState: fresh,
    goal: { kind: 'events', sequence: ['popup-opened', 'popup-closed'] },
    steps: [
      { label: 'Open a floating popup',
        goal: { kind: 'events', sequence: ['popup-opened'] } },
      { label: 'Dismiss the popup',
        goal: { kind: 'events', sequence: ['popup-opened', 'popup-closed'] } },
    ],
    par: 9,
    hints: [
      'Open the command prompt with C-b : then type `popup` and Enter.',
      'The popup is open - press Esc to dismiss it.',
    ],
    successCopy: 'A floating popup is a scratch terminal over your work - `:popup` (short for `display-popup`) opens it, `Esc` dismisses it, your layout untouched.',
    referenceSolution: [
      'C-b', ':', ...'popup'.split(''), 'Enter',
      'Esc',
    ],
  },
];

export const MISSIONS: Mission[] = RAW.map((m) => {
  const chapter = CHAPTER_OF[m.id];
  const order = ORDER_OF[m.id];
  if (chapter === undefined) throw new Error(`mission ${m.id} has no chapter in CHAPTER_OF`);
  if (order === undefined) throw new Error(`mission ${m.id} has no order in ORDER_OF`);
  return { ...m, chapter, order };
}).sort((a, b) => {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.order - b.order;
});

export const SPINE = MISSIONS.filter((m) => !m.optional);
export const ANNEX = MISSIONS.filter((m) => m.optional);
export const SPINE_COUNT = SPINE.length;
export const ANNEX_COUNT = ANNEX.length;
