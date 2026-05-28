/**
 * Convert screen/canvas coordinates to image coordinates.
 * @param {number} sx - Screen x
 * @param {number} sy - Screen y
 * @param {{ zoom: number, panX: number, panY: number }} transform
 * @returns {{ x: number, y: number }}
 */
export function screenToImage(sx, sy, transform) {
  return {
    x: (sx - transform.panX) / transform.zoom,
    y: (sy - transform.panY) / transform.zoom,
  };
}

/**
 * Convert image coordinates to screen/canvas coordinates.
 * @param {number} ix - Image x
 * @param {number} iy - Image y
 * @param {{ zoom: number, panX: number, panY: number }} transform
 * @returns {{ x: number, y: number }}
 */
export function imageToScreen(ix, iy, transform) {
  return {
    x: ix * transform.zoom + transform.panX,
    y: iy * transform.zoom + transform.panY,
  };
}

/**
 * Normalize a rectangle so x1 <= x2 and y1 <= y2.
 */
export function normalizeRect(x1, y1, x2, y2) {
  return {
    x1: Math.min(x1, x2),
    y1: Math.min(y1, y2),
    x2: Math.max(x1, x2),
    y2: Math.max(y1, y2),
  };
}

/**
 * Clamp a value between min and max (inclusive).
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a label string for a given 1-based index.
 * @param {number} index
 * @returns {string}
 */
export function generateLabel(index) {
  return `label-${index}`;
}

/**
 * Calculate the zoom transform that fits an image into a viewport,
 * centered with optional padding.
 * @param {{ width: number, height: number }} image
 * @param {{ width: number, height: number }} viewport
 * @param {number} [padding=0.92] - fraction of viewport to use
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function fitTransform(image, viewport, padding = 0.92) {
  const scale = Math.min(
    (viewport.width / image.width) * padding,
    (viewport.height / image.height) * padding,
  );
  return {
    zoom: scale,
    panX: (viewport.width - image.width * scale) / 2,
    panY: (viewport.height - image.height * scale) / 2,
  };
}

/**
 * Apply a zoom step toward a focal point in screen space.
 * @param {{ zoom: number, panX: number, panY: number }} transform
 * @param {number} factor - Multiplier (e.g. 1.1 to zoom in)
 * @param {number} cx - Focal x in screen coordinates
 * @param {number} cy - Focal y in screen coordinates
 * @param {number} [minZoom=0.02]
 * @param {number} [maxZoom=50]
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function applyZoom(transform, factor, cx, cy, minZoom = 0.02, maxZoom = 50) {
  const newZoom = clamp(transform.zoom * factor, minZoom, maxZoom);
  const ratio = newZoom / transform.zoom;
  return {
    zoom: newZoom,
    panX: cx - (cx - transform.panX) * ratio,
    panY: cy - (cy - transform.panY) * ratio,
  };
}
