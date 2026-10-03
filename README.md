# Handa Pilipinas — Resilient Four WebAR

A mobile-first, browser-based image-tracking AR experience built with MindAR, Three.js, and Vite. The landing screen uses the supplied Resilient Four artwork. After a user taps **Start Experience**, the app starts the rear camera and overlays configured videos on recognized images.

## Run locally

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. `localhost` is accepted as a secure camera context. A phone opening your computer's plain `http://` LAN address will normally be denied camera access; use an HTTPS development tunnel or deploy the production build over HTTPS.

Create an optimized production build with:

```bash
npm run build
npm run preview
```

The deployable static site is written to `dist/`.

## Add targets and videos

1. Put the original tracking images in `public/assets/targets/source-images/`.
2. Open the [official MindAR Image Targets Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile), add the images in the intended index order, compile them, and download the result.
3. Save that file as `public/assets/targets/targets.mind`.
4. Put web-compatible videos (MP4/H.264 is the safest shared iOS/Android choice) in `public/assets/videos/`.
5. Edit the single manifest at `src/ar/targets.js`.

Example:

```js
export const targetDefinitions = [
  {
    targetIndex: 0,
    videoSrc: "/assets/videos/target-01.mp4",
    targetAspectRatio: 1672 / 941,
    width: 1,
    loop: true,
    glowColor: "#21d7ff",
    glowDurationMs: 1100,
    videoDelayMs: 650,
  },
];
```

`targetIndex` is zero-based and must match the image's order in the compiler. `targetAspectRatio` must match the target image's width divided by height. The AR plane then matches the physical image exactly, while the video uses a center-cropped cover fit to fill it without stretching. Recompile `targets.mind` whenever the target image set or order changes.

The included Solido Panel is target index `0`, Apoy Panel is target index `1`, Amihan Panel is target index `2`, and Ulan Panel is target index `3`; all matching videos are configured in `src/ar/targets.js`. When any is recognized, an anchored edge glow pulses over the panel and its video fades in using a center-cropped cover fit that reaches all four target corners without distortion.

## Runtime behavior

- The camera fills the viewport and MindAR requests the environment-facing camera where available.
- Videos are muted and use `playsinline`/`webkit-playsinline` so Safari does not launch its native fullscreen player.
- The Start gesture primes configured videos for mobile autoplay. The in-camera **Enable sound** button uses a separate explicit gesture to unlock audio reliably on iOS and Android.
- Included overlays are mobile-optimized 1280×720 H.264/AAC files with fast-start metadata, reducing transfer and decode pressure while retaining the original source files outside the project.
- A recognized target starts or resumes its video. Losing the target pauses it without resetting playback.
- A render-stage pose stabilizer smooths small position, rotation, and scale noise over about 100 ms, then adaptively catches up during larger movements to avoid visible drift.
- Multiple compiled targets are supported; one visible target is tracked at a time for smoother mobile performance.
- Video elements buffer automatically after Start instead of blocking startup on full-file downloads, and MindAR tracks one visible target at a time to keep mobile pose updates responsive.
- GPU textures, geometry, media, the camera, and the render loop are cleaned up when the page is left.

## Mobile notes

### iPhone / Safari

- Serve the site over HTTPS and allow Camera when prompted.
- Keep videos muted for reliable autoplay. They are rendered inline as WebGL textures.
- Safe-area insets, dynamic viewport height, rotation, and the home indicator are accounted for by the UI.
- If permission was previously denied: Safari → the page settings (`aA`) → Website Settings → Camera → Allow, then reload. On some iOS versions use Settings → Safari → Camera.

### Android / Chrome

- Serve over HTTPS and allow Camera when prompted. Chrome will normally select the rear camera through MindAR.
- If permission was denied: tap the site controls icon in the address bar → Permissions → Camera → Allow, then reload.

## Troubleshooting recognition

- Prefer detailed, high-contrast targets with varied visual features. Avoid large flat-color areas, repeated patterns, glare, motion blur, and nearly identical target images.
- Use the compiler's feature preview; weak targets with few feature points should be redesigned or replaced.
- Test the same printed/digital image, crop, orientation, and aspect ratio that was compiled.
- Use even lighting, keep the whole target visible while acquiring it, and avoid reflections.
- Confirm the manifest index matches the target's compiler order and that the corresponding video URL exists.
- Check the browser console for `[AR]` diagnostics. A missing `targets.mind` or empty manifest is reported explicitly.

## Project structure

```text
index.html
src/
  main.js
  ar/
    arExperience.js
    targets.js             # target index → video manifest
  styles/main.css
public/assets/
  background/home-background.png
  targets/
    targets.mind           # compiled MindAR tracking data
    source-images/         # original target images
  videos/                  # AR videos
```

Camera access requires HTTPS in production. Deploy `dist/` to any normal HTTPS static host.

## Integrating into a larger Vite project

The tracking runtime is isolated in `src/ar/arExperience.js`, while all target-to-video mappings live in `src/ar/targets.js`. Import those modules from the host feature and copy `public/assets/` into the host project's public directory. Asset URLs respect Vite's configured `base`, so subpath deployments are supported. Keep the target order in `targets.js` synchronized with the image order used to compile `targets.mind`.
