/* ============================================================
   Carousel Creative — Case-study "Creative Examples" module
   Reusable across case-study pages. Reads a JSON array of video
   URLs from [data-videos] on .cs-portfolio, auto-generates the
   captions from each filename, builds a small grid, and opens
   any clip in a lightbox modal.

   Caption rule (e.g. "PS_Hot Summer Nights.mp4" -> "HOT SUMMER NIGHTS"):
     - strip the leading two-letter client code + underscore
     - drop anything from the next underscore onward
     - replace hyphens/underscores with spaces
     - uppercase
   ============================================================ */
(function () {
  "use strict";

  var root = document.querySelector(".cs-portfolio");
  if (!root) return;

  var videos;
  try { videos = JSON.parse(root.getAttribute("data-videos") || "[]"); }
  catch (e) { videos = []; }
  if (!videos.length) return;

  function captionFromUrl(url) {
    var file = url.split("/").pop().split("?")[0].split("#")[0]; // filename only
    var name = file.replace(/\.[^.]+$/, "");                     // strip extension
    var parts = name.split("_");
    // parts[0] is the client code; the descriptive segment is parts[1]
    // (anything after the next underscore is ignored).
    var desc = parts.length > 1 ? parts[1] : parts[0];
    return desc.replace(/[-_]+/g, " ").trim().toUpperCase();
  }

  /* ---------- build the grid ---------- */
  var heading = document.createElement("p");
  heading.className = "cs-portfolio__title";
  heading.textContent = "Creative Examples";

  var grid = document.createElement("div");
  grid.className = "cs-portfolio__grid";

  videos.forEach(function (url) {
    var caption = captionFromUrl(url);

    var card = document.createElement("button");
    card.type = "button";
    card.className = "cs-vid";
    card.setAttribute("data-src", url);
    card.setAttribute("aria-label", "Play video: " + caption);

    var cap = document.createElement("span");
    cap.className = "cs-vid__caption";
    cap.textContent = caption;

    var frame = document.createElement("span");
    frame.className = "cs-vid__frame";

    var v = document.createElement("video");
    v.src = url + "#t=0.1";            // nudge to a frame so a still shows
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.tabIndex = -1;
    v.setAttribute("aria-hidden", "true");

    var play = document.createElement("span");
    play.className = "cs-vid__play";
    play.setAttribute("aria-hidden", "true");

    frame.appendChild(v);
    frame.appendChild(play);
    card.appendChild(cap);
    card.appendChild(frame);
    grid.appendChild(card);
  });

  root.appendChild(heading);
  root.appendChild(grid);

  /* ---------- lightbox modal (built once) ---------- */
  var modal = document.createElement("div");
  modal.className = "cs-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="cs-modal__overlay" data-close></div>' +
    '<div class="cs-modal__dialog" role="dialog" aria-modal="true" aria-label="Creative example">' +
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
    if (p && p.catch) p.catch(function () {}); // ignore autoplay rejection
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

  grid.addEventListener("click", function (e) {
    var card = e.target.closest(".cs-vid");
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

/* ============================================================
   Prev / next case-study pager (runs independently of the
   creative-examples module so every case-study page gets it).
   Edit this one ordered list to change the series.
   ============================================================ */
(function () {
  "use strict";

  var SERIES = [
    { file: "perfectly-snug.html",    n: "01", client: "Perfectly Snug",   headline: "From $1M a Year to $1M a Month" },
    { file: "dove-dental.html",       n: "02", client: "Dove Dental",       headline: "Turning Customer Conversations Into a Competitive Advantage" },
    { file: "cuddle-kind.html",       n: "03", client: "cuddle+kind",       headline: "High-Volume Production for a Premium Brand" },
    { file: "salonmonster.html",      n: "04", client: "salonMonster",      headline: "From No Creative to a Creative System for Software" },
    { file: "zlumber.html",           n: "05", client: "Zlumber",           headline: "From Trying to Crack Meta Ads to Finally Seeing Traction" },
    { file: "article-furniture.html", n: "06", client: "Article Furniture", headline: "Testing a New Furniture Category Before Scaling" }
  ];

  var current = (location.pathname.split("/").pop() || "").toLowerCase();
  var idx = -1;
  for (var i = 0; i < SERIES.length; i++) {
    if (SERIES[i].file.toLowerCase() === current) { idx = i; break; }
  }
  if (idx === -1) return; // not a known case-study page

  var anchor = document.querySelector(".closing") || document.querySelector("main");
  if (!anchor) return;

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function label(item) { return item.n + " " + item.client + ": " + item.headline; }

  var prev = idx > 0 ? SERIES[idx - 1] : null;
  var next = idx < SERIES.length - 1 ? SERIES[idx + 1] : null;

  function linkHtml(item, dir) {
    var dirLabel = dir === "prev" ? "Previous" : "Next";
    var arrow = '<span class="cs-pager__arrow" aria-hidden="true">' +
      (dir === "prev" ? "&larr;" : "&rarr;") + "</span>";
    var eyebrow = dir === "prev"
      ? '<span class="cs-pager__dir">' + arrow + "Previous</span>"
      : '<span class="cs-pager__dir">Next' + arrow + "</span>";
    var meta = '<span class="cs-pager__meta"><span class="cs-pager__num">' + esc(item.n) +
      '</span><span class="cs-pager__sep" aria-hidden="true">&middot;</span>' +
      '<span class="cs-pager__client">' + esc(item.client) + "</span></span>";
    var headline = '<span class="cs-pager__headline">' + esc(item.headline) + "</span>";
    return '<a class="cs-pager__link cs-pager__link--' + dir + '" href="' + item.file +
      '" aria-label="' + dirLabel + " case study: " + esc(label(item)) + '">' +
      eyebrow + meta + headline + "</a>";
  }

  var html = '<div class="wrap cs-pager__inner">';
  html += prev ? linkHtml(prev, "prev") : '<span class="cs-pager__spacer" aria-hidden="true"></span>';
  html += next ? linkHtml(next, "next") : '<span class="cs-pager__spacer" aria-hidden="true"></span>';
  html += "</div>";

  var nav = document.createElement("nav");
  nav.className = "cs-pager";
  nav.setAttribute("aria-label", "More case studies");
  nav.innerHTML = html;

  anchor.parentNode.insertBefore(nav, anchor);
})();
