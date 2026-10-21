# ADR 0004: Frames are drawn with Canvas 2D, and the transform is public

Status: accepted (2026-10-21)

## Context

Drawing a frame through a similarity is one affine draw. Canvas 2D does it on the GPU in every
browser, in workers too, with no WebGPU. An application with its own GPU pipeline (cutaway reframes
360 video on WebGPU) wants to apply the correction in its own pass instead.

## Decision

- **`stabilize` draws with `setTransform` and `drawImage`** on an `OffscreenCanvas` of the frame's
  size, over black, with high-quality smoothing, and makes a `VideoFrame` from the canvas.
- **`transformAt(plan, timestamp, size)` is public**: the source-pixel to output-pixel similarity,
  crop zoom included, exactly what `stabilize` draws, for any other renderer.
- **The core's `warpReference`** is the CPU reference of that draw, used by the tests.

## Consequences

- No GPU code ships in websteady; a WebGPU renderer is the application's or a later adapter.
- At 4K the canvas draw and its copy into a new frame dominate the cost.
