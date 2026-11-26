import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const storiesPath = './stories.json';
const publicDir = './public';

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
const storyIndex = stories.findIndex((s) => s.status === 'pending');

if (storyIndex === -1) {
  console.log('No pending stories found in stories.json!');
  process.exit(0);
}

const story = stories[storyIndex];
console.log(`Processing Story: ${story.title}`);

const processedScenes = [];

for (let i = 0; i < story.scenes.length; i++) {
  const scene = story.scenes[i];
  const audioFile = `audio_${i}.mp3`;
  const imageFile = `image_${i}.jpg`;
  const audioPath = path.join(publicDir, audioFile);
  const imagePath = path.join(publicDir, imageFile);

  // 1. Generate English Voiceover (Deep Storytelling Voice)
  console.log(`Generating voice for scene ${i + 1}...`);
  const safeText = scene.narration.replace(/"/g, '\\"');
  execSync(
    `edge-tts --voice "en-US-ChristopherNeural" --rate="-5%" --text "${safeText}" --write-media "${audioPath}"`,
  );

  // 2. Measure exact audio duration using ffprobe
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
  )
    .toString()
    .trim();
  const durationSec = parseFloat(durationStr) + 0.6; // 0.6s breathing pause

  // 3. Generate Story-Specific Paper Cutout Image (Free API)
  console.log(`Generating image for scene ${i + 1}...`);
  const encodedPrompt = encodeURIComponent(scene.visualPrompt);
  const imgUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&model=flux&seed=${Date.now() + i}`;

  const res = await fetch(imgUrl);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));

  processedScenes.push({
    narration: scene.narration,
    effect: scene.effect || 'zoom_in',
    audioFile,
    imageFile,
    durationInFrames: Math.ceil(durationSec * 30), // 30 FPS
  });
}

// Save manifest for Remotion
fs.writeFileSync(
  path.join(publicDir, 'current_video.json'),
  JSON.stringify({ title: story.title, scenes: processedScenes }, null, 2),
);

// Mark story as done
stories[storyIndex].status = 'done';
fs.writeFileSync(storiesPath, JSON.stringify(stories, null, 2));

console.log('All assets prepared successfully!');
