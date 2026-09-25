(() => {
  "use strict";

  // ---------- Segments ----------
  const MOTION_INFO = {
    front: { icon: "\u2194", text: "Front teeth \u2014 gentle back-and-forth" },
    back: { icon: "\u2194", text: "Back teeth, both sides \u2014 gentle back-and-forth" },
    top: { icon: "\u21bb", text: "Chewing surfaces \u2014 small circles" },
  };

  const SEGMENTS = [
    { arch: "upper", part: "front", label: "Upper Front" },
    { arch: "upper", part: "back", label: "Upper Back" },
    { arch: "upper", part: "top", label: "Upper Top" },
    { arch: "lower", part: "front", label: "Lower Front" },
    { arch: "lower", part: "back", label: "Lower Back" },
    { arch: "lower", part: "top", label: "Lower Top" },
  ];

  const MIN_DURATION = 30;
  const MAX_DURATION = 300;
  const STEP = 15;
  const DEFAULT_DURATION = 120;

  let totalDuration = DEFAULT_DURATION;
  let segDurations = [];
  let segIndex = 0;
  let segRemaining = 0;
  let totalRemaining = 0;
  let timerId = null;

  // ---------- Elements ----------
  const setupScreen = document.getElementById("setup-screen");
  const runScreen = document.getElementById("run-screen");
  const doneScreen = document.getElementById("done-screen");

  const durationDisplay = document.getElementById("duration-display");
  const decBtn = document.getElementById("dec-btn");
  const incBtn = document.getElementById("inc-btn");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const restartBtn = document.getElementById("restart-btn");

  const totalTimeEl = document.getElementById("total-time");
  const segmentLabelEl = document.getElementById("segment-label");
  const segmentTimeEl = document.getElementById("segment-time");
  const dotsEl = document.getElementById("dots");
  const mouthSvg = document.getElementById("mouth-svg");
  const motionIconEl = document.getElementById("motion-icon");
  const motionTextEl = document.getElementById("motion-text");

  // ---------- Helpers ----------
  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.max(0, sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function showScreen(el) {
    [setupScreen, runScreen, doneScreen].forEach((s) => s.classList.remove("active"));
    el.classList.add("active");
  }

  function updateDurationDisplay() {
    durationDisplay.textContent = fmt(totalDuration);
  }

  // ---------- Mouth SVG ----------
  function polar(cx, cy, r, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const p1 = polar(cx, cy, r, startAngle);
    const p2 = polar(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const archConfig = {
    upper: { cx: 100, cy: 65, r: 58, start: 200, end: 340 },
    lower: { cx: 100, cy: 135, r: 58, start: 20, end: 160 },
  };

  const TEETH_PER_ARCH = 6;
  // Which part each tooth (index, left-to-right) belongs to:
  // the two outer teeth on each side are "back", the two center teeth are "front".
  const TOOTH_PARTS = ["back", "back", "front", "front", "back", "back"];

  function buildMouth() {
    mouthSvg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    Object.entries(archConfig).forEach(([arch, cfg]) => {
      // faint gum line behind the teeth, for visual context only
      const gum = document.createElementNS(ns, "path");
      gum.setAttribute("d", arcPath(cfg.cx, cfg.cy, cfg.r, cfg.start, cfg.end));
      gum.setAttribute("class", "arch-base");
      mouthSvg.appendChild(gum);

      const span = cfg.end - cfg.start;
      const slice = span / TEETH_PER_ARCH;

      for (let i = 0; i < TEETH_PER_ARCH; i++) {
        const angle = cfg.start + slice * (i + 0.5);
        const pos = polar(cfg.cx, cfg.cy, cfg.r, angle);
        const rotation = angle + 90;

        const tooth = document.createElementNS(ns, "rect");
        tooth.setAttribute("x", -7);
        tooth.setAttribute("y", -11);
        tooth.setAttribute("width", 14);
        tooth.setAttribute("height", 22);
        tooth.setAttribute("rx", 5);
        tooth.setAttribute(
          "transform",
          `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)}) rotate(${rotation.toFixed(2)})`
        );
        tooth.setAttribute("class", "tooth");
        tooth.dataset.arch = arch;
        tooth.dataset.part = TOOTH_PARTS[i];
        mouthSvg.appendChild(tooth);
      }
    });
  }

  function highlightSegment(seg) {
    const teeth = mouthSvg.querySelectorAll(".tooth");
    teeth.forEach((t) => {
      const active =
        t.dataset.arch === seg.arch &&
        (seg.part === "top" || t.dataset.part === seg.part);
      t.classList.toggle("on", active);
      t.classList.toggle("top-on", active && seg.part === "top");
    });

    const info = MOTION_INFO[seg.part];
    motionIconEl.textContent = info.icon;
    motionTextEl.textContent = info.text;
  }

  // ---------- Dots ----------
  function buildDots() {
    dotsEl.innerHTML = "";
    SEGMENTS.forEach(() => {
      const d = document.createElement("div");
      d.className = "dot";
      dotsEl.appendChild(d);
    });
  }

  function updateDots() {
    const dots = dotsEl.querySelectorAll(".dot");
    dots.forEach((d, i) => {
      d.classList.remove("done", "active");
      if (i < segIndex) d.classList.add("done");
      else if (i === segIndex) d.classList.add("active");
    });
  }

  // ---------- Timer ----------
  function computeSegDurations(total) {
    const base = Math.floor(total / SEGMENTS.length);
    const remainder = total - base * SEGMENTS.length;
    return SEGMENTS.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function renderRun() {
    const seg = SEGMENTS[segIndex];
    segmentLabelEl.textContent = seg.label;
    segmentTimeEl.textContent = fmt(segRemaining);
    totalTimeEl.textContent = fmt(totalRemaining);
    highlightSegment(seg);
    updateDots();
  }

  function tick() {
    segRemaining -= 1;
    totalRemaining -= 1;

    if (segRemaining < 0) {
      segIndex += 1;
      if (segIndex >= SEGMENTS.length) {
        finish();
        return;
      }
      segRemaining = segDurations[segIndex];
      vibrate(150);
    }

    if (totalRemaining < 0) totalRemaining = 0;
    renderRun();
  }

  function start() {
    segDurations = computeSegDurations(totalDuration);
    segIndex = 0;
    segRemaining = segDurations[0];
    totalRemaining = totalDuration;

    buildMouth();
    buildDots();
    renderRun();
    showScreen(runScreen);

    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
    vibrate(100);
  }

  function stop() {
    clearInterval(timerId);
    showScreen(setupScreen);
  }

  function finish() {
    clearInterval(timerId);
    vibrate([100, 60, 100, 60, 200]);
    showScreen(doneScreen);
  }

  // ---------- Events ----------
  decBtn.addEventListener("click", () => {
    totalDuration = Math.max(MIN_DURATION, totalDuration - STEP);
    updateDurationDisplay();
  });

  incBtn.addEventListener("click", () => {
    totalDuration = Math.min(MAX_DURATION, totalDuration + STEP);
    updateDurationDisplay();
  });

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  restartBtn.addEventListener("click", () => showScreen(setupScreen));

  // ---------- Init ----------
  updateDurationDisplay();
  showScreen(setupScreen);

  // ---------- PWA service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
