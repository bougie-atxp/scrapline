import { stepRace } from './simulation';
import type { Controls, Race } from './simulation';
export const FIXED_STEP = 1 / 60;
export class FixedClock {
  accumulator = 0;
  advance(elapsed: number, tick: (delta: number) => void) {
    this.accumulator += Math.min(.1, Math.max(0, elapsed));
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_STEP && steps < 6) { tick(FIXED_STEP); this.accumulator -= FIXED_STEP; steps++; }
    if (steps === 6) this.accumulator = Math.min(this.accumulator, FIXED_STEP);
    return steps;
  }
  reset() { this.accumulator = 0; }
}
export type ReplayFrame = { tick: number; input: Controls };
export function replay(race: Race, frames: ReplayFrame[], ticks: number) {
  let frameIndex = 0;
  for (let tick = 0; tick < ticks; tick++) {
    while (frameIndex + 1 < frames.length && frames[frameIndex + 1].tick <= tick) frameIndex++;
    stepRace(race, frames[frameIndex]?.input ?? { throttle: 0, brake: false, steer: 0, drift: false, boost: false }, FIXED_STEP);
  }
  return race;
}
