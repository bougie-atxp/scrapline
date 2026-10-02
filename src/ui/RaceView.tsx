import { useEffect, useRef, useState } from 'react';
import type { Drawing } from '../game/drawing';
import { Stadium } from '../render/scene';
import { createRace, neutral, rankCars, recoverCar, stepRace } from '../game/simulation';
import type { Controls, Race } from '../game/simulation';
import { FixedClock } from '../game/replay';
import { LENGTH, trackAt } from '../game/track';
import { loadSaved, save } from '../game/storage';
import { DrawingPreview } from './DrawingPad';
import type { QAWindow } from '../qa/BrowserQA';
export function timeLabel(time: number) { return `${Math.floor(time / 60)}:${(time % 60).toFixed(2).padStart(5, '0')}`; }
type Hud = { time:number; lap:number; speed:number; rank:number; charge:number; energy:number; turbo:boolean; countdown:number; event:string; positions:{x:number;y:number;id:number}[] };
const initialHud: Hud = { time:0,lap:1,speed:0,rank:1,charge:0,energy:1,turbo:false,countdown:4,event:'',positions:[] };
export default function RaceView({ drawing, onRedraw }: { drawing: Drawing; onRedraw: () => void }) {
  const host = useRef<HTMLDivElement>(null), raceRef = useRef<Race | null>(null), controls = useRef<Controls>(neutral());
  const [hud, setHud] = useState(initialHud), [paused, setPaused] = useState(false), [result, setResult] = useState<Race | null>(null), [error, setError] = useState(''), [round, setRound] = useState(0), [transform, setTransform] = useState(true);
  const [auto, setAuto] = useState(() => loadSaved().auto ?? (matchMedia('(pointer: coarse)').matches || innerWidth <= 700));
  const [reduced, setReduced] = useState(() => loadSaved().reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches);
  const autoRef = useRef(auto), reducedRef = useRef(reduced);
  useEffect(() => { autoRef.current = auto; save({auto}); }, [auto]);
  useEffect(() => { reducedRef.current = reduced; save({reduced}); }, [reduced]);
  const pause = (value: boolean) => { if (raceRef.current) raceRef.current.paused = value; controls.current = neutral(); setPaused(value); };
  const retry = () => { setResult(null); setError(''); setPaused(false); setHud(initialHud); setTransform(true); controls.current = neutral(); setRound(previous => previous + 1); };
  useEffect(() => {
    if (!host.current) return;
    const race = createRace(drawing); raceRef.current = race;
    let stadium: Stadium;
    try { stadium = new Stadium(host.current, drawing, () => { race.paused = true; setError('The paper stadium lost its graphics context. Your drawing is safe. Reload the race to try again.'); }); }
    catch { setError('WebGL could not open the stadium. Your drawing is safe. Try a browser with hardware acceleration enabled.'); return; }
    if (import.meta.env.DEV) (window as QAWindow).__scrapline = { race, recover:()=>recoverCar(race.cars[0]), snapshot:()=>{ stadium.renderer.render(stadium.scene, stadium.camera); return stadium.renderer.domElement.toDataURL('image/png'); } };
    const clock = new FixedClock(); let previous = performance.now(), animation = 0, uiClock = 0, liftTime = 0, completed = false;
    const frame = (now: number) => {
      const elapsed = Math.min(.1, (now - previous) / 1000); previous = now;
      if (!race.paused) liftTime += elapsed;
      const duration = reducedRef.current ? .35 : 2.1;
      if (liftTime > duration) { setTransform(false); const input = { ...controls.current, throttle: autoRef.current ? 1 : controls.current.throttle }; clock.advance(elapsed, delta => stepRace(race, input, delta)); }
      stadium.update(race, elapsed, Math.max(0, 1 - liftTime / duration), reducedRef.current);
      uiClock += elapsed;
      if (uiClock > .08) {
        const car = race.cars[0];
        setHud({ time:race.time,lap:Math.min(2,car.progress.laps+1),speed:car.speed*8,rank:rankCars(race.cars).findIndex(item=>item.id===0)+1,charge:car.charge,energy:car.energy,turbo:car.turbo>0,countdown:Math.ceil(race.countdown),event:car.eventTimer>0?car.event:'',positions:race.cars.map(item=>({x:item.x,y:item.z,id:item.id})) }); uiClock = 0;
      }
      if (race.finished && !completed) { completed = true; const best = loadSaved().best; if (!best || race.time < best) save({best:race.time}); setResult(race); }
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    const pressed = new Set<string>();
    const updateKeys = () => { controls.current = { throttle:pressed.has('ArrowUp')||pressed.has('KeyW')?1:0,brake:pressed.has('ArrowDown')||pressed.has('KeyS'),steer:(pressed.has('ArrowRight')||pressed.has('KeyD')?1:0)-(pressed.has('ArrowLeft')||pressed.has('KeyA')?1:0),drift:pressed.has('Space'),boost:pressed.has('ShiftLeft')||pressed.has('ShiftRight') }; };
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,select')) return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(event.code)) { event.preventDefault(); pressed.add(event.code); updateKeys(); }
      if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat && !race.finished) { pressed.clear(); pause(!race.paused); }
      if (event.code === 'KeyR' && !event.repeat && !race.paused) recoverCar(race.cars[0]);
    };
    const keyup = (event: KeyboardEvent) => { pressed.delete(event.code); updateKeys(); };
    const hidden = () => { if (document.hidden && !race.finished) { pressed.clear(); clock.reset(); pause(true); } };
    const blur = () => { pressed.clear(); controls.current = neutral(); if (!race.finished) pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); document.addEventListener('visibilitychange', hidden); window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(animation); stadium.dispose(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); raceRef.current = null; if(import.meta.env.DEV)delete (window as QAWindow).__scrapline; };
  }, [drawing, round]);
  const touch = (key: 'steer' | 'drift' | 'boost' | 'brake', value: number | boolean, label: string, className: string) => {
    const release = () => { if (key === 'steer') { if (controls.current.steer === value) controls.current.steer = 0; } else controls.current[key] = false; };
    return <button className={className} aria-label={label} onPointerDown={event=>{ event.preventDefault(); if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture(event.pointerId); if (key==='steer') controls.current.steer=value as number; else controls.current[key]=value as boolean; }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{label}</button>;
  };
  const path = Array.from({length:100},(_,index)=>{const point=trackAt(index/100*LENGTH);return `${point.x},${point.y}`;}).join(' ');
  return <main className="race-shell"><div className="stadium" ref={host} /><div className="race-grain" /><header className="race-header"><strong>SCRAPLINE<span>®</span></strong><div className="race-name">THE OFFCUT GRAND PRIX <span>DESK CIRCUIT / 02 LAPS</span></div><button className="pause-button" onClick={()=>pause(!paused)} aria-label={paused?'Resume race':'Pause race'}>{paused?'RESUME':'Ⅱ PAUSE'}</button></header><div className="race-hud"><div className="position"><strong>{hud.rank}<small>/4</small></strong><span>POSITION</span></div><div className="lap"><strong>{hud.lap}<small>/2</small></strong><span>LAP</span></div><div className="timer"><strong>{timeLabel(hud.time)}</strong><span>RACE TIME</span></div></div><div className="minimap"><svg viewBox="-75 -40 150 80" aria-label="Course map and racer positions"><polyline points={path} fill="none" stroke="#968b74" strokeWidth="9" /><polyline points={path} fill="none" stroke="#e5dcc7" strokeWidth="6" />{hud.positions.map(car=><circle key={car.id} cx={car.x} cy={car.y} r={car.id===0?3.6:2.7} fill={car.id===0?'#c9432b':'#30342f'} stroke="#f5f0e1" strokeWidth="1" />)}</svg><span>DESK CIRCUIT — 301 m</span></div><div className="driving-hud"><div className="speed"><strong>{Math.round(hud.speed).toString().padStart(2,'0')}</strong><span>KM/H<br />PAPER SPEED</span></div><div className="energy-bars"><div><span>{hud.turbo?'BOOSTING':'SHIFT / BOOST'}</span><i><b style={{width:`${hud.energy*100}%`}} /></i></div><div className={hud.charge>.8?'charged':''}><span>{hud.charge>.23?'RELEASE SPACE → BOOST':'SPACE / HOLD TO DRIFT'}</span><i><b style={{width:`${hud.charge*100}%`}} /></i></div></div></div><div className="race-event" aria-live="polite">{hud.event}</div><div className="desktop-controls"><span>WASD / ARROWS <b>DRIVE</b></span><span>SPACE <b>DRIFT</b></span><span>SHIFT <b>BOOST</b></span><span>R <b>RECOVER</b></span></div><div className="touch-controls"><div className="steering">{touch('steer',-1,'←','steer')}{touch('steer',1,'→','steer')}{touch('brake',true,'BRAKE','brake')}</div><div className="pedals">{touch('drift',true,'DRIFT','drift')}{touch('boost',true,'BOOST','boost')}</div></div>{transform && <div className="transformation"><div className="lift-drawing"><DrawingPreview drawing={drawing} /></div><p className="eyebrow">A QUESTIONABLE IDEA BECOMES…</p><h2>A real contender.</h2><span>Adding wheels. Lowering expectations.</span></div>}{!transform&&hud.countdown>0&&!paused&&!error&&<div className="countdown"><strong key={hud.countdown}>{hud.countdown===4?'READY?':hud.countdown}</strong><span>{auto?'AUTO-ACCEL ON · STEER INTO THE FIRST TURN':'HOLD W / ↑ TO GET AWAY'}</span></div>}{!transform&&hud.countdown===0&&hud.time<1.2&&<div className="go">GO.</div>}{paused&&!result&&!error&&<div className="modal-scrim"><section className="pause-card"><p className="eyebrow">PENCILS DOWN.</p><h2>Take a breath.</h2><p>Your race is right where you left it.</p><label><input type="checkbox" checked={auto} onChange={event=>setAuto(event.target.checked)} /> Auto-accelerate</label><label><input type="checkbox" checked={reduced} onChange={event=>setReduced(event.target.checked)} /> Reduced decorative motion</label><p className="pause-help">Steer with WASD or arrows. Hold Space through a corner, then release for earned boost. Shift spends your boost reserve. R points you forward without skipping track.</p><button className="primary" onClick={()=>pause(false)}>Back to the race →</button><div className="modal-actions"><button onClick={retry}>Restart race</button><button onClick={onRedraw}>Redraw car</button></div></section></div>}{result&&<div className="modal-scrim result-scrim"><section className="result-card"><p className="eyebrow">02 / THE FINISH LINE</p><div className="result-heading"><h2>{hud.rank===1?'Bad drawing.\nGreat driving.':'Beautifully\nquestionable.'}</h2><div className="result-place">{rankCars(result.cars).findIndex(car=>car.id===0)+1}<span>OF FOUR</span></div></div><DrawingPreview drawing={drawing} className="result-drawing" /><div className="results-stats"><div><span>RACE TIME</span><strong>{timeLabel(result.time)}</strong></div><div><span>BEST LAP</span><strong>{timeLabel(Math.min(...result.cars[0].progress.lapTimes))}</strong></div><div><span>PERSONAL BEST</span><strong>{timeLabel(loadSaved().best||result.time)}</strong></div></div><div className="result-standings">{rankCars(result.cars).map((car,index)=><div key={car.id} className={car.id===0?'you':''}><span>0{index+1}</span><b>{car.name}</b><span>{car.finished!==null?timeLabel(car.finished):'STILL RACING'}</span></div>)}</div><button className="primary" onClick={retry}>One more scrap <span>↗</span></button><button className="redraw" onClick={onRedraw}>Back to the drawing board →</button></section></div>}{error&&<div className="modal-scrim"><section className="pause-card"><h2>A paper jam.</h2><p role="alert">{error}</p><button className="primary" onClick={retry}>Reload race →</button><button className="redraw" onClick={onRedraw}>Back to your drawing</button></section></div>}</main>;
}
