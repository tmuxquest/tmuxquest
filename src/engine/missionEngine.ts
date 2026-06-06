import type { TmuxState, GameEvent } from './types';
import { dispatch, dispatchAction } from './tmuxModel';
import type { MouseAction, ApplyOpts } from './tmuxModel';
import { evaluateGoal } from './goals';
import type { Mission } from '../missions/schema';

export interface MissionEngineOpts {
  promptLineFor?: (paneId: string) => string | undefined;
}

export class MissionEngine {
  state: TmuxState;
  events: GameEvent[] = [];
  keystrokes = 0;
  complete = false;
  promptLineFor?: (paneId: string) => string | undefined;

  constructor(public mission: Mission, opts?: MissionEngineOpts) {
    this.state = mission.initialState();
    this.promptLineFor = opts?.promptLineFor;
  }

  private applyOpts(): ApplyOpts | undefined {
    if (!this.promptLineFor) return undefined;
    return { promptLineFor: this.promptLineFor };
  }

  press(key: string): void {
    if (this.complete) return;
    this.keystrokes++;
    const r = dispatch(this.state, key, this.applyOpts());
    this.state = r.state;
    const newEvents = [...r.events];
    if (newEvents.length) this.events = [...this.events, ...newEvents];
    if (evaluateGoal(this.mission.goal, this.state, this.events)) this.complete = true;
  }

  reset(): void {
    this.state = this.mission.initialState();
    this.events = []; this.keystrokes = 0; this.complete = false;
  }

  recordBriefOpened(): void { this.recordBriefEvent({ type: 'brief-opened' }); }

  recordBriefClosed(): void { this.recordBriefEvent({ type: 'brief-closed' }); }

  private recordBriefEvent(ev: GameEvent): void {
    if (this.complete) return;
    this.events = [...this.events, ev];
    if (evaluateGoal(this.mission.goal, this.state, this.events)) this.complete = true;
  }

  attachByName(name: string): void {
    if (this.complete) return;
    const target = this.state.sessions.find(se => se.name === name);
    if (!target) return;
    this.state = { ...this.state, activeSessionId: target.id };
    this.press('Enter');
  }

  dispatchAction(action: MouseAction): void {
    if (this.complete) return;
    const r = dispatchAction(this.state, action, this.applyOpts());
    this.state = r.state;
    if (r.events.length) this.events = [...this.events, ...r.events];
    if (evaluateGoal(this.mission.goal, this.state, this.events)) this.complete = true;
  }

  tick(_deltaMs: number): { events: GameEvent[] } {
    return { events: [] };
  }

  setPaneCwd(paneId: string, cwd: string): void {
    for (const se of this.state.sessions) {
      for (const w of se.windows) {
        if (!w.paneContent || !(paneId in w.paneContent)) continue;
        if (!w.paneCwd) w.paneCwd = {};
        w.paneCwd[paneId] = cwd;
        this.state = { ...this.state, sessions: [...this.state.sessions] };
        return;
      }
    }
  }

}
