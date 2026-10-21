# Architecture

websteady is a hexagonal TypeScript monorepo, built like its siblings web360 and webtween. The core
is pure: it knows no browser API, no Node API and no npm package. Drawing on canvases is an
adapter, and the published package wires it to the browser. `.dependency-cruiser.cjs` enforces the
import rules below.

## Packages

| Path                       | Role                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core`            | `@websteady/core`: image analysis, motion, the camera path and its plan, the render transform, the streams. No runtime dependencies. |
| `packages/adapters/canvas` | `@websteady/canvas`: grey thumbnails and transformed frames drawn on `OffscreenCanvas`. Depends on the core only.                    |
| `packages/websteady`       | `@bvdmitri/websteady`, the published package: the public API and the browser `Platform`. It bundles the workspace packages.          |
| `tools/checks`             | The repository checks: no em or en dashes, no private sample terms.                                                                  |
| `tools/docs`               | The documentation site's link rewriting.                                                                                             |
| `tools/release`            | The release notes, taken from the changelog.                                                                                         |
| `tools/demo`               | A Vite page that stabilizes a picked clip and downloads the MP4. Not published.                                                      |

## Inside the core

| Folder      | Holds                                                                                           | Imports                          |
| ----------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| `shared/`   | Branded units, a seeded random source                                                           | nothing                          |
| `geometry/` | `Similarity` (apply, compose, invert, parts, matrix), the least-squares and RANSAC fits         | `shared/`                        |
| `image/`    | Grey images, the pyramid, Shi-Tomasi corners, pyramidal Lucas-Kanade tracking                   | `geometry/`                      |
| `motion/`   | A pair of frames to a motion and its reliability, in normalized coordinates                     | `geometry/`, `image/`, `shared/` |
| `path/`     | Filling, the camera path, smoothing, the crop fit, `planStabilization`                          | `geometry/`, `shared/`           |
| `render/`   | `frameTransform`, the CPU reference warp, PSNR and ITF                                          | `geometry/`, `image/`            |
| `stream/`   | `analyzeStream`, `stabilizeStream` and `transformAt`, generic over the frame type through ports | all of the above                 |

The streams never see a `VideoFrame`: an `AnalysisPort` and a `RenderPort` say what to do with a
frame, and the published package binds them to `VideoFrame` and `OffscreenCanvas`.

## Public API

`@bvdmitri/websteady` exports (`packages/websteady/src/index.ts`):

- `analyzeMotion(frames, options)`: pass 1, the `MotionTrack` of a stream of decoded frames.
- `planStabilization(track, { smoothing, crop })`: the `StabilizationPlan`, plain data.
- `stabilize(frames, plan, options)`: pass 2, an async generator of steady frames.
- `transformAt(plan, timestamp, size)`: the transform `stabilize` draws a frame through, for
  drawing it in another pass; `apply`, `invert` and `toMatrix` to use it.
- `PRESETS`: `gentle`, `normal` and `strong` settings.
- `itf`: inter-frame transformation fidelity, to measure a result.
- `WebsteadyError` and its `WebsteadyErrorCode`; `browserPlatform()` and the `Platform` type.
