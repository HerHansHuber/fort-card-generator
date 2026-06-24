# Fort Card Generator

A tiny static web app for generating printable kids' fort-building prompt cards: missions, materials, story sparks, STEM tests, safety notes, and age/space/energy tweaks.

I searched for an existing online generator for the phrase "Tiny Thinkers Fort" and did not find a clear dedicated generator. This project is an independent, brand-neutral alternative and is not affiliated with any toy brand.

## Features

- Fully static: plain HTML, CSS, and JavaScript
- Works offline after loading
- Repeatable generation with an optional seed
- Shareable URLs containing the selected settings
- Print-friendly card layout for Save as PDF
- GitHub Pages workflow included

## Local preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Deploy to GitHub Pages

This repository includes `.github/workflows/pages.yml`.

1. Push to `main`.
2. In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow publishes the static files.

If the repository is private, GitHub Pages availability depends on the account/plan. Public repositories work with GitHub Pages by default.
