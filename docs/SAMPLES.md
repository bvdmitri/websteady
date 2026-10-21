# Samples and fixtures

## Private samples

Real clips for local measurements go in `samples/`, which git ignores except for its README. They
often show people and places, so none of it is ever committed.

`samples/catalogue.json` lists what must not leak. The repository checks (`tools/checks`) refuse
a commit whose files, paths or message contain any of its terms:

```json
{
  "samples": [{ "files": ["clip-name.mp4"] }],
  "terms": ["a folder name", "a person's name"]
}
```

A missing catalogue checks nothing (a fresh clone has no private samples); an unreadable one fails
the check.

## Test images and clips

The tests make their images: a smooth analytic texture (`packages/core/src/testing/images.ts`)
sampled exactly through any transform, so a known motion has an exact answer, flat and dithered
frames for sky, and a shaky sequence of the texture for the end-to-end test. No fixture is
committed.

The demo's measurements in [METHOD.md](./METHOD.md) use synthetic clips made with ffmpeg: a static
Mandelbrot picture, turned and cropped by a known jitter on every frame, and a flat colour.
