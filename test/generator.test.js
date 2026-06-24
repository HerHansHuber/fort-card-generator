import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCubeBay,
  addNode,
  addPitchedRoofBay,
  addStick,
  calculateParts,
  createEmptyDesign,
  deserializeDesign,
  distance,
  serializeDesign
} from '../app.js';

test('cube bay uses 8 balls and 12 one-length sticks', () => {
  const design = createEmptyDesign();
  addCubeBay(design);
  const parts = calculateParts(design, { balls: 36, sticks: 64 });
  assert.equal(parts.balls, 8);
  assert.equal(parts.sticks, 12);
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

test('pitched roof template keeps sloped sides close to one rod', () => {
  const design = createEmptyDesign();
  addPitchedRoofBay(design, { x: 0, y: 1, z: 0 });
  assert.equal(calculateParts(design).invalidSticks, 0);
  const peak = design.nodes.find((node) => Math.abs(node.position.x - 0.5) < 0.01 && node.position.z === 0);
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
