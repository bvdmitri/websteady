# The method

websteady stabilizes a video in three passes over its decoded frames. This page states every step,
its parameters with their units, and the published method each follows. Defaults live in
`ANALYSIS` (`packages/core/src/motion/analyze.ts`) and `PRESETS` (`packages/websteady/src/stabilize.ts`).

## Coordinates

- **Pixels** have `x` to the right and `y` down, as images and canvases lay them out.
- **Normalized coordinates** put the origin at the frame's centre and measure in frame widths:
  `(x - width / 2) / width`, `(y - height / 2) / width`. Every motion and correction is kept this
  way, so a plan measured on small thumbnails applies to the same video at any resolution.
- **A similarity** `{ a, b, tx, ty }` maps `(x, y)` to `(a x - b y + tx, b x + a y + ty)`: a turn
  by `atan2(b, a)` and a scale by `hypot(a, b)` about the origin, then a move. Pan and tilt move
  the picture, roll turns it, a push scales it.

## Pass 1: analyse

Each frame is drawn small and grey, then compared with the frame before it.

1. **Thumbnail.** The frame is drawn with its long side at **480 px** (never enlarged) on an
   `OffscreenCanvas`, and its luma taken with the Rec. 601 weights (0.299, 0.587, 0.114), in 0..1.
2. **Pyramid.** The thumbnail and its halvings, each blurred by the 5-tap binomial kernel
   (1, 4, 6, 4, 1) / 16 first: at most **4 levels**, none with a side below **24 px**.
3. **Corners** (Shi and Tomasi 1994). The smaller eigenvalue of the structure tensor, summed over
   a 5 by 5 window of central-difference gradients, scores each pixel. The best pixel of each
   **24 px** grid cell is kept if it scores at least **2%** of the frame's best and at least
   **1e-3**. The floor is a contrast of a few grey levels: video noise and the one-level
   dithering a browser adds when drawing a flat frame score below it, so open sky has no corners
   (measured: a dithered flat frame cost 320 ms per frame in analysis below the floor, 29 ms at it).
4. **Tracking** (Lucas and Kanade 1981, pyramidal as in Bouguet 2001). Each corner is followed
   from the coarsest level to the finest with a **15 by 15 px** window (radius 7), at most **10**
   steps a level, stopping below **0.03 px**. A corner is dropped if its window has no texture,
   it leaves the frame, or tracking it back misses its start by more than **0.5 px**.
5. **Motion** (Fischler and Bolles 1981). RANSAC draws **200** pairs of tracked points, fits a
   similarity to each in closed form (least squares on centred points), and keeps the one most
   points agree with within **1 thumbnail pixel**; a least-squares fit over those points is the
   frame's motion. The draws are seeded, so a video always gives the same track.
6. **Reliability.** A motion is reliable when at least **8** points and at least **30%** of the
   tracked ones agree with it. Sky, a flat wall, or a frame filled by moving subjects is not.

The result is a `MotionTrack`: each frame's timestamp, its motion from the frame before (the first
frame's is the identity), whether it is reliable, and the frame's height over its width.

## Planning

1. **Filling.** An unreliable motion is replaced by the reliable ones around it, blended by
   distance; the nearest reliable one at the ends; standing still when none is reliable. A camera
   keeps moving through a stretch of sky the way it moved into it.
2. **Path.** The motions are composed into the camera path: where the first frame's picture is in
   each frame.
3. **Smoothing.** The path's angle (unwrapped), log scale and move are each smoothed by a Gaussian
   over time, looking both ways, with a standard deviation of `smoothing` seconds (converted to
   frames by the median frame interval) and reaching 3 deviations. Beyond the ends the path is
   mirrored about its end values, so a steady pan stays exactly a steady pan.
4. **Correction.** Each frame's correction moves its picture from the measured path onto the
   smooth one: `smooth ∘ path⁻¹`.
5. **Crop.** The output shows the centre `1 - crop` of each side, zoomed to fill the frame. Where a
   correction would bring the frame's edge into that window, it is weakened toward none, by
   bisection over the share kept (24 steps), until the window's corners map inside the frame.

The plan is plain data (`StabilizationPlan`): the crop, the aspect, and each frame's timestamp and
correction.

## Pass 2: render

Each frame is drawn through `frameTransform(correction, crop, size)`: into normalized coordinates,
through the correction, zoomed by `1 / (1 - crop)` about the centre, and back to pixels at the
frame's own size. The frame of the plan nearest in time to a frame's timestamp supplies its
correction. The browser draws it with Canvas 2D `setTransform` and `drawImage` (high-quality
smoothing) over black, which the crop keeps out of view.

`transformAt(plan, timestamp, size)` returns the same transform, for drawing it in another pass.

## Settings

| Setting     | Unit               | Range          | Meaning                                               |
| ----------- | ------------------ | -------------- | ----------------------------------------------------- |
| `smoothing` | seconds            | above 0        | How long a wobble may last and still be smoothed away |
| `crop`      | share of each side | 0 to below 0.5 | How much picture is given up to hide the moving edges |

`PRESETS`: `gentle` (0.5 s, 5%) follows the camera closely; `normal` (1 s, 10%) is the default;
`strong` (2 s, 15%) holds the picture steadiest. More smoothing with too little crop leaves the
correction clamped often, which shows as the picture briefly following the shake.

The analysis settings are fixed in the public API: they are tuned for frames analysed at 480 px,
and sky-heavy frames and fast turns are handled by the reliability test and the 4-level pyramid
(which follows a move of about 100 thumbnail pixels, a fifth of the frame, between frames).

## Measured

On synthetic shaky clips (a detailed picture moved by a known jitter of up to 2.5% of the frame and
3 degrees), in headless Chrome on an Apple M2 Pro, decoding included:

| Clip           | Analyse (ms per frame) | Render and encode (ms per frame) | ITF before  | ITF after   |
| -------------- | ---------------------- | -------------------------------- | ----------- | ----------- |
| 720p           | 64                     | 36                               | 19.5 dB     | 32.6 dB     |
| 1080p          | 74                     | 64                               | 19.5 dB     | 31.0 dB     |
| 4K             | 98                     | 214                              | 19.3 dB     | 27.1 dB     |
| Flat sky, 720p | 29                     | 52                               | (no motion) | (no motion) |

ITF (inter-frame transformation fidelity) is the mean PSNR between consecutive frames, the
standard measure of stabilization (`itf`). The core's end-to-end test asserts a gain of at least
8 dB on its own synthetic clip (measured 11.4 dB). Real footage is still to be measured.
