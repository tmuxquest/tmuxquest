import { createInitialState, dispatch } from '../engine/tmuxModel';
import { paneOrder } from '../engine/layout';
import type { TmuxState } from '../engine/types';

export const fresh = (): TmuxState => createInitialState();

export function withWindows(n: number): TmuxState {
  const s = createInitialState();
  const se = s.sessions[0]!;
  for (let i = 0; i < n; i++) {
    const wid = `w${s.nextId++}`, pid = `p${s.nextId++}`;
    se.windows.push({ id: wid, name: 'bash', createdAt: Date.now(),
      layout: { kind: 'leaf', paneId: pid }, activePaneId: pid, zoomedPaneId: null });
  }
  return s;
}

export function rescueScenario(): TmuxState {
  const s = withWindows(2);
  const se = s.sessions[0]!;
  se.windows[0]!.name = 'logs';
  se.windows[1]!.name = 'db';
  const api = se.windows[2]!;
  api.name = 'api';
  api.paneContent = { [api.activePaneId]: [
    '➜ ~/api npm run dev',
    'INFO  api listening on :3000',
    'INFO  GET /health 200 1ms',
    'WARN  payments upstream slow 1.4s',
    'ERROR payments upstream timeout (3/3)',
    'ERROR unhandled rejection: ECONNREFUSED 10.0.0.5:5432',
    'WARN  restarting worker in 5s…',
  ] };
  se.activeWindowId = se.windows[0]!.id;
  return s;
}

export function copyLogScenario(): TmuxState {
  const s = createInitialState();
  const w = s.sessions[0]!.windows[0]!;
  w.paneContent = { [w.activePaneId]: [
    '➜ ~/tmuxquest ./run.sh',
    'INFO  boot sequence start',
    'INFO  loading config /etc/app.conf',
    'INFO  db pool size=10',
    'INFO  cache warm 0%',
    'INFO  cache warm 58%',
    'INFO  cache warm 100%',
    'INFO  http listening :8080',
    'INFO  worker 1 ready',
    'INFO  worker 2 ready',
    'INFO  worker 3 ready',
    'WARN  slow query 1.2s users.list',
    'INFO  GET /health 200 1ms',
    'INFO  GET /api/items 200 9ms',
    'INFO  POST /api/items 201 14ms',
    'INFO  deploy hook fired rev=4f1a2c',
    'INFO  GET /api/items 200 7ms',
    'WARN  retry upstream payments (1/3)',
    'INFO  upstream payments ok',
    'INFO  GET /metrics 200 2ms',
    'INFO  gc pause 4ms',
    'INFO  GET /health 200 1ms',
    'INFO  heartbeat ok',
    'INFO  idle',
  ] };
  return s;
}

export function copyRescueScenario(): TmuxState {
  const s = createInitialState();
  const w = s.sessions[0]!.windows[0]!;
  const left = w.activePaneId;
  const right = `p${s.nextId++}`;
  w.layout = {
    kind: 'split', dir: 'v', ratio: 0.5,
    a: { kind: 'leaf', paneId: left },
    b: { kind: 'leaf', paneId: right },
  };
  w.paneContent = {
    [left]: [
      '➜ ~/tmuxquest tail -f app.log',
      'INFO  GET /health 200 1ms',
      'INFO  GET /api/orders 200 12ms',
      'INFO  POST /api/orders 201 31ms',
      'WARN  upstream latency rising',
      'ERROR api: connection refused upstream=payments (503)',
      'INFO  GET /health 200 1ms',
      'INFO  retry scheduled in 5s',
    ],
    [right]: ['➜ ~/tmuxquest cat > notes.txt'],
  };
  return s;
}

export function verticalSplitTwoPanes(): TmuxState {
  let s = createInitialState();
  s = dispatch(s, 'C-b').state;
  s = dispatch(s, '%').state;
  return s;
}

export function fourPanesTiled(): TmuxState {
  let s = createInitialState();
  s = dispatch(s, 'C-b').state; s = dispatch(s, '%').state;
  s = dispatch(s, 'C-b').state; s = dispatch(s, '"').state;
  s = dispatch(s, 'C-b').state; s = dispatch(s, '%').state;
  const w = s.sessions[0]!.windows[0]!;
  w.activePaneId = paneOrder(w.layout)[0]!;
  return s;
}

export function preSeededLogScrollback(): TmuxState {
  const s = createInitialState();
  const w = s.sessions[0]!.windows[0]!;
  const pid = w.activePaneId;
  w.paneContent = {
    [pid]: [
      'GET /health 200 1ms',
      'GET /users 200 5ms',
      'POST /orders 500 14ms',
      'GET /items 200 3ms',
      'GET /cart 200 4ms',
      'DELETE /carts/4 200 2ms',
      'GET /pricing 200 6ms',
      'POST /search 200 9ms',
      'GET /static/css 200 1ms',
      'POST /webhook 200 8ms',
      'GET /health 200 1ms',
      'GET /users 200 5ms',
      'POST /orders 500 11ms',
      'GET /items 200 4ms',
      'GET /metrics 200 12ms',
    ],
  };
  return s;
}

export function twoPaneLiveAndCat(): TmuxState {
  let s = createInitialState();
  s = dispatch(s, 'C-b').state;
  s = dispatch(s, '%').state;
  const w = s.sessions[0]!.windows[0]!;
  const paneIds = paneOrder(w.layout);
  w.paneRoles = { live: paneIds[0]!, reader: paneIds[1]! };
  w.activePaneId = paneIds[0]!;
  return s;
}

export function withSinglePreloadedBuffer(): TmuxState {
  const s = createInitialState();
  s.pasteBuffers = [{ name: 'buffer0', text: 'useful captured text' }];
  s.nextBufferIdx = 1;
  return s;
}

export function paneWithSeededScrollback(): TmuxState {
  const s = createInitialState();
  const w = s.sessions[0]!.windows[0]!;
  const pid = w.activePaneId;
  w.paneContent = { [pid]: ['hello', 'world'] };
  return s;
}

export function serverLogScrollback(): TmuxState {
  const s = createInitialState();
  const w = s.sessions[0]!.windows[0]!;
  const pid = w.activePaneId;
  w.paneContent = {
    [pid]: [
      '➜ ~/tmuxquest ./serve.sh',
      'INFO  starting api server',
      'INFO  loading config /etc/app.conf',
      'INFO  listening on http://127.0.0.1:8080',
      'INFO  worker pool ready (4)',
      'INFO  GET /health 200 1ms',
      'INFO  GET /api/items 200 9ms',
      'INFO  heartbeat ok',
      'INFO  GET /health 200 1ms',
      'INFO  idle',
    ],
  };
  w.paneRoles = { live: pid };
  return s;
}

export function windowsForFind(): TmuxState {
  const s = createInitialState();
  const se = s.sessions[0]!;
  se.windows[0]!.name = 'edit';
  const names = ['build', 'logs', 'db', 'api', 'deploy', 'scratch', 'shell'];
  for (const n of names) {
    const wid = `w${s.nextId++}`, pid = `p${s.nextId++}`;
    se.windows.push({
      id: wid, name: n, createdAt: Date.now(),
      layout: { kind: 'leaf' as const, paneId: pid },
      activePaneId: pid, zoomedPaneId: null as null,
    });
  }
  return s;
}

export function twoNamedSessions(): TmuxState {
  const s = createInitialState();
  const devSe = s.sessions[0]!;
  devSe.name = 'dev';
  devSe.windows[0]!.name = 'code';
  const logsWinId = `w${s.nextId++}`;
  const logsPaneId = `p${s.nextId++}`;
  const logsSessId = `s${s.nextId++}`;
  s.sessions.push({
    id: logsSessId,
    name: 'logs',
    createdAt: Date.now(),
    windows: [{
      id: logsWinId,
      name: 'tail',
      createdAt: Date.now(),
      layout: { kind: 'leaf' as const, paneId: logsPaneId },
      activePaneId: logsPaneId,
      zoomedPaneId: null as null,
      paneContent: { [logsPaneId]: [] },
    }],
    activeWindowId: logsWinId,
  });
  return s;
}
