import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadGaramond } from '@remotion/google-fonts/EBGaramond';

const { fontFamily: cinzel } = loadCinzel();
const { fontFamily: garamond } = loadGaramond();

const ease = Easing.inOut(Easing.cubic);

export const calculateStoryFrames = (props) => {
  const scenes = props.scenes || [];
  const title = props.titleDurationInFrames || 60;
  const end = props.endCardDurationInFrames || 225;
  const overlap = props.overlapFrames ?? 12;
  let total = title;
  scenes.forEach((scene, index) => {
    total += scene.durationInFrames || 0;
    if (index < scenes.length - 1) total -= overlap;
  });
  return total + end;
};

const buildStarts = (props) => {
  const overlap = props.overlapFrames ?? 12;
  const title = props.titleDurationInFrames || 60;
  const starts = [];
  let cursor = Math.max(0, title - 18);
  (props.scenes || []).forEach((scene) => {
    starts.push(cursor);
    cursor += (scene.durationInFrames || 0) - overlap;
  });
  return { starts, scenesEnd: cursor + overlap };
};

const TitleCard = ({ title, genre, duration }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 18, duration - 16, duration], [0, 1, 1, 0], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line = interpolate(frame, [8, 32], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shift = interpolate(frame, [0, duration], [16, -10], { easing: ease });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#07070a',
        opacity: progress,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: `translateY(${shift}px)`,
          textAlign: 'center',
          padding: '0 140px',
        }}
      >
        <div
          style={{
            fontFamily: garamond,
            fontSize: 28,
            letterSpacing: 10,
            textTransform: 'uppercase',
            color: '#d7c199',
            opacity: 0.8,
            marginBottom: 28,
          }}
        >
          {genre || 'A paper-cutout film'}
        </div>
        <div
          style={{
            fontFamily: cinzel,
            fontSize: 86,
            fontWeight: 700,
            color: '#f4ead2',
            lineHeight: 1.15,
            textShadow: '0 8px 30px rgba(0,0,0,0.8)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            margin: '34px auto 0',
            height: 2,
            width: 280 * line,
            background: 'linear-gradient(90deg, transparent, #e2c37a, transparent)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const EndCard = ({ title, duration }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24, duration - 30, duration], [0, 1, 1, 0], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, duration], [20, -12], { easing: ease });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#07070a',
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)` }}>
        <div
          style={{
            fontFamily: cinzel,
            fontSize: 34,
            letterSpacing: 12,
            textTransform: 'uppercase',
            color: '#e2c37a',
            marginBottom: 22,
          }}
        >
          The End
        </div>
        <div
          style={{
            fontFamily: cinzel,
            fontSize: 58,
            color: '#f4ead2',
            padding: '0 160px',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Particles = ({ kind, duration }) => {
  const frame = useCurrentFrame();
  const items = useMemo(() => {
    const count = kind === 'rain' ? 70 : 46;
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        x: (i * 97 + 13) % 1920,
        y: (i * 53 + 29) % 1080,
        size: kind === 'rain' ? 1.5 : 2 + (i % 3),
        speed: kind === 'rain' ? 14 + (i % 8) : 0.35 + (i % 5) * 0.12,
        drift: ((i % 7) - 3) * 0.25,
        seed: i,
      });
    }
    return list;
  }, [kind]);

  if (kind === 'none') return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {items.map((p) => {
        const travel = (p.y + frame * p.speed) % 1120;
        const x = (p.x + frame * p.drift + 1920) % 1920;
        const opacity = 0.18 + 0.18 * Math.sin((frame + p.seed * 9) / 16);
        const height = kind === 'rain' ? 18 : p.size;
        const width = kind === 'rain' ? 1.2 : p.size;
        return (
          <div
            key={p.seed}
            style={{
              position: 'absolute',
              left: x,
              top: travel - 20,
              width,
              height,
              borderRadius: kind === 'rain' ? 0 : 99,
              background:
                kind === 'embers'
                  ? 'rgba(255, 170, 70, 0.85)'
                  : 'rgba(245, 235, 214, 0.7)',
              opacity,
              transform: kind === 'rain' ? 'rotate(12deg)' : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Karaoke = ({ words, duration }) => {
  const frame = useCurrentFrame();
  if (!words || words.length === 0) return null;
  const fade = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 72,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 150px',
        opacity: fade,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.62)',
          padding: '16px 32px',
          borderRadius: 14,
          textAlign: 'center',
          lineHeight: 1.45,
          maxWidth: 1600,
        }}
      >
        {words.map((word, index) => {
          const active = frame >= word.from && frame <= word.to + 2;
          const spoken = frame > word.to + 2;
          return (
            <span
              key={`${word.word}-${index}`}
              style={{
                fontFamily: garamond,
                fontSize: 46,
                fontWeight: 600,
                color: active ? '#ffe7a8' : spoken ? '#f5ebd6' : 'rgba(245, 235, 214, 0.42)',
                textShadow: active
                  ? '0 0 18px rgba(255, 200, 80, 0.55), 0 2px 8px #000'
                  : '0 2px 8px #000',
                marginRight: 10,
                display: 'inline-block',
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const SceneBlock = ({ scene }) => {
  const frame = useCurrentFrame();
  const dur = scene.durationInFrames;
  const progress = interpolate(frame, [0, dur], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, 14, Math.max(16, dur - 14), dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let bgX = 0;
  let fgX = 0;
  let bgScale = interpolate(progress, [0, 1], [1.16, 1.24]);
  let fgScale = interpolate(progress, [0, 1], [1.04, 1.16]);
  let fgY = 0;
  const effect = scene.effect || 'zoom_in';

  if (effect === 'zoom_out') {
    bgScale = interpolate(progress, [0, 1], [1.28, 1.16]);
    fgScale = interpolate(progress, [0, 1], [1.2, 1.05]);
  } else if (effect === 'pan_right') {
    bgX = interpolate(progress, [0, 1], [-28, 36]);
    fgX = interpolate(progress, [0, 1], [-70, 80]);
  } else if (effect === 'pan_left') {
    bgX = interpolate(progress, [0, 1], [36, -28]);
    fgX = interpolate(progress, [0, 1], [80, -70]);
  } else if (effect === 'push_up') {
    fgY = interpolate(progress, [0, 1], [30, -36]);
    bgX = interpolate(progress, [0, 1], [-8, 8]);
  } else if (effect === 'handheld') {
    fgX = Math.sin(frame * 0.07) * 6 + interpolate(progress, [0, 1], [-18, 22]);
    fgY = Math.cos(frame * 0.09) * 4;
    bgX = Math.sin(frame * 0.05) * 3;
  } else if (effect === 'shake') {
    fgX = Math.sin(frame * 0.9) * 5;
    fgY = Math.cos(frame * 1.1) * 3;
    bgScale = interpolate(progress, [0, 1], [1.12, 1.2]);
  } else {
    // zoom_in and default: slight opposing parallax so the frame is never still
    bgX = interpolate(progress, [0, 1], [-12, 16]);
    fgX = interpolate(progress, [0, 1], [-24, 30]);
  }

  const light = interpolate(progress, [0, 0.5, 1], [0.12, 0.22, 0.1]);
  const vignette = interpolate(progress, [0, 1], [0.72, 0.84]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }}>
      <Img
        src={staticFile(scene.imageFile)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(8px) saturate(1.05) brightness(0.72)',
          transform: `scale(${bgScale}) translate(${bgX}px, -10px)`,
        }}
      />
      <Img
        src={staticFile(scene.imageFile)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${fgScale}) translate(${fgX}px, ${fgY}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 40%, rgba(255,210,130,${light}) 0%, transparent 42%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle, transparent 36%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
      <Particles kind={scene.particles || 'dust'} duration={dur} />
      <Karaoke words={scene.words || []} duration={dur} />
      {scene.audioFile ? <Audio src={staticFile(scene.audioFile)} /> : null}
      {scene.sfxFile ? (
        <Audio src={staticFile(scene.sfxFile)} volume={0.28} />
      ) : null}
    </AbsoluteFill>
  );
};

const MusicBed = ({ props, scenesEnd }) => {
  const frame = useCurrentFrame();
  const title = props.titleDurationInFrames || 60;
  const voiceRanges = (props.scenes || []).map((scene, index) => {
    const start = (props._starts || [])[index] || 0;
    return [start, start + (scene.durationInFrames || 0) - 8];
  });
  const speaking = voiceRanges.some(([from, to]) => frame >= from && frame < to);
  const inTitle = frame < title;
  const inEnd = frame >= scenesEnd;
  const ducked = speaking ? 0.16 : inTitle || inEnd ? 0.36 : 0.24;
  if (!props.musicFile) return null;
  return <Audio src={staticFile(props.musicFile)} volume={ducked} />;
};

export const StoryVideo = (props) => {
  const { starts, scenesEnd } = useMemo(() => buildStarts(props), [props]);
  const titleDur = props.titleDurationInFrames || 60;
  const endDur = props.endCardDurationInFrames || 225;
  const scenes = props.scenes || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {props.musicFile ? <MusicBed props={{ ...props, _starts: starts }} scenesEnd={scenesEnd} /> : null}

      <Sequence from={0} durationInFrames={titleDur}>
        <TitleCard title={props.title} genre={props.genre} duration={titleDur} />
      </Sequence>

      {scenes.map((scene, index) => (
        <Sequence
          key={`${scene.imageFile}-${index}`}
          from={starts[index]}
          durationInFrames={scene.durationInFrames}
        >
          <SceneBlock scene={scene} />
        </Sequence>
      ))}

      <Sequence from={scenesEnd} durationInFrames={endDur}>
        <EndCard title={props.title} duration={endDur} />
      </Sequence>

      {props.grainFile ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: 0.08,
            mixBlendMode: 'overlay',
          }}
        >
          <Img
            src={staticFile(props.grainFile)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
