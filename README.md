# Image Annotator

A browser-based image annotation tool for placing points and drawing rectangles on images, with real-time coordinate editing and JSON export.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run unit tests
npm run build      # production build
```

## Features

- **Open any image** — click Open Image or drag & drop onto the canvas
- **Point annotations** — click once to place a crosshair marker
- **Rectangle annotations** — click and drag to draw a bounding box; drag any corner handle to resize
- **Editable list** — every annotation shows label, x/y coordinates, and a delete button in the right panel; all fields update the canvas immediately
- **Zoom & pan** — scroll to zoom toward the cursor, Space+drag (or middle-click drag) to pan, double-click or press F to fit the image
- **JSON export** — downloads `annotations_YYYYMMDDHHmm_<imagename>.json`

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `P` | Point mode |
| `R` | Rectangle mode |
| `F` | Fit image to view |
| `Scroll` | Zoom in / out |
| `Space` + drag | Pan |
| Middle-click drag | Pan |

## Export format

Points and rectangles are kept in separate lists. Points use `x`/`y`; rectangles use `x1 y1 x2 y2` where `(x1, y1)` is the top-left corner.

```json
{
  "points": [
    { "label": "label-1", "x": 320, "y": 240 }
  ],
  "rectangles": [
    { "label": "label-2", "x1": 111, "y1": 133, "x2": 437, "y2": 330 }
  ]
}
```

All coordinates are in image pixels (independent of zoom level).
