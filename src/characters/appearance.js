import {
  normalizeAppearance as normalizeFromSchema,
  normalizePalette,
} from '../../scripts/lib/story_schema.mjs';

export { normalizePalette };

export function cssHex(value, fallback = '#C4966E') {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return fallback;
}

export function shade(hex, amount) {
  const raw = cssHex(hex).slice(1);
  const nums = [0, 2, 4].map((i) => {
    const n = parseInt(raw.slice(i, i + 2), 16) + amount;
    return Math.max(0, Math.min(255, n));
  });
  return `#${nums.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function characterColors(appearance) {
  const palette = normalizePalette(appearance?.palette);
  const skin = cssHex(palette.skin, '#C4966E');
  const hair = cssHex(palette.hair, '#1A1410');
  const coat = cssHex(palette.coat, '#6E6B66');
  const pants = cssHex(palette.pants, '#2C2A28');
  const boots = cssHex(palette.boots, '#241C16');
  const shirt = cssHex(palette.shirt, '#1E1C1A');
  const accent = cssHex(palette.accent, '#C2A57A');
  return {
    skin,
    skinDk: shade(skin, -28),
    skinLt: shade(skin, 22),
    hair,
    hairHi: shade(hair, 22),
    coat,
    coatDk: shade(coat, -28),
    coatLt: shade(coat, 24),
    pants,
    pantsLt: shade(pants, 16),
    boots,
    bootsDk: shade(boots, -18),
    shirt,
    shirtLt: shade(shirt, 18),
    accent,
    eyes: cssHex(appearance?.eyes, '#3A2A1C'),
    lipstick: appearance?.lipstick ? cssHex(appearance.lipstick, '#9C4E48') : '#9C4E48',
    lipDk: shade(appearance?.lipstick ? cssHex(appearance.lipstick, '#9C4E48') : '#9C4E48', -24),
  };
}

export function normalizeAppearance(characterOrAppearance) {
  if (characterOrAppearance && (characterOrAppearance.palette || characterOrAppearance.description || characterOrAppearance.id)) {
    return normalizeFromSchema(characterOrAppearance);
  }
  return normalizeFromSchema({ appearance: characterOrAppearance, palette: characterOrAppearance?.palette });
}
