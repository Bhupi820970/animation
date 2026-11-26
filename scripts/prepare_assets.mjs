import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const storiesPath = './stories.json';
const publicDir = './public';
const MAX_IMAGE_ATTEMPTS = 3;
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

function safeSeed(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n)) return 1;
  const max = 2147483647;
  return ((n % max) + max) % max;
}

function imageUrlCandidates(prompt, seed, width, height, model) {
  const encoded = encodeURIComponent(prompt);
  const seedValue = safeSeed(seed);
  const officialQuery = `width=${width}&height=${height}&model=${encodeURIComponent(model)}&seed=${seedValue}`;
  const urls = [];
  if ((process.env.POLLINATIONS_API_KEY || '').trim()) {
    // Official API rejects unknown query params such as nologo, and seed must be <= 2147483647.
    urls.push({
      host: 'gen.pollinations.ai',
      model,
      url: `https://gen.pollinations.ai/image/${encoded}?${officialQuery}`,
    });
  }
  urls.push({
    host: 'image.pollinations.ai',
    model,
    url: `https://image.pollinations.ai/prompt/${encoded}?${officialQuery}&nologo=true`,
  });
  return urls;
}

function convertToJpeg(srcPath, destPath) {
  execFileSync(
    'ffmpeg',
    ['-y', '-i', srcPath, '-q:v', '2', destPath],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function briefApiError(buf, status) {
  if (isImageBuffer(buf)) {
    return `HTTP ${status} (image body, ${buf.length} bytes)`;
  }
  try {
    const parsed = JSON.parse(buf.toString('utf8'));
    const message = parsed?.error?.message || parsed?.message || parsed?.error || parsed;
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    return `HTTP ${status}: ${text.slice(0, 180)}`;
  } catch {
    const raw = buf.toString('utf8').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    return `HTTP ${status}: ${raw.slice(0, 180) || 'non-text body'}`;
  }
}

function saveImageBuffer(buf, destPath) {
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
    return false;
  }
  console.log(`Saved ${path.basename(destPath)} (${written.length} bytes)`);
  return true;
}

async function tryPollinationsImage(prompt, destPath, seed) {
  let lastError = 'unknown error';
  const hasKey = Boolean((process.env.POLLINATIONS_API_KEY || '').trim());
  const models = hasKey ? ['flux'] : ['flux'];
  const width = 1024;
  const height = 576;

  console.log(`Trying Pollinations${hasKey ? ' with API key' : ' without API key'}; models: ${models.join(', ')}`);

  for (const model of models) {
    const candidates = imageUrlCandidates(prompt, seed, width, height, model);
    for (const candidate of candidates) {
      try {
        console.log(`Pollinations request: host=${candidate.host} model=${model}`);
        const res = await fetch(candidate.url, { headers: authHeaders() });
        const buf = Buffer.from(await res.arrayBuffer());
        lastError = briefApiError(buf, res.status);

        if (res.status === 401 || res.status === 402) {
          console.log(`Pollinations ${candidate.host} model=${model} ${lastError}. Not making any payment; trying the next free option.`);
          continue;
        }

        if (res.status === 503 || res.status === 429) {
          const retryAfterSec = Number(res.headers.get('retry-after'));
          const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 5000;
          console.log(`Pollinations busy (${lastError}), waiting ${Math.round(waitMs / 1000)}s and retrying once`);
          await sleep(waitMs);
          const retry = await fetch(candidate.url, { headers: authHeaders() });
          const retryBuf = Buffer.from(await retry.arrayBuffer());
          lastError = briefApiError(retryBuf, retry.status);
          if (retry.status === 401 || retry.status === 402) {
            console.log(`Pollinations ${candidate.host} model=${model} ${lastError}. Not making any payment; trying the next free option.`);
            continue;
          }
          if (retry.ok && isImageBuffer(retryBuf) && retryBuf.length >= MIN_IMAGE_BYTES && saveImageBuffer(retryBuf, destPath)) {
            console.log(`Pollinations succeeded on retry: host=${candidate.host} model=${model}`);
            return true;
          }
          console.log(`Pollinations retry failed (${lastError})`);
          continue;
        }

        if (!res.ok) {
          console.log(`Pollinations ${candidate.host} model=${model} ${lastError}`);
          continue;
        }

        if (!isImageBuffer(buf) || buf.length < MIN_IMAGE_BYTES) {
          lastError = `invalid image body (${buf.length} bytes)`;
          console.log(`Pollinations ${candidate.host} model=${model} returned a non-image`);
          continue;
        }

        if (saveImageBuffer(buf, destPath)) {
          console.log(`Pollinations succeeded: host=${candidate.host} model=${model}`);
          return true;
        }
        lastError = 'converted file was not a valid JPEG';
      } catch (err) {
        lastError = err.message || String(err);
        console.log(`Pollinations ${candidate.host} model=${model} failed: ${lastError}`);
      }
    }
  }

  console.log(`Pollinations did not return a valid image (${lastError})`);
  return false;
}

async function tryGeminiImage(prompt, destPath) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return false;

  const models = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
  for (const model of models) {
    try {
      console.log(`Trying Gemini image model ${model}...`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${prompt}\nNo text, no watermark, no logo, no caption.`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['IMAGE'],
              imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
            },
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) {
        const message = payload?.error?.message || `HTTP ${res.status}`;
        console.log(`Gemini ${model} failed: ${message}`);
        continue;
      }
      const parts = payload?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
      const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
      if (!b64) {
        console.log(`Gemini ${model} returned no image data`);
        continue;
      }
      const buf = Buffer.from(b64, 'base64');
      if (isImageBuffer(buf) && saveImageBuffer(buf, destPath)) return true;
      console.log(`Gemini ${model} returned a non-image payload`);
    } catch (err) {
      console.log(`Gemini ${model} failed: ${err.message || String(err)}`);
    }
  }
  return false;
}

function renderLocalImage(prompt, destPath, seed) {
  console.log('Using local paper-cutout fallback for this scene');
  execFileSync(
    'python3',
    [
      'scripts/local_scene.py',
      '--prompt',
      prompt,
      '--out',
      destPath,
      '--seed',
      String(seed),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const written = fs.readFileSync(destPath);
  if (written.length < MIN_IMAGE_BYTES || !isJpeg(written)) {
    throw new Error('Local fallback did not write a valid JPEG');
  }
  console.log(`Saved ${path.basename(destPath)} (${written.length} bytes, local fallback)`);
}

async function createSceneImage(prompt, destPath, seed) {
  if (await tryPollinationsImage(prompt, destPath, seed)) return 'pollinations';
  if (await tryGeminiImage(prompt, destPath)) return 'gemini';
  renderLocalImage(prompt, destPath, seed);
  return 'local';
}

const PROMPT_BAN =
  'Absolutely no text, no letters, no typography, no captions, no subtitles, no watermarks, no logos, no signatures, no UI, no writing of any kind.';

function buildVisualPrompt(story, scene) {
  return [story.artStyle, story.character, scene.visualPrompt, PROMPT_BAN]
    .filter(Boolean)
    .join(' ');
}

function inferParticles(text) {
  const value = (text || '').toLowerCase();
  if (/(rain|thunderstorm|downpour)/.test(value)) return 'rain';
  if (/(ember|fire|flame|ash|burn|lantern)/.test(value)) return 'embers';
  return 'dust';
}

function inferSfx(effect, index) {
  if (effect === 'shake' || effect === 'handheld') return 'sfx_boom.mp3';
  if (index === 0) return 'sfx_paper.mp3';
  if (index % 4 === 0) return 'sfx_whoosh.mp3';
  return null;
}

function generateVoice(narration, audioPath, wordsPath, voice) {
  execFileSync(
    'python3',
    [
      'scripts/tts_scene.py',
      '--text',
      narration,
      '--out',
      audioPath,
      '--words',
      wordsPath,
      '--voice',
      voice,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const size = fs.statSync(audioPath).size;
  if (size < 1000) {
    throw new Error(`Voice file is too small (${size} bytes)`);
  }
}

function wordsToFrames(wordsPath) {
  if (!fs.existsSync(wordsPath)) return [];
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  return words.map((word) => ({
    word: word.word,
    from: Math.max(0, Math.round(word.start * 30)),
    to: Math.max(1, Math.round(word.end * 30)),
  }));
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
const sourceCounts = { pollinations: 0, gemini: 0, local: 0 };
const fallbackScenes = [];
const voice = story.voice || 'en-GB-RyanNeural';

for (let i = 0; i < story.scenes.length; i++) {
  const scene = story.scenes[i];
  const audioFile = `audio_${i}.mp3`;
  const imageFile = `image_${i}.jpg`;
  const wordsFile = `words_${i}.json`;
  const audioPath = path.join(publicDir, audioFile);
  const imagePath = path.join(publicDir, imageFile);
  const wordsPath = path.join(publicDir, wordsFile);

  console.log(`Generating voice for scene ${i + 1}/${story.scenes.length}...`);
  generateVoice(scene.narration, audioPath, wordsPath, voice);
  const durationSec = audioDurationSeconds(audioPath) + 0.35;

  console.log(`Generating image for scene ${i + 1}/${story.scenes.length}...`);
  const prompt = buildVisualPrompt(story, scene);
  const source = await createSceneImage(prompt, imagePath, Date.now() + i * 17);
  sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  if (source === 'local') fallbackScenes.push(i);
  if (source === 'pollinations' && i < story.scenes.length - 1) await sleep(2200);

  const effect = scene.effect || 'zoom_in';
  processedScenes.push({
    narration: scene.narration,
    effect,
    audioFile,
    imageFile,
    words: wordsToFrames(wordsPath),
    particles: scene.particles || inferParticles(`${scene.visualPrompt} ${scene.narration}`),
    sfxFile: inferSfx(effect, i),
    imageSource: source,
    durationInFrames: Math.max(60, Math.ceil(durationSec * 30)),
  });
}

const sceneSeconds = processedScenes.reduce((sum, scene) => sum + scene.durationInFrames / 30, 0);
const musicSeconds = Math.max(90, Math.ceil(sceneSeconds + 20));
console.log(`Building original CC0 soundtrack (${musicSeconds}s) and film grain...`);
execFileSync(
  'python3',
  [
    'scripts/make_soundtrack.py',
    '--out-dir',
    publicDir,
    '--seconds',
    String(musicSeconds),
    '--seed',
    String(Math.abs(String(story.id || 'story').split('').reduce((s, ch) => s + ch.charCodeAt(0), 0))),
  ],
  { stdio: ['inherit', 'inherit', 'inherit'] },
);

const manifest = {
  title: story.title,
  description: story.description || '',
  storyId: story.id,
  genre: story.genre || '',
  imageSource: Object.entries(sourceCounts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}:${count}`)
    .join(','),
  fallbackScenes,
  titleDurationInFrames: 60,
  endCardDurationInFrames: 225,
  overlapFrames: 12,
  musicFile: 'music.mp3',
  grainFile: 'grain.jpg',
  scenes: processedScenes,
};

fs.writeFileSync(
  path.join(publicDir, 'current_video.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  `All assets prepared successfully. Image sources: ${manifest.imageSource || 'none'}. Story will be marked done only after a successful render.`,
);
