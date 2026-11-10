// Popup choreography. popup.js only calls playState(name) with a named state;
// every animation detail (springs, avatar poses, tilt, confetti) lives here.
//
// Layers (outer to inner), so each transform is owned by exactly one thing:
//   .stage          pointer tilt / idle sway (CSS variables, set per frame)
//   .avatar-stage   parallax offset (CSS `translate` property)
//   .avatar-breathe idle breathing loop
//   .avatar-body    state animations (bounce, squash, wobble) + ring
//   .avatar-flip    static scaleX(-1) mirror, never animated
//   img.pose        stacked poses, crossfaded with opacity only (no src swaps)
import { animate, spring, stagger } from "./vendor/motion-mini.js";

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = reducedMotionQuery.matches;

const TILT_MAX_DEG = 6;
const SWAY_AFTER_MS = 2500;
const END_POSE_DELAY_MS = 1900;
const CONFETTI_COLORS = ["#3b82f6", "#60a5fa", "#10b981", "#c9bd95", "#f5f5f5"];

const els = {};
let poses = [];
let currentPose = "intro";
// Animations and timers owned by the current state; cleared on every state change.
let running = [];
let timers = [];
let stateToken = 0;
let breathing = null;
let confettiFire = null;
let confettiLoading = null;
let initialized = false;

/** Composed avatar transform, always the same function list so WAAPI can interpolate it. */
function T(x = 0, y = 0, rotate = 0, sx = 1, sy = sx) {
  return `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${sx}, ${sy})`;
}

function track(animation) {
  running.push(animation);
}

// Timers are cleared by stopState(), so a later() callback never outlives its state.
function later(ms, fn) {
  timers.push(setTimeout(fn, ms));
}

/** Stops everything the previous state started. Stopping commits the current frame, so the next animation starts from where the last one was. */
function stopState() {
  stateToken++;
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  for (const animation of running) {
    try {
      animation.stop();
    } catch (error) {
      // Already finished or element removed.
    }
  }
  running = [];
}

// Rest transforms; an interrupted state springs back to these unless the next state animates the element itself.
const REST = () => [[els.card, "translateY(0px) scale(1)"], [els.bubble, "scale(1)"], [els.body, T()]];

function settle() {
  if (reduced) return;
  for (const [el, rest] of REST()) {
    if (el && el.style.transform && el.style.transform !== rest) {
      track(animate(el, { transform: rest }, { type: spring, bounce: 0.3, duration: 0.35 }));
    }
  }
}

// ---------- Avatar poses ----------

function isUsable(img) {
  return img && !img.dataset.broken;
}

function setPose(name, { instant = false } = {}) {
  let target = poses.find((img) => img.dataset.pose === name);
  if (!isUsable(target)) target = poses.find((img) => img.dataset.pose === "intro");
  if (!isUsable(target)) target = null;
  currentPose = target ? target.dataset.pose : name;

  for (const img of poses) {
    const show = img === target;
    if (instant) {
      animate(img, { opacity: show ? 1 : 0 }, { duration: 0.001 });
    } else if (show) {
      // Incoming pose fades in on top before the outgoing one leaves: no blank frame.
      animate(img, { opacity: 1 }, { duration: reduced ? 0.15 : 0.18, ease: "easeOut" });
    } else {
      animate(img, { opacity: 0 }, { duration: 0.18, delay: reduced ? 0.05 : 0.1, ease: "easeIn" });
    }
  }
}

function handlePoseError(event) {
  const img = event.target;
  console.error("Avatar failed to load:", img.getAttribute("src"));
  img.dataset.broken = "true";
  img.style.visibility = "hidden";
  if (img.dataset.pose === currentPose) setPose("intro", { instant: true });
}

// ---------- Idle loops ----------

function startBreathing() {
  if (reduced || breathing || !els.breathe) return;
  breathing = animate(
    els.breathe,
    { transform: ["scale(1)", "scale(1.035)"] },
    { duration: 1.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
  );
  if (document.hidden || !document.hasFocus()) breathing.pause();
}

function stopBreathing() {
  if (!breathing) return;
  breathing.cancel();
  breathing = null;
}

// Pointer tilt with an idle sway when the pointer is still or outside the popup.
const tilt = { x: 0, y: 0, targetX: 0, targetY: 0, lastMove: 0, frame: 0, start: performance.now() };

function onPointerMove(event) {
  if (reduced || event.pointerType === "touch") return;
  const nx = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
  tilt.targetY = nx * TILT_MAX_DEG;
  tilt.targetX = -ny * TILT_MAX_DEG;
  tilt.lastMove = performance.now();
  startTilt();
}

function onPointerLeave() {
  tilt.lastMove = 0;
}

// Never runs while reduced or hidden: applyReducedMotion() and pauseIdle() cancel the pending frame.
function tiltFrame(now) {
  tilt.frame = 0;
  if (now - tilt.lastMove > SWAY_AFTER_MS) {
    const t = (now - tilt.start) / 1000;
    tilt.targetY = 2.2 * Math.sin((t * 2 * Math.PI) / 7);
    tilt.targetX = 1.2 * Math.sin((t * 2 * Math.PI) / 9);
  }
  tilt.x += (tilt.targetX - tilt.x) * 0.08;
  tilt.y += (tilt.targetY - tilt.y) * 0.08;
  applyTilt(tilt.x, tilt.y);
  tilt.frame = requestAnimationFrame(tiltFrame);
}

function applyTilt(x, y) {
  if (!els.stage) return;
  const style = els.stage.style;
  style.setProperty("--tilt-x", `${x.toFixed(2)}deg`);
  style.setProperty("--tilt-y", `${y.toFixed(2)}deg`);
  // Parallax: the avatar sits "closer" than the bubble, so it moves further.
  style.setProperty("--parallax-avatar", `${(y * 0.8).toFixed(2)}px ${(-x * 0.6).toFixed(2)}px`);
  style.setProperty("--parallax-bubble", `${(-y * 0.35).toFixed(2)}px ${(x * 0.25).toFixed(2)}px`);
}

// The loop only runs while the popup is visible and focused (a daily window left open in the
// background must not keep writing styles every frame).
function startTilt() {
  if (reduced || document.hidden || !document.hasFocus() || tilt.frame) return;
  tilt.frame = requestAnimationFrame(tiltFrame);
}

function pauseTilt() {
  cancelAnimationFrame(tilt.frame);
  tilt.frame = 0;
}

function stopTilt() {
  pauseTilt();
  tilt.x = tilt.y = tilt.targetX = tilt.targetY = 0;
  applyTilt(0, 0);
}

// ---------- Confetti (loaded on demand, main-thread canvas, no worker) ----------

function loadConfetti() {
  if (reduced) return Promise.resolve(null);
  if (!confettiLoading) {
    confettiLoading = import("./vendor/confetti.js")
      .then(({ create }) => {
        const canvas = document.createElement("canvas");
        canvas.className = "confetti-canvas";
        canvas.setAttribute("aria-hidden", "true");
        document.body.append(canvas);
        confettiFire = create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
        return confettiFire;
      })
      .catch((error) => {
        console.warn("Confetti unavailable:", error.message);
        return null;
      });
  }
  return confettiLoading;
}

async function burstConfetti() {
  const token = stateToken;
  const fire = await loadConfetti();
  if (!fire || reduced || token !== stateToken || !els.avatar) return;
  const rect = els.avatar.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height * 0.3) / window.innerHeight
  };
  const shared = { origin, colors: CONFETTI_COLORS, disableForReducedMotion: true, scalar: 0.8, ticks: 170, gravity: 0.9 };
  fire({ ...shared, particleCount: 40, angle: 120, spread: 70, startVelocity: 32 });
  later(140, () => fire({ ...shared, particleCount: 18, angle: 75, spread: 50, startVelocity: 24 }));
}

// ---------- States ----------

const SPRING_SOFT = { type: spring, bounce: 0.3, duration: 0.6 };
const SPRING_BOUNCY = { type: spring, bounce: 0.5, duration: 0.7 };
const FADE = { duration: 0.2, ease: "easeOut" };

function revealCard() {
  document.documentElement.classList.remove("pre-intro");
}

/**
 * Opacity fades always run to completion (never tracked/stopped): stopping one
 * would commit a half-faded value and leave text invisible.
 */
function fadeIn(el, { from = 0, delay = 0 } = {}) {
  if (el) animate(el, { opacity: [from, 1] }, { ...FADE, delay });
}

const states = {
  intro({ pose = "intro" } = {}) {
    setPose(pose, { instant: true });
    revealCard();
    if (reduced) {
      fadeIn(els.card);
      return;
    }
    fadeIn(els.card);
    track(animate(els.card, { transform: ["translateY(18px) scale(0.96)", "translateY(0px) scale(1)"] }, SPRING_SOFT));
    track(animate(els.body, { transform: [T(0, 12, -10, 0.3), T()] }, { ...SPRING_BOUNCY, delay: 0.12 }));
    fadeIn(els.bubble, { delay: 0.22 });
    track(animate(els.bubble, { transform: ["scale(0.7)", "scale(1)"] }, { type: spring, bounce: 0.4, duration: 0.55, delay: 0.22 }));
    const buttons = els.buttons ? els.buttons.querySelectorAll(".button") : [];
    const delayFor = stagger(0.07, { startDelay: 0.32 });
    buttons.forEach((button, i) => {
      const delay = delayFor(i, buttons.length);
      fadeIn(button, { delay });
      track(animate(button, { transform: ["translateY(12px)", "translateY(0px)"] }, { type: spring, bounce: 0.35, duration: 0.5, delay }));
    });
    // Idle loops are not tied to this state, so a quick "restore" does not cancel them.
    setTimeout(startBreathing, 800);
    startTilt();
  },

  restore({ pose = "intro" } = {}) {
    setPose(pose);
  },

  thinking() {
    if (reduced) {
      setPose("thinking");
      return;
    }
    // Anticipation squash, jump, land; the pose swaps at the top of the jump.
    track(animate(els.body, {
      transform: [T(), T(0, 6, 0, 1.12, 0.86), T(0, -22, 0, 0.92, 1.1), T(0, 0, 0, 1.06, 0.94), T()]
    }, { duration: 0.75, times: [0, 0.22, 0.5, 0.78, 1], ease: ["easeOut", "easeOut", "easeIn", "easeOut"] }));
    later(170, () => setPose("thinking"));
    // Then ponder: a slow head tilt until the joke arrives.
    later(780, () => {
      track(animate(els.body, { transform: [T(), T(0, 0, -4)] }, {
        duration: 1.1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut"
      }));
    });
    track(animate(els.bubble, { transform: ["scale(0.96)", "scale(1)"] }, { type: spring, bounce: 0.5, duration: 0.45 }));
  },

  again() {
    if (reduced) {
      setPose("thinking");
      fadeIn(els.bubble);
      return;
    }
    fadeIn(els.bubble, { from: 0.4 });
    track(animate(els.bubble, { transform: ["scale(0.88)", "scale(1)"] }, { type: spring, bounce: 0.45, duration: 0.5 }));
    // Same hop as "thinking", without restarting the bubble pulse.
    track(animate(els.body, {
      transform: [T(), T(0, 5, 0, 1.1, 0.88), T(0, -18, 6, 0.94, 1.08), T(0, 0, 0, 1.04, 0.96), T()]
    }, { duration: 0.7, times: [0, 0.22, 0.5, 0.78, 1], ease: ["easeOut", "easeOut", "easeIn", "easeOut"] }));
    later(160, () => setPose("thinking"));
    later(720, () => {
      track(animate(els.body, { transform: [T(), T(0, 0, -4)] }, {
        duration: 1.1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut"
      }));
    });
  },

  setup() {
    setPose("intro");
    loadConfetti();
    if (reduced) {
      fadeIn(els.bubble);
      return;
    }
    // Bubble springs out of its tail (bottom right, next to the avatar).
    fadeIn(els.bubble);
    track(animate(els.bubble, { transform: ["scale(0.72)", "scale(1)"] }, { type: spring, bounce: 0.45, duration: 0.55 }));
    track(animate(els.body, { transform: [T(0, 4, 3, 1.04, 0.96), T()] }, SPRING_BOUNCY));
  },

  cue() {
    setPose("pointing");
    if (reduced) return;
    // Lean toward the bubble and spring back.
    track(animate(els.body, {
      transform: [T(), T(-10, -6, -8, 1.06), T(2, 0, 2, 0.98), T()]
    }, { duration: 0.6, times: [0, 0.35, 0.7, 1], ease: ["easeOut", "easeInOut", "easeOut"] }));
  },

  punch() {
    setPose("lol");
    if (reduced) {
      later(END_POSE_DELAY_MS, () => setPose("coolguy"));
      return;
    }
    track(animate(els.bubble, { transform: ["scale(1.07)", "scale(1)"] }, { type: spring, bounce: 0.55, duration: 0.5 }));
    track(animate(els.body, {
      transform: [T(0, 0, 0, 1.12, 0.9), T(0, -10, -6, 1.04), T(0, -4, 6, 1.04), T(0, -2, -5), T(0, 0, 4), T(0, 0, -2), T()]
    }, { duration: 0.85, times: [0, 0.15, 0.32, 0.5, 0.66, 0.82, 1], ease: "easeInOut" }));
    later(60, burstConfetti);
    later(END_POSE_DELAY_MS, () => {
      setPose("coolguy");
      track(animate(els.body, { transform: [T(0, -6, 0, 1.04), T()] }, SPRING_BOUNCY));
    });
  },

  error() {
    setPose("intro");
    if (reduced) {
      fadeIn(els.bubble);
      return;
    }
    track(animate(els.body, {
      transform: [T(), T(-7), T(7), T(-5), T(5), T(-2), T()]
    }, { duration: 0.55, ease: "easeInOut" }));
    track(animate(els.bubble, { transform: ["scale(0.94)", "scale(1)"] }, { type: spring, bounce: 0.5, duration: 0.45 }));
  }
};

/**
 * Plays a named popup state: intro, restore, thinking, again, setup, cue, punch, error.
 * Starting a state cancels whatever the previous one was doing.
 */
export function playState(name, options) {
  if (!initialized) init();
  const state = states[name];
  if (!state) {
    console.warn("Unknown popup state:", name);
    return;
  }
  // "restore" only swaps the pose; it must not cut the intro short.
  if (name !== "restore") {
    stopState();
    settle();
  }
  try {
    state(options);
  } catch (error) {
    // Animation must never break the joke flow.
    console.error(`Popup state "${name}" failed:`, error);
    revealCard();
  }
}

/** Springs a freshly rendered action button into place. */
export function buttonIn(button) {
  if (!button) return;
  fadeIn(button);
  if (reduced) return;
  animate(button, { transform: ["translateY(10px) scale(0.96)", "translateY(0px) scale(1)"] }, { type: spring, bounce: 0.4, duration: 0.45 });
}

// ---------- Press feedback ----------

const PRESSABLE = ".button, .close-button";

function pressDown(event) {
  const target = event.target.closest(PRESSABLE);
  if (!target || target.disabled || reduced) return;
  animate(target, { transform: "scale(0.94)" }, { duration: 0.1, ease: "easeOut" });
}

function pressUp(event) {
  const target = event.target.closest(PRESSABLE);
  if (!target || reduced) return;
  animate(target, { transform: "scale(1)" }, { type: spring, bounce: 0.6, duration: 0.45 });
}

function keyboardPress(event) {
  // Enter/Space activation fires click with detail 0: give it the same spring.
  if (event.detail !== 0 || reduced) return;
  const target = event.target.closest(PRESSABLE);
  if (!target || !target.isConnected) return;
  animate(target, { transform: ["scale(0.94)", "scale(1)"] }, { type: spring, bounce: 0.6, duration: 0.45 });
}

// ---------- Setup ----------

function applyReducedMotion(isReduced) {
  reduced = isReduced;
  if (reduced) {
    stopState();
    stopBreathing();
    stopTilt();
    for (const el of [els.card, els.body, els.bubble]) {
      if (el) {
        animate(el, { transform: "none", opacity: 1 }, { duration: 0.001 });
      }
    }
    if (confettiFire) confettiFire.reset();
    setPose(currentPose, { instant: true });
  } else {
    startBreathing();
    startTilt();
  }
}

function init() {
  initialized = true;
  els.card = document.querySelector(".popup-container");
  els.stage = document.querySelector(".stage");
  els.bubble = document.getElementById("joke-container");
  els.avatar = document.querySelector(".avatar-stage");
  els.breathe = document.querySelector(".avatar-breathe");
  els.body = document.querySelector(".avatar-body");
  els.buttons = document.querySelector(".button-container");
  poses = Array.from(document.querySelectorAll(".pose"));

  for (const img of poses) {
    img.addEventListener("error", handlePoseError);
    // The error may already have fired before this module ran.
    if (img.complete && img.naturalWidth === 0) handlePoseError({ target: img });
  }

  document.addEventListener("pointerdown", pressDown);
  document.addEventListener("pointerup", pressUp);
  document.addEventListener("pointercancel", pressUp);
  document.addEventListener("pointerout", (event) => {
    // Release only when the pointer leaves the pressable itself, not when it moves between its children.
    const target = event.target.closest && event.target.closest(PRESSABLE);
    if (target && !target.contains(event.relatedTarget)) pressUp(event);
  });
  document.addEventListener("click", keyboardPress, true);
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);

  const pauseIdle = () => {
    if (breathing) breathing.pause();
    pauseTilt();
  };
  const resumeIdle = () => {
    if (breathing && !document.hidden) breathing.play();
    startTilt();
  };
  window.addEventListener("blur", pauseIdle);
  window.addEventListener("focus", resumeIdle);
  document.addEventListener("visibilitychange", () => (document.hidden ? pauseIdle() : resumeIdle()));

  reducedMotionQuery.addEventListener("change", (event) => applyReducedMotion(event.matches));
}
