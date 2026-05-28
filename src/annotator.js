import { generateLabel, normalizeRect } from './utils.js';

export class Annotator {
  constructor() {
    this.annotations = [];
    this._nextId = 1;
    this._nextLabelIndex = 1;
    this._listeners = new Map();
  }

  /** Register an event listener. Returns an unsubscribe function. */
  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this._listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach(cb => cb(data));
  }

  /**
   * Add a point annotation.
   * @param {number} x
   * @param {number} y
   * @returns {object} The created annotation
   */
  addPoint(x, y) {
    const annotation = {
      id: this._nextId++,
      type: 'point',
      label: generateLabel(this._nextLabelIndex++),
      x1: Math.round(x),
      y1: Math.round(y),
      x2: Math.round(x),
      y2: Math.round(y),
    };
    this.annotations.push(annotation);
    this._emit('change', { annotations: this.annotations, added: annotation });
    return annotation;
  }

  /**
   * Add a rectangle annotation. Coordinates are normalized so x1 <= x2, y1 <= y2.
   * @returns {object} The created annotation
   */
  addRect(x1, y1, x2, y2) {
    const rect = normalizeRect(x1, y1, x2, y2);
    const annotation = {
      id: this._nextId++,
      type: 'rect',
      label: generateLabel(this._nextLabelIndex++),
      x1: Math.round(rect.x1),
      y1: Math.round(rect.y1),
      x2: Math.round(rect.x2),
      y2: Math.round(rect.y2),
    };
    this.annotations.push(annotation);
    this._emit('change', { annotations: this.annotations, added: annotation });
    return annotation;
  }

  /**
   * Update fields on an existing annotation by id.
   * @param {number} id
   * @param {object} fields - Partial update (label, x1, y1, x2, y2)
   * @returns {object|null} Updated annotation or null if not found
   */
  updateAnnotation(id, fields) {
    const annotation = this.annotations.find(a => a.id === id);
    if (!annotation) return null;
    Object.assign(annotation, fields);
    this._emit('change', { annotations: this.annotations, updated: annotation });
    return annotation;
  }

  /**
   * Remove an annotation by id.
   * @param {number} id
   * @returns {boolean} True if removed
   */
  removeAnnotation(id) {
    const index = this.annotations.findIndex(a => a.id === id);
    if (index === -1) return false;
    const [removed] = this.annotations.splice(index, 1);
    this._emit('change', { annotations: this.annotations, removed });
    return true;
  }

  /** Remove all annotations and reset counters. */
  clearAll() {
    this.annotations = [];
    this._nextId = 1;
    this._nextLabelIndex = 1;
    this._emit('change', { annotations: this.annotations, cleared: true });
  }

  /**
   * Serialize annotations to a JSON string.
   * Each entry: { label, x1, y1, x2, y2 }
   */
  exportJSON() {
    const points = this.annotations
      .filter(a => a.type === 'point')
      .map(({ label, x1, y1 }) => ({ label, x: x1, y: y1 }));

    const rectangles = this.annotations
      .filter(a => a.type === 'rect')
      .map(({ label, x1, y1, x2, y2 }) => ({ label, x1, y1, x2, y2 }));

    return JSON.stringify({ points, rectangles }, null, 2);
  }
}
