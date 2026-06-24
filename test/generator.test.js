import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCards } from '../app.js';

test('generates requested number of deterministic cards', () => {
  const options = {
    age: 'early',
    space: 'indoor',
    energy: 'balanced',
    theme: 'space',
    count: 4,
    seed: 'rainy-sunday',
    materials: ['blankets', 'pillows', 'chairs']
  };
  const first = generateCards(options);
  const second = generateCards(options);
  assert.equal(first.length, 4);
  assert.deepEqual(first, second);
  assert.equal(first[0].theme, 'Space station');
  assert.ok(first[0].materials.length <= 3);
  assert.ok(first[0].mission.length > 20);
});

test('clamps card count and falls back to default materials', () => {
  const cards = generateCards({ count: 99, seed: 'clamp-test', theme: 'castle', materials: [] });
  assert.equal(cards.length, 12);
  assert.equal(cards[0].theme, 'Castle');
  assert.ok(cards.every((card) => card.materials.length > 0));
});
