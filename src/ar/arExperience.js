import * as THREE from "three";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

const waitForVideoMetadata = (video) =>
  new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    video.addEventListener("loadedmetadata", resolve, { once: true });
    video.addEventListener("error", () => reject(new Error(`Unable to load video: ${video.src}`)), { once: true });
    video.load();
  });

const createInlineVideo = ({ videoSrc, loop = true }) => {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.loop = loop;
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = false;
  video.preload = "auto";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("disablepictureinpicture", "");
  video.crossOrigin = "anonymous";
  return video;
};

const configureCoverTexture = (texture, videoAspect, targetAspect) => {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if (videoAspect > targetAspect) {
    texture.repeat.set(targetAspect / videoAspect, 1);
    texture.offset.set((1 - texture.repeat.x) / 2, 0);
  } else {
    texture.repeat.set(1, videoAspect / targetAspect);
    texture.offset.set(0, (1 - texture.repeat.y) / 2);
  }
};

const createGlowMaterial = (color) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 glowColor;
      uniform float intensity;
      void main() {
        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edge = 1.0 - smoothstep(0.0, 0.115, edgeDistance);
        float softFill = 0.1 * (1.0 - smoothstep(0.0, 0.5, edgeDistance));
        gl_FragColor = vec4(glowColor, (edge + softFill) * intensity);
      }
    `,
  });

export class ARExperience {
  constructor({ container, imageTargetSrc, targets, onTargetStateChange }) {
    this.container = container;
    this.imageTargetSrc = imageTargetSrc;
    this.targets = targets;
    this.onTargetStateChange = onTargetStateChange;
    this.mindar = null;
    this.media = [];
    this.visibleTargets = new Set();
  }

  async unlockMedia() {
    const videos = this.targets.map(createInlineVideo);
    this.media = videos.map((video) => ({
      video,
      texture: null,
      geometry: null,
      material: null,
      glowGeometry: null,
      glowMaterial: null,
      glowMesh: null,
      videoMesh: null,
      anchor: null,
      targetPosition: new THREE.Vector3(),
      targetQuaternion: new THREE.Quaternion(),
      targetScale: new THREE.Vector3(1, 1, 1),
      smoothedPosition: new THREE.Vector3(),
      smoothedQuaternion: new THREE.Quaternion(),
      smoothedScale: new THREE.Vector3(1, 1, 1),
      transformReady: false,
      foundAt: 0,
      active: false,
    }));

    await Promise.allSettled(
      videos.map(async (video) => {
        try {
          await video.play();
          video.pause();
          video.currentTime = 0;
        } catch {
          // Muted playback normally succeeds after the Start button gesture.
          // A second attempt is made when its target is found.
        }
      }),
    );
  }

  async setAudioEnabled(enabled) {
    await Promise.allSettled(
      this.media.map(async (item) => {
        const { video } = item;
        video.muted = !enabled;
        video.defaultMuted = !enabled;

        if (!enabled) return;

        if (item.active) {
          video.volume = 1;
          await video.play();
          return;
        }

        // Prime unmuted playback inside the sound-button gesture so iOS can
        // play with audio later when the target is detected.
        video.volume = 0;
        await video.play();
        // A target may be found while this asynchronous unlock is running.
        // Never let the priming path pause a video that just became active.
        if (!item.active) {
          video.pause();
          video.currentTime = 0;
        }
        video.volume = 1;
      }),
    );
  }

  async start() {
    this.mindar = new MindARThree({
      container: this.container,
      imageTargetSrc: this.imageTargetSrc,
      // All compiled targets remain recognizable, but only one is tracked at
      // once. This reduces mobile CPU/GPU pressure and improves pose stability.
      maxTrack: 1,
      // Moderate adaptive smoothing keeps small pose changes steady while
      // still allowing larger movements to catch up without visible drift.
      filterMinCF: 0.001,
      filterBeta: 100,
      warmupTolerance: 5,
      missTolerance: 5,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no",
    });

    const { renderer, scene, camera } = this.mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = "transparent";

    await Promise.all(
      this.targets.map(async (definition, position) => {
        const mediaItem = this.media[position];
        const { video } = mediaItem;
        await waitForVideoMetadata(video);

        const videoAspectRatio = video.videoWidth / video.videoHeight || 16 / 9;
        const targetAspectRatio = definition.targetAspectRatio ?? videoAspectRatio;
        const planeWidth = definition.width ?? 1;
        const planeHeight = planeWidth / targetAspectRatio;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        configureCoverTexture(texture, videoAspectRatio, targetAspectRatio);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          toneMapped: false,
          transparent: true,
          opacity: 0,
        });
        const plane = new THREE.Mesh(geometry, material);
        plane.position.z = 0.003;

        const glowGeometry = new THREE.PlaneGeometry(planeWidth * 1.035, planeHeight * 1.06);
        const glowMaterial = createGlowMaterial(definition.glowColor ?? "#21d7ff");
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.z = 0.001;
        glowMesh.visible = false;

        const anchor = this.mindar.addAnchor(definition.targetIndex);
        anchor.group.add(glowMesh);
        anchor.group.add(plane);

        anchor.onTargetFound = async () => {
          mediaItem.active = true;
          mediaItem.foundAt = performance.now();
          anchor.group.matrix.decompose(
            mediaItem.smoothedPosition,
            mediaItem.smoothedQuaternion,
            mediaItem.smoothedScale,
          );
          mediaItem.targetPosition.copy(mediaItem.smoothedPosition);
          mediaItem.targetQuaternion.copy(mediaItem.smoothedQuaternion);
          mediaItem.targetScale.copy(mediaItem.smoothedScale);
          mediaItem.transformReady = true;
          material.opacity = 0;
          glowMesh.visible = true;
          this.visibleTargets.add(definition.targetIndex);
          this.onTargetStateChange?.(this.visibleTargets.size > 0);
          try {
            await video.play();
          } catch (error) {
            console.warn(`[AR] Video ${definition.videoSrc} could not autoplay.`, error);
          }
        };

        anchor.onTargetLost = () => {
          mediaItem.active = false;
          mediaItem.transformReady = false;
          material.opacity = 0;
          glowMaterial.uniforms.intensity.value = 0;
          glowMesh.visible = false;
          this.visibleTargets.delete(definition.targetIndex);
          video.pause();
          this.onTargetStateChange?.(this.visibleTargets.size > 0);
        };

        anchor.onTargetUpdate = () => {
          if (!mediaItem.active) return;
          anchor.group.matrix.decompose(
            mediaItem.targetPosition,
            mediaItem.targetQuaternion,
            mediaItem.targetScale,
          );
        };

        Object.assign(mediaItem, {
          texture,
          geometry,
          material,
          glowGeometry,
          glowMaterial,
          glowMesh,
          videoMesh: plane,
          anchor,
        });
      }),
    );

    await this.mindar.start();
    let previousFrameTime = performance.now();
    renderer.setAnimationLoop((time) => {
      const frameTime = Math.min(Math.max(time - previousFrameTime, 8), 50);
      previousFrameTime = time;

      this.media.forEach((item, index) => {
        if (!item.active) return;

        const definition = this.targets[index];
        if (item.transformReady) {
          const smoothingTime = definition.poseSmoothingMs ?? 100;
          const baseAlpha = 1 - Math.exp(-frameTime / smoothingTime);
          const averageScale = Math.max(
            (Math.abs(item.targetScale.x) + Math.abs(item.targetScale.y) + Math.abs(item.targetScale.z)) / 3,
            0.001,
          );
          const normalizedPositionError = item.smoothedPosition.distanceTo(item.targetPosition) / averageScale;
          const rotationError = item.smoothedQuaternion.angleTo(item.targetQuaternion);
          const movementAmount = Math.min(
            1,
            Math.max(normalizedPositionError / 0.04, rotationError / 0.12),
          );
          const catchUpAlpha = Math.min(0.68, baseAlpha * 3);
          const alpha = THREE.MathUtils.lerp(baseAlpha, catchUpAlpha, movementAmount);

          item.smoothedPosition.lerp(item.targetPosition, alpha);
          item.smoothedQuaternion.slerp(item.targetQuaternion, alpha);
          item.smoothedScale.lerp(item.targetScale, alpha);
          item.anchor.group.matrix.compose(
            item.smoothedPosition,
            item.smoothedQuaternion,
            item.smoothedScale,
          );
        }

        const elapsed = time - item.foundAt;
        const glowDuration = definition.glowDurationMs ?? 1000;
        const videoDelay = definition.videoDelayMs ?? 600;
        const glowProgress = Math.min(elapsed / glowDuration, 1);
        const pulse = 0.72 + Math.sin(elapsed * 0.018) * 0.28;
        item.glowMaterial.uniforms.intensity.value = (1 - glowProgress) * pulse;
        item.glowMesh.visible = glowProgress < 1;
        item.material.opacity = THREE.MathUtils.smoothstep(elapsed, videoDelay, videoDelay + 350);
      });
      renderer.render(scene, camera);
    });
  }

  async stop() {
    if (this.mindar) {
      this.mindar.renderer.setAnimationLoop(null);
      this.mindar.stop();
      this.mindar.renderer.dispose();
    }

    this.media.forEach(({ video, texture, geometry, material, glowGeometry, glowMaterial }) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      glowGeometry?.dispose();
      glowMaterial?.dispose();
    });

    this.media = [];
    this.visibleTargets.clear();
    this.container.replaceChildren();
    this.mindar = null;
  }
}
