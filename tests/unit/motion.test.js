import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchMediaState } from "./setup.js";

// The vendored libraries are replaced with recorders: these tests cover the choreography
// (which element animates when, and what gets cancelled), not the libraries themselves.
const lib = vi.hoisted(() => ({ animations: [], confettiFails: false, fire: null, gate: null }));

vi.mock("../../vendor/motion-mini.js", () => ({
  spring: "spring",
  stagger: (step, { startDelay }) => (i) => startDelay + i * step,
  animate: vi.fn((el, keyframes, options) => {
    const controls = {
      el,
      keyframes,
      options,
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    lib.animations.push(controls);
    return controls;
  })
}));

// Registered per load() with vi.doMock: an evaluated mock module is otherwise reused across
// vi.resetModules(). Loading waits on lib.gate so tests can change state while it "downloads".
function mockConfetti() {
  vi.doMock("../../vendor/confetti.js", async () => {
    await lib.gate.promise;
    if (lib.confettiFails) throw new Error("chunk failed");
    return {
      create: vi.fn(() => {
        lib.fire = vi.fn();
        lib.fire.reset = vi.fn();
        return lib.fire;
      })
    };
  });
}

// Vitest runs from the repository root.
const HTML = readFileSync(resolve("popup.html"), "utf8");

let motion;
let frames;
let now;
let hidden;
let focused;

function mountDom() {
  const doc = new DOMParser().parseFromString(HTML, "text/html");
  document.documentElement.className = doc.documentElement.className;
  document.body.innerHTML = doc.body.innerHTML;
  document.body.querySelectorAll("script").forEach((s) => s.remove());
}

async function load({ reduced = false, prepare } = {}) {
  vi.resetModules();
  mockConfetti();
  lib.animations.length = 0;
  lib.fire = null;
  mountDom();
  matchMediaState.reduced = reduced;
  if (prepare) prepare();
  motion = await import("../../motion.js");
}

const $ = (sel) => document.querySelector(sel);
const el = {
  card: () => $(".popup-container"),
  bubble: () => $("#joke-container"),
  body: () => $(".avatar-body"),
  breathe: () => $(".avatar-breathe"),
  stage: () => $(".stage"),
  pose: (name) => $(`.pose[data-pose="${name}"]`)
};
const animsOn = (node) => lib.animations.filter((a) => a.el === node);
const lastOpacity = (node) => animsOn(node).filter((a) => "opacity" in a.keyframes).at(-1)?.keyframes.opacity;
const visiblePose = () => ["intro", "thinking", "lol", "coolguy", "pointing"].filter((p) => lastOpacity(el.pose(p)) === 1);
const runFrame = (t) => {
  now = t;
  const queued = frames.splice(0);
  queued.forEach(([, fn]) => fn(t));
};

function pointer(type, target, props = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "mouse", clientX: 0, clientY: 0, relatedTarget: null, ...props });
  target.dispatchEvent(event);
  return event;
}

// The document outlives each fresh module instance, so remove the listeners init() adds.
let added;
function trackListeners(target) {
  const original = target.addEventListener;
  vi.spyOn(target, "addEventListener").mockImplementation(function (...args) {
    added.push([target, args]);
    return original.apply(this, args);
  });
}

// Lets the gated confetti import resolve and the burst run.
async function releaseConfetti() {
  lib.gate.resolve();
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  added = [];
  trackListeners(document);
  trackListeners(window);
  trackListeners(document.documentElement);
  lib.gate = Promise.withResolvers();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  frames = [];
  now = 0;
  hidden = false;
  focused = true;
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((fn) => (frames.push([++id, fn]), id)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((handle) => (frames = frames.filter(([fid]) => fid !== handle))));
  vi.spyOn(performance, "now").mockImplementation(() => now);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  lib.confettiFails = false;
});

afterEach(async () => {
  // Never leave a gated import pending into the next test.
  lib.gate.resolve();
  await vi.dynamicImportSettled();
  for (const [target, args] of added) target.removeEventListener(...args);
  vi.useRealTimers();
  delete document.hidden;
});

describe("playState basics", () => {
  it("initialises once, binding pose error handlers and document listeners", async () => {
    await load();
    const add = vi.spyOn(document, "addEventListener");
    motion.playState("intro");
    motion.playState("setup");
    expect(add.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
  });

  it("warns on an unknown state and does nothing else", async () => {
    await load();
    motion.playState("nope");
    expect(console.warn).toHaveBeenCalledWith("Unknown popup state:", "nope");
  });

  it("reveals the card and logs if a state throws", async () => {
    await load();
    const { animate } = await import("../../vendor/motion-mini.js");
    animate.mockImplementationOnce(() => {
      throw new Error("WAAPI missing");
    });
    motion.playState("intro");
    expect(console.error).toHaveBeenCalledWith('Popup state "intro" failed:', expect.any(Error));
    expect(document.documentElement.classList.contains("pre-intro")).toBe(false);
  });
});

describe("intro", () => {
  it("reveals the card and springs card, avatar, bubble and buttons in", async () => {
    await load();
    motion.playState("intro");
    expect(document.documentElement.classList.contains("pre-intro")).toBe(false);
    expect(visiblePose()).toEqual(["intro"]);
    for (const node of [el.card(), el.body(), el.bubble()]) expect(animsOn(node).some((a) => "transform" in a.keyframes)).toBe(true);
    const buttons = document.querySelectorAll(".button-container .button");
    const delays = [...buttons].map((b) => animsOn(b).find((a) => "transform" in a.keyframes).options.delay);
    expect(delays[0]).toBeCloseTo(0.32);
    expect(delays[1]).toBeCloseTo(0.39);
  });

  it("starts breathing after 800 ms and the tilt loop right away", async () => {
    await load();
    motion.playState("intro");
    expect(frames).toHaveLength(1);
    expect(animsOn(el.breathe())).toHaveLength(0);
    vi.advanceTimersByTime(800);
    const breathing = animsOn(el.breathe())[0];
    expect(breathing.options.repeat).toBe(Infinity);
    expect(breathing.pause).not.toHaveBeenCalled();
  });

  it("starts breathing paused when the window is hidden or unfocused", async () => {
    await load();
    motion.playState("intro");
    focused = false;
    vi.advanceTimersByTime(800);
    expect(animsOn(el.breathe())[0].pause).toHaveBeenCalled();
  });

  it("starts breathing paused when the document is hidden", async () => {
    await load();
    motion.playState("intro");
    hidden = true;
    vi.advanceTimersByTime(800);
    expect(animsOn(el.breathe())[0].pause).toHaveBeenCalled();
  });

  it("accepts a starting pose", async () => {
    await load();
    motion.playState("intro", { pose: "coolguy" });
    expect(visiblePose()).toEqual(["coolguy"]);
  });

  it("only fades the card under reduced motion", async () => {
    await load({ reduced: true });
    motion.playState("intro");
    expect(animsOn(el.card()).map((a) => Object.keys(a.keyframes))).toEqual([["opacity"]]);
    expect(animsOn(el.body())).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(animsOn(el.breathe())).toHaveLength(0);
    expect(frames).toHaveLength(0);
  });
});

describe("state transitions", () => {
  it("restore swaps the pose without stopping the intro", async () => {
    await load();
    motion.playState("intro");
    const introAnims = [...lib.animations];
    motion.playState("restore", { pose: "pointing" });
    expect(visiblePose()).toEqual(["pointing"]);
    expect(introAnims.every((a) => a.stop.mock.calls.length === 0)).toBe(true);
    motion.playState("restore");
    expect(visiblePose()).toEqual(["intro"]);
  });

  it("a new state stops the previous state's animations and timers", async () => {
    await load();
    motion.playState("thinking");
    const hop = animsOn(el.body())[0];
    motion.playState("setup");
    expect(hop.stop).toHaveBeenCalled();
    // The thinking timers (pose swap at 170 ms, ponder at 780 ms) never fire.
    vi.advanceTimersByTime(1000);
    expect(visiblePose()).toEqual(["intro"]);
    expect(animsOn(el.body()).some((a) => a.options.repeat === Infinity)).toBe(false);
  });

  it("ignores errors from stopping an animation that already ended", async () => {
    await load();
    motion.playState("cue");
    animsOn(el.body())[0].stop.mockImplementation(() => {
      throw new Error("detached");
    });
    expect(() => motion.playState("punch")).not.toThrow();
  });

  it("springs an interrupted element back to rest", async () => {
    await load();
    motion.playState("intro");
    el.body().style.transform = "translate(3px, 0px) rotate(0deg) scale(1, 1)";
    el.bubble().style.transform = "scale(1)";
    motion.playState("cue");
    const settle = animsOn(el.body()).find((a) => a.keyframes.transform === "translate(0px, 0px) rotate(0deg) scale(1, 1)");
    expect(settle).toBeDefined();
    // Already at rest: no extra spring for the bubble.
    expect(animsOn(el.bubble()).some((a) => a.keyframes.transform === "scale(1)")).toBe(false);
  });

  it("thinking hops, swaps to the thinking pose, then ponders", async () => {
    await load();
    motion.playState("thinking");
    expect(visiblePose()).toEqual([]);
    vi.advanceTimersByTime(170);
    expect(visiblePose()).toEqual(["thinking"]);
    vi.advanceTimersByTime(610);
    expect(animsOn(el.body()).at(-1).options.repeat).toBe(Infinity);
  });

  it("again hops without the thinking bubble pulse and ponders", async () => {
    await load();
    motion.playState("again");
    vi.advanceTimersByTime(160);
    expect(visiblePose()).toEqual(["thinking"]);
    vi.advanceTimersByTime(560);
    expect(animsOn(el.body()).at(-1).options.repeat).toBe(Infinity);
    expect(lastOpacity(el.bubble())).toEqual([0.4, 1]);
  });

  it("setup springs the bubble and preloads confetti", async () => {
    await load();
    motion.playState("setup");
    expect(visiblePose()).toEqual(["intro"]);
    await releaseConfetti();
    expect(document.querySelector("canvas.confetti-canvas")).not.toBeNull();
  });

  it("cue points at the punchline button", async () => {
    await load();
    motion.playState("cue");
    expect(visiblePose()).toEqual(["pointing"]);
    expect(animsOn(el.body())).toHaveLength(1);
  });

  it("punch laughs, fires two confetti bursts, then settles into the cool pose", async () => {
    await load();
    motion.playState("punch");
    expect(visiblePose()).toEqual(["lol"]);
    await vi.advanceTimersByTimeAsync(60);
    await releaseConfetti();
    expect(lib.fire).toHaveBeenCalledTimes(1);
    expect(lib.fire.mock.calls[0][0]).toMatchObject({ particleCount: 40, disableForReducedMotion: true });
    await vi.advanceTimersByTimeAsync(140);
    expect(lib.fire).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1900);
    expect(visiblePose()).toEqual(["coolguy"]);
  });

  it("error shakes the avatar and shows the intro pose", async () => {
    await load();
    motion.playState("cue");
    motion.playState("error");
    expect(visiblePose()).toEqual(["intro"]);
    expect(animsOn(el.body()).at(-1).keyframes.transform).toHaveLength(7);
  });

  it.each(["thinking", "again", "setup", "cue", "error"])("%s uses only fades and pose swaps under reduced motion", async (name) => {
    await load({ reduced: true });
    motion.playState(name);
    vi.advanceTimersByTime(3000);
    expect(lib.animations.every((a) => !("transform" in a.keyframes))).toBe(true);
  });

  it("punch under reduced motion swaps poses without confetti", async () => {
    await load({ reduced: true });
    motion.playState("punch");
    expect(visiblePose()).toEqual(["lol"]);
    await vi.advanceTimersByTimeAsync(1900);
    expect(visiblePose()).toEqual(["coolguy"]);
    expect(lib.fire).toBeNull();
    expect(lib.animations.every((a) => !("transform" in a.keyframes))).toBe(true);
  });

  it("uses a shorter crossfade under reduced motion", async () => {
    await load({ reduced: true });
    motion.playState("cue");
    expect(animsOn(el.pose("pointing")).at(-1).options.duration).toBe(0.15);
    expect(animsOn(el.pose("intro")).at(-1).options.delay).toBe(0.05);
  });
});

describe("confetti", () => {
  it("is skipped when the state changes before the library loads", async () => {
    await load();
    motion.playState("punch");
    await vi.advanceTimersByTimeAsync(60);
    motion.playState("setup");
    await releaseConfetti();
    await vi.advanceTimersByTimeAsync(200);
    expect(lib.fire).not.toHaveBeenCalled();
  });

  it("is skipped when reduced motion turns on while it loads", async () => {
    await load();
    motion.playState("punch");
    await vi.advanceTimersByTimeAsync(60);
    matchMediaState.emit(true);
    await releaseConfetti();
    await vi.advanceTimersByTimeAsync(200);
    expect(lib.fire).not.toHaveBeenCalled();
  });

  it("is skipped when the avatar is missing", async () => {
    await load({ prepare: () => $(".avatar-stage").remove() });
    motion.playState("punch");
    await vi.advanceTimersByTimeAsync(60);
    await releaseConfetti();
    await vi.advanceTimersByTimeAsync(200);
    expect(lib.fire).not.toHaveBeenCalled();
  });

  it("degrades to no confetti when the module cannot load", async () => {
    lib.confettiFails = true;
    await load();
    motion.playState("punch");
    await vi.advanceTimersByTimeAsync(60);
    await releaseConfetti();
    // Vitest rewraps a throwing mock factory's message; the real browser passes the import error through.
    expect(console.warn).toHaveBeenCalledWith("Confetti unavailable:", expect.any(String));
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("loads the library and creates the canvas only once", async () => {
    await load();
    motion.playState("setup");
    motion.playState("setup");
    await releaseConfetti();
    expect(document.querySelectorAll("canvas.confetti-canvas")).toHaveLength(1);
  });
});

describe("avatar pose fallbacks", () => {
  it("hides a broken pose and falls back to intro when it is requested", async () => {
    await load();
    motion.playState("intro");
    el.pose("lol").dispatchEvent(new Event("error"));
    expect(el.pose("lol").style.visibility).toBe("hidden");
    expect(console.error).toHaveBeenCalledWith("Avatar failed to load:", "images/lol.png");
    motion.playState("punch");
    expect(visiblePose()).toEqual(["intro"]);
  });

  it("switches to intro immediately when the visible pose breaks", async () => {
    await load();
    motion.playState("cue");
    el.pose("pointing").dispatchEvent(new Event("error"));
    expect(visiblePose()).toEqual(["intro"]);
    expect(animsOn(el.pose("intro")).at(-1).options.duration).toBe(0.001);
  });

  it("catches a pose that failed before the module ran", async () => {
    await load({
      prepare: () => {
        const img = el.pose("thinking");
        Object.defineProperty(img, "complete", { get: () => true });
        Object.defineProperty(img, "naturalWidth", { get: () => 0 });
      }
    });
    motion.playState("intro");
    expect(el.pose("thinking").dataset.broken).toBe("true");
    motion.playState("thinking");
    vi.advanceTimersByTime(200);
    expect(visiblePose()).toEqual(["intro"]);
  });

  it("hides every pose when intro is broken too", async () => {
    await load();
    motion.playState("intro");
    el.pose("intro").dispatchEvent(new Event("error"));
    el.pose("pointing").dispatchEvent(new Event("error"));
    motion.playState("cue");
    expect(visiblePose()).toEqual([]);
  });
});

describe("pointer tilt and idle sway", () => {
  const vars = () => {
    const s = el.stage().style;
    return [s.getPropertyValue("--tilt-x"), s.getPropertyValue("--tilt-y")];
  };

  it("eases toward the pointer, clamped to the max tilt", async () => {
    await load();
    motion.playState("intro");
    window.innerWidth = 400;
    window.innerHeight = 600;
    now = 100;
    pointer("pointermove", document.body, { clientX: 800, clientY: -50 });
    // Stay inside the 2.5 s window before the idle sway takes over.
    for (let t = 116; t < 2500; t += 16) runFrame(t);
    const [x, y] = vars().map(parseFloat);
    expect(y).toBeCloseTo(6, 1);
    expect(x).toBeCloseTo(6, 1);
    expect(el.stage().style.getPropertyValue("--parallax-avatar")).toMatch(/px .*px/);
  });

  it("sways on its own when the pointer is still or has left", async () => {
    await load();
    motion.playState("intro");
    pointer("pointermove", document.body, { clientX: 0, clientY: 0 });
    $("html").dispatchEvent(new Event("pointerleave"));
    runFrame(4000);
    expect(vars()[0]).not.toBe("");
    expect(frames).toHaveLength(1);
  });

  it("ignores touch and reduced motion", async () => {
    await load();
    motion.playState("intro");
    frames = [];
    pointer("pointermove", document.body, { pointerType: "touch" });
    expect(frames).toHaveLength(0);
  });

  it("stops the loop while the document is hidden and resumes when visible", async () => {
    await load();
    motion.playState("intro");
    vi.advanceTimersByTime(800);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    runFrame(16);
    expect(frames).toHaveLength(0);
    expect(animsOn(el.breathe())[0].pause).toHaveBeenCalled();
    // Pointer moves while hidden do not restart it.
    pointer("pointermove", document.body);
    expect(frames).toHaveLength(0);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames).toHaveLength(1);
    expect(animsOn(el.breathe())[0].play).toHaveBeenCalled();
  });

  it("stops the loop while the window is unfocused and resumes on focus", async () => {
    await load();
    motion.playState("intro");
    expect(frames).toHaveLength(1);
    focused = false;
    window.dispatchEvent(new Event("blur"));
    expect(frames).toHaveLength(0);
    runFrame(16);
    expect(frames).toHaveLength(0);
    focused = true;
    window.dispatchEvent(new Event("focus"));
    expect(frames).toHaveLength(1);
  });

  it("does not start the loop in a window that opened unfocused", async () => {
    await load();
    focused = false;
    motion.playState("intro");
    expect(frames).toHaveLength(0);
  });

  it("does not schedule a second loop when one is already running", async () => {
    await load();
    motion.playState("intro");
    pointer("pointermove", document.body);
    window.dispatchEvent(new Event("focus"));
    expect(frames).toHaveLength(1);
  });

  it("resuming before breathing started only restarts the tilt", async () => {
    await load();
    motion.playState("intro");
    window.dispatchEvent(new Event("blur"));
    hidden = true;
    window.dispatchEvent(new Event("focus"));
    expect(frames).toHaveLength(0);
  });
});

describe("press feedback", () => {
  const yes = () => document.getElementById("yes-button");

  it("squashes on pointerdown and springs back on pointerup", async () => {
    await load();
    motion.playState("intro");
    pointer("pointerdown", yes());
    expect(animsOn(yes()).at(-1).keyframes).toEqual({ transform: "scale(0.94)" });
    pointer("pointerup", yes());
    expect(animsOn(yes()).at(-1).keyframes).toEqual({ transform: "scale(1)" });
    pointer("pointercancel", yes());
    expect(animsOn(yes()).at(-1).keyframes).toEqual({ transform: "scale(1)" });
  });

  it("ignores disabled buttons and non-pressable targets", async () => {
    await load();
    motion.playState("intro");
    const before = lib.animations.length;
    yes().disabled = true;
    pointer("pointerdown", yes());
    pointer("pointerdown", el.bubble());
    pointer("pointerup", el.bubble());
    expect(lib.animations.length).toBe(before);
  });

  it("releases when the pointer leaves the button", async () => {
    await load();
    motion.playState("intro");
    pointer("pointerout", yes(), { relatedTarget: document.body });
    expect(animsOn(yes()).at(-1).keyframes).toEqual({ transform: "scale(1)" });
  });

  it("does not release when the pointer moves from a child to its own button", async () => {
    await load();
    motion.playState("intro");
    const label = document.createElement("span");
    yes().append(label);
    const before = animsOn(yes()).length;
    pointer("pointerout", label, { relatedTarget: yes() });
    expect(animsOn(yes()).length).toBe(before);
  });

  it("ignores pointerout outside pressables and from non-element targets", async () => {
    await load();
    motion.playState("intro");
    const before = lib.animations.length;
    pointer("pointerout", el.bubble(), { relatedTarget: document.body });
    pointer("pointerout", document, { relatedTarget: document.body });
    expect(lib.animations.length).toBe(before);
  });

  it("gives keyboard activation (click with detail 0) the same spring", async () => {
    await load();
    motion.playState("intro");
    const click = new MouseEvent("click", { bubbles: true, detail: 0 });
    yes().dispatchEvent(click);
    expect(animsOn(yes()).at(-1).keyframes).toEqual({ transform: ["scale(0.94)", "scale(1)"] });
  });

  it("leaves mouse clicks, non-pressables and detached buttons alone", async () => {
    await load();
    motion.playState("intro");
    const before = lib.animations.length;
    yes().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    el.bubble().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    // A button removed during dispatch, before the document capture listener runs.
    const detached = yes();
    window.addEventListener("click", (e) => e.target === detached && detached.remove(), { capture: true, once: true });
    detached.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(lib.animations.length).toBe(before);
  });

  it("is disabled under reduced motion", async () => {
    await load({ reduced: true });
    motion.playState("intro");
    const before = lib.animations.length;
    pointer("pointerdown", yes());
    pointer("pointerup", yes());
    yes().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(lib.animations.length).toBe(before);
  });
});

describe("buttonIn", () => {
  it("fades and springs a new button in", async () => {
    await load();
    const b = document.createElement("button");
    motion.buttonIn(b);
    expect(animsOn(b).map((a) => Object.keys(a.keyframes)[0])).toEqual(["opacity", "transform"]);
  });

  it("only fades under reduced motion and ignores a missing button", async () => {
    await load({ reduced: true });
    const b = document.createElement("button");
    motion.buttonIn(b);
    motion.buttonIn(null);
    expect(animsOn(b).map((a) => Object.keys(a.keyframes)[0])).toEqual(["opacity"]);
  });
});

describe("live reduced-motion changes", () => {
  it("switching on stops everything and snaps to rest", async () => {
    await load();
    motion.playState("intro");
    vi.advanceTimersByTime(800);
    motion.playState("setup");
    await releaseConfetti();
    const breathing = animsOn(el.breathe())[0];
    const stateAnims = animsOn(el.body());
    matchMediaState.emit(true);
    expect(breathing.cancel).toHaveBeenCalled();
    expect(stateAnims.every((a) => a.stop.mock.calls.length > 0)).toBe(true);
    expect(frames).toHaveLength(0);
    expect(el.stage().style.getPropertyValue("--tilt-x")).toBe("0.00deg");
    expect(lib.fire.reset).toHaveBeenCalled();
    for (const node of [el.card(), el.body(), el.bubble()]) {
      expect(animsOn(node).at(-1).keyframes).toEqual({ transform: "none", opacity: 1 });
    }
    expect(visiblePose()).toEqual(["intro"]);
  });

  it("switching on before anything animated is safe", async () => {
    await load();
    motion.playState("restore");
    expect(() => matchMediaState.emit(true)).not.toThrow();
  });

  it("switching off restarts breathing and tilt", async () => {
    await load({ reduced: true });
    motion.playState("intro");
    matchMediaState.emit(false);
    expect(animsOn(el.breathe())).toHaveLength(1);
    expect(frames).toHaveLength(1);
    // A pending tilt frame is dropped when reduced motion turns back on.
    matchMediaState.emit(true);
    expect(frames).toHaveLength(0);
    runFrame(16);
    expect(frames).toHaveLength(0);
  });
});

describe("missing markup", () => {
  it("every state runs without the optional elements", async () => {
    await load({
      prepare: () => {
        document.body.innerHTML = '<p id="joke"></p>';
      }
    });
    for (const name of ["intro", "restore", "thinking", "again", "setup", "cue", "punch", "error"]) {
      motion.playState(name);
      vi.advanceTimersByTime(3000);
    }
    await releaseConfetti();
    pointer("pointermove", document.body);
    runFrame(16);
    matchMediaState.emit(true);
    for (const name of ["setup", "error"]) motion.playState(name);
    expect(console.error).not.toHaveBeenCalled();
  });
});
