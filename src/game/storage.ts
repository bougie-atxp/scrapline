import type { Stroke } from './drawing';
export type Saved = { strokes?: Stroke[]; best?: number; auto?: boolean; reduced?: boolean };
const storageKey = () => import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('qa-session') ? 'scrapline-qa-v1' : 'scrapline-v1';
export function loadSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    if (!value || typeof value !== 'object') return {};
    return { strokes: Array.isArray(value.strokes) ? value.strokes.filter((stroke: Stroke) => stroke && typeof stroke.color === 'string' && Array.isArray(stroke.points)).slice(0, 150).map((stroke: Stroke) => ({ ...stroke, points: stroke.points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y)).slice(0, 5000) })) : undefined, best: Number.isFinite(value.best) && value.best > 0 ? value.best : undefined, auto: typeof value.auto === 'boolean' ? value.auto : undefined, reduced: typeof value.reduced === 'boolean' ? value.reduced : undefined };
  } catch { return {}; }
}
export function save(part: Saved) { try { localStorage.setItem(storageKey(), JSON.stringify({ ...loadSaved(), ...part })); } catch { return; } }
