# ADR 0001: A pure core with adapters behind ports

Status: accepted (2026-10-21)

## Context

Stabilizing mixes logic that can be tested exhaustively (corners, tracking, fitting, smoothing,
the crop) with drawing that needs a browser (canvases, `VideoFrame`). web360 and webtween keep the
two apart and test the logic to the last branch.

## Decision

- **`packages/core` is pure TypeScript**: no runtime dependency, no browser, no Node API.
- **`packages/adapters/canvas`** draws thumbnails and transformed frames on `OffscreenCanvas`, and
  imports the core only.
- **`packages/websteady`** binds the core's ports to `VideoFrame` through a `Platform`, which tests
  replace.
- `.dependency-cruiser.cjs` enforces the direction of every import.

## Consequences

- Every step of the method is tested with synthetic images whose motion is known exactly.
- The browser-only code is thin and tested with stand-in canvases and frames.
