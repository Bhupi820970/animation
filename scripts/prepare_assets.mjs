import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const storiesPath = './stories.json';
const publicDir = './public';
const MIN_IMAGE_BYTES = 8000;
const MIN_PNG_BYTES = 3000;
const TITLE_FRAMES = 60;
const END_FRAMES = 150;
const OVERLAP_FRAMES = 12;
const MIN_STORY_SEC = 180;
const MAX_STORY_SEC = 240;
const POSES = ['three_quarter', 'back'];

const POSE_PROMPTS = {
  three_quarter:
    'full-body paper-cutout puppet, three-quarter view facing slightly left, standing, arms relaxed, head to boots visible, same clothes',
  front:
    'full-body paper-cutout puppet, facing the camera straight on, standing, arms at the sides, head to boots visible, same clothes',
  back:
    'full-body paper-cutout puppet, rear view with back turned, face not visible, standing, same clothes, head to boots visible',
};

const PROMPT_BAN =
  'Absolutely no text, no letters, no typography, no captions, no subtitles, no watermarks, no logos, no signatures, no UI, no numbers, no writing of any kind. Blank unmarked papers, signs and screens only.';

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

function stableHash(text) {
  let h = 2166136261;
  for (const ch of String(text || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return safeSeed(h >>> 0);
}

function imageUrlCandidates(prompt, seed, width, height, model, extraQuery = {}) {
  const encoded = encodeURIComponent(prompt);
  const seedValue = safeSeed(seed);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model: String(model),
    seed: String(seedValue),
  });
  for (const [key, value] of Object.entries(extraQuery)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const urls = [];
  if ((process.env.POLLINATIONS_API_KEY || '').trim()) {
    urls.push({
      host: 'gen.pollinations.ai',
      model,
      url: `https://gen.pollinations.ai/image/${encoded}?${query}`,
    });
  }
  // Classic endpoint may watermark; only used as a last Pollinations try, never for official-only params.
  if (!extraQuery.transparent && !extraQuery.image) {
    urls.push({
      host: 'image.pollinations.ai',
      model,
      url: `https://image.pollinations.ai/prompt/${encoded}?${query}&nologo=true`,
    });
  }
  return urls;
}

function convertToJpeg(srcPath, destPath) {
  execFileSync('ffmpeg', ['-y', '-i', srcPath, '-q:v', '2', destPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
    const raw = buf
      .toString('utf8')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `HTTP ${status}: ${raw.slice(0, 180) || 'non-text body'}`;
  }
}

function saveJpeg(buf, destPath) {
  if (isJpeg(buf)) {
    fs.writeFileSync(destPath, buf);
  } else {
    const tmpPath = `${destPath}.tmpbin`;
    fs.writeFileSync(tmpPath, buf);
    convertToJpeg(tmpPath, destPath);
    fs.unlinkSync(tmpPath);
  }
  const written = fs.readFileSync(destPath);
  if (written.length < MIN_IMAGE_BYTES || !isJpeg(written)) return false;
  console.log(`Saved ${path.basename(destPath)} (${written.length} bytes)`);
  return true;
}

function saveRawImage(buf, destPath) {
  fs.writeFileSync(destPath, buf);
  if (buf.length < MIN_PNG_BYTES || !isImageBuffer(buf)) return false;
  console.log(`Saved ${path.basename(destPath)} (${buf.length} bytes)`);
  return true;
}

async function fetchPollinations(prompt, seed, width, height, models, extraQuery = {}) {
  let lastError = 'unknown error';
  for (const model of models) {
    const candidates = imageUrlCandidates(prompt, seed, width, height, model, extraQuery);
    for (const candidate of candidates) {
      try {
        console.log(`Pollinations request: host=${candidate.host} model=${model}`);
        const res = await fetch(candidate.url, { headers: authHeaders() });
        const buf = Buffer.from(await res.arrayBuffer());
        lastError = briefApiError(buf, res.status);

        if (res.status === 401 || res.status === 402) {
          console.log(
            `Pollinations ${candidate.host} model=${model} ${lastError}. Not making any payment; trying the next free option.`,
          );
          continue;
        }

        if (res.status === 503 || res.status === 429) {
          const retryAfterSec = Number(res.headers.get('retry-after'));
          const waitMs =
            Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 5000;
          console.log(`Pollinations busy (${lastError}), waiting ${Math.round(waitMs / 1000)}s and retrying once`);
          await sleep(waitMs);
          const retry = await fetch(candidate.url, { headers: authHeaders() });
          const retryBuf = Buffer.from(await retry.arrayBuffer());
          lastError = briefApiError(retryBuf, retry.status);
          if (retry.status === 401 || retry.status === 402) {
            console.log(
              `Pollinations ${candidate.host} model=${model} ${lastError}. Not making any payment; trying the next free option.`,
            );
            continue;
          }
          if (retry.ok && isImageBuffer(retryBuf) && retryBuf.length >= MIN_PNG_BYTES) {
            console.log(`Pollinations succeeded on retry: host=${candidate.host} model=${model}`);
            return { ok: true, buf: retryBuf, model, host: candidate.host };
          }
          console.log(`Pollinations retry failed (${lastError})`);
          continue;
        }

        if (!res.ok) {
          console.log(`Pollinations ${candidate.host} model=${model} ${lastError}`);
          continue;
        }
        if (!isImageBuffer(buf) || buf.length < MIN_PNG_BYTES) {
          lastError = `invalid image body (${buf.length} bytes)`;
          console.log(`Pollinations ${candidate.host} model=${model} returned a non-image`);
          continue;
        }
        console.log(`Pollinations succeeded: host=${candidate.host} model=${model}`);
        return { ok: true, buf, model, host: candidate.host };
      } catch (err) {
        lastError = err.message || String(err);
        console.log(`Pollinations ${candidate.host} model=${model} failed: ${lastError}`);
      }
    }
  }
  console.log(`Pollinations did not return a valid image (${lastError})`);
  return { ok: false, error: lastError };
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
                parts: [{ text: `${prompt}\n${PROMPT_BAN}` }],
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
      if (isImageBuffer(buf) && saveJpeg(buf, destPath)) return true;
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
    ['scripts/local_scene.py', '--prompt', prompt, '--out', destPath, '--seed', String(seed)],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const written = fs.readFileSync(destPath);
  if (written.length < MIN_IMAGE_BYTES || !isJpeg(written)) {
    throw new Error('Local fallback did not write a valid JPEG');
  }
  console.log(`Saved ${path.basename(destPath)} (${written.length} bytes, local fallback)`);
}

async function createBackgroundImage(prompt, destPath, seed) {
  const hasKey = Boolean((process.env.POLLINATIONS_API_KEY || '').trim());
  console.log(`Trying Pollinations${hasKey ? ' with API key' : ' without API key'}; models: flux`);
  const result = await fetchPollinations(prompt, seed, 1280, 720, ['flux']);
  if (result.ok && saveJpeg(result.buf, destPath)) return 'pollinations';
  if (await tryGeminiImage(prompt, destPath)) return 'gemini';
  renderLocalImage(prompt, destPath, seed);
  return 'local';
}

function sanitizePrompt(text) {
  let value = String(text || '');
  const replacements = [
    [/\breadable text\b/gi, 'unmarked surface'],
    [/\bhandwritten note\b/gi, 'blank scrap of paper'],
    [/\bnote, in my hand, said[^.]*\b/gi, 'blank scrap of paper'],
    [/\bwith her name\b/gi, 'unmarked'],
    [/\bwith a bride's name\b/gi, 'unmarked'],
    [/\ba printed access log with her name at 03:00\b/gi, 'blank unreadable monitor glow'],
    [/\baccess log\b/gi, 'blank monitor'],
    [/\bhandwriting continuing[^.]*\b/gi, 'open notebook with blank pages'],
    [/\bopen lab notebook, handwriting[^.]*\b/gi, 'open lab notebook with blank pages'],
    [/\ba sentence about[^.]*\b/gi, ''],
    [/\binscription\b/gi, 'unmarked carving'],
    [/\blettering\b/gi, 'unmarked marks'],
    [/\bwritten in\b/gi, 'made in'],
    [/\bsays?:[^.]*\b/gi, ''],
    [/\bnamed? patch\b/gi, 'plain patch'],
    [/\bthe word[s]?\b/gi, 'a mark'],
    [/\bticket reading\b/gi, 'blank ticket'],
    [/\bthat reads\b/gi, ''],
    [/\bthat said\b/gi, ''],
    [/\bpainted neatly, on the stone\b/gi, 'on an unmarked stone'],
    [/\ba stone with a bride's name\b/gi, 'an unmarked standing stone'],
    [/\bbilling letter\b/gi, 'blank envelope'],
    [/\bbank statement\b/gi, 'blank paper'],
    [/\brefund line\b/gi, ''],
    [/\bone bill for twelve dollars\b/gi, 'a blank slip of paper'],
  ];
  for (const [pattern, swap] of replacements) {
    value = value.replace(pattern, swap);
  }
  return value.replace(/\s+/g, ' ').trim();
}

function buildBackgroundPrompt(story, scene) {
  const style = story.artStyle || '2D layered paper cutout, hand-cut construction paper, cinematic lighting';
  const raw = sanitizePrompt(scene.backgroundPrompt || scene.visualPrompt || '');
  return [
    style,
    raw,
    'Empty environment only. No people, no humans, no faces, no figures, no body parts, no portraits, no mannequins.',
    'Locked art style, same paper stock and palette as the rest of the film.',
    PROMPT_BAN,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildCharacterPrompt(story, character, pose) {
  const style = story.artStyle || '2D layered paper cutout, hand-cut construction paper';
  return [
    style,
    'A single isolated paper-cutout character puppet, not a scene, not a portrait crop.',
    character.description || story.character || character.name,
    POSE_PROMPTS[pose] || POSE_PROMPTS.three_quarter,
    'Plain solid chroma-key lime green background (#00FF00), completely flat and even, no floor, no shadow on the backdrop, no scenery, no props, no furniture, no other people.',
    'Clean silhouette, layered paper, visible paper fibers, torn-paper edge quality.',
    PROMPT_BAN,
  ]
    .filter(Boolean)
    .join(' ');
}

function runCutout({ src, dest, pose, palette, silhouette }) {
  const args = ['scripts/cutout_character.py', '--out', dest, '--pose', pose || 'three_quarter'];
  if (src) args.push('--in', src);
  if (palette) args.push('--palette', JSON.stringify(palette));
  if (silhouette) args.push('--silhouette');
  const output = execFileSync('python3', args, { encoding: 'utf-8' });
  console.log(String(output).trim());
  if (!fs.existsSync(dest) || fs.statSync(dest).size < MIN_PNG_BYTES) {
    throw new Error(`Cutout failed for ${dest}`);
  }
}

async function generateCharacterPose(story, character, pose) {
  const id = character.id;
  const dest = path.join(publicDir, `char_${id}_${pose}.png`);
  const rawPath = path.join(publicDir, `char_${id}_${pose}_raw`);
  const seed = safeSeed((character.seed || stableHash(id)) + ({ three_quarter: 0, front: 11, back: 23 }[pose] || 0));
  const prompt = buildCharacterPrompt(story, character, pose);
  const hasKey = Boolean((process.env.POLLINATIONS_API_KEY || '').trim());
  let rawFile = null;
  let source = 'local';

  if (hasKey) {
    // gptimage can return a transparent PNG. It may 402 on a zero balance; never pay, just fall through.
    console.log(`Character ${id} ${pose}: trying gptimage transparent puppet`);
    const transparent = await fetchPollinations(prompt, seed, 768, 1024, ['gptimage'], {
      transparent: 'true',
    });
    if (transparent.ok) {
      rawFile = isPng(transparent.buf) ? `${rawPath}.png` : `${rawPath}.jpg`;
      fs.writeFileSync(rawFile, transparent.buf);
      source = 'pollinations-gptimage';
    } else {
      console.log(`Character ${id} ${pose}: gptimage unavailable, trying Flux on a green screen`);
      const flux = await fetchPollinations(prompt, seed, 768, 1024, ['flux']);
      if (flux.ok) {
        rawFile = isPng(flux.buf) ? `${rawPath}.png` : `${rawPath}.jpg`;
        if (isJpeg(flux.buf) || isPng(flux.buf) || isWebp(flux.buf)) {
          fs.writeFileSync(rawFile, flux.buf);
        } else {
          rawFile = null;
        }
        if (rawFile) source = 'pollinations-flux';
      }
    }
    if (source.startsWith('pollinations')) await sleep(2200);
  }

  runCutout({
    src: rawFile,
    dest,
    pose,
    palette: character.palette || null,
    silhouette: false,
  });
  return { file: path.basename(dest), source };
}

async function prepareCharacters(story) {
  const list = Array.isArray(story.characters) && story.characters.length
    ? story.characters
    : story.character
      ? [{ id: 'main', name: 'main', description: story.character, seed: story.characterSeed || stableHash(story.id) }]
      : [];
  const assets = {};
  const sources = {};
  for (const character of list) {
    assets[character.id] = {};
    for (const pose of POSES) {
      console.log(`Generating character puppet ${character.id} pose=${pose}...`);
      const result = await generateCharacterPose(story, character, pose);
      assets[character.id][pose] = result.file;
      sources[`${character.id}:${pose}`] = result.source;
    }
    const silDest = path.join(publicDir, `char_${character.id}_silhouette.png`);
    runCutout({
      src: path.join(publicDir, assets[character.id].three_quarter),
      dest: silDest,
      pose: 'three_quarter',
      palette: character.palette || null,
      silhouette: true,
    });
    assets[character.id].silhouette = path.basename(silDest);
  }
  return { assets, sources, list };
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

function inferShot(scene) {
  if (scene.shot) return scene.shot;
  const text = `${scene.visualPrompt || ''} ${scene.narration || ''}`.toLowerCase();
  if (/(silhouette)/.test(text)) return 'silhouette';
  if (/(close portrait|close-up|close up|face lit|two-shot)/.test(text)) return 'close';
  if (/(back turned|from behind|walking away|rear view)/.test(text)) return 'back';
  if (/(wide |aerial|establishing|empty |plain,|horizon|far view|tiny figure)/.test(text)) return 'wide';
  if (/(no people|empty environment|deserted)/.test(text)) return 'empty';
  return 'medium';
}

function placementFor(shot, index, role = 'primary') {
  const even = index % 2 === 0;
  const side = even ? 0.3 : 0.7;
  if (shot === 'empty') return null;
  if (shot === 'wide') {
    return { x: role === 'secondary' ? 0.62 : 0.32, y: -10, scale: 0.55, driftX: even ? 10 : -10 };
  }
  if (shot === 'close') {
    return { x: role === 'secondary' ? 0.66 : 0.36, y: -420, scale: 2.05, driftX: 8 };
  }
  if (shot === 'back') {
    return { x: side, y: -20, scale: 0.78, driftX: 14 };
  }
  if (shot === 'silhouette') {
    return { x: 0.5, y: -10, scale: 0.9, driftX: 8 };
  }
  if (shot === 'double' || shot === 'two_shot') {
    if (role === 'secondary') return { x: 0.68, y: -40, scale: 0.92, driftX: -10, opacity: 0.98 };
    return { x: 0.3, y: -20, scale: 0.98, driftX: 10 };
  }
  return { x: role === 'secondary' ? 0.7 : 0.28, y: -30, scale: 0.92, driftX: even ? 12 : -12 };
}

function poseFor(shot, requested) {
  // Close-ups zoom the same three-quarter puppet so the face never changes.
  if (requested === 'front') requested = 'three_quarter';
  if (requested) return requested;
  if (shot === 'back') return 'back';
  if (shot === 'silhouette') return 'silhouette';
  return 'three_quarter';
}

function buildPuppets(scene, index, characterAssets, characterList) {
  const shot = inferShot(scene);
  if (shot === 'empty' || !characterAssets || Object.keys(characterAssets).length === 0) {
    return [];
  }
  const primary = scene.characterId || characterList[0]?.id;
  const secondary = scene.secondaryCharacterId || (shot === 'double' || shot === 'two_shot' ? primary : scene.characterId2);
  const puppets = [];
  const add = (id, role, flip) => {
    if (!id || !characterAssets[id]) return;
    const pose = poseFor(shot, role === 'secondary' ? scene.secondaryPose || scene.pose : scene.pose);
    const file = characterAssets[id][pose] || characterAssets[id].three_quarter;
    if (!file) return;
    const place = placementFor(shot, index, role);
    if (!place) return;
    puppets.push({
      file,
      flip: Boolean(flip),
      ...place,
      z: role === 'secondary' ? 4 : 5,
    });
  };
  add(primary, 'primary', scene.flip);
  if (secondary) {
    add(secondary, 'secondary', scene.secondaryFlip ?? (secondary === primary ? true : !scene.flip));
  }
  return puppets;
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

function wordsToFrames(wordsPath, tempo = 1) {
  if (!fs.existsSync(wordsPath)) return [];
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  return words.map((word) => ({
    word: word.word,
    from: Math.max(0, Math.round((word.start / tempo) * 30)),
    to: Math.max(1, Math.round((word.end / tempo) * 30)),
  }));
}

function audioDurationSeconds(audioPath) {
  const durationStr = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
    { encoding: 'utf-8' },
  ).trim();
  const duration = parseFloat(durationStr);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration from ${audioPath}`);
  }
  return duration;
}

function estimateStorySeconds(sceneDurationsSec) {
  const overlapSec = OVERLAP_FRAMES / 30;
  let total = TITLE_FRAMES / 30;
  sceneDurationsSec.forEach((sec, index) => {
    total += sec;
    if (index < sceneDurationsSec.length - 1) total -= overlapSec;
  });
  return total + END_FRAMES / 30;
}

function atempoAudio(srcPath, destPath, tempo) {
  execFileSync(
    'ffmpeg',
    ['-y', '-i', srcPath, '-filter:a', `atempo=${tempo.toFixed(3)}`, '-b:a', '128k', destPath],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function capStoryDuration(processedScenes) {
  const secondsOf = (scenes) => estimateStorySeconds(scenes.map((s) => s.durationInFrames / 30));
  let total = secondsOf(processedScenes);
  if (total <= MAX_STORY_SEC) {
    console.log(`Story length ${total.toFixed(1)}s is within the 3-4 minute cap.`);
    return processedScenes;
  }
  let tempo = total / MAX_STORY_SEC;
  if (tempo > 1.18) tempo = 1.18;
  console.log(`Story length ${total.toFixed(1)}s exceeds 4 minutes. Speeding voice by ${tempo.toFixed(3)}x (atempo), no payment involved.`);
  for (const scene of processedScenes) {
    const src = path.join(publicDir, scene.audioFile);
    const dest = path.join(publicDir, scene.audioFile.replace(/\.mp3$/, '_cap.mp3'));
    atempoAudio(src, dest, tempo);
    fs.renameSync(dest, src);
    const wordsPath = path.join(publicDir, scene.audioFile.replace('audio_', 'words_').replace(/\.mp3$/, '.json'));
    scene.words = wordsToFrames(wordsPath, tempo);
    const durationSec = audioDurationSeconds(src) + 0.2;
    scene.durationInFrames = Math.max(60, Math.ceil(durationSec * 30));
  }
  total = secondsOf(processedScenes);
  console.log(`Story length after cap: ${total.toFixed(1)}s`);
  return processedScenes;
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

const voice = story.voice || 'en-GB-RyanNeural';
const { assets: characterAssets, sources: characterSources, list: characterList } = await prepareCharacters(story);
console.log(`Character puppets ready: ${JSON.stringify(characterSources)}`);

const processedScenes = [];
const sourceCounts = { pollinations: 0, gemini: 0, local: 0 };
const fallbackScenes = [];
const backgroundSeedBase = story.backgroundSeed || stableHash(`${story.id}-bg`);

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
  const durationSec = audioDurationSeconds(audioPath) + 0.22;

  console.log(`Generating background for scene ${i + 1}/${story.scenes.length}...`);
  const prompt = buildBackgroundPrompt(story, scene);
  const source = await createBackgroundImage(prompt, imagePath, backgroundSeedBase + i * 19);
  sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  if (source === 'local') fallbackScenes.push(i);
  if (source === 'pollinations' && i < story.scenes.length - 1) await sleep(2200);

  const effect = scene.effect || 'zoom_in';
  const shot = inferShot(scene);
  processedScenes.push({
    narration: scene.narration,
    effect,
    shot,
    audioFile,
    imageFile,
    words: wordsToFrames(wordsPath),
    particles: scene.particles || inferParticles(`${scene.visualPrompt || ''} ${scene.narration}`),
    sfxFile: inferSfx(effect, i),
    imageSource: source,
    puppets: buildPuppets(scene, i, characterAssets, characterList),
    durationInFrames: Math.max(60, Math.ceil(durationSec * 30)),
  });
}

const cappedScenes = capStoryDuration(processedScenes);
const sceneSeconds = cappedScenes.reduce((sum, scene) => sum + scene.durationInFrames / 30, 0);
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
  characterSources,
  fallbackScenes,
  titleDurationInFrames: TITLE_FRAMES,
  endCardDurationInFrames: END_FRAMES,
  overlapFrames: OVERLAP_FRAMES,
  musicFile: 'music.mp3',
  grainFile: 'grain.jpg',
  scenes: cappedScenes,
};

fs.writeFileSync(path.join(publicDir, 'current_video.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const finalSec = estimateStorySeconds(cappedScenes.map((s) => s.durationInFrames / 30));
console.log(
  `All assets prepared successfully. Image sources: ${manifest.imageSource || 'none'}. Character sources: ${JSON.stringify(characterSources)}. Estimated length: ${finalSec.toFixed(1)}s. Story will be marked done only after a successful render.`,
);
