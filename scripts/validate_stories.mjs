import fs from 'fs';
import path from 'path';

const STATUSES = new Set(['pending', 'done', 'processing']);
const EFFECTS = new Set([
  'zoom_in',
  'zoom_out',
  'pan_right',
  'pan_left',
  'shake',
  'handheld',
  'push_up',
]);
const SHOTS = new Set([
  'wide',
  'medium',
  'close',
  'back',
  'silhouette',
  'empty',
  'double',
  'two_shot',
]);
const storiesPath = path.resolve('./stories.json');

function fail(message) {
  console.error(`stories.json: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(storiesPath)) {
  fail('file is missing');
}

let stories;
try {
  stories = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
} catch (err) {
  fail(`is not valid JSON (${err.message})`);
}

if (!Array.isArray(stories)) {
  fail('must be a JSON array of stories');
}

const ids = new Set();
let pending = 0;

for (const [index, story] of stories.entries()) {
  const label = `story[${index}]`;
  if (!story || typeof story !== 'object') {
    fail(`${label} must be an object`);
  }
  if (!story.id || typeof story.id !== 'string') {
    fail(`${label} needs a string "id"`);
  }
  if (ids.has(story.id)) {
    fail(`duplicate id "${story.id}"`);
  }
  ids.add(story.id);
  if (!STATUSES.has(story.status)) {
    fail(`${label} (${story.id}) status must be pending, done, or processing`);
  }
  if (!story.title || typeof story.title !== 'string') {
    fail(`${label} (${story.id}) needs a string "title"`);
  }
  if (!Array.isArray(story.scenes) || story.scenes.length === 0) {
    fail(`${label} (${story.id}) needs a non-empty "scenes" array`);
  }
  if (story.status === 'pending') {
    pending += 1;
    if (story.id !== 'story_01' && story.scenes.length < 30) {
      fail(`${label} (${story.id}) pending feature stories need at least 30 scenes`);
    }
    if (story.id !== 'story_01' && story.scenes.length > 45) {
      fail(`${label} (${story.id}) has more than 45 scenes`);
    }
    if (story.id !== 'story_01') {
      if (!story.artStyle || typeof story.artStyle !== 'string') {
        fail(`${label} (${story.id}) needs a locked "artStyle"`);
      }
      if (!Array.isArray(story.characters) || story.characters.length === 0) {
        fail(`${label} (${story.id}) needs a non-empty "characters" array`);
      }
      const charIds = new Set();
      for (const [cIndex, character] of story.characters.entries()) {
        const cLabel = `${label} characters[${cIndex}]`;
        if (!character.id || typeof character.id !== 'string') {
          fail(`${cLabel} needs a string "id"`);
        }
        if (charIds.has(character.id)) {
          fail(`${cLabel} duplicate character id "${character.id}"`);
        }
        charIds.add(character.id);
        if (!character.name || typeof character.name !== 'string') {
          fail(`${cLabel} needs a string "name"`);
        }
        if (!character.description || typeof character.description !== 'string') {
          fail(`${cLabel} needs a locked "description"`);
        }
        if (!Number.isInteger(character.seed) || character.seed < 1 || character.seed > 2147483647) {
          fail(`${cLabel} needs an integer "seed" between 1 and 2147483647`);
        }
      }
    }
  }

  for (const [sceneIndex, scene] of story.scenes.entries()) {
    const sceneLabel = `${label} scene[${sceneIndex}]`;
    if (!scene.narration || typeof scene.narration !== 'string') {
      fail(`${sceneLabel} needs a "narration" string`);
    }
    if (!scene.visualPrompt || typeof scene.visualPrompt !== 'string') {
      fail(`${sceneLabel} needs a "visualPrompt" string`);
    }
    if (scene.effect && !EFFECTS.has(scene.effect)) {
      fail(
        `${sceneLabel} effect "${scene.effect}" is invalid (use zoom_in, zoom_out, pan_right, pan_left, shake, handheld, or push_up)`,
      );
    }
    if (scene.shot && !SHOTS.has(scene.shot)) {
      fail(
        `${sceneLabel} shot "${scene.shot}" is invalid (use wide, medium, close, back, silhouette, empty, double, or two_shot)`,
      );
    }
  }
}

console.log(
  `stories.json OK: ${stories.length} stories, ${pending} pending, ${ids.size} unique ids`,
);
