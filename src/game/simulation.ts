import type { Drawing } from './drawing';
import { aiControls, angleDifference } from './ai';
import { initialProgress, LENGTH, nearestTrack, ROAD_HALF, START, trackAt, updateProgress } from './track';
import type { Progress } from './track';
import { inInk, inStamp, stampPhase } from './hazards';
export type Controls = { throttle: number; brake: boolean; steer: number; drift: boolean; boost: boolean };
export const neutral = (): Controls => ({ throttle: 0, brake: false, steer: 0, drift: false, boost: false });
export type Car = { id: number; name: string; x: number; z: number; heading: number; vx: number; vz: number; speed: number; distance: number; lane: number; progress: Progress; charge: number; turbo: number; energy: number; slipping: number; stampCooldown: number; collision: number; stuck: number; recovery: number; finished: number | null; drifting: boolean; event: string; eventTimer: number };
export type Race = { cars: Car[]; time: number; countdown: number; finished: boolean; paused: boolean; drawing: Drawing; marks: {x:number;z:number;heading:number;life:number;ink:boolean}[]; markClock: number };
export function createRace(drawing: Drawing): Race {
  return { drawing, time: 0, countdown: 3.2, finished: false, paused: false, marks: [], markClock: 0, cars: ['YOU', 'PAPER TIGER', 'OFFCUT', 'CARBON COPY'].map((name, id) => {
    const distance = START - 1.5 - Math.floor(id / 2) * 5;
    const lane = id % 2 ? 2.8 : -2.8;
    const point = trackAt(distance);
    return { id, name, x: point.x, z: point.y + lane, heading: point.heading, vx: 0, vz: 0, speed: 0, distance, lane, progress: initialProgress(distance), charge: 0, turbo: 0, energy: 1, slipping: 0, stampCooldown: 0, collision: 0, stuck: 0, recovery: 0, finished: null, drifting: false, event: '', eventTimer: 0 };
  }) };
}
export function rankCars(cars: Car[]) { return [...cars].sort((first, second) => {
  if (first.finished !== null && second.finished !== null) return first.finished - second.finished;
  if (first.finished !== null) return -1;
  if (second.finished !== null) return 1;
  const validatedFirst = Math.min(first.progress.total, first.progress.next * LENGTH / 12);
  const validatedSecond = Math.min(second.progress.total, second.progress.next * LENGTH / 12);
  return validatedSecond - validatedFirst;
}); }
export function recoverCar(car: Car) {
  const center = nearestTrack(car.x, car.z);
  car.heading = center.heading; car.vx = Math.cos(center.heading) * 3; car.vz = Math.sin(center.heading) * 3;
  car.stuck = 0; car.recovery = 1.1; car.event = 'BACK ON THE LINE'; car.eventTimer = 1.8;
}
export function stepRace(race: Race, input: Controls, delta: number) {
  if (race.paused || race.finished) return;
  if (race.countdown > 0) { race.countdown = Math.max(0, race.countdown - delta); return; }
  race.time += delta; race.markClock += delta;
  for (const car of race.cars) {
    const controls = car.id === 0 && car.finished === null ? input : aiControls(car, race.time);
    car.slipping = Math.max(0, car.slipping - delta); car.stampCooldown = Math.max(0, car.stampCooldown - delta);
    car.collision = Math.max(0, car.collision - delta); car.turbo = Math.max(0, car.turbo - delta); car.eventTimer = Math.max(0, car.eventTimer - delta); car.recovery = Math.max(0, car.recovery - delta);
    car.energy = Math.min(1, car.energy + delta * .055);
    if (controls.boost && car.energy > .04) { car.turbo = .15; car.energy = Math.max(0, car.energy - delta * .4); }
    const drifting = controls.drift && Math.abs(controls.steer) > .12 && car.speed > 4;
    if (drifting) car.charge = Math.min(1, car.charge + delta * .52);
    if (car.drifting && !controls.drift && car.charge > .23) { car.turbo = .6 + car.charge * 1.35; car.event = car.charge > .8 ? 'PERFECT RELEASE' : 'DRIFT BOOST'; car.eventTimer = 1.4; car.charge = 0; }
    if (!drifting) car.charge = Math.max(0, car.charge - delta * .22);
    car.drifting = drifting;
    const forward = car.vx * Math.cos(car.heading) + car.vz * Math.sin(car.heading);
    let lateral = -car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
    const grip = car.slipping > 0 ? 1.2 : drifting ? 2.6 : 8;
    lateral *= Math.exp(-grip * delta);
    const maxSpeed = car.turbo > 0 ? 16.2 : 11.4;
    const acceleration = controls.brake ? -11 : controls.throttle * (car.turbo > 0 ? 12 : 6.7);
    const newForward = Math.max(0, Math.min(maxSpeed, forward + (acceleration - .032 * forward * forward - .65) * delta));
    const speedFactor = Math.min(1, car.speed / 3) / (1 + car.speed * .047);
    car.heading += controls.steer * speedFactor * (drifting ? 1.7 : 1.36) * delta;
    car.vx = Math.cos(car.heading) * newForward - Math.sin(car.heading) * lateral;
    car.vz = Math.sin(car.heading) * newForward + Math.cos(car.heading) * lateral;
    if (drifting) { car.vx += Math.sin(car.heading) * controls.steer * car.speed * .64 * delta; car.vz -= Math.cos(car.heading) * controls.steer * car.speed * .64 * delta; }
    car.x += car.vx * delta; car.z += car.vz * delta; car.speed = Math.hypot(car.vx, car.vz);
    const near = nearestTrack(car.x, car.z);
    const limit = ROAD_HALF - 1;
    if (Math.abs(near.offset) > limit) {
      const sign = Math.sign(near.offset);
      const normalX = -Math.sin(near.heading) * sign;
      const normalZ = Math.cos(near.heading) * sign;
      car.x = near.x + normalX * limit; car.z = near.z + normalZ * limit;
      const outward = car.vx * normalX + car.vz * normalZ;
      if (outward > 0) { car.vx -= normalX * outward * 1.2; car.vz -= normalZ * outward * 1.2; car.vx *= .84; car.vz *= .84; }
      car.heading += angleDifference(near.heading - car.heading) * Math.min(1, delta * 2.4);
      if (car.collision <= 0) { car.event = 'PAPER, NOT ARMOUR'; car.eventTimer = .9; car.collision = .5; }
    }
    if (inInk(car.x, car.z)) { car.slipping = 1.35; if (car.eventTimer <= 0) { car.event = 'INK! EASY ON THE STEERING'; car.eventTimer = 1; } }
    if (stampPhase(race.time).impact && inStamp(car.x, car.z) && car.stampCooldown <= 0) { car.vx *= .22; car.vz *= .22; car.stampCooldown = 2; car.collision = .8; car.event = 'RETURN TO SENDER'; car.eventTimer = 1.6; }
    car.distance = nearestTrack(car.x, car.z).distance;
    if (car.finished === null) {
      updateProgress(car.progress, car.distance, race.time);
      if (car.progress.laps >= 2) car.finished = race.time;
    }
    if ((car.speed < 1.8 && controls.throttle > 0) || Math.abs(angleDifference(near.heading - car.heading)) > 2) car.stuck += delta; else car.stuck = Math.max(0, car.stuck - delta);
    if (car.stuck > 2.2) recoverCar(car);
    if (race.markClock > .07 && (car.slipping > 0 || drifting)) race.marks.push({ x: car.x, z: car.z, heading: car.heading, life: car.slipping > 0 ? 2.4 : 1.4, ink: car.slipping > 0 });
  }
  for (let first = 0; first < race.cars.length; first++) for (let second = first + 1; second < race.cars.length; second++) {
    const car = race.cars[first], other = race.cars[second];
    const gap = Math.hypot(other.x - car.x, other.z - car.z);
    if (gap > .001 && gap < 2.25) {
      const normalX = (other.x - car.x) / gap, normalZ = (other.z - car.z) / gap;
      const overlap = (2.25 - gap) * .5;
      car.x -= normalX * overlap; car.z -= normalZ * overlap; other.x += normalX * overlap; other.z += normalZ * overlap;
      const closing = (car.vx - other.vx) * normalX + (car.vz - other.vz) * normalZ;
      if (closing > 0) { car.vx -= normalX * closing * .55; car.vz -= normalZ * closing * .55; other.vx += normalX * closing * .55; other.vz += normalZ * closing * .55; }
    }
  }
  if (race.markClock > .07) race.markClock = 0;
  race.marks = race.marks.filter(mark => (mark.life -= delta) > 0).slice(-240);
  if (race.cars[0].finished !== null) race.finished = true;
}
