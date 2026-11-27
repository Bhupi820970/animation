import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { StoryVideo } from './StoryVideo.jsx';

export const smokeProps = {
  title: 'Smoke Preview',
  description: 'CI smoke render',
  storyId: 'smoke',
  genre: 'Test',
  titleDurationInFrames: 0,
  endCardDurationInFrames: 18,
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
          color: '#F5EBD6',
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
