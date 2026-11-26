import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const storiesPath = './stories.json';
const publicDir = './public';
const MAX_IMAGE_ATTEMPTS = 8;
const MIN_IMAGE_BYTES = 8000;

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isJpeg(buf) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng(buf) {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function isWebp(buf) {
  return buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
}

function isImageBuffer(buf) {
  return isJpeg(buf) || isPng(buf) || isWebp(buf);
}

function authHeaders() {
  const headers = {
    'User-Agent': 'animation-factory/1.0',
    Accept: 'image/*,application/json',
  };
  const key = (process.env.POLLINATIONS_API_KEY || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function imageUrlCandidates(prompt, seed, width, height) {
  const encoded = encodeURIComponent(prompt);
  const query = `width=${width}&height=${height}&nologo=true&model=flux&seed=${seed}`;
  const urls = [];
  if ((process.env.POLLINATIONS_API_KEY || '').trim()) {
    urls.push(`https://gen.pollinations.ai/image/${encoded}?${query}`);
  }
  urls.push(`https://image.pollinations.ai/prompt/${encoded}?${query}`);
  return urls;
}

function convertToJpeg(srcPath, destPath) {
  execFileSync(
    'ffmpeg',
    ['-y', '-i', srcPath, '-q:v', '2', destPath],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

async function downloadValidImage(prompt, destPath, seed) {
  let lastError = 'unknown error';
  const sizes = [
    [1920, 1080],
    [1280, 720],
  ];

  for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
    const [width, height] = sizes[attempt === 1 ? 0 : Math.min(1, sizes.length - 1)];
    const urls = imageUrlCandidates(prompt, seed + attempt, width, height);

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: authHeaders() });
        const buf = Buffer.from(await res.arrayBuffer());
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSec = Number(retryAfterHeader);
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : Math.min(15000, 4000 * attempt);

        if (res.status === 503 || res.status === 429) {
          lastError = `HTTP ${res.status}`;
          console.log(`Image API busy (${res.status}) on attempt ${attempt}, waiting ${Math.round(waitMs / 1000)}s`);
          await sleep(waitMs);
          break;
        }

        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          console.log(`Image API returned HTTP ${res.status} on attempt ${attempt}`);
          continue;
        }

        if (!isImageBuffer(buf) || buf.length < MIN_IMAGE_BYTES) {
          lastError = `invalid image body (${buf.length} bytes)`;
          console.log(`Image API returned a non-image on attempt ${attempt}, retrying`);
          continue;
        }

        if (isJpeg(buf)) {
          fs.writeFileSync(destPath, buf);
        } else {
          const tmpPath = `${destPath}.tmp`;
          fs.writeFileSync(tmpPath, buf);
          convertToJpeg(tmpPath, destPath);
          fs.unlinkSync(tmpPath);
        }

        const written = fs.readFileSync(destPath);
        if (written.length < MIN_IMAGE_BYTES || !isJpeg(written)) {
          lastError = 'converted file was not a valid JPEG';
          continue;
        }
        console.log(`Saved ${path.basename(destPath)} (${written.length} bytes)`);
        return;
      } catch (err) {
        lastError = err.message || String(err);
        console.log(`Image download failed on attempt ${attempt}: ${lastError}`);
      }
    }

    await sleep(Math.min(15000, 4000 * attempt));
  }

  throw new Error(`Could not generate a valid scene image after ${MAX_IMAGE_ATTEMPTS} attempts (${lastError})`);
}

function generateVoice(narration, audioPath, textPath) {
  fs.writeFileSync(textPath, narration, 'utf-8');
  execFileSync(
    'edge-tts',
    [
      '--voice',
      'en-US-ChristopherNeural',
      '--rate=-5%',
      '--file',
      textPath,
      '--write-media',
      audioPath,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const size = fs.statSync(audioPath).size;
  if (size < 1000) {
    throw new Error(`Voice file is too small (${size} bytes)`);
  }
}

function audioDurationSeconds(audioPath) {
  const durationStr = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ],
    { encoding: 'utf-8' },
  ).trim();
  const duration = parseFloat(durationStr);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration from ${audioPath}`);
  }
  return duration;
}

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
const story = stories.find((item) => item.status === 'pending');

if (!story) {
  console.log('No pending stories found in stories.json.');
  writeOutput('has_story', 'false');
  process.exit(0);
}

console.log(`Processing story: ${story.id} — ${story.title}`);
writeOutput('has_story', 'true');
writeOutput('story_id', story.id);
fs.writeFileSync(path.join(publicDir, 'selected_story_id.txt'), `${story.id}\n`);

const processedScenes = [];

for (let i = 0; i < story.scenes.length; i++) {
  const scene = story.scenes[i];
  const audioFile = `audio_${i}.mp3`;
  const imageFile = `image_${i}.jpg`;
  const textFile = `narration_${i}.txt`;
  const audioPath = path.join(publicDir, audioFile);
  const imagePath = path.join(publicDir, imageFile);
  const textPath = path.join(publicDir, textFile);

  console.log(`Generating voice for scene ${i + 1}/${story.scenes.length}...`);
  generateVoice(scene.narration, audioPath, textPath);
  const durationSec = audioDurationSeconds(audioPath) + 0.6;

  console.log(`Generating image for scene ${i + 1}/${story.scenes.length}...`);
  await downloadValidImage(scene.visualPrompt, imagePath, Date.now() + i * 17);
  // Small gap so the free image API is less likely to throttle the next scene.
  if (i < story.scenes.length - 1) await sleep(2000);

  processedScenes.push({
    narration: scene.narration,
    effect: scene.effect || 'zoom_in',
    audioFile,
    imageFile,
    durationInFrames: Math.max(45, Math.ceil(durationSec * 30)),
  });
}

const manifest = {
  title: story.title,
  description: story.description || '',
  storyId: story.id,
  scenes: processedScenes,
};

fs.writeFileSync(
  path.join(publicDir, 'current_video.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log('All assets prepared successfully. Story will be marked done only after a successful render.');
