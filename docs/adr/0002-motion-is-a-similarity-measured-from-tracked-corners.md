# ADR 0002: Motion is a similarity measured from tracked corners

Status: accepted (2026-10-21)

## Context

Most uploads have no motion metadata left (a browser transcode drops it), so the motion has to come
from the pixels. The classic method (corners, optical flow, a robust fit) is published, small, and
runs in real time on small frames. Learned stabilizers exist only as papers. The usable browser
stabilizers are GPL (vid.stab in ffmpeg.wasm, a Gyroflow port), which a proprietary application
cannot ship.

## Decision

- **Frames are analysed at 480 px on the long side**, grey.
- **Shi-Tomasi corners, one per 24 px cell, tracked by pyramidal Lucas-Kanade** with a
  forward-backward check; **RANSAC fits a similarity** (move, turn, uniform scale) to the tracked
  points.
- **Motion is kept in normalized coordinates** (frame widths, origin at the centre), so it applies
  at any resolution.
- **Each motion carries a reliability**; unreliable frames (sky, flat walls, crowds of moving
  subjects) take the motion of the reliable frames around them.
- Every parameter and its reason is in docs/METHOD.md.

## Consequences

- A similarity cannot undo the wobble of a rolling shutter or the bend of a wide lens; a
  homography or a mesh is a later step.
- Large moving subjects can steer the fit when they cover most of the frame.
