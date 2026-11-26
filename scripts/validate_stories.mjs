import fs from 'fs';
import path from 'path';

const STATUSES = new Set(['pending', 'done', 'processing']);
const EFFECTS = new Set(['zoom_in', 'zoom_out', 'pan_right', 'pan_left', 'shake']);
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
  if (story.status === 'pending') pending += 1;

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
        `${sceneLabel} effect "${scene.effect}" is invalid (use zoom_in, zoom_out, pan_right, pan_left, or shake)`,
      );
    }
  }
}

console.log(
  `stories.json OK: ${stories.length} stories, ${pending} pending, ${ids.size} unique ids`,
);
