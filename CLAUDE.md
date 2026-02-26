# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `pnpm` (not npm or yarn) as the package manager.

```bash
pnpm dev          # Start dev server with Turbopack at localhost:3000
pnpm build        # Production build
pnpm lint         # ESLint
pnpm format       # Prettier (write)
pnpm format:check # Prettier (check only)
pnpm test         # Run all tests with Vitest
```

Run a single test file:

```bash
pnpm vitest run src/lib/datastructures/deque.test.ts
```

Type-check without building:

```bash
pnpm tsc --noEmit
```

## Architecture

**Next.js 15 App Router** with React 19. Path alias `@/` maps to `./src/`.

### Directory Structure

- `src/app/` — Pages and layouts using App Router. Each tool has a dedicated subdirectory (`image-converter/`, `password-generator/`, `auto-formatter/`, `qr-code-generator/`) with `page.tsx` and a `components/` folder for page-specific components.
- `src/components/` — Shared components:
  - `ui/` — Primitive UI components built on Radix UI (shadcn/ui pattern)
  - `layout/` — App shell (Header, Body, ParallaxBackgroundGrid)
  - `context/` — React context providers (ReactQuery, Theme)
  - `icons/` — Custom SVG icons
- `src/hooks/` — Client-only React hooks (marked with `import 'client-only'`)
- `src/lib/` — Pure utilities, organized by domain:
  - `client/` — Browser-only code: image conversion pipeline, IndexedDB cache, file download
  - `datastructures/` — Deque implementation
  - `promises/` — `promisePool` / `promisePoolGenerator` for concurrency-limited async execution
  - `validation/` — Input validation helpers
  - `utils.ts` — `cn()` (clsx + tailwind-merge), `retry()` (exponential backoff), `replaceFileExtension()`
  - `errors.ts` — Custom error types (e.g., `ValueError`)

### Image Conversion Pipeline

The image converter (`src/lib/client/image-tools/`) has a layered architecture:

1. **`convert-image.ts`** — Orchestrator: computes SHA-256 hash for IndexedDB caching, calls FFmpeg or Canvas API, retries on failure, falls back to Canvas API if FFmpeg fails.
2. **`convert-image-ffmpeg.ts`** — Primary path: FFmpeg WASM loaded from jsDelivr CDN. A fresh FFmpeg instance is created per conversion to avoid state conflicts.
3. **`convert-image-canvas-api.ts`** — Fallback: uses `OffscreenCanvas` in a Web Worker (`convert-image-canvas-api.worker.ts`), or falls back to main-thread Canvas if Web Workers are unavailable.
4. **`cache.ts`** — LRU-style IndexedDB cache (`app-cache` DB) with max 10,000 entries, keyed by `{options, useCanvas, sha256}`.

AVIF is Canvas-API-only (FFmpeg's base build lacks the codec). HEIC/HEIF inputs are pre-converted to JPEG via the `heic2any` library before entering this pipeline.

### State Management

- **URL state**: `nuqs` (wrapped in `NuqsAdapter` in the root layout) — used in QR Code Generator
- **Server state / async**: TanStack Query (`ReactQueryClientProvider` in root layout)
- **Persistent file storage**: IndexedDB (`ImageConverterDB`) managed by `usePersistentImages` hook
- **User preferences**: `localStorage` via `usehooks-ts` (e.g., preferred image format)

### Code Style

Prettier config (in `package.json`): single quotes, 2-space indent, trailing commas, `printWidth: 80`, `prettier-plugin-tailwindcss` for class sorting.

Sections within files are delimited with `// #region <Name>` / `// #endregion` comments.

ESLint extends `next/core-web-vitals` and `next/typescript` with `@next/next/no-img-element` turned off.
