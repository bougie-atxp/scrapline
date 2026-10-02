import { trackAt } from './track';
export const STAMP_DISTANCE = 112;
export const INK_DISTANCE = 219;
export function stampPhase(time: number) {
  const cycle = time % 7.8;
  return { warning: cycle > 4.1 && cycle < 5.4, impact: cycle >= 5.4 && cycle < 6.4, height: cycle < 4.1 ? 9 : cycle < 5.1 ? 9 + (cycle - 4.1) * 1.8 : cycle < 5.4 ? 10.8 * (5.4 - cycle) / .3 : cycle < 6.4 ? .35 : .35 + (cycle - 6.4) / 1.4 * 8.65 };
}
export function hazardPosition(distance: number, offset: number) { const center = trackAt(distance); return { x: center.x - Math.sin(center.heading) * offset, z: center.y + Math.cos(center.heading) * offset, heading: center.heading }; }
export const stampSpot = hazardPosition(STAMP_DISTANCE, -3.5);
export const inkSpot = hazardPosition(INK_DISTANCE, 2.8);
export function inStamp(x: number, z: number) { return Math.hypot(x - stampSpot.x, z - stampSpot.z) < 3.7; }
export function inInk(x: number, z: number) { return Math.hypot((x - inkSpot.x) / 1.3, z - inkSpot.z) < 3.7; }
