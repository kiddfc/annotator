import { describe, it, expect } from 'vitest';
import {
  screenToImage,
  imageToScreen,
  normalizeRect,
  clamp,
  generateLabel,
  fitTransform,
  applyZoom,
} from '../utils.js';

describe('screenToImage', () => {
  it('converts at identity transform', () => {
    const t = { zoom: 1, panX: 0, panY: 0 };
    expect(screenToImage(100, 200, t)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for pan offset', () => {
    const t = { zoom: 1, panX: 50, panY: 30 };
    expect(screenToImage(150, 130, t)).toEqual({ x: 100, y: 100 });
  });

  it('accounts for zoom', () => {
    const t = { zoom: 2, panX: 0, panY: 0 };
    expect(screenToImage(200, 400, t)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for zoom and pan together', () => {
    const t = { zoom: 2, panX: 20, panY: 40 };
    // screenToImage: (sx - panX) / zoom
    expect(screenToImage(120, 240, t)).toEqual({ x: 50, y: 100 });
  });
});

describe('imageToScreen', () => {
  it('converts at identity transform', () => {
    const t = { zoom: 1, panX: 0, panY: 0 };
    expect(imageToScreen(100, 200, t)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for pan offset', () => {
    const t = { zoom: 1, panX: 50, panY: 30 };
    expect(imageToScreen(100, 100, t)).toEqual({ x: 150, y: 130 });
  });

  it('accounts for zoom', () => {
    const t = { zoom: 2, panX: 0, panY: 0 };
    expect(imageToScreen(100, 200, t)).toEqual({ x: 200, y: 400 });
  });

  it('is the inverse of screenToImage', () => {
    const t = { zoom: 1.5, panX: -30, panY: 70 };
    const img = { x: 80, y: 120 };
    const screen = imageToScreen(img.x, img.y, t);
    const back = screenToImage(screen.x, screen.y, t);
    expect(back.x).toBeCloseTo(img.x);
    expect(back.y).toBeCloseTo(img.y);
  });
});

describe('normalizeRect', () => {
  it('keeps coords when already normalized', () => {
    expect(normalizeRect(10, 20, 100, 200)).toEqual({ x1: 10, y1: 20, x2: 100, y2: 200 });
  });

  it('flips x when drawn right-to-left', () => {
    expect(normalizeRect(100, 20, 10, 200)).toEqual({ x1: 10, y1: 20, x2: 100, y2: 200 });
  });

  it('flips y when drawn bottom-to-top', () => {
    expect(normalizeRect(10, 200, 100, 20)).toEqual({ x1: 10, y1: 20, x2: 100, y2: 200 });
  });

  it('flips both when drawn in opposite quadrant', () => {
    expect(normalizeRect(100, 200, 10, 20)).toEqual({ x1: 10, y1: 20, x2: 100, y2: 200 });
  });

  it('handles zero-size rect', () => {
    expect(normalizeRect(50, 50, 50, 50)).toEqual({ x1: 50, y1: 50, x2: 50, y2: 50 });
  });
});

describe('clamp', () => {
  it('returns value when in range', () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('generateLabel', () => {
  it('generates label-1 for index 1', () => {
    expect(generateLabel(1)).toBe('label-1');
  });

  it('generates label-N for arbitrary index', () => {
    expect(generateLabel(42)).toBe('label-42');
  });

  it('generates label-0 for index 0', () => {
    expect(generateLabel(0)).toBe('label-0');
  });
});

describe('fitTransform', () => {
  it('centers image in viewport', () => {
    const t = fitTransform({ width: 100, height: 100 }, { width: 500, height: 500 }, 1);
    expect(t.panX).toBeCloseTo((500 - 100 * t.zoom) / 2);
    expect(t.panY).toBeCloseTo((500 - 100 * t.zoom) / 2);
  });

  it('fits wide image by width', () => {
    const t = fitTransform({ width: 400, height: 100 }, { width: 400, height: 400 }, 1);
    expect(t.zoom).toBeCloseTo(1); // fits exactly by width
  });

  it('fits tall image by height', () => {
    const t = fitTransform({ width: 100, height: 400 }, { width: 400, height: 400 }, 1);
    expect(t.zoom).toBeCloseTo(1);
  });

  it('respects padding factor', () => {
    const t1 = fitTransform({ width: 200, height: 200 }, { width: 400, height: 400 }, 1);
    const t2 = fitTransform({ width: 200, height: 200 }, { width: 400, height: 400 }, 0.5);
    expect(t2.zoom).toBeCloseTo(t1.zoom * 0.5);
  });
});

describe('applyZoom', () => {
  it('multiplies zoom by factor', () => {
    const t = { zoom: 1, panX: 0, panY: 0 };
    const result = applyZoom(t, 2, 0, 0);
    expect(result.zoom).toBe(2);
  });

  it('clamps to minZoom', () => {
    const t = { zoom: 0.1, panX: 0, panY: 0 };
    const result = applyZoom(t, 0.01, 0, 0, 0.05, 50);
    expect(result.zoom).toBe(0.05);
  });

  it('clamps to maxZoom', () => {
    const t = { zoom: 40, panX: 0, panY: 0 };
    const result = applyZoom(t, 2, 0, 0, 0.02, 50);
    expect(result.zoom).toBe(50);
  });

  it('zooms toward the focal point', () => {
    // A focal point at (100, 100) should remain at (100, 100) after zoom
    const t = { zoom: 1, panX: 0, panY: 0 };
    const cx = 100;
    const cy = 100;
    const result = applyZoom(t, 2, cx, cy);
    // screenToImage at focal before and after should be equal
    const imgBefore = { x: (cx - t.panX) / t.zoom, y: (cy - t.panY) / t.zoom };
    const imgAfter = { x: (cx - result.panX) / result.zoom, y: (cy - result.panY) / result.zoom };
    expect(imgAfter.x).toBeCloseTo(imgBefore.x);
    expect(imgAfter.y).toBeCloseTo(imgBefore.y);
  });
});
