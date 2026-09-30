import * as THREE from "./assets/vendor/three.module.js";
import { createCity } from "./city-world.js?v=20s-2";
import { DURATION, STATIC_TIME, STORY, cameraAt } from "./city-flight.js?v=20s-2";

const host = document.querySelector(".city-intro");
const backdrop = document.querySelector(".city-backdrop");
const canvas = document.querySelector("#city-canvas");
const scrim = document.querySelector(".city-info-scrim");
const controls = document.querySelector(".city-controls");
const pauseButton = document.querySelector("[data-city-pause]");
const replayButton = document.querySelector("[data-city-replay]");
const endcard = document.querySelector(".city-endcard");
const scrollCue = document.querySelector(".scroll-cue");
const chapter = document.querySelector("[data-chapter]");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: false, alpha: false, powerPreference: "high-performance"});
} catch {
  host.dataset.status = "fallback";
}
if (renderer) startCity();

async function startCity() {
  const world = createCity(renderer), camera = world.camera;
  world.resize(backdrop.clientWidth, backdrop.clientHeight);
  await world.prepare();
  const position = new THREE.Vector3(), look = new THREE.Vector3(), offset = new THREE.Vector3();
  const travelPosition = new THREE.Vector3(), travelLook = new THREE.Vector3();
  let elapsed = 0, ambient = 0, previous = 0, frame = 0, userPaused = false, contextLost = false;
  let scrollPosition = Math.max(0, scrollY / innerHeight), exitTime = 0, lastDraw = 0;
  let metricsStart = 0, metricsFrames = 0;
  const smooth = (x) => x ** 4 * (35 - 84 * x + 70 * x * x - 20 * x ** 3);

  function setCamera(story, opening) {
    const pose = cameraAt(scrollPosition > .001 ? exitTime : story, camera.aspect);
    if (camera.fov !== pose.fov) {camera.fov = pose.fov; camera.updateProjectionMatrix();}
    position.fromArray(pose.position); look.fromArray(pose.look);
    const extra = Math.max(0, 1.5 / camera.aspect - 1);
    if (opening > 0) {
      const journey = reducedMotion.matches ? 0 : Math.max(0, scrollPosition - 1) * 17;
      travelPosition.set(0, 31, 73 - journey); travelLook.set(0, 24, -104 - journey);
      offset.copy(travelPosition).sub(travelLook); offset.y = 0;
      travelPosition.addScaledVector(offset.normalize(), Math.min(12, extra * 12));
      position.lerp(travelPosition, opening); look.lerp(travelLook, opening);
    }
    camera.position.copy(position); camera.lookAt(look);
  }
  function render() {
    const story = (reducedMotion.matches ? STATIC_TIME : elapsed) % DURATION;
    const opening = reducedMotion.matches ? (scrollPosition > .15 ? 1 : 0) : smooth(Math.min(1, scrollPosition));
    setCamera(story, opening); world.setOpening(opening);
    const enter = smooth(THREE.MathUtils.clamp((story - STORY.revealStart + STORY.fade) / STORY.fade, 0, 1));
    const exit = 1 - smooth(THREE.MathUtils.clamp((story - STORY.revealEnd) / STORY.fade, 0, 1));
    const brand = enter * exit * (1 - opening);
    endcard.style.opacity = String(brand);
    endcard.style.transform = "translate(-50%,-50%) scale(" + (.98 + .02 * brand) + ")";
    scrollCue.style.setProperty("--cue-morph", String(brand));
    scrim.style.opacity = String(opening);
    host.classList.toggle("city-finished", story >= STORY.revealStart - .1 && story <= STORY.revealEnd + STORY.fade);
    const index = story < (STORY.reads[0] + STORY.reads[1]) / 2 || story >= STORY.revealEnd + 1.8 ? 0
      : story < (STORY.reads[1] + STORY.reads[2]) / 2 ? 1 : story < STORY.revealStart - 1.9 ? 2 : 3;
    host.dataset.scene = ["product", "agent", "growth", "andy"][index];
    host.dataset.elapsed = story.toFixed(2); host.dataset.cycles = String(Math.floor(elapsed / DURATION));
    host.dataset.paused = String(userPaused); host.dataset.duration = String(DURATION);
    backdrop.dataset.travel = scrollPosition.toFixed(3);
    const chapterText = String(Math.min(3, index + 1)).padStart(2, "0");
    if (chapter.textContent !== chapterText) chapter.textContent = chapterText;
    world.render(reducedMotion.matches ? STATIC_TIME : ambient, story);
    host.dataset.status = "ready";
  }
  function resize() {
    scrollPosition = Math.max(0, scrollY / innerHeight);
    world.resize(backdrop.clientWidth, backdrop.clientHeight); render();
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || userPaused || contextLost || reducedMotion.matches) return;
    // A decoding/upload or browser task must not teleport the camera on its
    // next frame. Normal 60/30 Hz frames still advance at their real cadence.
    const delta = previous ? Math.min(Math.max((now - previous) / 1000, 0), .05) : 0;
    previous = now; ambient += delta;
    if (scrollPosition < .01) elapsed += delta;
    // Reading pages use a lower background rate; scrolling always renders immediately.
    if (scrollPosition < 1 || now - lastDraw >= 1000 / 24) {
      render(); lastDraw = now; metricsFrames++;
      if (!metricsStart) metricsStart = now;
      if (now - metricsStart >= 1500) {
        host.dataset.fps = (metricsFrames * 1000 / (now - metricsStart)).toFixed(1);
        metricsStart = now; metricsFrames = 0;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0; metricsStart = 0; metricsFrames = 0;
    if (contextLost) return;
    controls.hidden = reducedMotion.matches;
    host.dataset.playback = reducedMotion.matches ? "reduced" : userPaused ? "paused" : document.hidden ? "background" : "playing";
    if (reducedMotion.matches) render();
    else if (!userPaused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function syncButton() {
    pauseButton.setAttribute("aria-label", userPaused ? "继续城市动画" : "暂停城市动画");
    pauseButton.title = userPaused ? "继续动画" : "暂停动画";
    pauseButton.innerHTML = userPaused ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5L15 10l-8 5.5z" /></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg>';
  }
  pauseButton.addEventListener("click", () => {
    userPaused = !userPaused; host.dataset.paused = String(userPaused); syncButton(); syncPlayback();
  });
  replayButton.addEventListener("click", () => {
    elapsed = 0; userPaused = false; syncButton(); render(); syncPlayback();
  });
  window.addEventListener("scroll", () => {
    const next = Math.max(0, scrollY / innerHeight);
    if (scrollPosition < .01 && next >= .01) exitTime = elapsed % DURATION;
    scrollPosition = next;
    if (!contextLost) render();
  }, {passive: true});
  new ResizeObserver(resize).observe(backdrop);
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pageshow", syncPlayback);
  reducedMotion.addEventListener("change", syncPlayback);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault(); contextLost = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; host.classList.remove("city-ready"); backdrop.classList.remove("is-ready");
    host.dataset.status = "fallback"; controls.hidden = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false; resize(); host.classList.add("city-ready"); backdrop.classList.add("is-ready"); syncPlayback();
  });
  resize(); host.classList.add("city-ready"); backdrop.classList.add("is-ready");
  syncButton(); syncPlayback();
  world.artworkReady.then(loaded => {
    host.dataset.artwork = loaded.every(Boolean) ? "ready" : "partial";
    if (!contextLost) render();
  });
}
