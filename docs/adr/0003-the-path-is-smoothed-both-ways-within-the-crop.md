# ADR 0003: The camera path is smoothed both ways in time, within the crop

Status: accepted (2026-10-21)

## Context

Stabilization runs after recording, so it can look ahead: a path smoothed both ways in time has no
lag. The output must show only picture, so a correction may not move the frame's edge into view.

## Decision

- **A Gaussian over time**, of `smoothing` seconds, on the path's angle, log scale and move, with
  the ends mirrored so a steady pan is kept exactly.
- **A fixed crop**: the centre `1 - crop` of each side, zoomed to fill the frame.
- **The correction is weakened toward none** where it would show the edge, by bisection.
- **Presets** `gentle`, `normal`, `strong` pair a smoothing with a crop.

## Consequences

- Simple and predictable; where the clamp acts, the picture follows the shake briefly. L1-optimal
  paths, which plan within the crop, are on the roadmap.
