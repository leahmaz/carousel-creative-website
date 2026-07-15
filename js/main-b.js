/* ============================================================
   Carousel Creative — Design B interactions
   Restrained, performance-minded: IntersectionObserver reveals,
   one rAF-throttled scroll handler for the process line.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- nav hairline on scroll ---------- */
  var nav = document.getElementById("nav");
  function navState() { if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 6); }

  /* ---------- reveal on scroll ---------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var group = Array.prototype.slice.call(
          el.parentElement.querySelectorAll(":scope > .reveal")
        );
        var i = group.indexOf(el);
        el.style.transitionDelay = (i > 0 ? Math.min(i, 6) * 90 : 0) + "ms";
        el.classList.add("in-view");
        obs.unobserve(el);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- scroll-driven process line ----------
     The accent rail fills as the steps list passes through the viewport,
     and each step lights as the fill crosses its midpoint. One passive,
     rAF-throttled scroll listener keeps this smooth and cheap. */
  var steps = document.getElementById("steps");
  var fill = document.getElementById("stepsFill");
  var stepEls = steps
    ? Array.prototype.slice.call(steps.querySelectorAll(".step"))
    : [];

  function updateProcess() {
    if (!steps || !fill) return;
    var rect = steps.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;

    // progress 0 → 1 as the list travels from entering (lower third)
    // to leaving (upper portion) of the viewport.
    var startAt = vh * 0.78;   // begin filling when top reaches 78% down
    var span = rect.height + vh * 0.42;
    var progress = (startAt - rect.top) / span;
    progress = Math.max(0, Math.min(1, progress));

    fill.style.height = (progress * 100).toFixed(2) + "%";

    var railTop = rect.top + 8;
    var railLen = rect.height - 16;
    var fillBottom = railTop + railLen * progress;
    stepEls.forEach(function (step) {
      var sr = step.getBoundingClientRect();
      var mid = sr.top + sr.height * 0.42;
      step.classList.toggle("is-active", fillBottom >= mid);
    });
  }

  /* ---------- single rAF-throttled scroll loop ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      navState();
      if (!reduceMotion) updateProcess();
      ticking = false;
    });
  }

  if (reduceMotion && fill) {
    fill.style.height = "100%";
    stepEls.forEach(function (s) { s.classList.add("is-active"); });
  }

  navState();
  updateProcess();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* ---------- smooth anchor scroll with sticky-nav offset ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 82;
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
})();

/* ============================================================
   Hero research field
   ----------------------------------------------------------
   SVG concentric rings (uneven spacing, focal point off to the
   right on desktop / above the headline on mobile) + a Canvas
   dot field that drifts gently and responds to the pointer with
   a damped, lagging parallax. One rAF loop, paused when offscreen.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("heroDots");
  var rings = document.getElementById("heroRings");
  var blobs = document.getElementById("heroBlobs");
  if (!hero || !canvas || !rings) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var W = 0, H = 0;
  var focal = { x: 0, y: 0 };
  var radii = [], dots = [];
  var mouse = { x: -9999, y: -9999 };
  var smooth = { x: -9999, y: -9999 };
  var hasMouse = false, running = false, raf = null;
  var active = 0, lastMove = -9999;      // cursor "magnetism" envelope (0 idle → 1 moving)
  var blobShift = { x: 0, y: 0 };        // tiny blob parallax offset

  var INFLUENCE = 170;   // px radius of the soft magnetic field
  var MAX_PULL = 9;      // px max displacement toward the cursor (subtle)
  var EASE = 0.085;      // damping → smooth follow + smooth return, never snaps
  // warm, low-contrast dot tiers
  var TIERS = [
    "rgba(120,70,58,0.16)",
    "rgba(120,70,58,0.24)",
    "rgba(120,70,58,0.32)",
    "rgba(120,70,58,0.42)"
  ];

  function setFocal() {
    if (W <= 760) { focal.x = W * 0.5; focal.y = H * 0.17; }   // mobile: above headline
    else { focal.x = W * 0.86; focal.y = H * 0.42; }           // desktop: right side
  }

  function buildRings() {
    var maxR = 0, corners = [[0, 0], [W, 0], [0, H], [W, H]];
    corners.forEach(function (c) {
      var d = Math.hypot(c[0] - focal.x, c[1] - focal.y);
      if (d > maxR) maxR = d;
    });
    // uneven radii: tight near the centre, looser toward the edges
    radii = [];
    var r = 18, gap = 14, growth = 1.18;
    while (r < maxR + 24) { radii.push(r); gap *= growth; r += gap; }

    rings.setAttribute("width", W);
    rings.setAttribute("height", H);
    rings.setAttribute("viewBox", "0 0 " + W + " " + H);
    var s = "";
    for (var i = 0; i < radii.length; i++) {
      var op = Math.max(0.08, 0.21 - i * 0.0025);
      s += '<circle cx="' + focal.x.toFixed(1) + '" cy="' + focal.y.toFixed(1) +
           '" r="' + radii[i].toFixed(1) +
           '" fill="none" stroke="rgba(126,64,59,' + op.toFixed(3) +
           ')" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    }
    rings.innerHTML = s;
  }

  // Dots scattered in the BANDS between rings. Area-uniform radius sampling
  // gives an even spatial density; a faint outward thinning keeps it natural.
  function buildDots() {
    dots = [];
    if (radii.length < 2) return;
    var minR = 8, maxR = radii[radii.length - 1];
    var minR2 = minR * minR, maxR2 = maxR * maxR;
    var target = Math.max(240, Math.min(1360, Math.round((W * H) / 975)));   // ~2× density
    var attempts = 0, cap = target * 9;
    while (dots.length < target && attempts < cap) {
      attempts++;
      var rr = Math.sqrt(minR2 + Math.random() * (maxR2 - minR2));
      if (Math.random() < 0.18 * (rr / maxR)) continue;          // subtle outward thinning
      var a = Math.random() * 6.2832;
      var x = focal.x + Math.cos(a) * rr;
      var y = focal.y + Math.sin(a) * rr;
      if (x < 2 || x > W - 2 || y < 2 || y > H - 2) continue;     // inside the hero only
      dots.push({ bx: x, by: y, rad: 0.8 + Math.random() * 0.9, tier: (Math.random() * 4) | 0, dx: 0, dy: 0 });
    }
  }

  // Three irregular audience regions anchored to the field around the focal
  // point. Fixed per-point radius factors give each a stable, asymmetrical
  // identity (not a circle); they overlap to read as shared audiences.
  // Each region has a distinct silhouette, size and ORIENTATION (whole shape
  // rotated by `orient`, so they're not all axis-aligned horizontal bands).
  // Deep radius dips (down to ~0.45) carve concave bays / pinched necks; tall
  // peaks form peninsulas & lobes. Aspect ratio (rx vs ry) is intentionally
  // uneven per blob.
  var BLOB_SPECS = [
    // 1 — tall, diagonal lobe with a pinched neck + a peninsula (extremes softened ~30%)
    { idx: 1, ox: -0.04, oy: -0.16, rx: 0.20, ry: 0.35, orient: -0.70,
      f:  [1.11, 0.90, 0.79, 0.97, 1.15, 1.04, 0.72, 0.69, 0.86, 1.07, 1.18, 0.93, 0.78, 0.65, 0.85, 1.06, 1.13, 0.94],
      aj: [0.00, 0.04, -0.03, 0.04, -0.03, 0.03, 0.04, -0.03, 0.03, -0.04, 0.03, 0.04, -0.03, 0.04, -0.03, 0.03, -0.04, 0.03] },
    // 2 — compact, rounded but irregular: a few broad lobes & soft bays (cell-like, not spiky)
    { idx: 2, ox:  0.02, oy:  0.06, rx: 0.20, ry: 0.185, orient: 0.40,
      f:  [1.10, 1.15, 0.97, 0.78, 0.73, 0.88, 1.07, 1.13, 0.93, 0.72, 0.70, 0.86, 1.09, 1.04, 0.82, 0.94],
      aj: [0.03, -0.02, 0.03, -0.03, 0.02, -0.03, 0.03, 0.02, -0.03, 0.03, -0.02, 0.03, -0.03, 0.02, -0.03, 0.03] },
    // 3 — map-like, with a bay that wraps toward the target centre
    //     (15% smaller + ~20% rounder than the original map blob)
    { idx: 3, ox: -0.18, oy:  0.10, rx: 0.289, ry: 0.238, orient: -0.45,
      f:  [1.16, 1.08, 0.94, 0.73, 0.58, 0.64, 0.86, 1.04, 1.18, 1.10, 0.96, 0.76, 0.66, 0.82, 1.12, 1.21, 1.00, 0.78, 0.70, 0.92],
      aj: [0.00, 0.03, -0.03, 0.03, -0.02, 0.02, 0.03, -0.03, 0.02, -0.03, 0.03, -0.02, 0.03, -0.03, 0.02, -0.03, 0.03, -0.02, 0.03, -0.02] }
  ];

  // Catmull-Rom → cubic bezier, closed: a smooth but irregular outline.
  function smoothClosed(pts) {
    var n = pts.length, d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " +
                c2x.toFixed(1) + "," + c2y.toFixed(1) + " " +
                p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d + "Z";
  }

  // Groups are created once (so the entrance reveal plays a single time);
  // resize only re-points the path data, never re-triggers the animation.
  var blobPaths = null;

  function buildBlobs() {
    if (!blobs) return;
    blobs.setAttribute("width", W);
    blobs.setAttribute("height", H);
    blobs.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!blobPaths) {
      var html = "";
      for (var g = 0; g < BLOB_SPECS.length; g++) {
        html += '<g class="blobReveal blobReveal--' + BLOB_SPECS[g].idx + '">' +
                  '<path class="blobShape--' + BLOB_SPECS[g].idx + '"/></g>';
      }
      blobs.innerHTML = html;
      blobPaths = blobs.querySelectorAll("path");
    }
    var scale = Math.min(W, H);
    for (var b = 0; b < BLOB_SPECS.length; b++) {
      var spec = BLOB_SPECS[b];
      var cx = focal.x + spec.ox * W, cy = focal.y + spec.oy * H;
      var rx = spec.rx * scale, ry = spec.ry * scale, N = spec.f.length, pts = [];
      var cosO = Math.cos(spec.orient), sinO = Math.sin(spec.orient);
      for (var i = 0; i < N; i++) {
        var a = (i / N) * 6.2832 + spec.aj[i];        // jitter → asymmetry
        var lx = Math.cos(a) * rx * spec.f[i];        // point on the local (unrotated) ellipse
        var ly = Math.sin(a) * ry * spec.f[i];
        pts.push([cx + lx * cosO - ly * sinO, cy + lx * sinO + ly * cosO]);   // rotate whole shape
      }
      blobPaths[b].setAttribute("d", smoothClosed(pts));
    }
  }

  function resize() {
    W = hero.clientWidth; H = hero.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setFocal(); buildRings(); buildBlobs(); buildDots();
    if (!running) render(performance.now(), true);
  }

  function render(t, staticDraw) {
    ctx.clearRect(0, 0, W, H);

    if (!staticDraw) {
      smooth.x += (mouse.x - smooth.x) * 0.10;     // lag → distant dots feel delayed
      smooth.y += (mouse.y - smooth.y) * 0.10;
      var moving = (t - lastMove) < 140 ? 1 : 0;
      active += (moving - active) * 0.06;           // magnetism rises / fades smoothly

      var R2 = INFLUENCE * INFLUENCE;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i], tx = 0, ty = 0;
        if (hasMouse && active > 0.002) {
          var vx = smooth.x - d.bx, vy = smooth.y - d.by, dd = vx * vx + vy * vy;
          if (dd < R2) {
            var dist = Math.sqrt(dd) || 0.001;
            var f = 1 - dist / INFLUENCE; f *= f;
            var pull = f * MAX_PULL * active;
            tx = (vx / dist) * pull; ty = (vy / dist) * pull;   // drift toward the cursor
          }
        }
        d.dx += (tx - d.dx) * EASE;                  // idle → eases back to its origin
        d.dy += (ty - d.dy) * EASE;
      }

      if (finePointer && blobs) {                    // optional 1–2px blob parallax
        var bpx = ((smooth.x - W / 2) / W) * 4 * active;
        var bpy = ((smooth.y - H / 2) / H) * 4 * active;
        blobShift.x += (bpx - blobShift.x) * 0.05;
        blobShift.y += (bpy - blobShift.y) * 0.05;
        blobs.style.transform = "translate(" + blobShift.x.toFixed(2) + "px," + blobShift.y.toFixed(2) + "px)";
      }
    }

    // batched fills by alpha tier → only 4 fill calls per frame
    for (var k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.fillStyle = TIERS[k];
      for (var j = 0; j < dots.length; j++) {
        var p = dots[j];
        if (p.tier !== k) continue;
        var px = p.bx + p.dx, py = p.by + p.dy;
        ctx.moveTo(px + p.rad, py);
        ctx.arc(px, py, p.rad, 0, 6.2832);
      }
      ctx.fill();
    }

    if (running) raf = requestAnimationFrame(function (n) { render(n, false); });
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    raf = requestAnimationFrame(function (n) { render(n, false); });
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  resize();
  window.addEventListener("load", resize);
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt); rt = setTimeout(resize, 160);
  }, { passive: true });

  // reduced motion OR coarse pointer → static dots, no rAF loop.
  // (Blobs still breathe via CSS, except under reduced motion where that's off too.)
  if (reduceMotion || !finePointer) { render(performance.now(), true); return; }

  window.addEventListener("pointermove", function (e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    lastMove = performance.now();
    if (!hasMouse) { hasMouse = true; smooth.x = mouse.x; smooth.y = mouse.y; }
  }, { passive: true });

  // pause the loop entirely when the hero is scrolled out of view
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
    }, { threshold: 0 }).observe(hero);
  } else {
    start();
  }
})();

/* ============================================================
   Final CTA — "coverage" field (the hero, evolved)
   ------------------------------------------------------------
   Cream dots over deep espresso, frosted warm "opportunity"
   regions, and a caramel cursor-blob (an ad) the dots migrate
   toward. Warmer and more expansive than the analytical hero.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sec = document.querySelector(".closing");
  var canvas = document.getElementById("closingDots");
  var blobsSvg = document.getElementById("closingBlobs");
  var ringsEl = document.getElementById("closingRings");
  if (!sec || !canvas || !blobsSvg) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var W = 0, H = 0, dots = [], blobs = [];
  var fx = 0, fy = 0;   // rings centre — slightly left & up of centre
  var mouse = { x: -9999, y: -9999 }, sm = { x: -9999, y: -9999 };
  var inside = false, active = 0, lastMove = -9999, running = false, raf = null;

  var INFLUENCE = 185, MAX_PULL = 10, EASE = 0.08, REACT = 240;
  // cream dot tiers on espresso — subtle, understated
  var TIERS = [
    "rgba(251,247,244,0.12)",
    "rgba(251,247,244,0.18)",
    "rgba(251,247,244,0.25)",
    "rgba(251,247,244,0.34)"
  ];

  // Regions placed in POLAR coords around the rings centre: dn is the
  // normalised distance (0 = centre). Density, size and opacity all fall off
  // with dn, so regions concentrate near the centre and thin out toward the
  // edges. Opacities are lower than the hero's (more translucent). Flat, no blur.
  var BLOB_DEFS = [
    // dense near the centre — larger, a touch stronger
    { ang: 0.4, dn: 0.04, r: 0.165, c: "#A6534E", o: 0.22, s: 11 },
    { ang: 2.3, dn: 0.09, r: 0.175, c: "#B66A4C", o: 0.20, s: 23 },
    { ang: 4.1, dn: 0.07, r: 0.140, c: "#C6834A", o: 0.22, s: 37 },
    { ang: 5.6, dn: 0.13, r: 0.125, c: "#7E403B", o: 0.20, s: 41 },
    { ang: 1.2, dn: 0.15, r: 0.115, c: "#C98A3C", o: 0.19, s: 53 },
    // mid ring — medium
    { ang: 0.7, dn: 0.32, r: 0.100, c: "#C6834A", o: 0.16, s: 67 },
    { ang: 2.7, dn: 0.38, r: 0.095, c: "#A6534E", o: 0.15, s: 71 },
    { ang: 3.6, dn: 0.34, r: 0.105, c: "#B66A4C", o: 0.16, s: 83 },
    { ang: 5.0, dn: 0.44, r: 0.085, c: "#C98A3C", o: 0.14, s: 97 },
    { ang: 4.5, dn: 0.48, r: 0.080, c: "#7E403B", o: 0.14, s: 101 },
    // sparse outer — small, faint
    { ang: 1.6, dn: 0.64, r: 0.060, c: "#C6834A", o: 0.12, s: 113 },
    { ang: 3.1, dn: 0.72, r: 0.050, c: "#A6534E", o: 0.10, s: 127 },
    { ang: 5.9, dn: 0.60, r: 0.058, c: "#B66A4C", o: 0.12, s: 131 },
    { ang: 0.2, dn: 0.86, r: 0.042, c: "#C98A3C", o: 0.09, s: 149 },
    { ang: 2.1, dn: 0.92, r: 0.038, c: "#7E403B", o: 0.09, s: 151 }
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function smoothClosed(pts) {
    var n = pts.length, d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " +
                c2x.toFixed(1) + "," + c2y.toFixed(1) + " " +
                p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d + "Z";
  }

  // organic, stable-per-seed silhouette (blurred anyway, so kept simple)
  function blobPath(cx, cy, r, seed) {
    var rnd = rng(seed), N = 10 + (rnd() * 4 | 0), pts = [];
    for (var i = 0; i < N; i++) {
      var a = (i / N) * 6.2832 + (rnd() - 0.5) * 0.20;
      var f = 0.74 + rnd() * 0.42;
      if (rnd() < 0.22) f *= 0.78;          // occasional bay
      pts.push([cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f]);
    }
    return smoothClosed(pts);
  }

  function buildBlobs() {
    blobsSvg.setAttribute("width", W);
    blobsSvg.setAttribute("height", H);
    blobsSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!blobs.length) {
      var html = "";
      for (var i = 0; i < BLOB_DEFS.length; i++) {
        var def = BLOB_DEFS[i];
        html += '<g style="opacity:' + def.o + '">' +
                  '<path class="fBlob fBlob--d' + (i % 4) + '" fill="' + def.c + '"/></g>';
      }
      blobsSvg.innerHTML = html;
      var gs = blobsSvg.querySelectorAll("g"), ps = blobsSvg.querySelectorAll("path");
      for (var j = 0; j < BLOB_DEFS.length; j++) {
        blobs.push({ def: BLOB_DEFS[j], g: gs[j], path: ps[j], cx: 0, cy: 0, ox: 0, oy: 0, opx: 0 });
      }
    }
    var minWH = Math.min(W, H);
    var spreadX = W * 0.50, spreadY = H * 0.60;   // elliptical cluster around the centre
    for (var k = 0; k < blobs.length; k++) {
      var b = blobs[k], def = b.def;
      b.cx = fx + Math.cos(def.ang) * def.dn * spreadX;
      b.cy = fy + Math.sin(def.ang) * def.dn * spreadY;
      b.path.setAttribute("d", blobPath(b.cx, b.cy, def.r * minWH, def.s));
    }
  }

  // same concentric rings as the hero, centred slightly left & up; cream
  // strokes (low alpha) so they read as thin, subtle lines on the espresso.
  function buildRings() {
    if (!ringsEl) return;
    var maxR = 0, corners = [[0, 0], [W, 0], [0, H], [W, H]];
    corners.forEach(function (c) {
      var d = Math.hypot(c[0] - fx, c[1] - fy);
      if (d > maxR) maxR = d;
    });
    ringsEl.setAttribute("width", W);
    ringsEl.setAttribute("height", H);
    ringsEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    var s = "", r = 18, gap = 14, growth = 1.18, i = 0;
    while (r < maxR + 24) {
      var op = Math.max(0.035, 0.12 - i * 0.003);
      s += '<circle cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) +
           '" r="' + r.toFixed(1) +
           '" fill="none" stroke="rgba(251,247,244,' + op.toFixed(3) +
           ')" stroke-width="1" vector-effect="non-scaling-stroke"/>';
      gap *= growth; r += gap; i++;
    }
    ringsEl.innerHTML = s;
  }

  // even distribution: a jittered grid (slightly denser than the hero)
  function buildDots() {
    dots = [];
    var cell = 30, jit = cell * 0.72;
    for (var y = cell * 0.5; y < H; y += cell) {
      for (var x = cell * 0.5; x < W; x += cell) {
        var px = x + (Math.random() - 0.5) * jit, py = y + (Math.random() - 0.5) * jit;
        if (px < 2 || px > W - 2 || py < 2 || py > H - 2) continue;
        dots.push({
          bx: px, by: py, ph: Math.random() * 6.283, amp: 0.45 + Math.random() * 0.55,
          rad: 0.8 + Math.random() * 0.9, tier: (Math.random() * 4) | 0, dx: 0, dy: 0
        });
      }
    }
  }

  function resize() {
    W = sec.clientWidth; H = sec.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx = W * 0.41; fy = H * 0.39;          // slightly left & up of centre
    buildRings(); buildBlobs(); buildDots();
    if (!running) render(performance.now(), true);
  }

  function render(t, staticDraw) {
    ctx.clearRect(0, 0, W, H);

    if (!staticDraw) {
      sm.x += (mouse.x - sm.x) * 0.12;
      sm.y += (mouse.y - sm.y) * 0.12;
      var moving = (inside && (t - lastMove) < 200) ? 1 : 0;
      active += (moving - active) * 0.05;          // magnetism fades when still / on leave

      var R2 = INFLUENCE * INFLUENCE;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var drx = Math.sin(t * 0.00035 + d.ph) * d.amp;     // almost-imperceptible drift
        var dry = Math.cos(t * 0.00030 + d.ph * 1.2) * d.amp;
        var tx = 0, ty = 0;
        if (active > 0.003) {
          var ax = sm.x - d.bx, ay = sm.y - d.by, dd = ax * ax + ay * ay;
          if (dd < R2) {
            var dist = Math.sqrt(dd) || 0.001, f = 1 - dist / INFLUENCE; f *= f;
            var pull = f * MAX_PULL * active;
            tx = (ax / dist) * pull; ty = (ay / dist) * pull;  // migrate toward the cursor blob
          }
        }
        d.dx += ((tx + drx) - d.dx) * EASE;
        d.dy += ((ty + dry) - d.dy) * EASE;
      }

      for (var k = 0; k < blobs.length; k++) {     // regions react subtly to the cursor ad
        var b = blobs[k], tox = 0, toy = 0, tob = 0;
        if (active > 0.003) {
          var bx = sm.x - b.cx, by = sm.y - b.cy, bdist = Math.hypot(bx, by);
          if (bdist < REACT) {
            var bf = 1 - bdist / REACT, sh = bf * 2.2;
            tox = (bx / (bdist || 1)) * sh; toy = (by / (bdist || 1)) * sh; tob = bf * 0.08 * active;
          }
        }
        b.ox += (tox - b.ox) * 0.06; b.oy += (toy - b.oy) * 0.06; b.opx += (tob - b.opx) * 0.06;
        b.g.style.transform = "translate(" + b.ox.toFixed(2) + "px," + b.oy.toFixed(2) + "px)";
        b.g.style.opacity = (b.def.o + b.opx).toFixed(3);
      }
    }

    for (var c = 0; c < 4; c++) {
      ctx.beginPath();
      ctx.fillStyle = TIERS[c];
      for (var j = 0; j < dots.length; j++) {
        var p = dots[j];
        if (p.tier !== c) continue;
        var qx = p.bx + p.dx, qy = p.by + p.dy;
        ctx.moveTo(qx + p.rad, qy);
        ctx.arc(qx, qy, p.rad, 0, 6.2832);
      }
      ctx.fill();
    }

    if (running) raf = requestAnimationFrame(function (n) { render(n, false); });
  }

  function start() {
    if (running) return;
    running = true; sec.classList.remove("is-paused");
    raf = requestAnimationFrame(function (n) { render(n, false); });
  }
  function stop() {
    running = false; sec.classList.add("is-paused");
    if (raf) cancelAnimationFrame(raf); raf = null;
  }

  resize();
  window.addEventListener("load", resize);
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 160); }, { passive: true });

  // reduced motion or touch → static dots; regions still drift gently via CSS
  if (reduceMotion || !finePointer) { render(performance.now(), true); return; }

  sec.addEventListener("pointerenter", function () { inside = true; });
  sec.addEventListener("pointerleave", function () { inside = false; });
  sec.addEventListener("pointermove", function (e) {
    var rect = sec.getBoundingClientRect();
    mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
    lastMove = performance.now();
    if (sm.x < -9000) { sm.x = mouse.x; sm.y = mouse.y; }
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
    }, { threshold: 0 }).observe(sec);
  } else {
    start();
  }
})();

/* ============================================================
   Testimonials — editorial slider + modal
   ----------------------------------------------------------
   Progressive enhancement: without JS the six testimonials read
   as a stacked list. Enhanced, they become a two-up pair on
   desktop / one-up on tablet & mobile, paged with arrows + a
   numeric progress counter, crossfading with a slight horizontal
   drift. "Read full testimonial" opens an accessible modal.
   ============================================================ */
(function () {
  "use strict";

  var section = document.querySelector(".tstm");
  if (!section) return;
  var list = section.querySelector(".tstm__list");
  var items = Array.prototype.slice.call(section.querySelectorAll(".tstm__item"));
  if (!list || !items.length) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var prevBtn = section.querySelector(".tstm__nav--prev");
  var nextBtn = section.querySelector(".tstm__nav--next");
  var progress = section.querySelector(".tstm__progress");
  var desktopMQ = window.matchMedia("(min-width: 900px)");

  var page = 0;
  var lastPerView = desktopMQ.matches ? 2 : 1;
  var animating = false;
  var SHIFT = 16;      // px of horizontal drift
  var SWAP = 320;      // ms before the incoming pair fades in

  function perView() { return desktopMQ.matches ? 2 : 1; }
  function pageCount() { return Math.ceil(items.length / perView()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function pageItems(p) {
    var n = perView(), s = p * n;
    return items.slice(s, s + n);
  }

  function syncControls() {
    if (progress) progress.textContent = pad(page + 1) + " / " + pad(pageCount());
    if (prevBtn) prevBtn.disabled = page <= 0;
    if (nextBtn) nextBtn.disabled = page >= pageCount() - 1;
  }

  // bring the current page's items in, drifting from `dir`
  function enter(dir) {
    var show = pageItems(page);
    items.forEach(function (el) {
      if (show.indexOf(el) === -1) {
        el.classList.remove("is-shown", "is-in");
        el.style.transform = "";
      }
    });
    show.forEach(function (el) {
      el.classList.add("is-shown");
      el.classList.remove("is-in");
      el.style.transform = reduce ? "" : "translateX(" + (dir < 0 ? -SHIFT : SHIFT) + "px)";
    });
    void list.offsetWidth;                       // reflow so the drift animates
    show.forEach(function (el) {
      el.classList.add("is-in");
      el.style.transform = "";
    });
    syncControls();
  }

  // snap to the current page without animation (initial paint / breakpoint change)
  function renderStatic() {
    section.classList.add("tstm--no-anim");
    var show = pageItems(page);
    items.forEach(function (el) {
      var on = show.indexOf(el) !== -1;
      el.classList.toggle("is-shown", on);
      el.classList.toggle("is-in", on);
      el.style.transform = "";
    });
    syncControls();
    void list.offsetWidth;
    if (reduce) { section.classList.remove("tstm--no-anim"); return; }
    window.requestAnimationFrame(function () {
      section.classList.remove("tstm--no-anim");
    });
  }

  function go(dir) {
    if (animating) return;
    var target = page + dir;
    if (target < 0 || target > pageCount() - 1) return;
    var leaving = pageItems(page);
    page = target;
    if (reduce) { enter(dir); return; }
    animating = true;
    leaving.forEach(function (el) {
      el.classList.remove("is-in");
      el.style.transform = "translateX(" + (dir > 0 ? -SHIFT : SHIFT) + "px)";
    });
    window.setTimeout(function () {
      leaving.forEach(function (el) {
        el.classList.remove("is-shown");
        el.style.transform = "";
      });
      enter(dir);
      animating = false;
    }, SWAP);
  }

  if (prevBtn) prevBtn.addEventListener("click", function () { go(-1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(1); });

  // keyboard arrows while the section has focus within it
  section.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { go(-1); }
    else if (e.key === "ArrowRight") { go(1); }
  });

  // light touch swipe
  var sx = 0, sy = 0, swiping = false;
  section.addEventListener("touchstart", function (e) {
    var t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiping = true;
  }, { passive: true });
  section.addEventListener("touchend", function (e) {
    if (!swiping) return; swiping = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  // re-page when the per-view count flips, keeping the leftmost item anchored
  function onBreakpoint() {
    var n = perView();
    if (n === lastPerView) return;
    var anchor = page * lastPerView;
    page = Math.floor(anchor / n);
    lastPerView = n;
    if (page > pageCount() - 1) page = pageCount() - 1;
    if (page < 0) page = 0;
    renderStatic();
  }
  if (desktopMQ.addEventListener) desktopMQ.addEventListener("change", onBreakpoint);
  else if (desktopMQ.addListener) desktopMQ.addListener(onBreakpoint);
  // resize fallback (covers environments that don't fire MQ change events)
  var rtimer;
  window.addEventListener("resize", function () {
    window.clearTimeout(rtimer);
    rtimer = window.setTimeout(onBreakpoint, 150);
  }, { passive: true });

  /* ---------- modal ---------- */
  var modal = document.getElementById("tstmModal");
  if (modal) {
    var mBody = modal.querySelector(".tstm-modal__body");
    var mName = modal.querySelector(".tstm-modal__name");
    var mTitle = modal.querySelector(".tstm-modal__title");
    var mCompany = modal.querySelector(".tstm-modal__company");
    var mClose = modal.querySelector(".tstm-modal__close");
    var lastFocus = null;

    var openModal = function (item) {
      var tpl = item.querySelector("template");
      mBody.innerHTML = "";
      if (tpl) mBody.appendChild(tpl.content.cloneNode(true));
      mName.textContent = item.getAttribute("data-name") || "";
      mTitle.textContent = item.getAttribute("data-title") || "";
      mCompany.textContent = item.getAttribute("data-company") || "";
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("tstm-modal-open");
      void modal.offsetWidth;                 // flush the hidden state, then transition in
      modal.classList.add("is-open");
      document.addEventListener("keydown", onModalKey);
      mClose.focus();
    };

    var closeModal = function () {
      if (modal.hidden) return;
      document.removeEventListener("keydown", onModalKey);
      document.body.classList.remove("tstm-modal-open");
      modal.classList.remove("is-open");
      window.setTimeout(function () { modal.hidden = true; }, reduce ? 0 : 420);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    var onModalKey = function (e) {
      if (e.key === "Escape") { closeModal(); return; }
      if (e.key !== "Tab") return;
      var f = modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) closeModal();
    });
    items.forEach(function (item) {
      var btn = item.querySelector(".tstm__more");
      if (btn) btn.addEventListener("click", function () { openModal(item); });
    });
  }

  /* ---------- enhance ---------- */
  section.classList.add("tstm--enhanced");
  lastPerView = perView();
  renderStatic();
})();

/* ============================================================
   Case-study media previews
   ----------------------------------------------------------
   Each row shows a static 9:16 poster. On hover/focus the video
   lazy-loads (its src is only set on first interaction), then
   crossfades in and plays muted, looped and inline. Leaving the
   row pauses and resets it. Reduced motion keeps the poster only.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var studies = Array.prototype.slice.call(document.querySelectorAll(".study"));
  if (!studies.length) return;

  studies.forEach(function (study) {
    var video = study.querySelector(".study__video");
    if (!video) return;
    var loaded = false;

    function start() {
      if (reduce) return;
      if (!loaded) {
        var src = video.getAttribute("data-src");
        if (src) { video.src = src; loaded = true; }
      }
      video.muted = true;
      video.playsInline = true;
      study.classList.add("is-previewing");
      var p = video.play();
      if (p && p.catch) p.catch(function () {});   // ignore interrupted/blocked play
    }

    function stop() {
      study.classList.remove("is-previewing");
      if (!loaded) return;
      try { video.pause(); video.currentTime = 0; } catch (e) {}
    }

    study.addEventListener("mouseenter", start);
    study.addEventListener("mouseleave", stop);
    study.addEventListener("focusin", start);
    study.addEventListener("focusout", function (e) {
      if (!study.contains(e.relatedTarget)) stop();
    });
  });
})();

/* ============================================================
   REEL — homepage portfolio marquee
   Duplicates the card group for a seamless CSS loop, lazily
   attaches video sources when the reel nears the viewport,
   silently previews a clip on hover, and opens it (with sound
   + controls) in a cs-modal lightbox on click.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var marquee = document.getElementById("reelMarquee");
  if (!marquee) return;

  var track = marquee.querySelector(".reel__track");
  var group = track.querySelector(".reel__group");
  if (!track || !group) return;

  /* ---------- seamless loop: decorative duplicate of the group ---------- */
  if (!reduce) {
    var clone = group.cloneNode(true);
    clone.classList.add("reel__group--clone");
    clone.setAttribute("aria-hidden", "true");
    Array.prototype.forEach.call(clone.querySelectorAll(".reel-card"), function (btn) {
      btn.tabIndex = -1;
    });
    track.appendChild(clone);
  }

  var cards = Array.prototype.slice.call(track.querySelectorAll(".reel-card"));

  /* ---------- lazy source loading (first frame as the still) ---------- */
  var sourcesLoaded = false;
  function loadSources() {
    if (sourcesLoaded) return;
    sourcesLoaded = true;
    cards.forEach(function (card) {
      var v = card.querySelector("video");
      if (!v) return;
      v.preload = "metadata";
      v.src = card.getAttribute("data-src") + "#t=0.1";
    });
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadSources();
        obs.disconnect();
      });
    }, { rootMargin: "600px 0px" });
    io.observe(marquee);
  } else {
    loadSources();
  }

  /* ---------- hover / focus: silent inline preview ---------- */
  cards.forEach(function (card) {
    var video = card.querySelector("video");
    if (!video) return;

    function start() {
      loadSources();
      video.muted = true;
      video.playsInline = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    function stop() {
      try { video.pause(); video.currentTime = 0.1; } catch (e) {}
    }

    card.addEventListener("mouseenter", start);
    card.addEventListener("mouseleave", stop);
    card.addEventListener("focus", start);
    card.addEventListener("blur", stop);
  });

  /* ---------- lightbox (markup + behavior mirror case-study.js) ---------- */
  var modal = document.createElement("div");
  modal.className = "cs-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="cs-modal__overlay" data-close></div>' +
    '<div class="cs-modal__dialog" role="dialog" aria-modal="true" aria-label="Ad creative">' +
      '<button class="cs-modal__close" type="button" aria-label="Close video" data-close>&times;</button>' +
      '<div class="cs-modal__stage"></div>' +
    "</div>";
  document.body.appendChild(modal);

  var stage = modal.querySelector(".cs-modal__stage");
  var closeBtn = modal.querySelector(".cs-modal__close");
  var lastFocused = null;

  function openModal(url) {
    lastFocused = document.activeElement;
    stage.innerHTML = "";
    var v = document.createElement("video");
    v.src = url;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = "auto";
    stage.appendChild(v);

    modal.hidden = false;
    document.body.classList.add("cs-modal-open");
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    closeBtn.focus();
  }

  function closeModal() {
    var v = stage.querySelector("video");
    if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    stage.innerHTML = "";
    modal.hidden = true;
    document.body.classList.remove("cs-modal-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  track.addEventListener("click", function (e) {
    var card = e.target.closest(".reel-card");
    if (!card) return;
    openModal(card.getAttribute("data-src"));
  });

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
})();
