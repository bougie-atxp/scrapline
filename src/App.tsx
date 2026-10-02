import { useState } from 'react';
import DrawingPad from './ui/DrawingPad';
import RaceView from './ui/RaceView';
import type { Drawing, Stroke } from './game/drawing';
import { loadSaved, save } from './game/storage';
import BrowserQA from './qa/BrowserQA';
export default function App() {
  const [strokes, setStrokes] = useState<Stroke[]>(()=>loadSaved().strokes||[]);
  const [drawing, setDrawing] = useState<Drawing|null>(null);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) return <BrowserQA />;
  if (drawing) return <RaceView drawing={drawing} onRedraw={()=>setDrawing(null)} />;
  return <main className="workshop-shell"><header><strong>SCRAPLINE<span>®</span></strong><small>DRAW BADLY. DRIVE BEAUTIFULLY.</small><span className="header-edition">VOL. 001 / DESK CIRCUIT</span></header><DrawingPad initial={strokes} onStart={(fitted,raw)=>{save({strokes:raw});setStrokes(raw);setDrawing(fitted);}} /><footer><span>A MOTORSPORT OF QUESTIONABLE MATERIALS.</span><span>100% PAPER. 0% COMMON SENSE.</span></footer></main>;
}
