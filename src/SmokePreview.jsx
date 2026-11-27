import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { StoryVideo } from './StoryVideo.jsx';
import { normalizeAppearance } from './characters/appearance.js';

const samira = normalizeAppearance({
  id: 'samira',
  name: 'Samira',
  description: 'A woman with dark hair tightly tied back, a mid-calf grey coat, black sweater.',
  palette: { skin: 'C4926A', hair: '1A1410', coat: '6D6A66', pants: '2A2622', boots: '2A2018', shirt: '1F1C1A', accent: 'C2A57A' },
  appearance: { body: 'female', build: 'average', hair: 'tied_back', outfit: 'coat', accessory: 'notebook', eyes: '3A2A1C' },
});

const cal = normalizeAppearance({
  id: 'cal',
  name: 'Cal',
  description: 'A man with a close dark beard, short dark hair, a worn blue denim jacket.',
  palette: { skin: 'C4966E', hair: '1A1410', coat: '3E5A7A', pants: '3A3834', boots: '3A2A1C', shirt: '6A6864', accent: 'C2A06A' },
  appearance: { body: 'male', build: 'broad', hair: 'short', facialHair: 'beard', outfit: 'jacket', eyes: '3A2A1C' },
});

const mouthTalk = Array.from({ length: 90 }, (_, i) => {
  if (i < 36 || i > 78) return 0;
  if (i >= 50 && i <= 54) return 0;
  return Math.max(0, Math.min(1, Math.sin(i * 0.9) * 0.55 + 0.35));
});

export const smokeProps = {
  title: 'Smoke Preview',
  description: 'CI smoke render',
  storyId: 'smoke',
  genre: 'Test',
  titleDurationInFrames: 18,
  endCardDurationInFrames: 12,
  overlapFrames: 4,
  musicFile: '',
  grainFile: '',
  imageSource: 'svg',
  fallbackScenes: [],
  scenes: [
    {
      narration: 'She walks the green line every night.',
      visualPrompt: 'A plaster city and a green line of oil drums, no people',
      effect: 'pan_right',
      shot: 'wide',
      backdrop: 'city',
      durationInFrames: 36,
      words: [
        { word: 'She', from: 4, to: 8 },
        { word: 'walks', from: 9, to: 16 },
        { word: 'the', from: 17, to: 20 },
        { word: 'green', from: 21, to: 26 },
        { word: 'line', from: 27, to: 34 },
      ],
      particles: 'dust',
      mouth: mouthTalk.map((v, i) => (i < 36 ? 0 : v)),
      actors: [
        {
          id: 'samira',
          appearance: samira,
          seed: 41029,
          x: 0.34,
          y: 8,
          scale: 0.78,
          pose: 'three_quarter',
          expression: 'determined',
          gesture: 'walk',
          action: 'walk',
          speaking: false,
          driftX: 40,
          z: 5,
        },
      ],
    },
    {
      narration: 'The letter was never meant for her.',
      visualPrompt: 'A pocked plaster wall and a mail slot, no people',
      effect: 'zoom_in',
      shot: 'medium',
      backdrop: 'city',
      durationInFrames: 40,
      words: [
        { word: 'The', from: 2, to: 6 },
        { word: 'letter', from: 7, to: 14 },
        { word: 'was', from: 15, to: 18 },
        { word: 'never', from: 19, to: 26 },
        { word: 'meant', from: 27, to: 32 },
        { word: 'for', from: 33, to: 36 },
        { word: 'her.', from: 37, to: 42 },
      ],
      particles: 'dust',
      mouth: mouthTalk,
      actors: [
        {
          id: 'samira',
          appearance: samira,
          seed: 41029,
          x: 0.3,
          y: 0,
          scale: 1.05,
          pose: 'three_quarter',
          expression: 'worried',
          gesture: 'talk',
          action: 'idle',
          speaking: true,
          driftX: 8,
          z: 5,
        },
        {
          id: 'cal',
          appearance: cal,
          seed: 81043,
          x: 0.7,
          y: 0,
          scale: 1.0,
          pose: 'three_quarter',
          expression: 'neutral',
          gesture: 'listen',
          action: 'idle',
          speaking: false,
          flip: true,
          driftX: -8,
          z: 4,
        },
      ],
    },
  ],
};

export const SmokePreview = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <StoryVideo {...smokeProps} />
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          color: '#3A3228',
          fontSize: 14,
          letterSpacing: 2,
          opacity: 0.7,
        }}
      >
        SMOKE {frame}
      </div>
    </AbsoluteFill>
  );
};
