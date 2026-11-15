# Bauble Ninja

A Christmas-themed, webcam-controlled slicing game that runs entirely in the browser.

**Play it: [bauble-ninja.vercel.app](https://bauble-ninja.vercel.app)**

- Your webcam feed is segmented so only you appear, placed on a snowy night backdrop.
- Your hands leave trails that fade after about a second.
- Only fast swings count as a chop (slow arm movement leaves a faint trail and cuts nothing).
- Slice falling baubles for points. Miss a bauble or chop a bomb and you lose one of three lives.

## Run locally

It's a static site with no build step. Serve the folder over HTTP (camera access needs `localhost` or HTTPS):

```bash
npx serve .
```

Add `?cpu` to the URL to force CPU inference. You can also drag with the mouse or a finger to slice.

## Deploy

Import the repo in Vercel with the "Other" framework preset and no build command. Every push to `main` deploys.

## Structure

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Screens and HUD |
| `src/main.js` | Game loop, screen flow, rendering order |
| `src/vision.js` | Webcam, MediaPipe pose tracking and person cutout |
| `src/blade.js` | Hand trails and chop detection (speed thresholds live here) |
| `src/game.js` | Baubles, bombs, lives, scoring, difficulty ramp |
| `src/scene.js` | Backdrop and snowfall |
| `vendor/mediapipe/` | MediaPipe Tasks Vision runtime and pose model (Apache-2.0) |
