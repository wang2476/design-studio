import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTime, parseVideoNotes, withNotes } from './videoNotes.ts';

describe('video notes', () => {
  it('parses, drops empty notes and puts whole-clip notes last', () => {
    const parsed = parseVideoNotes(JSON.stringify({ video: 'clip.mp4', notes: [
      { id: 'a', t: null, text: 'overall', author: 'user' },
      { id: 'b', t: 3.2, text: 'this ease', author: 'claude' },
      { id: 'c', t: 1, text: '   ' },
    ] }));
    assert.equal('error' in parsed, false);
    if ('error' in parsed) return;
    assert.deepEqual(parsed.notes.map(n => n.id), ['b', 'a']);
    assert.equal(parsed.notes[0].author, 'claude');
  });

  it('rejects a missing, non-video or escaping video path', () => {
    for (const video of [undefined, 'still.png', '../clip.mp4'])
      assert.equal('error' in parseVideoNotes(JSON.stringify({ video })), true);
  });

  it('keeps the studioId and other fields when notes change', () => {
    const next = JSON.parse(withNotes(JSON.stringify({ studioId: 'x', video: 'c.mp4', notes: [] }), { summary: 's', notes: [] }));
    assert.partialDeepStrictEqual(next, { studioId: 'x', video: 'c.mp4', summary: 's' });
  });

  it('formats times as m:ss.s', () => {
    assert.equal(formatTime(65.25), '1:05.3');
    assert.equal(formatTime(null), 'clip');
  });
});
