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

  // Each arch is drawn as a "tunnel" cross-section: an outer rim (the
  // surface facing your lips/cheeks) and an inner rim (the surface facing
  // your tongue), joined by a connecting band (the chewing/biting surface).
  //   front = outer rim highlighted
  //   back  = inner rim highlighted
  //   top   = the connecting band highlighted
  const archConfig = {
    upper: { cx: 100, cy: 68, rOuter: 60, rInner: 34, start: 200, end: 340 },
    lower: { cx: 100, cy: 132, rOuter: 60, rInner: 34, start: 20, end: 160 },
  };

  function ringPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    const o1 = polar(cx, cy, rOuter, startAngle);
    const o2 = polar(cx, cy, rOuter, endAngle);
    const i1 = polar(cx, cy, rInner, startAngle);
    const i2 = polar(cx, cy, rInner, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return (
      `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} ` +
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} ` +
      `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} ` +
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`
    );
  }

  function buildMouth() {
    mouthSvg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    Object.entries(archConfig).forEach(([arch, cfg]) => {
      // faint base outline of the whole tunnel shape (outer rim + inner rim + ends)
      const base = document.createElementNS(ns, "path");
      base.setAttribute("d", ringPath(cfg.cx, cfg.cy, cfg.rOuter, cfg.rInner, cfg.start, cfg.end));
      base.setAttribute("class", "tunnel-base");
      mouthSvg.appendChild(base);

      // top: fill of the connecting band between outer and inner rim
      const band = document.createElementNS(ns, "path");
      band.setAttribute("d", ringPath(cfg.cx, cfg.cy, cfg.rOuter, cfg.rInner, cfg.start, cfg.end));
      band.setAttribute("class", "tunnel-band");
      band.dataset.arch = arch;
      mouthSvg.appendChild(band);

      // front: outer rim stroke
      const outer = document.createElementNS(ns, "path");
      outer.setAttribute("d", arcPath(cfg.cx, cfg.cy, cfg.rOuter, cfg.start, cfg.end));
      outer.setAttribute("class", "tunnel-rim tunnel-rim-outer");
      outer.dataset.arch = arch;
      mouthSvg.appendChild(outer);

      // back: inner rim stroke
      const inner = document.createElementNS(ns, "path");
      inner.setAttribute("d", arcPath(cfg.cx, cfg.cy, cfg.rInner, cfg.start, cfg.end));
      inner.setAttribute("class", "tunnel-rim tunnel-rim-inner");
      inner.dataset.arch = arch;
      mouthSvg.appendChild(inner);
    });
  }

  function highlightSegment(seg) {
    mouthSvg.querySelectorAll(".tunnel-band").forEach((el) => {
      el.classList.toggle("on", el.dataset.arch === seg.arch && seg.part === "top");
    });
    mouthSvg.querySelectorAll(".tunnel-rim-outer").forEach((el) => {
      el.classList.toggle("on", el.dataset.arch === seg.arch && seg.part === "front");
    });
    mouthSvg.querySelectorAll(".tunnel-rim-inner").forEach((el) => {
      el.classList.toggle("on", el.dataset.arch === seg.arch && seg.part === "back");
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
