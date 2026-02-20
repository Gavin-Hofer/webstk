# Client-side image conversion alternatives (Sharp/ImageMagick/Libvips)

## What you are seeing with Canvas + ffmpeg.wasm

The behavior you described (larger outputs and inconsistent performance) is common with browser-only pipelines:

- `canvas.toBlob()` quality defaults differ by browser and format, so output size can vary even with the same input/settings.
- Browser image decode/encode stacks are not identical (Chromium vs. Firefox vs. WebKit), which makes performance and compression less predictable.
- `ffmpeg.wasm` is excellent for media workflows, but for still images it usually has a larger payload and less predictable startup/runtime characteristics than image-focused stacks.

## Options you asked about

### 1) Sharp (WASM)

**Summary:** not a strong browser-first choice today.

- Sharp is very well-supported and widely used in Node/server contexts.
- Sharp relies on `libvips`, but the mainstream Sharp ecosystem is optimized for server/runtime environments (Node, and increasingly WASI/edge style contexts), not typical browser bundles.
- Browser integration generally requires more adaptation and has fewer battle-tested examples than other browser-focused image approaches.

**Fit for your app:** low for fully in-browser conversion right now.

---

### 2) ImageMagick (WASM)

**Summary:** feature-rich, but often heavy.

- `magick-wasm` style builds expose a very broad set of operations and formats.
- Excellent for advanced editing pipelines and compatibility edge cases.
- Tradeoff: large WASM payload, higher memory usage, and potentially slower startup on mid/low devices.

**Fit for your app:** good if breadth/advanced operations matter more than startup size and responsiveness.

---

### 3) Libvips (WASM)

**Summary:** best balance for your use case.

- `libvips` is the same high-performance engine behind Sharp.
- WASM wrappers (for example `wasm-vips`) are purpose-built for browser usage and are typically leaner than ImageMagick for common transformations.
- Supports the future features you mentioned: crop/resize, color transforms, brightness/contrast/saturation adjustments, and format conversion.

**Fit for your app:** strong for a client-side converter/editor where performance and output control both matter.

## Recommendation

If you want to stay client-side, **adopt a Libvips WASM pipeline** and treat it as the primary converter/editor engine.

Why this is the best next step:

1. **Performance profile:** usually better than ImageMagick WASM for routine conversion/edit operations.
2. **Output control:** more deterministic encoding knobs than raw canvas-only flows.
3. **Roadmap fit:** supports cropping and color/brightness workflows you plan to add.
4. **Ecosystem confidence:** while Sharp itself is server-centric, `libvips` as a core engine is mature and widely trusted.

## Practical architecture (recommended)

1. Run all conversions in a dedicated worker.
2. Normalize decode -> transform -> encode in one engine (avoid mixing canvas encoders and ffmpeg encoders unless needed).
3. Set explicit encode parameters per format (quality, chroma subsampling, effort/compression level, metadata policy).
4. Add a per-browser benchmark + golden image test suite to catch regressions in both speed and output size.
5. Keep a fallback path:
   - Preferred: libvips WASM
   - Fallback: canvas/WebCodecs for basic formats if WASM initialization fails

## Suggested default encoder policy

- **JPEG:** quality ~75-82, 4:2:0 subsampling, strip metadata by default.
- **WebP:** quality ~70-80 for photos, lossless only when explicitly requested.
- **PNG:** expose compression level and optional palette reduction for screenshots/flat graphics.
- **AVIF (optional):** great size wins but slower; make it opt-in or background.

## Bottom line

For a **well-supported and widely-used foundation** with room for **editing + crop features**, choose **Libvips via a browser-oriented WASM wrapper** as your primary client-side image engine. Use ImageMagick WASM only if you need its broader operation/format surface and can accept larger runtime cost.
