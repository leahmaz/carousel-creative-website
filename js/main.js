/* ============================================================
   Carousel Creative — interactions
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- nav: subtle border on scroll ---------- */
  var nav = document.getElementById("nav");
  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* ---------- reveal on scroll ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObs = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          // stagger siblings within the same parent group
          var siblings = Array.prototype.slice.call(
            el.parentElement.querySelectorAll(":scope > .reveal")
          );
          var idx = siblings.indexOf(el);
          el.style.transitionDelay = (idx > 0 ? Math.min(idx, 6) * 70 : 0) + "ms";
          el.classList.add("in-view");
          obs.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- process timeline draw ---------- */
  var timeline = document.getElementById("timeline");
  var progress = document.getElementById("timelineProgress");
  var steps = timeline
    ? Array.prototype.slice.call(timeline.querySelectorAll(".timeline__step"))
    : [];

  if (timeline && progress && "IntersectionObserver" in window && !reduceMotion) {
    var drawn = false;
    var tlObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || drawn) return;
          drawn = true;
          progress.style.width = "100%";
          steps.forEach(function (step, i) {
            setTimeout(function () { step.classList.add("is-lit"); }, 180 + i * 230);
          });
        });
      },
      { threshold: 0.35 }
    );
    tlObs.observe(timeline);
  } else if (progress) {
    progress.style.width = "100%";
    steps.forEach(function (s) { s.classList.add("is-lit"); });
  }

  /* ---------- hero flow: traveling highlight + gentle re-settle ---------- */
  var flow = document.getElementById("flow");
  if (flow && !reduceMotion) {
    var cards = Array.prototype.slice.call(flow.querySelectorAll(".flow__card"));
    var active = 0;

    function highlight() {
      cards.forEach(function (c, i) {
        c.classList.toggle("is-active", i === active);
      });
      active = (active + 1) % cards.length;
    }
    highlight();
    var hi = setInterval(highlight, 2400);

    // Every few seconds the whole flow gently re-settles top-to-bottom: each card
    // fades up in sequence. Order is preserved (the pipeline stays legible) but the
    // panel feels alive, as if the insight is being recomputed.
    function resettle() {
      cards.forEach(function (card, i) {
        setTimeout(function () {
          card.style.transition = "transform .55s var(--ease), opacity .55s var(--ease)";
          card.style.transform = "translateY(10px)";
          card.style.opacity = "0.35";
          setTimeout(function () {
            card.style.transform = "";
            card.style.opacity = "";
          }, 240);
        }, i * 120);
      });
    }
    var re = setInterval(resettle, 6400);

    // pause timers when tab is hidden, resume on return
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearInterval(hi);
        clearInterval(re);
      } else {
        hi = setInterval(highlight, 2400);
        re = setInterval(resettle, 6400);
      }
    });
  }

  /* ---------- FAQ open/close is handled natively by <details>,
       animated via CSS ::details-content (see styles.css). No JS needed. ---------- */

  /* ---------- smooth-scroll offset for sticky nav ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
})();
