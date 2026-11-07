import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixPrompt, parseSwiftView } from './swiftView.ts';

const valid = JSON.stringify({
  image: 'toast_card_1.png', width: 402, height: 874, scale: 3,
  elements: [{ tag: 'ToastCard', file: 'ios/App/DesignLab/ToastCardLab.swift', line: 72, x: 108.2, y: 142, width: 185.7, height: 40 }, { tag: 'broken' }],
});

test('parses a DesignLab layout and drops malformed elements', () => {
  const view = parseSwiftView(valid);
  assert.ok(!('error' in view));
  assert.equal(view.scale, 3);
  assert.deepEqual(view.elements.map(e => e.tag), ['ToastCard']);
});

test('rejects bad JSON, path escapes, non-PNG images and missing size', () => {
  for (const bad of ['{', JSON.stringify({ image: '../x.png', width: 1, height: 1 }), JSON.stringify({ image: 'x.jpg', width: 1, height: 1 }), JSON.stringify({ image: 'x.png', width: 0, height: 1 })]) {
    assert.ok('error' in parseSwiftView(bad), bad);
  }
});

test('fix prompt names the tag, file:line and frame', () => {
  const view = parseSwiftView(valid);
  assert.ok(!('error' in view));
  const prompt = fixPrompt('toast_card_1', view.elements[0], 'make it 12pt taller');
  assert.match(prompt, /"ToastCard" \(ios\/App\/DesignLab\/ToastCardLab\.swift:72, x 108\.2, y 142, 185\.7 × 40 pt\)/);
  assert.match(prompt, /make it 12pt taller/);
});
