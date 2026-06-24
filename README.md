# 3D Fort Kit Planner

A realtime Three.js web app for planning ball-and-stick kids' fort builds before constructing them physically.

The app is designed around the common commercial fort-kit pattern used by Tiny Thinkers-style toys: spherical connector balls plus equal-length rods/sticks. I could not verify a public official dimensional spec from search results, so the planner keeps the important practical constraint configurable: **one connector ball per joint and one equal-length stick per valid connection**. You can enter the number of balls/sticks in your own box and the app shows whether the design fits.

## Features

- Realtime Three.js 3D scene with orbit camera
- Add, connect, move, and delete connector balls/sticks
- Strict one-stick-length mode for equal-length rod kits
- Live bill of materials:
  - balls/connectors needed
  - sticks/rods needed
  - off-length connections
  - inventory shortage vs owned parts
- Quick templates: cube bay, tunnel, pitched roof bay
- Share design as URL
- Download/load design JSON
- Static GitHub Pages deployment workflow

## Local preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Test

```bash
npm test
npm run check
```

## Deploy to GitHub Pages

This repository includes `.github/workflows/pages.yml`. Push to `main`; GitHub Pages deploys from the workflow.
