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
  useVideoConfig,
} from 'remotion';
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadGaramond } from '@remotion/google-fonts/EBGaramond';
import { PaperBackdrop, backdropKind } from './characters/PaperBackdrop.jsx';

const { fontFamily: cinzel } = loadCinzel();
const { fontFamily: garamond } = loadGaramond();

const CREAM = '#F5EBD6';
const ease = Easing.inOut(Easing.cubic);
const KEN_BURNS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right'];

const fadeStops = (duration, fadeIn, fadeOut) => {
  const dur = Math.max(1, duration || 1);
  const inEnd = Math.max(1, Math.min(fadeIn, Math.max(1, Math.floor(dur / 3))));
  const outStart = Math.max(inEnd + 1, dur - fadeOut);
  const end = Math.max(outStart + 1, dur);
  return [0, inEnd, outStart, end];
};

const chunkTimedWords = (words, maxWords = 8) => {
  const list = Array.isArray(words) ? words.filter((word) => word && word.word) : [];
  if (!list.length) return [];
  const cues = [];
  for (let i = 0; i < list.length; i += maxWords) {
    const slice = list.slice(i, i + maxWords);
    const from = Number(slice[0].from) || 0;
    const to = Math.max(from + 1, Number(slice[slice.length - 1].to) || from + 1);
    cues.push({ text: slice.map((word) => word.word).join(' '), from, to });
  }
  return cues;
};

const narrationCues = (narration, durationInFrames, maxWords = 8) => {
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
};

export const calculateStoryFrames = (props) => {
  const scenes = props.scenes || [];
  const title = props.titleDurationInFrames || 0;
  const end = props.endCardDurationInFrames || 150;
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
  const title = props.titleDurationInFrames || 0;
  const starts = [];
  let cursor = Math.max(0, title);
  (props.scenes || []).forEach((scene) => {
    starts.push(cursor);
    cursor += (scene.durationInFrames || 0) - overlap;
  });
  return { starts, scenesEnd: cursor + overlap };
};

const EndCard = ({ title, duration }) => {
  const frame = useCurrentFrame();
  const fadeIn = Math.min(30, Math.max(8, Math.floor(duration / 5)));
  const fadeOut = Math.min(30, Math.max(6, Math.floor(duration / 6)));
  const opacity = interpolate(frame, fadeStops(duration, fadeIn, fadeOut), [0, 1, 1, 0], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, duration], [16, -8], { easing: ease });

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
            color: CREAM,
            marginBottom: 22,
            textShadow: '0 2px 16px rgba(0,0,0,0.9)',
          }}
        >
          The End
        </div>
        <div
          style={{
            fontFamily: cinzel,
            fontSize: 58,
            color: CREAM,
            padding: '0 160px',
            lineHeight: 1.2,
            textShadow: '0 2px 18px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Particles = ({ kind }) => {
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
        const opacity = 0.16 + 0.14 * Math.sin((frame + p.seed * 9) / 16);
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
                kind === 'embers' ? 'rgba(255, 170, 70, 0.85)' : 'rgba(245, 235, 214, 0.7)',
              opacity,
              transform: kind === 'rain' ? 'rotate(12deg)' : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Subtitles = ({ scene }) => {
  const frame = useCurrentFrame();
  const cues = useMemo(() => {
    if (scene?.words?.length) return chunkTimedWords(scene.words, 8);
    return narrationCues(scene?.narration || '', scene?.durationInFrames || 1, 8);
  }, [scene]);
  if (!cues.length) return null;
  const active = cues.find((cue) => frame >= cue.from && frame < cue.to) || cues.find((cue) => frame < cue.to);
  if (!active || !active.text) return null;
  const fade = interpolate(frame, fadeStops(scene.durationInFrames || 1, 6, 8), [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 64,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 140px',
        opacity: fade,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: garamond,
          fontSize: 46,
          fontWeight: 600,
          color: CREAM,
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 1600,
          textShadow: '0 2px 0 rgba(0,0,0,0.85), 0 4px 14px rgba(0,0,0,0.9)',
        }}
      >
        {active.text}
      </div>
    </div>
  );
};

const kenBurns = (effect, progress, frame) => {
  let bgX = 0;
  let bgY = 0;
  let bgScale = interpolate(progress, [0, 1], [1.06, 1.14]);
  if (effect === 'zoom_out') {
    bgScale = interpolate(progress, [0, 1], [1.16, 1.06]);
  } else if (effect === 'pan_right') {
    bgX = interpolate(progress, [0, 1], [-48, 48]);
    bgScale = interpolate(progress, [0, 1], [1.12, 1.14]);
  } else if (effect === 'pan_left') {
    bgX = interpolate(progress, [0, 1], [48, -48]);
    bgScale = interpolate(progress, [0, 1], [1.12, 1.14]);
  } else {
    bgX = interpolate(progress, [0, 1], [-12, 16]);
    bgY = interpolate(progress, [0, 1], [6, -8]);
  }
  return { bgX, bgY, bgScale, flicker: Math.sin(frame * 0.015) * 0 };
};

const SceneBlock = ({ scene }) => {
  const frame = useCurrentFrame();
  const dur = scene.durationInFrames;
  const progress = interpolate(frame, [0, dur], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, fadeStops(dur, 14, 14), [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const effect = KEN_BURNS.includes(scene.effect) ? scene.effect : 'zoom_in';
  const { bgX, bgY, bgScale } = kenBurns(effect, progress, frame);
  const light = interpolate(progress, [0, 0.5, 1], [0.08, 0.14, 0.08]);
  const vignette = interpolate(progress, [0, 1], [0.58, 0.68]);
  const hasImage = Boolean(scene.imageFile);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: hasImage ? 'saturate(1.08) contrast(1.05) brightness(0.96)' : 'saturate(1.04) brightness(0.95)',
          transform: `scale(${bgScale}) translate(${bgX}px, ${bgY}px)`,
        }}
      >
        {hasImage ? (
          <Img
            src={staticFile(scene.imageFile)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <PaperBackdrop
            kind={scene.backdrop || backdropKind(`${scene.visualPrompt || ''} ${scene.narration || ''}`)}
            frame={frame}
          />
        )}
      </div>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 38%, rgba(255,210,130,${light}) 0%, transparent 46%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 42%, rgba(0,0,0,${vignette}) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <Particles kind={scene.particles || 'dust'} />
      <Subtitles scene={scene} />
      {scene.audioFile ? <Audio src={staticFile(scene.audioFile)} /> : null}
      {scene.sfxFile ? <Audio src={staticFile(scene.sfxFile)} volume={0.28} /> : null}
    </AbsoluteFill>
  );
};

const MusicBed = ({ props, scenesEnd }) => {
  const { durationInFrames, fps } = useVideoConfig();
  if (!props.musicFile) return null;
  const voiceRanges = (props.scenes || []).map((scene, index) => {
    const start = (props._starts || [])[index] || 0;
    return [start, start + (scene.durationInFrames || 0) - 8];
  });
  const fadeFrames = Math.round(3 * (fps || 30));
  const fadeStart = Math.max(0, durationInFrames - fadeFrames);
  const last = Math.max(fadeStart + 1, durationInFrames - 1);

  return (
    <Audio
      src={staticFile(props.musicFile)}
      loop
      volume={(frame) => {
        const speaking = voiceRanges.some(([from, to]) => frame >= from && frame < to);
        const base = speaking ? 0.06 : 0.12;
        if (frame < fadeStart) return base;
        return (
          base *
          interpolate(frame, [fadeStart, last], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        );
      }}
    />
  );
};

export const StoryVideo = (props) => {
  const { starts, scenesEnd } = useMemo(() => buildStarts(props), [props]);
  const titleDur = props.titleDurationInFrames || 0;
  const endDur = props.endCardDurationInFrames || 150;
  const scenes = props.scenes || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {props.musicFile ? <MusicBed props={{ ...props, _starts: starts }} scenesEnd={scenesEnd} /> : null}

      {titleDur > 0 ? (
        <Sequence from={0} durationInFrames={titleDur}>
          <AbsoluteFill style={{ backgroundColor: '#000' }} />
        </Sequence>
      ) : null}

      {scenes.map((scene, index) => (
        <Sequence
          key={`${scene.imageFile || scene.narration || 'scene'}-${index}`}
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
            opacity: 0.07,
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
