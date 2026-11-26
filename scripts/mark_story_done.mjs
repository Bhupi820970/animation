import fs from 'fs';
import path from 'path';

const storiesPath = './stories.json';
const selectedPath = path.join('public', 'selected_story_id.txt');

if (!fs.existsSync(selectedPath)) {
  console.error('No selected story id found. Did prepare-assets run?');
  process.exit(1);
}

const storyId = fs.readFileSync(selectedPath, 'utf-8').trim();
if (!storyId) {
  console.error('Selected story id is empty.');
  process.exit(1);
}

const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
const story = stories.find((item) => item.id === storyId);
if (!story) {
  console.error(`Story id "${storyId}" was not found in stories.json`);
  process.exit(1);
}

story.status = 'done';
fs.writeFileSync(storiesPath, `${JSON.stringify(stories, null, 2)}\n`);
console.log(`Marked ${storyId} as done`);
