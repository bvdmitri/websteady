# @bvdmitri/websteady

Video stabilization in the browser: the camera's shake measured from the pixels, smoothed, and
cropped away. websteady takes decoded `VideoFrame`s and gives steady ones; decoding, encoding and
audio stay with your application.

```ts
import { analyzeMotion, planStabilization, PRESETS, stabilize } from '@bvdmitri/websteady';

const track = await analyzeMotion(decode()); // pass 1: every frame, in order
const plan = planStabilization(track, PRESETS.normal); // plain data
for await (const frame of stabilize(decode(), plan)) {
  // pass 2
  await encoder.add(frame); // same size and timing as its source frame
  frame.close();
}
```

- Both passes close the frames they are given; close every frame `stabilize` yields.
- `PRESETS`: `gentle` (0.5 s smoothing, 5% crop), `normal` (1 s, 10%), `strong` (2 s, 15%).
- `transformAt(plan, timestamp, size)` gives the transform a frame is drawn through (source pixel
  to output pixel, crop included), to draw it in your own GPU pass.
- Both passes take `signal` (an `AbortSignal`) and `onProgress` (frames done, from 1).

Requirements: `OffscreenCanvas` with a 2D context, and `VideoFrame` (WebCodecs).

## License

MIT
