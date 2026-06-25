import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONNECTOR_COLORS,
  SOCKET_DIRECTIONS,
  STICK_COLOR,
  addCubeBay,
  addEquilateralTriangle,
  addNode,
  addPitchedRoofBay,
  addStick,
  calculateParts,
  connectSelectedPairs,
  createEmptyDesign,
  createUndoHistory,
  deserializeDesign,
  distance,
  getSocketUsage,
  getConnectorColor,
  moveNodesByDelta,
  pickConnectorColor,
  pushUndoSnapshot,
  restoreUndoSnapshot,
  scaleDesignToRodLength,
  serializeDesign,
  setRodLength
} from '../app.js';

test.beforeEach(() => {
  setRodLength(1);
});

test('visual defaults use 2-unit rods, yellow/orange connector colors, and darker blue sticks', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(app, /export let ROD_LENGTH = 2/);
  assert.match(html, /id="stick-length"[^>]+value="2"/);
  assert.match(html, /id="stick-length-label">2\.00/);
  assert.deepEqual(CONNECTOR_COLORS, [0xffc928, 0xff7a2f]);
  assert.equal(STICK_COLOR, 0x0736c9);
  assert.equal(pickConnectorColor(() => 0), CONNECTOR_COLORS[0]);
  assert.equal(pickConnectorColor(() => 0.99), CONNECTOR_COLORS[1]);
  const design = createEmptyDesign();
  const node = addNode(design, { x: 0, y: 0, z: 0 });
  assert.ok(CONNECTOR_COLORS.includes(node.color));
  assert.equal(getConnectorColor(node), node.color);
});

test('18-hole socket model exposes 6 axis and 12 face-diagonal directions', () => {
  assert.equal(SOCKET_DIRECTIONS.length, 18);
  assert.equal(new Set(SOCKET_DIRECTIONS.map((socket) => socket.id)).size, 18);
  assert.equal(SOCKET_DIRECTIONS.filter((socket) => /^[XYZ][+-]$/.test(socket.id)).length, 6);
  assert.equal(SOCKET_DIRECTIONS.filter((socket) => /^(XY|XZ|YZ)/.test(socket.id)).length, 12);
});

test('cube bay uses 8 balls and 12 valid one-length sticks', () => {
  const design = createEmptyDesign();
  addCubeBay(design);
  const parts = calculateParts(design, { balls: 36, sticks: 64 });
  assert.equal(parts.balls, 8);
  assert.equal(parts.sticks, 12);
  assert.equal(parts.invalidSticks, 0);
  assert.equal(parts.duplicateSockets, 0);
  assert.equal(parts.withinInventory, true);
});

test('stick length slider logic rescales existing balls and sticks', () => {
  const design = createEmptyDesign();
  addCubeBay(design);
  const before = distance(design.nodes[0].position, design.nodes[1].position);
  const result = scaleDesignToRodLength(design, 1.5, 1);
  const after = distance(design.nodes[0].position, design.nodes[1].position);
  assert.equal(result.rodLength, 1.5);
  assert.ok(Math.abs(before - 1) < 0.001);
  assert.ok(Math.abs(after - 1.5) < 0.001);
  assert.equal(calculateParts(design).invalidSticks, 0);
  assert.match(serializeDesign(design), /"rodLength": 1\.5/);
});

test('equilateral triangle uses three 45-degree face-diagonal sockets', () => {
  const design = createEmptyDesign();
  addEquilateralTriangle(design);
  const parts = calculateParts(design, { balls: 3, sticks: 3 });
  assert.equal(parts.balls, 3);
  assert.equal(parts.sticks, 3);
  assert.equal(parts.invalidSticks, 0);
  assert.equal(parts.withinInventory, true);
});

test('strict connections reject off-length rods', () => {
  const design = createEmptyDesign();
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: 2, y: 0, z: 0 });
  const result = addStick(design, a.id, b.id, { strict: true });
  assert.equal(result.ok, false);
  assert.equal(design.sticks.length, 0);
});

test('strict connections reject off-angle rods even when length is correct', () => {
  const design = createEmptyDesign();
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: Math.cos(15 * Math.PI / 180), y: 0, z: Math.sin(15 * Math.PI / 180) });
  const result = addStick(design, a.id, b.id, { strict: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Off-angle/);
});

test('non-strict off-length rods are counted as invalid', () => {
  const design = createEmptyDesign();
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: 2, y: 0, z: 0 });
  const result = addStick(design, a.id, b.id, { strict: false });
  assert.equal(result.ok, true);
  const parts = calculateParts(design, { balls: 2, sticks: 1 });
  assert.equal(parts.invalidSticks, 1);
  assert.equal(parts.withinInventory, false);
});

test('socket holes cannot be reused in strict mode', () => {
  const design = createEmptyDesign();
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: 1, y: 0, z: 0 });
  const c = addNode(design, { x: 2, y: 0, z: 0 });
  assert.equal(addStick(design, a.id, b.id, { strict: true }).ok, true);
  assert.equal(addStick(design, a.id, c.id, { strict: true }).ok, false);
  assert.equal(getSocketUsage(design, a.id).length, 1);
});

test('selected balls can move together while preserving shape', () => {
  const design = createEmptyDesign();
  const [a, b, c] = addEquilateralTriangle(design);
  const before = distance(b.position, c.position);
  const result = moveNodesByDelta(design, [a.id, b.id, c.id], { x: 2, y: 0.5, z: -1 });
  assert.equal(result.ok, true);
  assert.equal(calculateParts(design).invalidSticks, 0);
  assert.ok(Math.abs(distance(b.position, c.position) - before) < 1e-9);
});

test('connect selected pairs connects valid selected nodes', () => {
  const design = createEmptyDesign();
  const s = 1 / Math.sqrt(2);
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: s, y: s, z: 0 });
  const c = addNode(design, { x: s, y: 0, z: s });
  const result = connectSelectedPairs(design, [a.id, b.id, c.id], { strict: true });
  assert.equal(result.added, 3);
  assert.equal(calculateParts(design).invalidSticks, 0);
});

test('connect selected pairs skips square diagonals because all sticks are same length', () => {
  const design = createEmptyDesign();
  const a = addNode(design, { x: 0, y: 0, z: 0 });
  const b = addNode(design, { x: 1, y: 0, z: 0 });
  const c = addNode(design, { x: 0, y: 0, z: 1 });
  const d = addNode(design, { x: 1, y: 0, z: 1 });
  const result = connectSelectedPairs(design, [a.id, b.id, c.id, d.id], { strict: true });
  assert.equal(result.added, 4);
  assert.equal(design.sticks.length, 4);
  assert.equal(calculateParts(design).invalidSticks, 0);
  assert.ok(result.messages.some((message) => message.includes('square diagonals cannot be connected')));
});

test('pitched roof template uses only equal-length face-diagonal and straight rods', () => {
  const design = createEmptyDesign();
  addPitchedRoofBay(design, { x: 0, y: 1, z: 0 });
  const parts = calculateParts(design);
  assert.equal(parts.invalidSticks, 0);
  assert.equal(parts.sticks, 7);
  const peak = design.nodes.find((node) => Math.abs(node.position.x - 1 / Math.sqrt(2)) < 0.01 && Math.abs(node.position.y - (1 + 1 / Math.sqrt(2))) < 0.01 && node.position.z === 0);
  const left = design.nodes.find((node) => node.position.x === 0 && node.position.y === 1 && node.position.z === 0);
  assert.ok(Math.abs(distance(peak.position, left.position) - 1) < 0.01);
});

test('designs serialize and restore ids', () => {
  const design = createEmptyDesign();
  addCubeBay(design);
  const restored = deserializeDesign(serializeDesign(design));
  assert.deepEqual(calculateParts(restored), calculateParts(design));
  assert.equal(restored.nextNodeId, 9);
  assert.equal(restored.nextStickId, 13);
});

test('undo snapshots restore the previous design and selected balls', () => {
  const design = createEmptyDesign();
  const history = createUndoHistory();
  const first = addNode(design, { x: 0, y: 0, z: 0 });
  pushUndoSnapshot(history, design, [first.id]);

  const second = addNode(design, { x: 1, y: 0, z: 0 });
  addStick(design, first.id, second.id, { strict: true });
  assert.equal(design.nodes.length, 2);
  assert.equal(design.sticks.length, 1);

  const undo = restoreUndoSnapshot(history);
  assert.equal(undo.ok, true);
  assert.deepEqual(undo.selected, [first.id]);
  assert.equal(undo.design.nodes.length, 1);
  assert.equal(undo.design.sticks.length, 0);
  assert.equal(undo.design.nextNodeId, 2);
  assert.equal(restoreUndoSnapshot(history).ok, false);
});

test('undo snapshots include stick length scale changes', () => {
  const design = createEmptyDesign();
  const history = createUndoHistory();
  addCubeBay(design);
  pushUndoSnapshot(history, design, []);
  scaleDesignToRodLength(design, 1.5, 1);

  const undo = restoreUndoSnapshot(history);
  assert.equal(undo.ok, true);
  assert.equal(undo.design.rodLength, 1);
  assert.ok(Math.abs(distance(undo.design.nodes[0].position, undo.design.nodes[1].position) - 1) < 0.001);
  assert.match(serializeDesign(undo.design), /\"rodLength\": 1/);
});

test('browser import map and controls exist', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /styles\.css\?v=mobile-tools/);
  assert.match(html, /class="panel build-panel"/);
  assert.ok(html.indexOf('data-mode="add"') < html.indexOf('data-mode="connect"'));
  assert.ok(html.indexOf('data-mode="connect"') < html.indexOf('data-mode="delete"'));
  assert.ok(html.indexOf('data-mode="delete"') < html.indexOf('data-mode="move"'));
  assert.ok(html.indexOf('data-mode="move"') < html.indexOf('data-mode="select"'));
  assert.match(html, /id="connect-selected"/);
  assert.match(html, /data-template="triangle"/);
  assert.match(html, /id="stick-length"/);
  assert.match(html, /id="undo"/);
  assert.match(html, /Undo last edit \(Ctrl\+Z\)/);
  assert.match(html, /Changing this rescales every existing ball and stick/);
  assert.match(html, /app\.js\?v=rod2-colors/);
  assert.match(app, /pushUndoSnapshot\(undoHistory, design, selected\)/);
  assert.match(app, /restoreUndoSnapshot\(undoHistory\)/);
  assert.match(app, /ctrlKey \|\| event\.metaKey/);
  assert.match(app, /scaleDesignToRodLength/);
  assert.match(app, /ConvexGeometry/);
  assert.match(app, /createConnectorGeometry/);
  assert.match(app, /face-diagonal sockets/);
});

test('mobile layout keeps the 3D scene visible and collapses controls to tool buttons plus undo', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 880px\)/);
  assert.match(css, /\.viewport \{\s*position: fixed;\s*inset: 0;\s*height: 100dvh;/);
  assert.match(css, /\.sidebar > :not\(\.build-panel\) \{ display: none; \}/);
  assert.match(css, /\.build-panel > :not\(\.tools\) \{ display: none; \}/);
  assert.match(css, /#fit-view \{ display: none; \}/);
  assert.match(css, /\.topbar > div:first-child \{ display: none; \}/);
});
