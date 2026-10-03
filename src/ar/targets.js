/**
 * Add one entry for every image compiled into targets.mind.
 * targetIndex is the image's zero-based order in the MindAR compiler.
 */
const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
const assetUrl = (path) => `${baseUrl}${path}`;

export const TARGETS_FILE = assetUrl("/assets/targets/targets.mind");

export const targetDefinitions = [
  {
    targetIndex: 0,
    name: "Solido Panel",
    videoSrc: assetUrl("/assets/videos/solido-video.mp4"),
    targetAspectRatio: 1672 / 941,
    width: 1,
    loop: true,
    glowColor: "#21d7ff",
    glowDurationMs: 1100,
    videoDelayMs: 650,
    poseSmoothingMs: 100,
  },
  {
    targetIndex: 1,
    name: "Apoy Panel",
    videoSrc: assetUrl("/assets/videos/apoy-video.mp4"),
    targetAspectRatio: 1672 / 941,
    width: 1,
    loop: true,
    glowColor: "#ff6a16",
    glowDurationMs: 1100,
    videoDelayMs: 650,
    poseSmoothingMs: 100,
  },
  {
    targetIndex: 2,
    name: "Amihan Panel",
    videoSrc: assetUrl("/assets/videos/amihan-video.mp4"),
    targetAspectRatio: 1672 / 941,
    width: 1,
    loop: true,
    glowColor: "#8ad9ff",
    glowDurationMs: 1100,
    videoDelayMs: 650,
    poseSmoothingMs: 100,
  },
  {
    targetIndex: 3,
    name: "Ulan Panel",
    videoSrc: assetUrl("/assets/videos/ulan-video.mp4"),
    targetAspectRatio: 1672 / 941,
    width: 1,
    loop: true,
    glowColor: "#3ebcff",
    glowDurationMs: 1100,
    videoDelayMs: 650,
    poseSmoothingMs: 100,
  },
];
