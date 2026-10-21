# Roadmap

What websteady does today and what comes next. Read it with [CLAUDE.md](../CLAUDE.md) (the rules)
and [METHOD.md](./METHOD.md) (the method and its measurements).

## What exists

- **Analysis**: Shi-Tomasi corners tracked by pyramidal Lucas-Kanade on 480 px thumbnails, and the
  camera's motion between frames as a similarity fitted by RANSAC, with a reliability per frame.
- **Planning**: the camera path smoothed both ways in time and each correction kept within the
  crop; three presets.
- **Rendering**: Canvas 2D in the browser, or any pass through `transformAt`.
- **The demo** (`tools/demo`): pick a clip, stabilize it, compare, download.

## What is next

- **Real footage**: measure speed and ITF on real shaky clips (skydiving, walking, cycling) and
  tune from them, recording each change in METHOD.md.
- **Camera paths with fewer kinks**: L1-optimal paths (Grundmann, Kwatra and Essa 2011) in place of
  the Gaussian, so the crop clamp never shows.
- **Moving subjects**: weighting or masking points on large moving subjects, so a frame filled by
  other people does not steer the camera.
- **Richer motion**: a homography or a mesh, and rolling-shutter correction, for wide lenses.
- **Speed at 4K**: rendering is the cost there (about 214 ms per frame with encoding); a WebGPU
  render pass in the application, through `transformAt`, avoids the canvas copy.

Audio, containers and playback stay out of scope: they belong to the application.
