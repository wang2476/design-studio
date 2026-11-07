import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addOption, decide, parseRound, reopen, serialize, setStatus, toggleCheck, type Round } from './round.ts';

const base: Round = { question: 'Which toast?', options: [], decision: null };

describe('decision rounds', () => {
  it('numbers options one past the highest ever used, and ignores duplicates', () => {
    let r = addOption(addOption(base, 'a.swiftview'), 'b.swiftview');
    r = { ...r, options: r.options.filter(o => o.n !== 1) };
    r = addOption(addOption(r, 'c.swiftview'), 'b.swiftview');
    assert.deepEqual(r.options.map(o => [o.n, o.path]), [[2, 'b.swiftview'], [3, 'c.swiftview']]);
  });

  it('picking rejects the other open options but leaves superseded ones', () => {
    let r = ['a', 'b', 'c'].reduce((acc, p) => addOption(acc, `${p}.tsx`), base);
    r = setStatus(r, 3, 'superseded');
    r = decide(r, 2, 'calmer', ['ship it', ' '], '2026-11-07');
    assert.deepEqual(r.options.map(o => o.status), ['rejected', 'picked', 'superseded']);
    assert.partialDeepStrictEqual(r.decision, { option: 2, why: 'calmer', date: '2026-11-07', checks: [{ text: 'ship it', done: false }] });
  });

  it('needs a reason and a real option', () => {
    const r = addOption(base, 'a.tsx');
    assert.throws(() => decide(r, 1, '  '), /why/);
    assert.throws(() => decide(r, 9, 'x'), /#9/);
  });

  it('reopening clears the pick and returns it to open', () => {
    const r = reopen(decide(addOption(addOption(base, 'a.tsx'), 'b.tsx'), 1, 'x'));
    assert.equal(r.decision, null);
    assert.deepEqual(r.options.map(o => o.status), ['open', 'rejected']);
  });

  it('toggles a check', () => {
    const r = toggleCheck(decide(addOption(base, 'a.tsx'), 1, 'x', ['one']), 0);
    assert.equal(r.decision?.checks[0].done, true);
  });

  it('round-trips through the file, keeping studioId, and drops bad options and decisions', () => {
    const source = JSON.stringify({ studioId: 'id', question: 'Q', options: [
      { n: 1, path: 'a.tsx' }, { n: 1, path: 'dup.tsx' }, { n: 2, path: '../escape.tsx' }, { n: 0, path: 'zero.tsx' },
    ], decision: { option: 7, why: 'x' } });
    const parsed = parseRound(source);
    if ('error' in parsed) throw new Error(parsed.error);
    assert.deepEqual(parsed.options.map(o => o.path), ['a.tsx']);
    assert.equal(parsed.decision, null);
    assert.equal(JSON.parse(serialize(source, parsed)).studioId, 'id');
    assert.equal('error' in parseRound('{"question":" "}'), true);
  });
});
