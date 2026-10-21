# websteady: operating manual

websteady is a library that stabilizes video in the browser: it measures the camera's shake from
the pixels, smooths the camera path, and draws each frame onto the smooth path with a small crop.
It takes and gives decoded `VideoFrame`s. It is not a player and not a muxer. This file is the
operating manual for anyone (human or agent) changing the code.

## How to start any task

1. Read the relevant doc in `docs/` before touching an area. `docs/` is the source of truth.
2. If the docs do not cover what you need, ask. Once decided, update the doc in the same change.
3. Write the failing test first, then the code that makes it pass, then refactor.
4. If a change contradicts a doc, stop and ask whether to change the doc or the code. A code
   change that contradicts its doc is incomplete.

## Where things are described

| Topic                                          | Document                                             |
| ---------------------------------------------- | ---------------------------------------------------- |
| Where the work stands and what is next         | [docs/roadmap.md](./docs/roadmap.md)                 |
| Layers, packages, dependency rules, public API | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)       |
| The method: every step, its parameters, units  | [docs/METHOD.md](./docs/METHOD.md)                   |
| Private samples and committed fixtures         | [docs/SAMPLES.md](./docs/SAMPLES.md)                 |
| Releasing a version                            | [docs/guide/releasing.md](./docs/guide/releasing.md) |
| Decisions and their reasons                    | `docs/adr/`                                          |

## Hard rules

1. **TDD, always.** Every function starts as a failing test. Image, geometry and path maths also
   get property tests (fast-check). Coverage gates: 95% lines, 90% branches. Mutation testing
   (Stryker) on the core breaks below 80%.
2. **The core is pure.** No browser API, no Node API, no npm runtime dependency in
   `packages/core`. Canvases and frames are adapters behind ports.
3. **Every renderer has a CPU reference in the core** (`warpReference`), and what an adapter draws
   is the core's `frameTransform`, tested as such.
4. **The method is documented as facts.** `docs/METHOD.md` states each step with its parameters,
   their units and why they have their values, and the published method it follows. A parameter
   changes only with a measurement that justifies it, recorded there.
5. **No player, no muxer.** No playback state, clocks, audio or containers in any published
   package. Decoding, encoding and audio belong to the application.
6. **Strict lint, zero warnings.** Complexity 8, nesting 3, 30 lines a function, 300 lines a
   file, 3 parameters, no magic numbers. Fix the design rather than disable a rule.
7. **Units are types.** Use the branded units in `shared/units`; convert explicitly. Motion is in
   normalized coordinates (frame widths, origin at the centre); pixels only at the edges.
8. **Document contracts with TSDoc.** Exported types and functions that other modules rely on get
   a docstring: a one-line summary, then why, when, and the invariants. Do not restate the type.
9. **Comments and docs describe the present.** No "previously", "used to", "no longer". History
   belongs in git and the changelog.
10. **No em or en dashes** anywhere: code, comments, docs, commit messages. The repository
    checks reject them.
11. **Private samples never leak.** Nothing from `samples/` or its catalogue terms reaches a
    commit; the pre-commit and commit-msg hooks enforce it.
12. **Pin everything.** Exact dependency versions, a committed lockfile, CI actions pinned to a
    commit.
13. **Keep `CHANGELOG.md` current** for every user-visible change, and release by tag
    ([docs/guide/releasing.md](./docs/guide/releasing.md)).

## Commands

```sh
pnpm verify          # the full gate: checks, typecheck, lint, format, dependency rules, tests
pnpm test            # all tests
pnpm vitest run --project core   # one project
pnpm test:mutation   # Stryker on the core
pnpm checks          # repository checks over every tracked file
pnpm --filter @bvdmitri/websteady build   # dist/ for publishing
pnpm --filter @websteady/demo dev         # the demo page
```

Run `pnpm verify` before calling any change done.
