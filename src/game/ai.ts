import { trackAt } from './track';
import type { Car, Controls } from './simulation';
import { STAMP_DISTANCE, INK_DISTANCE, stampPhase } from './hazards';
import { LENGTH, wrap } from './track';
export function angleDifference(angle: number) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }
export function aiControls(car: Car, time: number): Controls {
  const upcomingStamp = wrap(STAMP_DISTANCE - car.distance);
  const upcomingInk = wrap(INK_DISTANCE - car.distance);
  const avoidStamp = upcomingStamp < 20 && (stampPhase(time + upcomingStamp / 10).impact || stampPhase(time).warning);
  const lane = avoidStamp ? 3 : upcomingInk < 16 ? -2.4 : car.lane;
  const target = trackAt(car.distance + 9 + car.speed * .4);
  const targetX = target.x - Math.sin(target.heading) * lane;
  const targetZ = target.y + Math.cos(target.heading) * lane;
  const error = angleDifference(Math.atan2(targetZ - car.z, targetX - car.x) - car.heading);
  const curvature = Math.abs(angleDifference(trackAt(car.distance + 14).heading - car.heading));
  const targetSpeed = curvature > .65 ? 8.8 : 9.65 + car.id * .18;
  return { throttle: car.speed < targetSpeed ? 1 : .2, brake: car.speed > targetSpeed + 1, steer: Math.max(-1, Math.min(1, error * 2.3)), drift: false, boost: car.energy > .85 && curvature < .22 && wrap(car.distance) < LENGTH, };
}
