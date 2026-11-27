import fs from 'fs';
import path from 'path';
import { validateStories } from './lib/story_schema.mjs';

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

const result = validateStories(stories);
if (result.errors.length) {
  for (const error of result.errors) fail(error);
}

console.log(
  `stories.json OK: ${result.count} stories, ${result.pending} pending, ${result.failed} failed, ${result.uniqueIds} unique ids`,
);
