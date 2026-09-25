(() => {
  "use strict";

  // ---------- Segments ----------
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
    upper: { cx: 100, cy: 75, r: 55, start: 200, end: 340 },
    lower: { cx: 100, cy: 125, r: 55, start: 20, end: 160 },
  };

  function buildMouth() {
    mouthSvg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    Object.entries(archConfig).forEach(([arch, cfg]) => {
      const span = cfg.end - cfg.start;
      const third = span / 3;

      // base full arc (background)
      const base = document.createElementNS(ns, "path");
      base.setAttribute("d", arcPath(cfg.cx, cfg.cy, cfg.r, cfg.start, cfg.end));
      base.setAttribute("class", "arch-base");
      mouthSvg.appendChild(base);

      // left, center(front), right segments
      const segs = [
        { part: "back", from: cfg.start, to: cfg.start + third },
        { part: "front", from: cfg.start + third, to: cfg.start + 2 * third },
        { part: "back", from: cfg.start + 2 * third, to: cfg.end },
      ];

      segs.forEach((s, i) => {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", arcPath(cfg.cx, cfg.cy, cfg.r, s.from, s.to));
        path.setAttribute("class", "arch-seg");
        path.dataset.arch = arch;
        path.dataset.part = s.part;
        path.dataset.idx = i;
        mouthSvg.appendChild(path);
      });
    });
  }

  function highlightSegment(seg) {
    const paths = mouthSvg.querySelectorAll(".arch-seg");
    paths.forEach((p) => {
      p.classList.remove("on", "top-on");
      const sameArch = p.dataset.arch === seg.arch;
      if (!sameArch) return;

      if (seg.part === "top") {
        // highlight the whole arch (all three sub-segments) in the "top" color
        p.classList.add("top-on");
      } else if (p.dataset.part === seg.part) {
        p.classList.add("on");
      }
    });
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
