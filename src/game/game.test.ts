import { describe, expect, it } from 'vitest';
import { INKS, loaner, normalizeDrawing } from './drawing';
import { CHECKPOINTS, initialProgress, LENGTH, nearestTrack, START, trackAt, updateProgress } from './track';
import { createRace, neutral, rankCars, recoverCar, stepRace } from './simulation';
import { FIXED_STEP, FixedClock, replay } from './replay';
import { aiControls } from './ai';
import { inkSpot, stampSpot } from './hazards';
const drawing = normalizeDrawing(loaner)!;
describe('drawing normalization', () => {
  it('rejects empty input and invalid points', () => { expect(normalizeDrawing([])).toBeNull(); expect(normalizeDrawing([{color:INKS[0],points:[{x:NaN,y:1}]}])).toBeNull(); });
  it('preserves disconnected open strokes and every point', () => { const raw = [{color:INKS[0],points:[{x:-5000,y:50},{x:5000,y:80}]},{color:INKS[1],points:[{x:90,y:300}]}]; const fitted = normalizeDrawing(raw)!; expect(fitted.strokes).toHaveLength(2); expect(fitted.strokes[0].points).toHaveLength(2); expect(fitted.strokes[1].color).toBe(INKS[1]); for(const point of fitted.strokes.flatMap(stroke=>stroke.points)){ expect(point.x).toBeGreaterThanOrEqual(0);expect(point.x).toBeLessThanOrEqual(640);expect(point.y).toBeGreaterThanOrEqual(0);expect(point.y).toBeLessThanOrEqual(294); } });
  it('keeps tiny dots finite and visible', () => { const fitted = normalizeDrawing([{color:INKS[2],points:[{x:2,y:2}]}])!; expect(Number.isFinite(fitted.strokes[0].points[0].x)).toBe(true); expect(fitted.strokes[0].points).toHaveLength(1); });
  it('fits wide and tall drawings without clipping or distortion', () => { for(const dimensions of [[10000,1],[1,10000]]) { const fitted=normalizeDrawing([{color:INKS[0],points:[{x:0,y:0},{x:dimensions[0],y:dimensions[1]}]}])!; expect(fitted.strokes[0].points.every(point=>point.x>=0&&point.x<=640&&point.y>=0&&point.y<=350)).toBe(true); } });
});
describe('course and ordered checkpoints', () => {
  it('projects the full circuit accurately', () => { for(let distance=0;distance<LENGTH;distance+=.5){ const point=trackAt(distance); expect(nearestTrack(point.x,point.y).distance).toBeCloseTo(distance,7); } });
  it('validates two ordered laps and lap times', () => { const progress=initialProgress(START); for(let distance=.5;distance<=LENGTH*2+1;distance+=.5) updateProgress(progress,(START+distance)%LENGTH,distance/10); expect(progress.laps).toBe(2);expect(progress.next).toBe(CHECKPOINTS*2+1);expect(progress.lapTimes).toHaveLength(2); });
  it('does not count finish-line rocking or reverse travel', () => { const progress=initialProgress(START-1); for(let index=0;index<100;index++) updateProgress(progress,START+(index%2?1:-1),index); expect(progress.laps).toBe(0); expect(progress.next).toBe(1); });
  it('rejects checkpoint teleporting', () => { const progress=initialProgress(START); updateProgress(progress,START+LENGTH/2,1); expect(progress.next).toBe(1);expect(progress.laps).toBe(0); });
});
describe('ranking, physics and hazards', () => {
  it('ranks by validated progress and finish time, not proximity to line', () => { const race=createRace(drawing); race.cars[1].progress.total=17; race.cars[2].progress.total=5; expect(rankCars(race.cars)[0].id).toBe(1); race.cars[3].finished=65; race.cars[0].finished=64; expect(rankCars(race.cars).map(car=>car.id)).toEqual([0,3,1,2]); });
  it('pause prevents simulation progression', () => { const race=createRace(drawing);race.paused=true;const before=JSON.stringify(race);stepRace(race,{...neutral(),throttle:1},FIXED_STEP);expect(JSON.stringify(race)).toBe(before); });
  it('barrier collisions constrain fixed fair bounds', () => { const race=createRace(drawing);race.countdown=0;const car=race.cars[0];car.z=-32;car.heading=-Math.PI/2;car.vz=-12;stepRace(race,{...neutral(),throttle:1},FIXED_STEP);expect(Math.abs(nearestTrack(car.x,car.z).offset)).toBeLessThanOrEqual(6.3001);expect(car.collision).toBeGreaterThan(0); });
  it('ink reduces grip for player and rivals', () => { for(const id of [0,1]){const race=createRace(drawing);race.countdown=0;race.cars[id].x=inkSpot.x;race.cars[id].z=inkSpot.z;stepRace(race,neutral(),FIXED_STEP);expect(race.cars[id].slipping).toBeGreaterThan(1);}});
  it('stamp penalizes both player and rivals only during impact', () => { for(const id of [0,1]){const race=createRace(drawing);race.countdown=0;race.time=5.5;const car=race.cars[id];car.x=stampSpot.x;car.z=stampSpot.z;car.heading=stampSpot.heading;car.vx=Math.cos(car.heading)*10;car.vz=Math.sin(car.heading)*10;stepRace(race,neutral(),FIXED_STEP);expect(car.stampCooldown).toBeGreaterThan(1);expect(Math.hypot(car.vx,car.vz)).toBeLessThan(3);}});
  it('drift release earns a brief boost', () => { const race=createRace(drawing);race.countdown=0;const car=race.cars[0];car.speed=8;car.vx=8;car.drifting=true;car.charge=.9;stepRace(race,{...neutral(),throttle:1},FIXED_STEP);expect(car.turbo).toBeGreaterThan(1);expect(car.event).toBe('PERFECT RELEASE'); });
  it('recovery changes heading but never teleports ahead', () => { const race=createRace(drawing);const car=race.cars[0];car.heading=Math.PI;const before={x:car.x,z:car.z,total:car.progress.total};recoverCar(car);expect({x:car.x,z:car.z,total:car.progress.total}).toEqual(before);expect(car.heading).toBeCloseTo(0); });
  it('AI completes two real laps, including after a spin, within 90 seconds', () => { const race=createRace(drawing);race.countdown=0;race.cars[2].heading=Math.PI;for(let tick=0;tick<90*60&&!race.finished;tick++)stepRace(race,aiControls(race.cars[0],race.time),FIXED_STEP); const summary=race.cars.map(car=>({id:car.id,time:car.finished,laps:car.progress.laps,progress:car.progress.total,speed:car.speed})); console.log('race simulation',JSON.stringify(summary));expect(race.finished).toBe(true);expect(race.time).toBeGreaterThan(50);expect(race.time).toBeLessThan(90);expect(race.cars[2].progress.total).toBeGreaterThan(LENGTH); });
});
describe('fixed-step replay', () => {
  it('recovers an AI car aimed directly into a barrier without jumping forward', () => {
    const race = createRace(drawing);
    race.countdown = 0;
    const car = race.cars[1];
    car.z = -31.25;
    car.heading = -Math.PI / 2;
    car.vx = 0;
    car.vz = -11;
    car.speed = 11;
    let collided = false;
    let previousProgress = car.progress.total;
    for (let tick = 0; tick < 60 * 14; tick++) {
      stepRace(race, neutral(), FIXED_STEP);
      collided ||= car.collision > 0;
      expect(Math.abs(nearestTrack(car.x, car.z).offset)).toBeLessThanOrEqual(6.301);
      expect(Math.abs(car.progress.total - previousProgress)).toBeLessThan(.4);
      previousProgress = car.progress.total;
    }
    expect(collided).toBe(true);
    expect(car.progress.total).toBeGreaterThan(50);
    expect(car.speed).toBeGreaterThan(5);
  });
  it('replays the exact same input deterministically', () => { const frames=[{tick:0,input:{...neutral(),throttle:1}},{tick:350,input:{...neutral(),throttle:1,steer:.3,drift:true}},{tick:450,input:{...neutral(),throttle:1,boost:true}}];expect(replay(createRace(drawing),frames,900)).toEqual(replay(createRace(drawing),frames,900)); });
  it('bounds catch-up after suspension and ignores negative deltas', () => { const clock=new FixedClock();let ticks=0;expect(clock.advance(50,()=>ticks++)).toBe(6);expect(ticks).toBe(6);expect(clock.advance(-5,()=>ticks++)).toBe(0);clock.reset();expect(clock.accumulator).toBe(0); });
  it('runs equal steps across different rendering cadences', () => { const fast=new FixedClock(),slow=new FixedClock();let fastTicks=0,slowTicks=0;for(let index=0;index<240;index++)fast.advance(1/120,()=>fastTicks++);for(let index=0;index<60;index++)slow.advance(1/30,()=>slowTicks++);expect(fastTicks).toBe(slowTicks);expect(fastTicks).toBe(120); });
});
