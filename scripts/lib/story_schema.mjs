export const STATUSES = new Set(['pending', 'done', 'processing', 'failed']);

export const EFFECTS = new Set([
  'zoom_in',
  'zoom_out',
  'pan_right',
  'pan_left',
  'shake',
  'handheld',
  'push_up',
]);

export const SHOTS = new Set([
  'wide',
  'medium',
  'close',
  'back',
  'silhouette',
  'empty',
  'double',
  'two_shot',
]);

export const BODIES = new Set(['female', 'male']);
export const BUILDS = new Set(['slim', 'average', 'broad']);
export const HAIR_STYLES = new Set([
  'tied_back',
  'low_knot',
  'pinned_up',
  'short',
  'undercut',
  'braid',
  'thinning',
]);
export const FACIAL_HAIR = new Set(['none', 'beard', 'stubble']);
export const OUTFITS = new Set(['coat', 'jacket', 'dress', 'shirt', 'suit']);
export const HATS = new Set(['none', 'cap', 'visor']);
export const SLEEVES = new Set(['long', 'rolled']);
export const ACCESSORIES = new Set(['none', 'notebook', 'document_roll', 'headset']);
export const EXPRESSIONS = new Set([
  'neutral',
  'worried',
  'sad',
  'angry',
  'smile',
  'determined',
  'surprised',
]);
export const GESTURES = new Set(['idle', 'walk', 'talk', 'hold', 'point', 'reach', 'listen']);
export const EXTRAS = new Set(['apron', 'shawl']);

export function hexColor(value) {
  const raw = String(value || '').trim().replace(/^#/, '');
  return /^[0-9A-Fa-f]{6}$/.test(raw) ? raw.toUpperCase() : null;
}

export function normalizePalette(palette) {
  const src = palette && typeof palette === 'object' ? palette : {};
  const out = {};
  for (const key of ['skin', 'hair', 'coat', 'pants', 'boots', 'shirt', 'accent']) {
    out[key] = hexColor(src[key]) || {
      skin: 'C4966E',
      hair: '1A1410',
      coat: '6E6B66',
      pants: '2C2A28',
      boots: '241C16',
      shirt: '1E1C1A',
      accent: 'C2A57A',
    }[key];
  }
  return out;
}

export function inferAppearance(character = {}) {
  const text = `${character.description || ''} ${character.name || ''}`.toLowerCase();
  const appearance = { ...(character.appearance || {}) };

  if (!appearance.body) {
    appearance.body = /\b(man|male|captain|brother|he\b)\b/.test(text) && !/\b(woman|female|daughter|she\b)\b/.test(text)
      ? 'male'
      : 'female';
    if (/\b(woman|female|daughter|girl)\b/.test(text)) appearance.body = 'female';
    if (/\b(man|male|captain|brother)\b/.test(text) && !/\b(woman|female)\b/.test(text)) appearance.body = 'male';
  }
  if (!appearance.build) {
    appearance.build = /\b(broad|broad-shouldered)\b/.test(text)
      ? 'broad'
      : /\b(lean|slim|young woman|20,|23,)\b/.test(text)
        ? 'slim'
        : 'average';
  }
  if (!appearance.hair) {
    if (/\bbraid\b/.test(text)) appearance.hair = 'braid';
    else if (/\bshaved on the sides|undercut\b/.test(text)) appearance.hair = 'undercut';
    else if (/\bthinning\b/.test(text)) appearance.hair = 'thinning';
    else if (/\bpinned up\b/.test(text)) appearance.hair = 'pinned_up';
    else if (/\b(low practical knot|low bun|knot)\b/.test(text)) appearance.hair = 'low_knot';
    else if (/\b(tied back|tied in|tied tightly)\b/.test(text)) appearance.hair = 'tied_back';
    else if (/\b(short hair|short dark hair|short salt|ball cap)\b/.test(text)) appearance.hair = 'short';
    else appearance.hair = appearance.body === 'male' ? 'short' : 'tied_back';
  }
  if (!appearance.facialHair) {
    appearance.facialHair = /\bbeard\b/.test(text) ? 'beard' : /\bstubble\b/.test(text) ? 'stubble' : 'none';
  }
  if (!appearance.outfit) {
    if (/\b(wedding dress|wine-colored dress|dark dress)\b/.test(text)) appearance.outfit = 'dress';
    else if (/\b(station suit|jumpsuit|coverall)\b/.test(text)) appearance.outfit = 'suit';
    else if (/\b(denim jacket|jacket)\b/.test(text)) appearance.outfit = 'jacket';
    else if (/\b(work shirt|office shirt|white shirt)\b/.test(text) && !/\bcoat\b/.test(text)) appearance.outfit = 'shirt';
    else appearance.outfit = 'coat';
  }
  if (!appearance.hat) {
    appearance.hat = /\bvisor\b/.test(text) ? 'visor' : /\b(ball cap|cap)\b/.test(text) ? 'cap' : 'none';
  }
  if (!appearance.sleeves) {
    appearance.sleeves = /\brolled\b/.test(text) ? 'rolled' : 'long';
  }
  if (!appearance.accessory) {
    if (/\bnotebook\b/.test(text)) appearance.accessory = 'notebook';
    else if (/\bdocument roll\b/.test(text)) appearance.accessory = 'document_roll';
    else if (/\bheadset\b/.test(text)) appearance.accessory = 'headset';
    else appearance.accessory = 'none';
  }
  const extras = new Set(Array.isArray(appearance.extras) ? appearance.extras : []);
  if (/\bapron\b/.test(text)) extras.add('apron');
  if (/\bshawl\b/.test(text)) extras.add('shawl');
  appearance.extras = [...extras];
  if (!appearance.eyes) {
    if (/\bgrey eyes|gray eyes\b/.test(text)) appearance.eyes = '6A6A70';
    else if (/\bhazel\b/.test(text)) appearance.eyes = '6B4A28';
    else appearance.eyes = '3A2A1C';
  }
  if (appearance.lipstick == null && /\blipstick\b/.test(text)) {
    appearance.lipstick = 'C0392B';
  }
  appearance.palette = normalizePalette(appearance.palette || character.palette);
  appearance.eyes = hexColor(appearance.eyes) || '3A2A1C';
  if (appearance.lipstick) appearance.lipstick = hexColor(appearance.lipstick);
  return appearance;
}

export function normalizeAppearance(character = {}) {
  const appearance = inferAppearance(character);
  if (!BODIES.has(appearance.body)) appearance.body = 'female';
  if (!BUILDS.has(appearance.build)) appearance.build = 'average';
  if (!HAIR_STYLES.has(appearance.hair)) appearance.hair = appearance.body === 'male' ? 'short' : 'tied_back';
  if (!FACIAL_HAIR.has(appearance.facialHair)) appearance.facialHair = 'none';
  if (!OUTFITS.has(appearance.outfit)) appearance.outfit = 'coat';
  if (!HATS.has(appearance.hat)) appearance.hat = 'none';
  if (!SLEEVES.has(appearance.sleeves)) appearance.sleeves = 'long';
  if (!ACCESSORIES.has(appearance.accessory)) appearance.accessory = 'none';
  appearance.extras = (appearance.extras || []).filter((item) => EXTRAS.has(item));
  return appearance;
}

export function inferExpression(scene = {}) {
  if (scene.expression && EXPRESSIONS.has(scene.expression)) return scene.expression;
  const text = `${scene.narration || ''} ${scene.visualPrompt || ''}`.toLowerCase();
  if (/(smil|laugh|love|warmth|wedding(?!.*(grave|dead)))/.test(text)) return 'smile';
  if (/(grave|died|dead|loss|mourn|bury|last spring)/.test(text)) return 'sad';
  if (/(knock|warning|fear|never|not answer|cannot happen|debt)/.test(text)) return 'worried';
  if (/(anger|swore|liar|shout)/.test(text)) return 'angry';
  if (/(i am [a-z]|my name|i run|i draw|i work|i translate)/.test(text)) return 'determined';
  if (/\?|recognized|did not belong|was not/.test(text)) return 'surprised';
  return 'neutral';
}

export function inferGesture(scene = {}) {
  if (scene.gesture && GESTURES.has(scene.gesture)) return scene.gesture;
  const text = `${scene.narration || ''} ${scene.visualPrompt || ''} ${scene.pose || ''}`.toLowerCase();
  if (/(walk|followed|across|stride|green line every)/.test(text)) return 'walk';
  if (/(letter|notebook|ticket|map|copy|write|envelope)/.test(text)) return 'hold';
  if (/(point|there|that way|coordinates)/.test(text)) return 'point';
  if (/(reach|pick it up|stooping|knock)/.test(text)) return 'reach';
  if (/(i am |this is )/.test(text)) return 'talk';
  if (/(listen|hold music|quiet|log it)/.test(text)) return 'listen';
  return 'idle';
}

export function inferShot(scene = {}) {
  if (scene.shot && SHOTS.has(scene.shot)) return scene.shot;
  const text = `${scene.visualPrompt || ''} ${scene.narration || ''}`.toLowerCase();
  if (/(silhouette)/.test(text)) return 'silhouette';
  if (/(close portrait|close-up|close up|face lit)/.test(text)) return 'close';
  if (/(back turned|from behind|walking away|rear view)/.test(text)) return 'back';
  if (/(wide |aerial|establishing|horizon|far view|tiny figure)/.test(text)) return 'wide';
  if (/(no people|empty environment|deserted|empty room)/.test(text)) return 'empty';
  if (/(two-shot|two shot|side by side|together)/.test(text)) return 'two_shot';
  return 'medium';
}

export function validateStory(story, { index = 0, requireFeatureLength = true } = {}) {
  const errors = [];
  const label = `story[${index}]`;
  if (!story || typeof story !== 'object') return [`${label} must be an object`];
  if (!story.id || typeof story.id !== 'string') errors.push(`${label} needs a string "id"`);
  if (story.status && !STATUSES.has(story.status)) {
    errors.push(`${label} (${story.id}) status must be pending, done, processing, or failed`);
  }
  if (!story.title || typeof story.title !== 'string') errors.push(`${label} (${story.id}) needs a string "title"`);
  if (!Array.isArray(story.scenes) || story.scenes.length === 0) {
    errors.push(`${label} (${story.id}) needs a non-empty "scenes" array`);
  }
  const isPending = story.status === 'pending';
  const isFeature = story.id !== 'story_01';
  if (isPending && requireFeatureLength && isFeature) {
    if (!story.scenes || story.scenes.length < 30) errors.push(`${label} (${story.id}) pending feature stories need at least 30 scenes`);
    if (story.scenes && story.scenes.length > 45) errors.push(`${label} (${story.id}) has more than 45 scenes`);
    if (!story.artStyle || typeof story.artStyle !== 'string') errors.push(`${label} (${story.id}) needs a locked "artStyle"`);
    if (!Array.isArray(story.characters) || story.characters.length === 0) {
      errors.push(`${label} (${story.id}) needs a non-empty "characters" array`);
    }
  }
  const charIds = new Set();
  if (Array.isArray(story.characters)) {
    for (const [cIndex, character] of story.characters.entries()) {
      const cLabel = `${label} characters[${cIndex}]`;
      if (!character?.id || typeof character.id !== 'string') errors.push(`${cLabel} needs a string "id"`);
      else if (charIds.has(character.id)) errors.push(`${cLabel} duplicate character id "${character.id}"`);
      else charIds.add(character.id);
      if (!character?.name || typeof character.name !== 'string') errors.push(`${cLabel} needs a string "name"`);
      if (isPending && isFeature && (!character?.description || typeof character.description !== 'string')) {
        errors.push(`${cLabel} needs a locked "description"`);
      }
      if (isPending && isFeature && (!Number.isInteger(character.seed) || character.seed < 1 || character.seed > 2147483647)) {
        errors.push(`${cLabel} needs an integer "seed" between 1 and 2147483647`);
      }
      if (character?.appearance) {
        const a = character.appearance;
        if (a.body && !BODIES.has(a.body)) errors.push(`${cLabel} appearance.body is invalid`);
        if (a.hair && !HAIR_STYLES.has(a.hair)) errors.push(`${cLabel} appearance.hair is invalid`);
        if (a.outfit && !OUTFITS.has(a.outfit)) errors.push(`${cLabel} appearance.outfit is invalid`);
        if (a.facialHair && !FACIAL_HAIR.has(a.facialHair)) errors.push(`${cLabel} appearance.facialHair is invalid`);
        if (a.hat && !HATS.has(a.hat)) errors.push(`${cLabel} appearance.hat is invalid`);
      }
    }
  }
  if (Array.isArray(story.scenes)) {
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      const sceneLabel = `${label} scene[${sceneIndex}]`;
      if (!scene?.narration || typeof scene.narration !== 'string') errors.push(`${sceneLabel} needs a "narration" string`);
      if (!scene?.visualPrompt || typeof scene.visualPrompt !== 'string') errors.push(`${sceneLabel} needs a "visualPrompt" string`);
      if (scene?.effect && !EFFECTS.has(scene.effect)) {
        errors.push(`${sceneLabel} effect "${scene.effect}" is invalid`);
      }
      if (scene?.shot && !SHOTS.has(scene.shot)) errors.push(`${sceneLabel} shot "${scene.shot}" is invalid`);
      if (scene?.expression && !EXPRESSIONS.has(scene.expression)) {
        errors.push(`${sceneLabel} expression "${scene.expression}" is invalid`);
      }
      if (scene?.gesture && !GESTURES.has(scene.gesture)) {
        errors.push(`${sceneLabel} gesture "${scene.gesture}" is invalid`);
      }
      if (scene?.characterId && charIds.size && !charIds.has(scene.characterId)) {
        errors.push(`${sceneLabel} characterId "${scene.characterId}" is not in characters`);
      }
      if (scene?.secondaryCharacterId && charIds.size && !charIds.has(scene.secondaryCharacterId)) {
        errors.push(`${sceneLabel} secondaryCharacterId "${scene.secondaryCharacterId}" is not in characters`);
      }
    }
  }
  return errors;
}

export function validateStories(stories) {
  const errors = [];
  if (!Array.isArray(stories)) return ['must be a JSON array of stories'];
  const ids = new Set();
  let pending = 0;
  let failed = 0;
  for (const [index, story] of stories.entries()) {
    if (story?.id) {
      if (ids.has(story.id)) errors.push(`duplicate id "${story.id}"`);
      ids.add(story.id);
    }
    if (story?.status === 'pending') pending += 1;
    if (story?.status === 'failed') failed += 1;
    errors.push(...validateStory(story, { index }));
  }
  return { errors, pending, failed, count: stories.length, uniqueIds: ids.size };
}

export function pickNextRenderableStory(stories) {
  const skipped = [];
  for (const [index, story] of stories.entries()) {
    if (!story || story.status !== 'pending') continue;
    const errors = validateStory(story, { index });
    if (errors.length) {
      skipped.push({ id: story.id, errors });
      continue;
    }
    return { story, skipped };
  }
  return { story: null, skipped };
}
