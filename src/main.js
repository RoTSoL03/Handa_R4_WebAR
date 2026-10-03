import "./styles/main.css";
import { TARGETS_FILE, targetDefinitions } from "./ar/targets.js";

const ui = {
  landing: document.querySelector("#landing-screen"),
  arScreen: document.querySelector("#ar-screen"),
  arContainer: document.querySelector("#ar-container"),
  startButton: document.querySelector("#start-button"),
  retryButton: document.querySelector("#retry-button"),
  soundButton: document.querySelector("#sound-button"),
  soundIcon: document.querySelector(".sound-button__icon"),
  soundLabel: document.querySelector(".sound-button__label"),
  loading: document.querySelector("#loading-overlay"),
  loadingMessage: document.querySelector("#loading-message"),
  scanner: document.querySelector("#scanner"),
  errorPanel: document.querySelector("#error-panel"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
};

let experience = null;
let isStarting = false;
let isAudioEnabled = false;

const updateSoundButton = () => {
  ui.soundButton.setAttribute("aria-pressed", String(isAudioEnabled));
  ui.soundButton.setAttribute("aria-label", isAudioEnabled ? "Mute video sound" : "Enable video sound");
  ui.soundIcon.textContent = isAudioEnabled ? "🔊" : "🔇";
  ui.soundLabel.textContent = isAudioEnabled ? "Sound on" : "Enable sound";
};

const setBusy = (busy, message = "Starting AR experience…") => {
  isStarting = busy;
  ui.startButton.disabled = busy;
  ui.retryButton.disabled = busy;
  ui.loadingMessage.textContent = message;
  ui.loading.hidden = !busy;
};

const showError = (title, message) => {
  setBusy(false);
  ui.scanner.hidden = true;
  ui.errorTitle.textContent = title;
  ui.errorMessage.textContent = message;
  ui.errorPanel.hidden = false;
};

const getFriendlyError = (error) => {
  const name = error?.name ?? "";
  const message = String(error?.message ?? error ?? "");

  if (name === "NotAllowedError" || /permission|denied/i.test(message)) {
    return {
      title: "Camera permission needed",
      message: "Camera access is required to use this AR experience. Allow camera access in your browser settings, then try again.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { title: "Camera unavailable", message: "No usable camera was found on this device." };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return { title: "Camera is busy", message: "The camera may be in use by another app. Close it and try again." };
  }
  return {
    title: "Unable to start AR",
    message: "The AR experience could not be initialized. Check your camera settings and try again.",
  };
};

const assertBrowserSupport = () => {
  if (!window.isSecureContext) {
    throw new Error("SECURE_CONTEXT_REQUIRED");
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.WebGLRenderingContext) {
    throw new Error("UNSUPPORTED_BROWSER");
  }
};

const assertAssetsReady = async () => {
  if (targetDefinitions.length === 0) {
    throw new Error("TARGET_CONFIG_EMPTY");
  }

  const response = await fetch(TARGETS_FILE, { cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("text/html")) {
    throw new Error("TARGET_FILE_MISSING");
  }
};

const startExperience = async () => {
  if (isStarting || experience) return;

  ui.landing.hidden = true;
  ui.arScreen.hidden = false;
  ui.errorPanel.hidden = true;
  ui.scanner.hidden = true;
  document.body.classList.add("ar-active");
  setBusy(true, "Preparing AR experience…");

  try {
    assertBrowserSupport();
    await assertAssetsReady();
    const { ARExperience } = await import("./ar/arExperience.js");

    experience = new ARExperience({
      container: ui.arContainer,
      imageTargetSrc: TARGETS_FILE,
      targets: targetDefinitions,
      onTargetStateChange: (hasVisibleTarget) => {
        ui.scanner.hidden = hasVisibleTarget;
      },
    });

    await experience.unlockMedia();
    setBusy(true, "Loading camera…");
    await experience.start();
    setBusy(false);
    ui.scanner.hidden = false;
    ui.soundButton.hidden = false;
  } catch (error) {
    console.error("[AR] Initialization failed:", error);
    await experience?.stop();
    experience = null;
    ui.soundButton.hidden = true;

    if (error.message === "TARGET_CONFIG_EMPTY") {
      showError("AR content is not configured", "Add target/video entries in src/ar/targets.js, then try again.");
    } else if (error.message === "TARGET_FILE_MISSING") {
      showError("Tracking file is missing", "Place the compiled targets.mind file in public/assets/targets, then try again.");
    } else if (error.message === "SECURE_CONTEXT_REQUIRED") {
      showError("Secure connection required", "Open this experience over HTTPS, or use localhost during development.");
    } else if (error.message === "UNSUPPORTED_BROWSER") {
      showError("Browser not supported", "Use a modern version of Safari or Chrome on a camera-equipped device.");
    } else {
      const friendly = getFriendlyError(error);
      showError(friendly.title, friendly.message);
    }
  }
};

ui.startButton.addEventListener("click", startExperience);
ui.retryButton.addEventListener("click", startExperience);
ui.soundButton.addEventListener("click", async () => {
  if (!experience) return;
  isAudioEnabled = !isAudioEnabled;
  updateSoundButton();
  await experience.setAudioEnabled(isAudioEnabled);
});

updateSoundButton();

window.addEventListener("pagehide", () => {
  experience?.stop();
  experience = null;
});
