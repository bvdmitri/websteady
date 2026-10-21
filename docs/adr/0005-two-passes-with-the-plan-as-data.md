# ADR 0005: Two passes over the frames, with the plan as data

Status: accepted (2026-10-21)

## Context

Smoothing both ways needs the whole path before the first frame is drawn. Holding every decoded
frame would take gigabytes; decoding twice takes time but no memory.

## Decision

- **Pass 1, `analyzeMotion`**, reads every frame once and keeps only thumbnails of two frames at a
  time; it returns the `MotionTrack`.
- **`planStabilization`** turns the track into a `StabilizationPlan`: plain JSON-safe data.
- **Pass 2, `stabilize`**, reads the frames again and draws each through the plan frame nearest to
  its timestamp, so a range of a video (timestamps not starting at 0) works as a whole video does.
- Both passes close every frame they are given, take an `AbortSignal`, and count progress from 1.

## Consequences

- An application decodes twice; it may store the plan and skip the first pass next time.
