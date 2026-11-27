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
import { PaperCharacter } from './characters/PaperCharacter.jsx';
import { PaperBackdrop, backdropKind } from './characters/PaperBackdrop.jsx';

const { fontFamily: cinzel } = loadCinzel();
const { fontFamily: garamond } = loadGaramond();


const ease = Easing.inOut(Easing.cubic);

const fadeStops = (duration, fadeIn, fadeOut) => {
  const dur = Math.max(1, duration || 1);
  const inEnd = Math.max(1, Math.min(fadeIn, Math.max(1, Math.floor(dur / 3))));
  const outStart = Math.max(inEnd + 1, dur - fadeOut);
  const end = Math.max(outStart + 1, dur);
  return [0, inEnd, outStart, end];
};


export const calculateStoryFrames = (props) => {
  const scenes = props.scenes || [];
  const title = props.titleDurationInFrames || 60;
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
  const progress = interpolate(frame, fadeStops(duration, 18, 16), [0, 1, 1, 0], {
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
  const opacity = interpolate(frame, fadeStops(duration, 24, 30), [0, 1, 1, 0], {
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

const WINDOW_SIZE = 8;

const visibleWords = (words, frame) => {
  if (!words || words.length === 0) return [];
  let active = words.findIndex((word) => frame >= word.from && frame <= word.to + 3);
  if (active < 0) {
    const next = words.findIndex((word) => word.from > frame);
    active = next < 0 ? words.length - 1 : Math.max(0, next - 1);
  }
  const start = Math.max(0, Math.min(active - 2, Math.max(0, words.length - WINDOW_SIZE)));
  return words.slice(start, start + WINDOW_SIZE);
};

const Karaoke = ({ words, duration }) => {
  const frame = useCurrentFrame();
  if (!words || words.length === 0) return null;
  const fade = interpolate(frame, fadeStops(duration, 8, 10), [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shown = visibleWords(words, frame);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 56,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 80px',
        opacity: fade,
        zIndex: 20,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.86)',
          padding: '18px 40px 22px',
          borderRadius: 16,
          textAlign: 'center',
          lineHeight: 1.35,
          maxWidth: 1680,
          border: '1px solid rgba(255, 230, 170, 0.22)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        }}
      >
        {shown.map((word, index) => {
          const active = frame >= word.from && frame <= word.to + 3;
          const spoken = frame > word.to + 3;
          return (
            <span
              key={`${word.word}-${word.from}-${index}`}
              style={{
                fontFamily: garamond,
                fontSize: 62,
                fontWeight: 700,
                color: active ? '#FFE28A' : spoken ? '#FFF8E8' : '#D9D0BC',
                WebkitTextStroke: active ? '0.4px #3a2a00' : '0.4px #000',
                textShadow: active
                  ? '0 0 16px rgba(255, 200, 70, 0.7), 0 3px 0 #000, 0 6px 14px #000'
                  : '0 3px 0 #000, 0 6px 14px #000',
                marginRight: 14,
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

const Actor = ({ actor, frame, duration, mouth }) => {
  if (!actor) return null;
  const { width: compW, height: compH } = useVideoConfig();
  const progress = interpolate(frame, [0, duration], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const swayX = Math.sin(frame * 0.035) * 3;
  const swayY = Math.cos(frame * 0.028) * 2;
  const driftX = interpolate(progress, [0, 1], [actor.driftX || 0, -1 * (actor.driftX || 0)]) * (compW / 1920);
  const scale = actor.scale || 1;
  const height = Math.round(compH * 0.92 * scale);
  const width = Math.round((height * 200) / 500);
  const left = Math.round((actor.x ?? 0.28) * compW - width / 2);
  const bottom = Math.round((actor.y ?? 0) * (compH / 1080));
  const open = actor.speaking ? Number(mouth?.[Math.max(0, Math.min((mouth?.length || 1) - 1, frame))] || 0) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        bottom,
        width,
        height,
        transform: `translate(${swayX + driftX}px, ${swayY}px)`,
        filter: 'drop-shadow(16px 22px 18px rgba(0,0,0,0.55))',
        pointerEvents: 'none',
        zIndex: actor.z ?? 5,
        opacity: actor.opacity ?? 1,
      }}
    >
      <PaperCharacter
        appearance={actor.appearance}
        character={actor.character}
        frame={frame}
        mouth={open}
        pose={actor.pose || 'three_quarter'}
        expression={actor.expression || 'neutral'}
        gesture={actor.gesture || 'idle'}
        action={actor.action}
        flipped={Boolean(actor.flip)}
        seed={actor.seed || 1}
      />
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

  const opacity = interpolate(frame, fadeStops(dur, 14, 14), [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let bgX = 0;
  let bgY = 0;
  let bgScale = interpolate(progress, [0, 1], [1.06, 1.12]);
  const effect = scene.effect || 'zoom_in';

  if (effect === 'zoom_out') {
    bgScale = interpolate(progress, [0, 1], [1.16, 1.06]);
  } else if (effect === 'pan_right') {
    bgX = interpolate(progress, [0, 1], [-40, 48]);
    bgScale = interpolate(progress, [0, 1], [1.1, 1.12]);
  } else if (effect === 'pan_left') {
    bgX = interpolate(progress, [0, 1], [48, -40]);
    bgScale = interpolate(progress, [0, 1], [1.1, 1.12]);
  } else if (effect === 'push_up') {
    bgY = interpolate(progress, [0, 1], [24, -28]);
    bgX = interpolate(progress, [0, 1], [-8, 8]);
  } else if (effect === 'handheld') {
    bgX = Math.sin(frame * 0.06) * 5 + interpolate(progress, [0, 1], [-16, 18]);
    bgY = Math.cos(frame * 0.08) * 3;
  } else if (effect === 'shake') {
    bgX = Math.sin(frame * 0.9) * 5;
    bgY = Math.cos(frame * 1.1) * 3;
    bgScale = interpolate(progress, [0, 1], [1.08, 1.14]);
  } else {
    bgX = interpolate(progress, [0, 1], [-16, 20]);
  }

  const light = interpolate(progress, [0, 0.5, 1], [0.1, 0.18, 0.1]);
  // Mild vignette so faces and puppets stay readable
  const vignette = interpolate(progress, [0, 1], [0.42, 0.52]);
  const actors = scene.actors || scene.puppets || [];
  const closeShot = scene.shot === 'close';
  const hasImage = Boolean(scene.imageFile);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: closeShot
            ? 'blur(2.2px) saturate(1.04) brightness(0.82)'
            : hasImage
              ? 'blur(2.4px) saturate(1.06) brightness(0.9)'
              : 'saturate(1.04) brightness(0.95)',
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
      {actors.map((actor, index) => (
        <Actor
          key={`${actor.id || 'actor'}-${index}`}
          actor={actor}
          frame={frame}
          duration={dur}
          mouth={scene.mouth}
        />
      ))}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 38%, rgba(255,210,130,${light}) 0%, transparent 46%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 48%, rgba(0,0,0,${vignette}) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <Particles kind={scene.particles || 'dust'} />
      <Karaoke words={scene.words || []} duration={dur} />
      {scene.audioFile ? <Audio src={staticFile(scene.audioFile)} /> : null}
      {scene.sfxFile ? <Audio src={staticFile(scene.sfxFile)} volume={0.28} /> : null}
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
  const endDur = props.endCardDurationInFrames || 150;
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
