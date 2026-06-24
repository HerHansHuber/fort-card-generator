import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCKET_DIRECTIONS,
  addCubeBay,
  addEquilateralTriangle,
  addNode,
  addPitchedRoofBay,
  addStick,
  calculateParts,
  connectSelectedPairs,
  createEmptyDesign,
  deserializeDesign,
  distance,
  getSocketUsage,
  moveNodesByDelta,
  serializeDesign
} from '../app.js';

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

test('browser import map and controls exist', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /data-mode="select"/);
  assert.match(html, /id="connect-selected"/);
  assert.match(html, /data-template="triangle"/);
  assert.match(html, /app\.js\?v=rhombicuboctahedron-18-sockets/);
  assert.match(app, /ConvexGeometry/);
  assert.match(app, /createConnectorGeometry/);
  assert.match(app, /face-diagonal sockets/);
});
