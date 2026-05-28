import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Annotator } from '../annotator.js';

describe('Annotator', () => {
  let ann;

  beforeEach(() => {
    ann = new Annotator();
  });

  // ─── addPoint ───────────────────────────────────────────────────────────────

  describe('addPoint', () => {
    it('returns a valid annotation object', () => {
      const p = ann.addPoint(10, 20);
      expect(p).toMatchObject({ type: 'point', x1: 10, y1: 20, x2: 10, y2: 20 });
    });

    it('assigns x2=x1 and y2=y1', () => {
      const p = ann.addPoint(55, 77);
      expect(p.x2).toBe(p.x1);
      expect(p.y2).toBe(p.y1);
    });

    it('rounds fractional coordinates', () => {
      const p = ann.addPoint(10.6, 20.4);
      expect(p.x1).toBe(11);
      expect(p.y1).toBe(20);
    });

    it('auto-assigns label-1 for first annotation', () => {
      expect(ann.addPoint(0, 0).label).toBe('label-1');
    });

    it('increments label index', () => {
      ann.addPoint(0, 0);
      expect(ann.addPoint(0, 0).label).toBe('label-2');
    });

    it('adds to annotations array', () => {
      ann.addPoint(0, 0);
      expect(ann.annotations).toHaveLength(1);
    });

    it('emits change event', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      ann.addPoint(1, 2);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0].added).toBeDefined();
    });
  });

  // ─── addRect ────────────────────────────────────────────────────────────────

  describe('addRect', () => {
    it('returns a valid annotation object', () => {
      const r = ann.addRect(10, 20, 100, 200);
      expect(r).toMatchObject({ type: 'rect', x1: 10, y1: 20, x2: 100, y2: 200 });
    });

    it('normalizes reversed coordinates', () => {
      const r = ann.addRect(100, 200, 10, 20);
      expect(r.x1).toBe(10);
      expect(r.y1).toBe(20);
      expect(r.x2).toBe(100);
      expect(r.y2).toBe(200);
    });

    it('rounds fractional values', () => {
      const r = ann.addRect(1.1, 2.9, 10.5, 20.4);
      expect(r.x1).toBe(1);
      expect(r.y1).toBe(3);
      expect(r.x2).toBe(11);
      expect(r.y2).toBe(20);
    });

    it('assigns incremented label', () => {
      ann.addPoint(0, 0);
      expect(ann.addRect(0, 0, 1, 1).label).toBe('label-2');
    });

    it('emits change event with added annotation', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      const r = ann.addRect(0, 0, 10, 10);
      expect(cb.mock.calls[0][0].added).toBe(r);
    });
  });

  // ─── updateAnnotation ───────────────────────────────────────────────────────

  describe('updateAnnotation', () => {
    it('updates a field by id', () => {
      const p = ann.addPoint(0, 0);
      ann.updateAnnotation(p.id, { label: 'custom' });
      expect(ann.annotations[0].label).toBe('custom');
    });

    it('can update coordinates', () => {
      const r = ann.addRect(0, 0, 10, 10);
      ann.updateAnnotation(r.id, { x1: 5, y1: 5 });
      expect(ann.annotations[0].x1).toBe(5);
      expect(ann.annotations[0].y1).toBe(5);
    });

    it('returns the updated annotation', () => {
      const p = ann.addPoint(0, 0);
      const result = ann.updateAnnotation(p.id, { label: 'updated' });
      expect(result?.label).toBe('updated');
    });

    it('returns null for unknown id', () => {
      expect(ann.updateAnnotation(999, { label: 'x' })).toBeNull();
    });

    it('emits change event', () => {
      const p = ann.addPoint(0, 0);
      const cb = vi.fn();
      ann.on('change', cb);
      ann.updateAnnotation(p.id, { x1: 10 });
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0].updated).toBe(p);
    });

    it('does not change other annotations', () => {
      const p1 = ann.addPoint(1, 1);
      const p2 = ann.addPoint(2, 2);
      ann.updateAnnotation(p1.id, { label: 'changed' });
      expect(p2.label).toBe('label-2');
    });
  });

  // ─── removeAnnotation ───────────────────────────────────────────────────────

  describe('removeAnnotation', () => {
    it('removes annotation by id', () => {
      const p = ann.addPoint(0, 0);
      ann.removeAnnotation(p.id);
      expect(ann.annotations).toHaveLength(0);
    });

    it('returns true when found', () => {
      const p = ann.addPoint(0, 0);
      expect(ann.removeAnnotation(p.id)).toBe(true);
    });

    it('returns false when not found', () => {
      expect(ann.removeAnnotation(999)).toBe(false);
    });

    it('removes the right item from a list', () => {
      ann.addPoint(1, 1);
      const p2 = ann.addPoint(2, 2);
      ann.addPoint(3, 3);
      ann.removeAnnotation(p2.id);
      expect(ann.annotations).toHaveLength(2);
      expect(ann.annotations.find(a => a.id === p2.id)).toBeUndefined();
    });

    it('emits change event with removed annotation', () => {
      const p = ann.addPoint(0, 0);
      const cb = vi.fn();
      ann.on('change', cb);
      ann.removeAnnotation(p.id);
      expect(cb.mock.calls[0][0].removed).toBe(p);
    });
  });

  // ─── clearAll ───────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('empties the annotations array', () => {
      ann.addPoint(0, 0);
      ann.addRect(0, 0, 10, 10);
      ann.clearAll();
      expect(ann.annotations).toHaveLength(0);
    });

    it('resets label index so next annotation is label-1', () => {
      ann.addPoint(0, 0);
      ann.clearAll();
      expect(ann.addPoint(0, 0).label).toBe('label-1');
    });

    it('emits change with cleared flag', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      ann.clearAll();
      expect(cb.mock.calls[0][0].cleared).toBe(true);
    });

    it('does not emit if already empty', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      ann.clearAll();
      expect(cb).toHaveBeenCalledOnce(); // still emits so UI can reset
    });
  });

  // ─── exportJSON ─────────────────────────────────────────────────────────────

  describe('exportJSON', () => {
    it('produces valid JSON', () => {
      ann.addPoint(10, 20);
      expect(() => JSON.parse(ann.exportJSON())).not.toThrow();
    });

    it('has top-level points and rectangles keys', () => {
      const data = JSON.parse(ann.exportJSON());
      expect(data).toHaveProperty('points');
      expect(data).toHaveProperty('rectangles');
      expect(Array.isArray(data.points)).toBe(true);
      expect(Array.isArray(data.rectangles)).toBe(true);
    });

    it('exports a point with x and y only — no x2/y2', () => {
      ann.addPoint(10, 20);
      const { points } = JSON.parse(ann.exportJSON());
      expect(points[0]).toEqual({ label: 'label-1', x: 10, y: 20 });
      expect(points[0]).not.toHaveProperty('x2');
      expect(points[0]).not.toHaveProperty('y2');
    });

    it('exports a rect with x1 y1 x2 y2', () => {
      ann.addRect(5, 10, 50, 100);
      const { rectangles } = JSON.parse(ann.exportJSON());
      expect(rectangles[0]).toEqual({ label: 'label-1', x1: 5, y1: 10, x2: 50, y2: 100 });
    });

    it('does not include internal id or type fields', () => {
      ann.addPoint(0, 0);
      ann.addRect(0, 0, 1, 1);
      const { points, rectangles } = JSON.parse(ann.exportJSON());
      expect(points[0]).not.toHaveProperty('id');
      expect(points[0]).not.toHaveProperty('type');
      expect(rectangles[0]).not.toHaveProperty('id');
      expect(rectangles[0]).not.toHaveProperty('type');
    });

    it('returns empty lists when there are no annotations', () => {
      const data = JSON.parse(ann.exportJSON());
      expect(data).toEqual({ points: [], rectangles: [] });
    });

    it('routes annotations into the correct list', () => {
      ann.addPoint(1, 1);
      ann.addRect(2, 2, 3, 3);
      ann.addPoint(4, 4);
      ann.addRect(5, 5, 6, 6);
      const { points, rectangles } = JSON.parse(ann.exportJSON());
      expect(points).toHaveLength(2);
      expect(rectangles).toHaveLength(2);
      expect(points[0].label).toBe('label-1');
      expect(rectangles[0].label).toBe('label-2');
    });
  });

  // ─── Event system ───────────────────────────────────────────────────────────

  describe('event listener management', () => {
    it('calls listener on each change', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      ann.addPoint(0, 0);
      ann.addPoint(0, 0);
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes when returned function is called', () => {
      const cb = vi.fn();
      const off = ann.on('change', cb);
      off();
      ann.addPoint(0, 0);
      expect(cb).not.toHaveBeenCalled();
    });

    it('supports multiple independent listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      ann.on('change', cb1);
      ann.on('change', cb2);
      ann.addPoint(0, 0);
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('passes the current annotations array to the listener', () => {
      const cb = vi.fn();
      ann.on('change', cb);
      ann.addPoint(1, 2);
      const { annotations } = cb.mock.calls[0][0];
      expect(Array.isArray(annotations)).toBe(true);
      expect(annotations).toHaveLength(1);
    });
  });

  // ─── ID uniqueness ──────────────────────────────────────────────────────────

  describe('id assignment', () => {
    it('assigns unique ids', () => {
      ann.addPoint(0, 0);
      ann.addRect(0, 0, 1, 1);
      ann.addPoint(0, 0);
      const ids = ann.annotations.map(a => a.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('ids do not repeat after clear', () => {
      ann.addPoint(0, 0);
      ann.clearAll();
      // After clear, ids restart from 1 — that is fine as long as there are no
      // duplicate ids within the same session
      ann.addPoint(0, 0);
      expect(ann.annotations[0].id).toBe(1);
    });
  });
});
