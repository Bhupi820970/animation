import fs from 'fs';

const storiesPath = './stories.json';
const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
const requested = (process.argv[2] || '').trim();
const fromFile = fs.existsSync('./public/selected_story_id.txt')
  ? fs.readFileSync('./public/selected_story_id.txt', 'utf-8').trim()
  : '';
const storyId = requested || fromFile;
const reason = (process.env.FAIL_REASON || 'render or asset preparation failed').slice(0, 300);

if (!storyId) {
  console.log('No story id to mark as failed.');
  process.exit(0);
}

const story = stories.find((item) => item.id === storyId);
if (!story) {
  console.log(`Story ${storyId} was not found.`);
  process.exit(0);
}
if (story.status === 'done') {
  console.log(`Story ${storyId} is already done; leaving it alone.`);
  process.exit(0);
}

story.status = 'failed';
story.failReason = reason;
fs.writeFileSync(storiesPath, `${JSON.stringify(stories, null, 2)}\n`);
console.log(`Marked ${storyId} as failed so the next pending story can run. Reason: ${reason}`);
