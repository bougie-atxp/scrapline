export type Point = { x: number; y: number };
export type Stroke = { color: string; points: Point[] };
export type Drawing = { strokes: Stroke[]; aspect: number };
export const INKS = ['#292c29', '#c9432b', '#386c78'];
export function normalizeDrawing(strokes: Stroke[]): Drawing | null {
  const clean = strokes.map(stroke => ({ color: INKS.includes(stroke.color) ? stroke.color : INKS[0], points: stroke.points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y)) })).filter(stroke => stroke.points.length);
  const points = clean.flatMap(stroke => stroke.points);
  if (!points.length) return null;
  const bounds = points.reduce((box,point)=>({minX:Math.min(box.minX,point.x),minY:Math.min(box.minY,point.y),maxX:Math.max(box.maxX,point.x),maxY:Math.max(box.maxY,point.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  const { minX, minY } = bounds;
  const width = Math.max(8, bounds.maxX - minX);
  const height = Math.max(8, bounds.maxY - minY);
  const scale = Math.min(540 / width, 235 / height);
  const offsetX = (640 - width * scale) / 2;
  const offsetY = 294 - height * scale;
  return { aspect: width / height, strokes: clean.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ x: offsetX + (point.x - minX) * scale, y: offsetY + (point.y - minY) * scale })) })) };
}
export const loaner: Stroke[] = [
  { color: INKS[0], points: [{x:90,y:260},{x:86,y:210},{x:165,y:199},{x:231,y:133},{x:357,y:133},{x:419,y:202},{x:526,y:217},{x:552,y:260},{x:90,y:260}] },
  { color: INKS[0], points: [{x:203,y:197},{x:246,y:151},{x:296,y:150},{x:298,y:197},{x:203,y:197}] },
  { color: INKS[0], points: [{x:315,y:151},{x:347,y:151},{x:390,y:197},{x:316,y:197},{x:315,y:151}] },
  { color: INKS[1], points: [{x:330,y:220},{x:309,y:249},{x:328,y:249},{x:303,y:275}] },
  { color: INKS[0], points: [{x:80,y:186},{x:130,y:186},{x:130,y:200}] },
];
export function drawStrokes(context: CanvasRenderingContext2D, strokes: Stroke[], lineWidth = 4) {
  context.lineCap = 'round'; context.lineJoin = 'round'; context.lineWidth = lineWidth;
  for (const stroke of strokes) {
    context.strokeStyle = stroke.color; context.fillStyle = stroke.color;
    context.beginPath();
    stroke.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    if (stroke.points.length === 1) { const point = stroke.points[0]; context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2); context.fill(); }
    else context.stroke();
  }
}
export function drawingTexture(drawing: Drawing): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 420;
  const context = canvas.getContext('2d')!; context.scale(1.2, 1.2);
  context.shadowColor = '#fffbed'; context.shadowBlur = 0;
  for (const stroke of drawing.strokes) { context.save(); drawStrokes(context, [{ ...stroke, color: '#fffbed' }], 17); context.restore(); }
  drawStrokes(context, drawing.strokes, 5);
  return canvas;
}
