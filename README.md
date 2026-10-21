# websteady

Video stabilization in the browser: the camera's shake measured from the pixels, smoothed, and
cropped away, from decoded `VideoFrame`s to decoded `VideoFrame`s.

websteady is a library, not a player or a muxer: decoding, encoding, audio and playback belong to
the application that uses it. It needs no camera metadata and no WebGPU: it works on any video, in
a page or a worker.

## What it does

- **Measures the camera's motion** between frames: corners tracked on small grey copies of the
  frames, and the move, turn and zoom most of them agree on, with a reliability for each frame.
- **Plans a smooth camera path**, looking both ways in time, with each frame's correction kept
  within a small crop so no edge shows. The plan is plain data.
- **Draws each frame onto the smooth path**, or hands you the transform to draw in your own pass.

See [packages/websteady/README.md](./packages/websteady/README.md) and the
[getting-started guide](./docs/guide/getting-started.md) for usage, and
[docs/METHOD.md](./docs/METHOD.md) for the method and its measurements.

## Development

Requires Node 24 or 26 and pnpm 11.

```sh
pnpm install
pnpm verify                        # checks, typecheck, lint, format, dependency rules, tests
pnpm --filter @websteady/demo dev  # the demo page
```

[CLAUDE.md](./CLAUDE.md) holds the rules every change follows.

## License

MIT
