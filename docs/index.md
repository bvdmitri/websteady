---
layout: home

hero:
  name: websteady
  text: Video stabilization in the browser
  tagline: The camera's shake measured from the pixels, smoothed, and cropped away, from decoded VideoFrames to decoded VideoFrames.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: The method
      link: /METHOD

features:
  - title: From the pixels
    details: No gyro or metadata needed. Corners are tracked between frames and the camera's motion fitted to them.
  - title: Smooth, never late
    details: The camera path is smoothed looking both ways in time, and each correction stays within a small crop.
  - title: Plain data
    details: The plan is JSON. Store it, apply it again, or draw its transforms in your own GPU pass.
  - title: In the browser
    details: Canvas 2D in a page or a worker. Nothing leaves the user's machine.
---
