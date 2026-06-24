# 3D Fort Kit Planner

A realtime Three.js web app for planning ball-and-stick kids' fort builds before constructing them physically.

The app is designed around the commercial fort-kit pattern shown in the linked connector: a **rhombicuboctahedron-like** ball with **18 socket holes** on its square faces and **one fixed stick length**. The 18 allowed directions are modeled as **6 straight axis sockets plus 12 face-diagonal 45° sockets**. That creates non-obvious triangular/bracing shapes while still rejecting impossible rods such as square diagonals.

Connector visuals are informed by Shane7986's Thingiverse model [Coupling Ball for Fort Building](https://www.thingiverse.com/thing:4264562), whose page describes compatibility with `.375 in` round rods/dowels and the Discovery Kids Fort Building Kit. The Thingiverse page lists the license as CC BY 4.0. This app does not embed the STL; it uses a lightweight Three.js faceted approximation with visible dark socket holes for realtime planning.

## Features

- Realtime Three.js 3D scene with orbit camera
- Add, connect, move, and delete connector balls/sticks
- Multi-select balls, connect all valid selected pairs, and move selections together
- WYSIWYG connection mode with semitransparent preview rods/endpoints
- Stick-length slider that rescales every existing ball/stick plus all future previews/templates
- 18-hole connector model with faceted blue ball and visible socket holes
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
