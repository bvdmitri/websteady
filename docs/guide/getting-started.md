# Getting started

websteady stabilizes a video from its decoded `VideoFrame`s, in two passes: it measures the
camera's motion, plans a smooth path, and draws each frame onto it. Decoding, encoding and audio
stay with your application; the examples use [Mediabunny](https://mediabunny.dev) in a worker.

## Stabilize a clip

```ts
import { analyzeMotion, planStabilization, PRESETS, stabilize } from '@bvdmitri/websteady';

// `decode()` yields every frame of the clip (or of the exported range), in order.
const track = await analyzeMotion(decode(), { onProgress: (done) => report('analyse', done) });
const plan = planStabilization(track, PRESETS.normal);
for await (const frame of stabilize(decode(), plan, {
  onProgress: (done) => report('render', done),
})) {
  await encoder.add(frame); // same size and timing as the source frame
  frame.close();
}
```

- Both passes close every frame they are given. Close every frame `stabilize` yields.
- `signal` (an `AbortSignal`) stops either pass between frames by throwing its reason;
  `onProgress` counts the frames each pass has done, from 1, separately for each pass.
- The plan is plain data: store it as JSON to apply again without analysing.

## Settings

| Preset   | `smoothing` | `crop` | Feel                           |
| -------- | ----------- | ------ | ------------------------------ |
| `gentle` | 0.5 s       | 0.05   | follows the camera, small crop |
| `normal` | 1 s         | 0.10   | the default                    |
| `strong` | 2 s         | 0.15   | holds the picture steadiest    |

`smoothing` is in seconds and above 0: how long a wobble may last and still be smoothed away.
`crop` is the share of each side given up, from 0 to below 0.5. Either out of range throws a
`RangeError`. [METHOD.md](../METHOD.md) has every step and parameter.

## A range of a video

Analyse and stabilize only the frames you export, a trim or a slow-motion range: timestamps need
not start at 0. The second pass finds each frame's correction by the nearest timestamp in the
plan, so decode the same range both times.

## Drawing it yourself

To apply the correction in your own GPU pass rather than through `stabilize`'s canvas:

```ts
import { invert, toMatrix, transformAt } from '@bvdmitri/websteady';

const transform = transformAt(plan, frame.timestamp, {
  width: frame.displayWidth,
  height: frame.displayHeight,
});
// Source pixel to output pixel, same size, the crop's zoom included. For each output pixel,
// sample the source at invert(transform) of it. toMatrix gives [a, -b, tx, b, a, ty] row by row.
const sourceOf = toMatrix(invert(transform));
```

Pixels have `x` to the right and `y` down, the origin at the top-left corner of the frame.
`Platform.render(frame, transform)` receives exactly this transform, so a custom `Platform` is the
other way to draw it.

## Frames from anywhere

Any `VideoFrame` works: a decoder's, or one made on another GPU device (web360's reframer, say).
Analysis and rendering draw it on a canvas at its display size, so frames reframed to 1920x1080 or
1080x1920 need nothing special.

## Speed

Measured in headless Chrome on an Apple M2 Pro, decoding included (METHOD.md has the details):
about 64, 74 and 98 ms per frame to analyse at 720p, 1080p and 4K, and 36, 64 and 214 ms per frame
to render and encode. Analysis works on 480 px thumbnails, so its cost grows little with resolution.

## Errors

`WebsteadyError` with code `canvas-unavailable`: there is no `OffscreenCanvas` with a 2D context
where the passes run.
