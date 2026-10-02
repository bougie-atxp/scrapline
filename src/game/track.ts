import type { Point } from './drawing';
export const STRAIGHT = 72;
export const RADIUS = 25;
export const HALF = STRAIGHT + Math.PI * RADIUS;
export const LENGTH = HALF * 2;
export const ROAD_HALF = 7.3;
export const START = 21;
export const CHECKPOINTS = 12;
export function wrap(value: number, length = LENGTH) { return ((value % length) + length) % length; }
export function trackAt(distance: number): Point & { heading: number } {
  const along = wrap(distance);
  if (along < STRAIGHT) return { x: -36 + along, y: -25, heading: 0 };
  if (along < HALF) { const angle = (along - STRAIGHT) / RADIUS; return { x: 36 + RADIUS * Math.sin(angle), y: -RADIUS * Math.cos(angle), heading: angle }; }
  if (along < HALF + STRAIGHT) return { x: 36 - (along - HALF), y: 25, heading: Math.PI };
  const angle = (along - HALF - STRAIGHT) / RADIUS;
  return { x: -36 - RADIUS * Math.sin(angle), y: RADIUS * Math.cos(angle), heading: Math.PI + angle };
}
export function nearestTrack(x: number, z: number): { distance: number; offset: number; x: number; z: number; heading: number } {
  let distance: number;
  if (x >= -36 && x <= 36) distance = z < 0 ? x + 36 : HALF + 36 - x;
  else if (x > 36) distance = STRAIGHT + Math.max(0, Math.min(Math.PI, Math.atan2(x - 36, -z))) * RADIUS;
  else distance = HALF + STRAIGHT + Math.max(0, Math.min(Math.PI, Math.atan2(-x - 36, z))) * RADIUS;
  const center = trackAt(distance);
  const offset = -(x - center.x) * Math.sin(center.heading) + (z - center.y) * Math.cos(center.heading);
  return { distance, offset, x: center.x, z: center.y, heading: center.heading };
}
export type Progress = { next: number; laps: number; total: number; lastDistance: number; lapStart: number; lapTimes: number[] };
export function initialProgress(distance: number): Progress { return { next: 1, laps: 0, total: Math.min(0, wrap(distance - START + LENGTH / 2) - LENGTH / 2), lastDistance: distance, lapStart: 0, lapTimes: [] }; }
export function updateProgress(progress: Progress, distance: number, time: number) {
  const delta = wrap(distance - progress.lastDistance + LENGTH / 2) - LENGTH / 2;
  progress.lastDistance = distance;
  if (Math.abs(delta) > 8) return;
  progress.total += delta;
  const target = progress.next * LENGTH / CHECKPOINTS;
  if (delta > 0 && progress.total >= target && progress.total < target + 8) {
    progress.next++;
    if ((progress.next - 1) % CHECKPOINTS === 0) {
      progress.laps++;
      progress.lapTimes.push(time - progress.lapStart);
      progress.lapStart = time;
    }
  }
}
