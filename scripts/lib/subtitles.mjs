const STOP_WORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'in', 'on', 'at', 'who',
  'that', 'with', 'was', 'were', 'is', 'are', 'as', 'by', 'from', 'her', 'his',
  'their', 'she', 'he', 'it', 'i', 'we', 'you', 'my', 'me', 'this', 'those',
  'these', 'be', 'been', 'not', 'never',
]);

export function chunkTimedWords(words, maxWords = 8) {
  const list = Array.isArray(words) ? words.filter((word) => word && word.word) : [];
  if (!list.length) return [];
  const cues = [];
  for (let i = 0; i < list.length; i += maxWords) {
    const slice = list.slice(i, i + maxWords);
    const from = Number(slice[0].from) || 0;
    const to = Math.max(from + 1, Number(slice[slice.length - 1].to) || from + 1);
    cues.push({
      text: slice.map((word) => word.word).join(' '),
      from,
      to,
    });
  }
  return cues;
}

export function narrationCues(narration, durationInFrames, maxWords = 8) {
  const tokens = String(narration || '').trim().split(/\s+/).filter(Boolean);
  const duration = Math.max(1, Number(durationInFrames) || 1);
  if (!tokens.length) return [];
  const chunks = [];
  for (let i = 0; i < tokens.length; i += maxWords) {
    chunks.push(tokens.slice(i, i + maxWords).join(' '));
  }
  const slice = duration / chunks.length;
  return chunks.map((text, index) => ({
    text,
    from: Math.round(index * slice),
    to: Math.round((index + 1) * slice),
  }));
}

export function sceneCues(scene, maxWords = 8) {
  if (scene?.words?.length) return chunkTimedWords(scene.words, maxWords);
  return narrationCues(scene?.narration || '', scene?.durationInFrames || 1, maxWords);
}

export function sceneStarts({ scenes = [], titleDurationInFrames = 0, overlapFrames = 12 } = {}) {
  const starts = [];
  let cursor = Math.max(0, titleDurationInFrames || 0);
  scenes.forEach((scene) => {
    starts.push(cursor);
    cursor += (scene.durationInFrames || 0) - (overlapFrames || 0);
  });
  return { starts, scenesEnd: cursor + (overlapFrames || 0) };
}

export function formatSrtTime(seconds) {
  const msTotal = Math.max(0, Math.round(Number(seconds) * 1000));
  const h = Math.floor(msTotal / 3_600_000);
  const m = Math.floor((msTotal % 3_600_000) / 60_000);
  const s = Math.floor((msTotal % 60_000) / 1000);
  const ms = msTotal % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function buildSrt({
  scenes = [],
  titleDurationInFrames = 0,
  overlapFrames = 12,
  fps = 30,
} = {}) {
  const { starts } = sceneStarts({ scenes, titleDurationInFrames, overlapFrames });
  const cues = [];
  scenes.forEach((scene, index) => {
    const offset = starts[index] || 0;
    for (const cue of sceneCues(scene)) {
      const start = (offset + cue.from) / fps;
      const end = Math.max(start + 0.2, (offset + cue.to) / fps);
      cues.push({ text: cue.text, start, end });
    }
  });
  return cues
    .map((cue, index) => `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`)
    .join('\n');
}

export function hookTitleWords(text, max = 4) {
  const words = String(text || '')
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const content = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()) && word.length > 1);
  const picked = (content.length >= 3 ? content.slice(-4) : words.slice(0, max)).slice(0, max);
  return picked.map((word) => word.toUpperCase());
}
