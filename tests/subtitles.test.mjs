import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSrt,
  chunkTimedWords,
  formatSrtTime,
  hookTitleWords,
  narrationCues,
} from '../scripts/lib/subtitles.mjs';

describe('subtitle chunking', () => {
  it('groups timed words into lines of at most 8 words', () => {
    const words = Array.from({ length: 10 }, (_, i) => ({
      word: `w${i + 1}`,
      from: i * 10,
      to: i * 10 + 8,
    }));
    const cues = chunkTimedWords(words, 8);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, 'w1 w2 w3 w4 w5 w6 w7 w8');
    assert.equal(cues[1].text, 'w9 w10');
    assert.equal(cues[0].from, 0);
    assert.equal(cues[1].to, 98);
  });

  it('splits narration proportionally when timings are missing', () => {
    const cues = narrationCues('one two three four five six seven eight nine', 90, 8);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, 'one two three four five six seven eight');
    assert.equal(cues[1].text, 'nine');
    assert.equal(cues[0].from, 0);
    assert.equal(cues[1].to, 90);
  });
});

describe('srt and hook words', () => {
  it('writes valid SRT timestamps and keeps cues on the timeline', () => {
    assert.equal(formatSrtTime(0), '00:00:00,000');
    assert.equal(formatSrtTime(65.2), '00:01:05,200');
    const srt = buildSrt({
      titleDurationInFrames: 0,
      overlapFrames: 0,
      fps: 30,
      scenes: [
        {
          narration: 'The first letter arrived addressed to a girl who died last spring.',
          durationInFrames: 60,
          words: [
            { word: 'The', from: 0, to: 6 },
            { word: 'first', from: 6, to: 12 },
            { word: 'letter', from: 12, to: 20 },
          ],
        },
      ],
    });
    assert.match(srt, /^1\n00:00:00,000 --> 00:00:00,667\nThe first letter\n$/);
  });

  it('picks 3-4 punchy hook words for the thumbnail', () => {
    assert.deepEqual(
      hookTitleWords('The first letter arrived addressed to a girl who died last spring.'),
      ['GIRL', 'DIED', 'LAST', 'SPRING'],
    );
  });
});
