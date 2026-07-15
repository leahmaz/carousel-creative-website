# Carousel Creative — Agency Website

The marketing site for [Carousel Creative](https://www.carouselcreative.com), a creative strategy and Meta advertising agency. Built as a hand-crafted static site — no framework, no build step — and deployed on Vercel.

## Stack

- **Static HTML/CSS/JS** — no build tooling; edit files and refresh
- **Vercel** — hosting + deploys on every push to `main` (canonical host: `www.carouselcreative.com`)
- **Cloudflare R2** — hosts the ad-creative videos shown on case study pages and the homepage reel
- **ConvertKit (Kit)** — lead-magnet email capture
- **Google Analytics 4** — `G-2HH9P55KXR`

## Pages

| Page | Notes |
| --- | --- |
| `index.html` | Homepage: hero, client logos, work reel, case studies, testimonials |
| `case-studies.html` | Case study index |
| `perfectly-snug.html`, `dove-dental.html`, `cuddle-kind.html`, `salonmonster.html`, `zlumber.html`, `article-furniture.html` | Individual case studies |
| `customer-research-canvas.html` | Lead-magnet landing page (ConvertKit form). Unlinked from nav |
| `connect.html` | Link-in-bio card, served at `/connect`. Noindexed, unlinked |
| `ai-projects.html` | AI projects portfolio, served at `/ai-projects`. Noindexed, unlinked |
| `404.html` | Not-found page |

Clean URLs for `/connect` and `/ai-projects` are rewrites in `vercel.json`. The unlisted pages carry `<meta name="robots" content="noindex">` and are excluded from `sitemap.xml`.

## Structure

```
css/styles-b.css      Single shared stylesheet (design tokens in :root)
js/main-b.js          Shared behavior: scroll reveals, hero/closing canvas
                      animations, testimonial slider + modal, case-study
                      hover previews, homepage work reel
js/case-study.js      Case-study pages: "Creative Examples" video grid +
                      lightbox, prev/next pager
case-studies/         Case-study hero videos (mp4) and poster images
ai-portfolio/         Screenshots for the /ai-projects page
logos/                Client logo images
hero-graphics/        Working files for hero artwork (not served)
```

Design system quick reference: warm paper/clay palette and type (Cambria/Caladea serif, Calibri/Carlito sans) are defined as CSS variables at the top of `styles-b.css`. New page-specific styles are prefixed per page (e.g. `lm-` lead magnet, `cn-` connect, `aip-` AI projects, `reel-`/`cs-` shared components).

## Local development

```sh
python3 -m http.server 4399
# then open http://localhost:4399
```

(Any static file server works; `.claude/launch.json` uses the command above.)

## Deploying

Push to `main` — Vercel builds and deploys automatically:

```sh
git push
```
