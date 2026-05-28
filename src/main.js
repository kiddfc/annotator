import { Annotator } from './annotator.js';
import { Renderer } from './renderer.js';

class App {
  constructor() {
    this.annotator = new Annotator();
    this.canvas = document.getElementById('canvas');
    this.renderer = new Renderer(this.canvas);
    this.mode = 'point';

    // Interaction state
    this.isPanning = false;
    this.isDrawing = false;
    this.isResizing = false;
    this.resizeTarget = null; // { ann, xField, yField, cursor }
    this.dragStart = null;
    this.spaceHeld = false;
    this.lastPanPos = null;

    this._setupCanvas();
    this._setupEvents();
    this._setupAnnotatorListener();
    this.renderer.render();
  }

  // ─── Canvas resize ──────────────────────────────────────────────────────────

  _setupCanvas() {
    const container = document.getElementById('canvas-container');
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.renderer.resize(w, h);
      this.renderer.render();
    });
    ro.observe(container);
    this.renderer.resize(container.clientWidth, container.clientHeight);
  }

  // ─── DOM events ─────────────────────────────────────────────────────────────

  _setupEvents() {
    // File open
    document.getElementById('open-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this._loadImage(file);
      e.target.value = '';
    });

    // Mode buttons
    document.getElementById('mode-point').addEventListener('click', () => this._setMode('point'));
    document.getElementById('mode-rect').addEventListener('click', () => this._setMode('rect'));

    // Toolbar actions
    document.getElementById('fit-btn').addEventListener('click', () => {
      this.renderer.fitImage();
      this._render();
    });
    document.getElementById('export-btn').addEventListener('click', () => this._exportJSON());
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (this.annotator.annotations.length === 0) return;
      if (confirm('Delete all annotations?')) this.annotator.clearAll();
    });

    // Canvas
    this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('dblclick', () => {
      this.renderer.fitImage();
      this._render();
    });

    // Drag & drop onto canvas area
    const container = document.getElementById('canvas-container');
    container.addEventListener('dragover', e => { e.preventDefault(); container.classList.add('drag-over'); });
    container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
    container.addEventListener('drop', e => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this._loadImage(file);
    });

    // Keyboard
    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));
  }

  _setupAnnotatorListener() {
    this.annotator.on('change', ({ annotations }) => {
      this.renderer.setAnnotations(annotations);
      this._syncAnnotationList(annotations);
      this._render();
    });
  }

  // ─── Image loading ───────────────────────────────────────────────────────────

  _loadImage(file) {
    this.imageName = file.name.replace(/\.[^.]+$/, ''); // strip extension
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      this.renderer.setImage(img);
      document.getElementById('hint').style.display = 'none';
      this.annotator.clearAll();
      this._render();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Failed to load image.');
    };
    img.src = url;
  }

  // ─── Mode ────────────────────────────────────────────────────────────────────

  _setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
  }

  // ─── Canvas interaction ──────────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    const pos = this._canvasPos(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.renderer.zoom(factor, pos.x, pos.y);
    this._render();
  }

  _onMouseDown(e) {
    const pos = this._canvasPos(e);

    // Middle-click or right-click or space → pan
    if (e.button === 1 || e.button === 2 || this.spaceHeld) {
      e.preventDefault();
      this.isPanning = true;
      this.lastPanPos = pos;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0 && this.renderer.image) {
      // Handle grab takes priority over drawing
      const handle = this._findHandle(pos);
      if (handle) {
        this.isResizing = true;
        this.resizeTarget = handle;
        this.canvas.style.cursor = handle.cursor;
        return;
      }

      this.isDrawing = true;
      this.dragStart = this.renderer.screenToImage(pos.x, pos.y);

      if (this.mode === 'point') {
        const { x, y } = this.dragStart;
        this.annotator.addPoint(x, y);
        this.isDrawing = false;
        this.dragStart = null;
      }
    }
  }

  _onMouseMove(e) {
    const pos = this._canvasPos(e);

    if (this.isPanning && this.lastPanPos) {
      this.renderer.pan(pos.x - this.lastPanPos.x, pos.y - this.lastPanPos.y);
      this.lastPanPos = pos;
      this._render();
      return;
    }

    if (this.isResizing && this.resizeTarget) {
      const img = this.renderer.screenToImage(pos.x, pos.y);
      this.annotator.updateAnnotation(this.resizeTarget.ann.id, {
        [this.resizeTarget.xField]: Math.round(img.x),
        [this.resizeTarget.yField]: Math.round(img.y),
      });
      return;
    }

    if (this.isDrawing && this.mode === 'rect' && this.dragStart) {
      const cur = this.renderer.screenToImage(pos.x, pos.y);
      this.renderer.setPending({
        type: 'rect',
        x1: this.dragStart.x,
        y1: this.dragStart.y,
        x2: cur.x,
        y2: cur.y,
      });
      this._render();
      return;
    }

    // Hover: show resize cursor when over a handle
    if (!this.spaceHeld) {
      const handle = this._findHandle(pos);
      this.canvas.style.cursor = handle ? handle.cursor : 'crosshair';
    }
  }

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.lastPanPos = null;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'crosshair';
      return;
    }

    if (this.isResizing && this.resizeTarget) {
      // Normalize so x1<=x2, y1<=y2 after the drag
      const ann = this.annotator.annotations.find(a => a.id === this.resizeTarget.ann.id);
      if (ann) {
        this.annotator.updateAnnotation(ann.id, {
          x1: Math.min(ann.x1, ann.x2),
          y1: Math.min(ann.y1, ann.y2),
          x2: Math.max(ann.x1, ann.x2),
          y2: Math.max(ann.y1, ann.y2),
        });
      }
      this.isResizing = false;
      this.resizeTarget = null;
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (this.isDrawing && this.mode === 'rect' && this.dragStart) {
      const pos = this._canvasPos(e);
      const end = this.renderer.screenToImage(pos.x, pos.y);
      const minPx = 5 / this.renderer.transform.zoom;
      if (Math.abs(end.x - this.dragStart.x) > minPx && Math.abs(end.y - this.dragStart.y) > minPx) {
        this.annotator.addRect(this.dragStart.x, this.dragStart.y, end.x, end.y);
      }
      this.renderer.setPending(null);
      this.isDrawing = false;
      this.dragStart = null;
      this._render();
    }
  }

  _onMouseLeave() {
    if (this.isDrawing) {
      this.renderer.setPending(null);
      this.isDrawing = false;
      this.dragStart = null;
      this._render();
    }
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeTarget = null;
    }
    this.isPanning = false;
    this.lastPanPos = null;
  }

  // ─── Handle hit-testing ──────────────────────────────────────────────────────

  /** Returns the corner handle under `pos` (screen px), or null. */
  _findHandle(pos) {
    const HIT = 10; // px radius
    // Iterate in reverse so topmost-drawn annotation wins
    for (let i = this.annotator.annotations.length - 1; i >= 0; i--) {
      const ann = this.annotator.annotations[i];
      if (ann.type !== 'rect') continue;
      const corners = [
        { xField: 'x1', yField: 'y1', ix: ann.x1, iy: ann.y1, cursor: 'nw-resize' },
        { xField: 'x2', yField: 'y1', ix: ann.x2, iy: ann.y1, cursor: 'ne-resize' },
        { xField: 'x1', yField: 'y2', ix: ann.x1, iy: ann.y2, cursor: 'sw-resize' },
        { xField: 'x2', yField: 'y2', ix: ann.x2, iy: ann.y2, cursor: 'se-resize' },
      ];
      for (const corner of corners) {
        const sp = this.renderer.imageToScreen(corner.ix, corner.iy);
        const dx = pos.x - sp.x;
        const dy = pos.y - sp.y;
        if (dx * dx + dy * dy <= HIT * HIT) return { ann, ...corner };
      }
    }
    return null;
  }

  _onKeyDown(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.spaceHeld = true;
      this.canvas.style.cursor = 'grab';
    }
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) this._setMode('point');
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) this._setMode('rect');
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
      this.renderer.fitImage();
      this._render();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // handled per-item in the list
    }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this.spaceHeld = false;
      if (!this.isPanning) this.canvas.style.cursor = 'crosshair';
    }
  }

  _canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ─── Annotation list ─────────────────────────────────────────────────────────

  /**
   * Diff-update the annotation list without full re-render,
   * so focused inputs keep their cursor position.
   */
  _syncAnnotationList(annotations) {
    const list = document.getElementById('annotation-list');
    const emptyState = document.getElementById('empty-state');
    const countEl = document.getElementById('annotation-count');

    countEl.textContent = annotations.length;
    emptyState.style.display = annotations.length === 0 ? '' : 'none';

    // Remove stale items
    const ids = new Set(annotations.map(a => a.id));
    list.querySelectorAll('.ann-item').forEach(el => {
      if (!ids.has(Number(el.dataset.id))) el.remove();
    });

    // Add or update
    annotations.forEach((ann, i) => {
      const color = this.renderer.getColor(i);
      const existing = list.querySelector(`.ann-item[data-id="${ann.id}"]`);
      if (existing) {
        this._syncItem(existing, ann, color);
      } else {
        const item = this._createItem(ann, color);
        // Insert in correct order
        const afterId = annotations[i + 1]?.id;
        const afterEl = afterId ? list.querySelector(`.ann-item[data-id="${afterId}"]`) : null;
        list.insertBefore(item, afterEl);
      }
    });
  }

  _syncItem(el, ann, color) {
    el.querySelector('.ann-badge').style.background = color;
    // Update inputs only if not focused (prevents cursor jump)
    el.querySelectorAll('[data-field]').forEach(input => {
      if (document.activeElement !== input) {
        input.value = ann[input.dataset.field] ?? '';
      }
    });
  }

  _createItem(ann, color) {
    const isPoint = ann.type === 'point';
    const el = document.createElement('div');
    el.className = 'ann-item';
    el.dataset.id = ann.id;

    el.innerHTML = `
      <div class="ann-row ann-header-row">
        <span class="ann-badge" style="background:${color}">${ann.type}</span>
        <input class="ann-input ann-label-input" data-field="label" value="${ann.label}" placeholder="label" spellcheck="false">
        <button class="ann-delete-btn" title="Delete annotation" aria-label="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="ann-coords-grid">
        <label class="coord-label">
          <span>x1</span>
          <input type="number" class="ann-input coord-input" data-field="x1" value="${ann.x1}">
        </label>
        <label class="coord-label">
          <span>y1</span>
          <input type="number" class="ann-input coord-input" data-field="y1" value="${ann.y1}">
        </label>
        ${!isPoint ? `
        <label class="coord-label">
          <span>x2</span>
          <input type="number" class="ann-input coord-input" data-field="x2" value="${ann.x2}">
        </label>
        <label class="coord-label">
          <span>y2</span>
          <input type="number" class="ann-input coord-input" data-field="y2" value="${ann.y2}">
        </label>
        ` : ''}
      </div>
    `;

    el.querySelector('.ann-delete-btn').addEventListener('click', () => {
      this.annotator.removeAnnotation(ann.id);
    });

    el.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        const isCoord = field !== 'label';
        const value = isCoord ? parseInt(input.value, 10) : input.value;
        if (isCoord && isNaN(value)) return;

        const update = { [field]: value };
        // Keep point x2/y2 in sync with x1/y1
        if (ann.type === 'point') {
          if (field === 'x1') update.x2 = value;
          if (field === 'y1') update.y2 = value;
        }
        this.annotator.updateAnnotation(ann.id, update);
      });
    });

    return el;
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  _exportJSON() {
    if (this.annotator.annotations.length === 0) {
      alert('No annotations to export.');
      return;
    }
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const safeName = (this.imageName ?? 'image').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `annotations_${ts}_${safeName}.json`;

    const json = this.annotator.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Render loop ─────────────────────────────────────────────────────────────

  _render() {
    this.renderer.render();
    document.getElementById('zoom-indicator').textContent = this.renderer.zoomPercent();
  }
}

new App();
