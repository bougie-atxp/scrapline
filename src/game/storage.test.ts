import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSaved, save } from './storage';

afterEach(() => vi.unstubAllGlobals());
describe('resilient local persistence', () => {
  it('preserves explicit false settings and distinguishes unset preferences', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"auto":false,"reduced":false}' });
    expect(loadSaved()).toMatchObject({auto:false,reduced:false});
    vi.stubGlobal('localStorage', { getItem: () => '{}' });
    expect(loadSaved().auto).toBeUndefined();
  });
  it('filters malformed stored strokes before the canvas reads them', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"strokes":[null,{"color":"#292c29","points":[null,{"x":1,"y":2},{"x":"bad","y":4}]}]}' });
    expect(loadSaved().strokes?.[0].points).toEqual([{x:1,y:2}]);
  });
  it('works when storage access throws or JSON is corrupt', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } });
    expect(loadSaved()).toEqual({});
    expect(() => save({best:65})).not.toThrow();
    vi.stubGlobal('localStorage', { getItem: () => 'broken' });
    expect(loadSaved()).toEqual({});
  });
  it('merges settings without erasing a saved drawing or record', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{"best":65,"strokes":[]}', setItem });
    save({auto:false});
    expect(JSON.parse(setItem.mock.calls[0][1])).toMatchObject({best:65,strokes:[],auto:false});
  });
});
