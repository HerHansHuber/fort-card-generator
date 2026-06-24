# 3D Fort Kit Planner

A realtime Three.js web app for planning ball-and-stick kids' fort builds before constructing them physically.

The app is designed around the common commercial fort-kit pattern used by Tiny Thinkers-style toys: spherical connector balls with **18 possible socket angles** and **one fixed stick length**. The planner enforces that a rod can only connect two balls one stick-length apart, so square diagonals are rejected; triangles are built as equilateral triangles using the 60° socket directions.

## Features

- Realtime Three.js 3D scene with orbit camera
- Add, connect, move, and delete connector balls/sticks
- Multi-select balls, connect all valid selected pairs, and move selections together
- WYSIWYG connection mode with semitransparent preview rods/endpoints
- Fixed one-stick-length rods: no impossible square diagonals
- 18-hole connector model with visible socket markers
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
