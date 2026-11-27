import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  inferAppearance,
  inferExpression,
  inferGesture,
  inferShot,
  normalizeAppearance,
  pickNextRenderableStory,
  validateStories,
  validateStory,
} from '../scripts/lib/story_schema.mjs';

const stories = JSON.parse(readFileSync(new URL('../stories.json', import.meta.url), 'utf-8'));

describe('stories.json parsing', () => {
  it('validates the repo stories.json', () => {
    const result = validateStories(stories);
    assert.deepEqual(result.errors, []);
    assert.ok(result.count >= 1);
    assert.ok(result.uniqueIds === result.count);
  });

  it('requires narration and visualPrompt on every scene', () => {
    const errors = validateStory({
      id: 'story_x',
      status: 'done',
      title: 'X',
      scenes: [{ narration: '', visualPrompt: 'background' }],
    });
    assert.ok(errors.some((error) => error.includes('narration')));
  });

  it('rejects an unknown shot and a missing character id', () => {
    const errors = validateStory({
      id: 'story_x',
      status: 'done',
      title: 'X',
      characters: [{ id: 'samira', name: 'Samira', description: 'A woman', seed: 1 }],
      scenes: [{ narration: 'Hello.', visualPrompt: 'A wall', shot: 'drone', characterId: 'hala' }],
    });
    assert.ok(errors.some((error) => error.includes('shot')));
    assert.ok(errors.some((error) => error.includes('characterId')));
  });
});

describe('appearance and performance inference', () => {
  it('locks Samira to a grey-coated woman with a notebook', () => {
    const samira = stories.find((story) => story.id === 'story_04').characters[0];
    const appearance = normalizeAppearance(samira);
    assert.equal(appearance.body, 'female');
    assert.equal(appearance.hair, 'tied_back');
    assert.equal(appearance.outfit, 'coat');
    assert.equal(appearance.accessory, 'notebook');
    assert.equal(appearance.palette.coat, '6D6A66');
  });

  it('infers a bearded man in a jacket from a description', () => {
    const appearance = inferAppearance({
      name: 'Cal',
      description: 'A man, broad, close dark beard, a worn blue denim jacket, grey undershirt.',
      palette: { coat: '3E5A7A', skin: 'C4966E', hair: '1A1410', pants: '3A3834', boots: '3A2A1C', shirt: '6A6864', accent: 'C2A06A' },
    });
    assert.equal(appearance.body, 'male');
    assert.equal(appearance.build, 'broad');
    assert.equal(appearance.facialHair, 'beard');
    assert.equal(appearance.outfit, 'jacket');
  });

  it('infers shot, expression, and gesture from narration', () => {
    assert.equal(inferShot({ narration: 'A tiny figure on the horizon.', visualPrompt: 'wide plain' }), 'wide');
    assert.equal(inferExpression({ narration: 'The first letter arrived for a girl who died last spring.' }), 'sad');
    assert.equal(inferGesture({ narration: 'I am Samira Nour. I translate for the team.' }), 'talk');
    assert.equal(inferGesture({ narration: 'She walks the green line every night.' }), 'walk');
  });
});

describe('queue picking', () => {
  it('skips an invalid pending story so it cannot block the queue', () => {
    const { story, skipped } = pickNextRenderableStory([
      {
        id: 'story_bad',
        status: 'pending',
        title: 'Broken',
        artStyle: 'paper',
        characters: [],
        scenes: Array.from({ length: 30 }, () => ({ narration: 'Hi.', visualPrompt: 'A wall' })),
      },
      stories.find((item) => item.status === 'pending'),
    ]);
    assert.equal(skipped[0].id, 'story_bad');
    assert.ok(story);
    assert.notEqual(story.id, 'story_bad');
  });

  it('ignores failed and done stories when picking the next render', () => {
    const pending = stories.find((item) => item.status === 'pending');
    const { story } = pickNextRenderableStory([
      { ...pending, id: 'already_done', status: 'done' },
      { ...pending, id: 'already_failed', status: 'failed' },
      pending,
    ]);
    assert.equal(story.id, pending.id);
  });
});

