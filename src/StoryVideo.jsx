import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const SceneBlock = ({ scene }) => {
  const frame = useCurrentFrame();
  const dur = scene.durationInFrames;

  const opacity = interpolate(frame, [0, 15, Math.max(16, dur - 15), dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let transform = 'scale(1.05)';
  if (scene.effect === 'zoom_in') {
    const scale = interpolate(frame, [0, dur], [1.0, 1.12]);
    transform = `scale(${scale})`;
  } else if (scene.effect === 'zoom_out') {
    const scale = interpolate(frame, [0, dur], [1.14, 1.0]);
    transform = `scale(${scale})`;
  } else if (scene.effect === 'pan_right') {
    const x = interpolate(frame, [0, dur], [-40, 40]);
    transform = `scale(1.12) translateX(${x}px)`;
  } else if (scene.effect === 'pan_left') {
    const x = interpolate(frame, [0, dur], [40, -40]);
    transform = `scale(1.12) translateX(${x}px)`;
  } else if (scene.effect === 'shake') {
    const shakeX = Math.sin(frame * 1.5) * 4;
    const shakeY = Math.cos(frame * 1.8) * 3;
    transform = `scale(1.08) translate(${shakeX}px, ${shakeY}px)`;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <Img
        src={staticFile(scene.imageFile)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform,
        }}
      />

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '0 120px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            color: '#f5ebd6',
            fontSize: 48,
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '20px 36px',
            borderRadius: 12,
            lineHeight: 1.35,
            textShadow: '2px 2px 4px #000',
          }}
        >
          {scene.narration}
        </div>
      </div>

      <Audio src={staticFile(scene.audioFile)} />
    </AbsoluteFill>
  );
};

export const StoryVideo = ({ scenes }) => {
  let currentStart = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {(scenes || []).map((scene, index) => {
        const from = currentStart;
        currentStart += scene.durationInFrames;

        return (
          <Sequence
            key={`${scene.imageFile}-${index}`}
            from={from}
            durationInFrames={scene.durationInFrames}
          >
            <SceneBlock scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
