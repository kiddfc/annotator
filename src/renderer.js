import { imageToScreen, fitTransform } from './utils.js';

export const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
];

const POINT_RADIUS = 7;
const HANDLE_SIZE = 6;
const LABEL_FONT = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 4;
const LABEL_HEIGHT = 18;

/** Draw a rounded rectangle path (cross-browser). */
function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;
    this.annotations = [];
    this.pendingAnnotation = null;
    this.dpr = window.devicePixelRatio || 1;
    this.transform = { zoom: 1, panX: 0, panY: 0 };
  }

  /** Load a new image and fit it to the current canvas. */
  setImage(img) {
    this.image = img;
    this.fitImage();
  }

  /** Fit the image into the canvas with padding. */
  fitImage() {
    if (!this.image) return;
    const cssW = this.canvas.width / this.dpr;
    const cssH = this.canvas.height / this.dpr;
    this.transform = fitTransform(
      { width: this.image.width, height: this.image.height },
      { width: cssW, height: cssH },
    );
  }

  setAnnotations(annotations) {
    this.annotations = annotations;
  }

  setPending(annotation) {
    this.pendingAnnotation = annotation;
  }

  /** Return the hex color for a given annotation index. */
  getColor(index) {
    return COLORS[index % COLORS.length];
  }

  /** Render the full scene. */
  render() {
    const { ctx, canvas, dpr } = this;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cssW, cssH);

    if (this.image) {
      this._drawImage(cssW, cssH);
      this.annotations.forEach((ann, i) => this._drawAnnotation(ann, this.getColor(i), false));
      if (this.pendingAnnotation) this._drawAnnotation(this.pendingAnnotation, '#ffffff', true);
    }

    ctx.restore();
  }

  _drawImage(cssW, cssH) {
    const { ctx, image, transform: { zoom, panX, panY } } = this;
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }

  _drawAnnotation(ann, color, isPending) {
    const { ctx, transform } = this;
    const toScreen = (x, y) => imageToScreen(x, y, transform);

    if (ann.type === 'point') {
      this._drawPoint(ctx, toScreen(ann.x1, ann.y1), color, ann.label, isPending);
    } else if (ann.type === 'rect') {
      this._drawRect(ctx, toScreen(ann.x1, ann.y1), toScreen(ann.x2, ann.y2), color, ann.label, isPending);
    }
  }

  _drawPoint(ctx, { x, y }, color, label, isPending) {
    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.strokeStyle = isPending ? 'rgba(255,255,255,0.6)' : color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Filled circle
    ctx.beginPath();
    ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isPending ? 'rgba(255,255,255,0.8)' : color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!isPending && label) {
      this._drawLabel(ctx, label, x, y - POINT_RADIUS - 4, color);
    }
  }

  _drawRect(ctx, p1, p2, color, label, isPending) {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);

    // Semi-transparent fill
    ctx.fillStyle = isPending ? 'rgba(255,255,255,0.06)' : color + '1a';
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = isPending ? 'rgba(255,255,255,0.7)' : color;
    ctx.lineWidth = 2;
    if (isPending) ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Corner handles – circles so they read as drag targets
    if (!isPending) {
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
        ctx.beginPath();
        ctx.arc(hx, hy, HANDLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    if (!isPending && label) {
      this._drawLabel(ctx, label, x, y - 4, color);
    }
  }

  _drawLabel(ctx, text, x, y, color) {
    ctx.font = LABEL_FONT;
    const tw = ctx.measureText(text).width;
    const bw = tw + LABEL_PADDING_X * 2;
    const bh = LABEL_HEIGHT;
    const bx = x - LABEL_PADDING_X;
    const by = y - bh;

    ctx.beginPath();
    roundRectPath(ctx, bx, by, bw, bh, 3);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x, by + bh / 2);
  }

  /** Convert image coordinates to screen/canvas coordinates. */
  imageToScreen(ix, iy) {
    const { zoom, panX, panY } = this.transform;
    return { x: ix * zoom + panX, y: iy * zoom + panY };
  }

  /** Convert screen coordinates to image coordinates. */
  screenToImage(sx, sy) {
    const { zoom, panX, panY } = this.transform;
    return {
      x: (sx - panX) / zoom,
      y: (sy - panY) / zoom,
    };
  }

  /** Apply zoom toward focal point. */
  zoom(factor, cx, cy) {
    const { zoom, panX, panY } = this.transform;
    const newZoom = Math.max(0.02, Math.min(50, zoom * factor));
    const ratio = newZoom / zoom;
    this.transform = {
      zoom: newZoom,
      panX: cx - (cx - panX) * ratio,
      panY: cy - (cy - panY) * ratio,
    };
  }

  /** Translate (pan) by delta pixels. */
  pan(dx, dy) {
    this.transform.panX += dx;
    this.transform.panY += dy;
  }

  /** Current zoom as a percentage string. */
  zoomPercent() {
    return `${Math.round(this.transform.zoom * 100)}%`;
  }

  /** Resize the canvas to the container, preserving DPR. */
  resize(cssW, cssH) {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = cssW * this.dpr;
    this.canvas.height = cssH * this.dpr;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
  }
}
