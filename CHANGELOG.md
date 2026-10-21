# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-21

### Added

- `analyzeMotion`: the camera's motion between consecutive frames of a decoded video, measured
  from tracked corners, with a reliability for each frame.
- `planStabilization`: a smooth camera path, looking both ways in time, with each frame's
  correction kept within a crop; `PRESETS` `gentle`, `normal` and `strong`.
- `stabilize`: the frames drawn steady on a canvas, streaming, with progress and cancelling.
- `transformAt`, `apply`, `invert` and `toMatrix`: the transform each frame is drawn through, for
  drawing it in another pass.
- `itf`: inter-frame transformation fidelity, the standard measure of a stabilization.
- A demo page that stabilizes a picked clip and downloads the MP4.

[Unreleased]: https://github.com/bvdmitri/websteady/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bvdmitri/websteady/releases/tag/v0.1.0
