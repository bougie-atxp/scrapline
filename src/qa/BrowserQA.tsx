import { useRef, useState } from 'react';
import type { Race } from '../game/simulation';
import { aiControls } from '../game/ai';
import { inkSpot, stampSpot } from '../game/hazards';
import { nearestTrack, LENGTH } from '../game/track';
export type QAWindow = Window & typeof globalThis & { __scrapline?: { race: Race; snapshot: () => string; recover: () => void } };
export default function BrowserQA() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mobile, setMobile] = useState(false), [log, setLog] = useState<string[]>([]), [running, setRunning] = useState(false);
  const [captures, setCaptures] = useState<{name:string;url:string}[]>([]);
  const append = (text: string) => setLog(previous => [...previous, text]);
  const run = async () => {
    setRunning(true); setLog([]);
    const target = frame.current!, win = target.contentWindow as QAWindow, doc = win.document;
    const wait = (time: number) => new Promise(resolve => setTimeout(resolve, time));
    const button = (text: string) => [...doc.querySelectorAll('button')].find(item => item.textContent?.includes(text));
    const assert = (condition: unknown, text: string) => append(`${condition ? 'PASS' : 'FAIL'} ${text}`);
    const errors: string[] = []; const onError = (event: ErrorEvent) => errors.push(event.message); win.addEventListener('error', onError);
    const originalConsoleError = win.console.error; win.console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); originalConsoleError(...args); };
    try {
      button('Clear')?.click(); await wait(150); button('Bring it')?.click(); await wait(150);
      assert(doc.body.textContent?.includes('One little scribble'), 'Empty drawing handled without entering race');
      const canvas = doc.querySelector('canvas')!; const bounds = canvas.getBoundingClientRect();
      const stroke = (points: number[][]) => {
        points.forEach((point, index) => canvas.dispatchEvent(new win.PointerEvent(index ? 'pointermove' : 'pointerdown', { bubbles:true, pointerId:11, pointerType:'pen', buttons:1, clientX:bounds.left+point[0]/640*bounds.width,clientY:bounds.top+point[1]/350*bounds.height })));
        canvas.dispatchEvent(new win.PointerEvent('pointerup',{bubbles:true,pointerId:11,pointerType:'pen'}));
      };
      stroke([[80,255],[90,205],[172,194],[222,121],[360,141],[411,201],[531,212],[560,262],[80,255]]); await wait(150);
      doc.querySelector<HTMLButtonElement>('[aria-label="Vermilion ink"]')?.click(); await wait(80);
      stroke([[257,165],[287,161],[277,194],[301,194],[270,228]]); await wait(150);
      stroke([[150,75],[176,56],[202,76]]); await wait(150);
      assert(doc.querySelectorAll('.preview-box polyline').length===3,'Pen pointer drawing preserves three disconnected open strokes');
      button('Undo')?.click(); await wait(120); assert(doc.querySelectorAll('.preview-box polyline').length===2,'Undo removes only last stroke');
      const overflow = doc.documentElement.scrollWidth-doc.documentElement.clientWidth; assert(overflow===0,`${mobile?'390px mobile':'Desktop'} workshop horizontal overflow = ${overflow}`);
      button('Bring it')?.click(); await wait(650);
      assert(!!doc.querySelector('.transformation'),'Actual fitted drawing appears in lift transformation');
      await wait(2400);
      assert(!!win.__scrapline,'Three.js stadium and simulation initialized');
      button('PAUSE')?.click(); await wait(160);
      const pausedTime=win.__scrapline!.race.time; await wait(150);
      assert(win.__scrapline!.race.paused&&win.__scrapline!.race.time===pausedTime,'Pause freezes real simulation');
      const checkbox=doc.querySelector<HTMLInputElement>('.pause-card input'); if(checkbox&&!checkbox.checked)checkbox.click();
      button('Back to the race')?.click(); await wait(160);
      assert(!win.__scrapline!.race.paused,'Resume continues simulation');
      (doc.activeElement as HTMLElement)?.blur();
      let oldKeys=new Set<string>(), driftSeen=false, boostSeen=false, lapSeen=false, cornerSeen=false, maxCharge=0;
      const send = (keys: Set<string>) => { for(const key of oldKeys)if(!keys.has(key))doc.body.dispatchEvent(new win.KeyboardEvent('keyup',{code:key,bubbles:true}));for(const key of keys)if(!oldKeys.has(key))doc.body.dispatchEvent(new win.KeyboardEvent('keydown',{code:key,bubbles:true,cancelable:true}));oldKeys=keys; };
      const started=performance.now(); let lastCapture=0;
      while(performance.now()-started<115000) {
        const race=win.__scrapline!.race, car=race.cars[0];
        if(race.finished)break;
        const input=aiControls(car,race.time);
        const keys=new Set<string>(['KeyW']);
        if(input.steer>.10)keys.add('KeyD');else if(input.steer<-.10)keys.add('KeyA');
        if(input.brake)keys.add('KeyS');
        if(car.distance>88&&car.distance<102&&race.time>5){keys.add('Space');keys.delete('KeyA');keys.add('KeyD');}
        if(car.distance>120&&car.distance<140&&car.energy>.2)keys.add('ShiftLeft');
        send(keys);
        driftSeen ||= car.charge>.24; boostSeen ||= car.turbo>.3; lapSeen ||= car.progress.laps>0; cornerSeen ||=car.distance>85&&car.distance<140;
        maxCharge=Math.max(maxCharge,car.charge);
        if(race.time-lastCapture>15&&race.countdown===0) { lastCapture=race.time; append(`LIVE ${race.time.toFixed(1)}s / lap ${car.progress.laps+1} / checkpoint ${car.progress.next} / speed ${car.speed.toFixed(1)}`); setCaptures(previous => [...previous,{name:`${mobile?'mobile':'desktop'}-race-${Math.round(race.time)}s.png`,url:win.__scrapline!.snapshot()}]); }
        await wait(35);
      }
      send(new Set()); await wait(250);
      const race=win.__scrapline!.race;
      assert(race.finished,`Keyboard-driven two-lap race finished in ${race.time.toFixed(2)}s`);
      assert(driftSeen&&boostSeen,`Real Space drift charge and release/Shift boost observed (max charge ${maxCharge.toFixed(2)})`);
      assert(lapSeen&&cornerSeen,'Ordered checkpoints, lap crossing, and corner traversal observed');
      assert(!!doc.querySelector('.result-card'),'Results show drawing, race time, best lap, position');
      assert(race.cars.slice(1).every(car=>car.progress.total>LENGTH),'All three rivals completed at least one full validated lap');
      button('One more scrap')?.click(); await wait(2800);
      assert(!doc.querySelector('.result-card')&&win.__scrapline!.race.time<2,'Retry resets race and keeps the drawing');
      const retryRace=win.__scrapline!.race; retryRace.countdown=0;
      const car=retryRace.cars[0];
      car.x=inkSpot.x;car.z=inkSpot.z;car.heading=inkSpot.heading;await wait(100);assert(car.slipping>0,'Ink collision affects live browser simulation');
      car.x=stampSpot.x;car.z=stampSpot.z;car.heading=stampSpot.heading;retryRace.time=5.5;await wait(100);assert(car.stampCooldown>0,'Stamp impact affects live browser simulation');
      car.x=0;car.z=-33;car.heading=-Math.PI/2;car.vz=-10;await wait(100);assert(Math.abs(nearestTrack(car.x,car.z).offset)<=6.31,'Live barrier collision has bounded recovery');
      car.heading=Math.PI;const before=car.progress.total;win.__scrapline!.recover();assert(Math.abs(car.progress.total-before)<.1,'Recover does not skip track progress');
      button('PAUSE')?.click();await wait(100);button('Redraw car')?.click();await wait(200);
      assert(!!doc.querySelector('.paper-pad')&&doc.querySelectorAll('.preview-box polyline').length===2,'Redraw restores original drawing');
      assert(doc.documentElement.scrollWidth===doc.documentElement.clientWidth,'No horizontal overflow after round trip');
      assert(errors.length===0,`Browser errors: ${errors.length}${errors.length?' / '+errors.join('; '):''}`);
    } catch(error) { append(`FAIL ${String(error)}`); }
    finally { win.removeEventListener('error',onError);win.console.error=originalConsoleError;setRunning(false); }
  };
  const checkTouchControls = async () => {
    setMobile(true); setRunning(true); setLog(['Loading 390px game…']); frame.current!.src = '/?qa-session';
    await new Promise(resolve => setTimeout(resolve, 900));
    const target = frame.current!, win = target.contentWindow as QAWindow, doc = win.document;
    const wait = (time: number) => new Promise(resolve => setTimeout(resolve, time));
    try {
      const clear = [...doc.querySelectorAll('button')].find(item => item.textContent === 'Clear'); clear?.click(); await wait(180);
      [...doc.querySelectorAll('button')].find(item => item.textContent?.includes('loaner'))?.click(); await wait(160);
      [...doc.querySelectorAll('button')].find(item => item.textContent?.includes('Bring it'))?.click(); await wait(3000);
      const container = doc.querySelector('.touch-controls') as HTMLElement | null;
      const steering = doc.querySelector('.steering') as HTMLElement | null;
      const pedals = doc.querySelector('.pedals') as HTMLElement | null;
      const steer = doc.querySelector('.steer') as HTMLElement | null;
      const brake = doc.querySelector('.brake') as HTMLElement | null;
      const drift = doc.querySelector('.drift') as HTMLElement | null;
      const boost = doc.querySelector('.boost') as HTMLElement | null;
      if (!container || !steering || !pedals || !steer || !brake || !drift || !boost) throw new Error('touch control element missing');
      const containerStyle = win.getComputedStyle(container), steerStyle = win.getComputedStyle(steer), driftStyle = win.getComputedStyle(drift), boostStyle = win.getComputedStyle(boost);
      const geometry = { container: { display: containerStyle.display, position: containerStyle.position, bottom: containerStyle.bottom, left: containerStyle.left, right: containerStyle.right, width: container.getBoundingClientRect().width }, steer: steer.getBoundingClientRect().toJSON(), brake: brake.getBoundingClientRect().toJSON(), drift: drift.getBoundingClientRect().toJSON(), boost: boost.getBoundingClientRect().toJSON() };
      append(JSON.stringify(geometry, null, 2));
      append(`${containerStyle.display === 'flex' && containerStyle.position === 'absolute' && container.getBoundingClientRect().width <= 390 && steerStyle.touchAction === 'none' && driftStyle.touchAction === 'none' && boostStyle.touchAction === 'none' && brake.getBoundingClientRect().height > 20 && drift.getBoundingClientRect().height >= 60 ? 'PASS' : 'FAIL'} 390px touch controls are visible, absolutely positioned within the viewport, and touch-action:none`);
      const intersections = [['steer left', steer], ['steer right', doc.querySelectorAll('.steer')[1] as HTMLElement], ['brake', brake], ['drift', drift], ['boost', boost]].map(([name, element]) => ({ name, rect: (element as HTMLElement).getBoundingClientRect() })).map((item, _, list) => list.filter(other => other !== item && other.rect.left < item.rect.right && other.rect.right > item.rect.left && other.rect.top < item.rect.bottom && other.rect.bottom > item.rect.top).length);
      append(`${Math.max(...intersections) === 0 ? 'PASS' : 'FAIL'} 390px touch controls have no overlapping hit targets`);
      const assert = (condition: unknown, text: string) => append(`${condition ? 'PASS' : 'FAIL'} ${text}`);
      const race = win.__scrapline!.race;
      race.countdown = 0;
      await wait(1500);
      const car = race.cars[0];
      const pointer = (element: HTMLElement, type: string, pointerId: number) => element.dispatchEvent(new win.PointerEvent(type, { bubbles:true, cancelable:true, pointerId, pointerType:'touch', buttons:type==='pointerdown'?1:0 }));
      const initialHeading = car.heading;
      pointer(steer, 'pointerdown', 21); await wait(300); pointer(steer, 'pointerup', 21);
      assert(car.heading < initialHeading - .04, 'Touch steering changes actual car heading');
      const right = doc.querySelectorAll<HTMLElement>('.steer')[1];
      pointer(right, 'pointerdown', 22); pointer(drift, 'pointerdown', 23); await wait(700);
      assert(car.charge > .23, 'Simultaneous touch steering + drift earns charge');
      pointer(drift, 'pointerup', 23); pointer(right, 'pointerup', 22); await wait(50);
      assert(car.turbo > .3, 'Touch drift release earns real boost');
      const energy = car.energy;
      pointer(boost, 'pointerdown', 24); await wait(300); pointer(boost, 'pointercancel', 24);
      assert(car.energy < energy - .03, 'Touch boost consumes reserve');
      const releasedEnergy = car.energy; await wait(180);
      assert(car.energy >= releasedEnergy, 'Pointer cancel releases boost without sticking');
      const speed = car.speed;
      pointer(brake, 'pointerdown', 25); await wait(350); pointer(brake, 'pointerup', 25);
      assert(car.speed < speed, 'Touch brake reduces actual speed');
      assert(doc.documentElement.scrollWidth === doc.documentElement.clientWidth, '390px race has no horizontal overflow');
      setCaptures(previous => [...previous,{name:'mobile-touch-race.png',url:win.__scrapline!.snapshot()}]);
      [...doc.querySelectorAll('button')].find(item => item.textContent?.includes('PAUSE'))?.click();
    } catch (error) { append(`FAIL ${String(error)}`); }
    setRunning(false);
  };
  return <div style={{padding:20,fontFamily:'monospace'}}><h2 style={{fontSize:35,margin:0}}>SCRAPLINE / isolated browser QA</h2><p>Development only. Inputs are dispatched to the real game. Hazard probes explicitly reposition test cars; normal gameplay never does.</p><div style={{display:'flex',gap:10,marginBottom:15}}><button disabled={running} onClick={()=>{setMobile(false);frame.current!.src='/?qa-session';}}>Desktop</button><button disabled={running} onClick={()=>{setMobile(true);frame.current!.src='/?qa-session';}}>390px mobile</button><button disabled={running} onClick={run}>{running?'Running real-time browser race…':'Run drawing → race → retry → redraw'}</button><button disabled={running} onClick={checkTouchControls}>Check 390px touch controls</button></div><div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}><iframe ref={frame} title="SCRAPLINE QA viewport" src="/?qa-session" style={{width:mobile?390:1000,height:mobile?844:760,border:'1px solid #9d927d',maxWidth:'100%'}} /><pre style={{fontSize:11,whiteSpace:'pre-wrap',maxWidth:500}}>{log.join('\n')}</pre><div>{captures.map((capture,index)=><a key={index} href={capture.url} download={capture.name} style={{display:'block',margin:'12px 0'}}>Download {capture.name}<img src={capture.url} alt={capture.name} style={{display:'block',width:280}} /></a>)}</div></div></div>;
}
