import React from 'react';
import { characterColors, normalizeAppearance } from './appearance.js';
import { rigPose } from './walkCycle.js';

const blinkWindows = (seed) => {
  const base = 70 + (seed % 25);
  return [18, 18 + base, 18 + base * 2, 18 + base * 3, 18 + base * 4].map((start) => [start, start + 4]);
};

export function blinkAmount(frame, seed = 1) {
  const cycle = 210;
  const local = ((frame % cycle) + cycle) % cycle;
  for (const [a, b] of blinkWindows(seed)) {
    const start = a % cycle;
    const end = start + (b - a);
    if (local >= start && local <= end) {
      const mid = (start + end) / 2;
      const t = 1 - Math.abs(local - mid) / ((end - start) / 2);
      return Math.max(0, Math.min(1, t));
    }
  }
  return 0;
}

function Mouth({ open, expression, colors, back }) {
  if (back) return null;
  const smile = expression === 'smile' ? 1 : expression === 'sad' || expression === 'worried' ? -0.7 : 0;
  const y = 96;
  if (open < 0.1 && smile > 0) {
    return <path d="M86 96 Q 100 106, 114 96" fill="none" stroke={colors.lipDk} strokeWidth="2.3" strokeLinecap="round" />;
  }
  if (open < 0.1 && smile < 0) {
    return <path d="M88 100 Q 100 94, 112 100" fill="none" stroke={colors.lipDk} strokeWidth="2.1" strokeLinecap="round" />;
  }
  if (open < 0.1) {
    return <path d="M88 97 Q 100 99, 112 97" fill="none" stroke={colors.lipDk} strokeWidth="2.2" strokeLinecap="round" />;
  }
  const w = 16 + open * 8;
  const h = 2.2 + open * 14;
  return (
    <g>
      <ellipse cx="100" cy={y} rx={w / 2} ry={h / 2} fill={colors.lipDk} />
      <ellipse cx="100" cy={y + h * 0.1} rx={w / 2 - 1.8} ry={Math.max(1.4, h / 2 - 2.2)} fill="#3A1C1C" />
      {open > 0.45 ? <ellipse cx="100" cy={y + h * 0.28} rx={w * 0.2} ry={h * 0.16} fill="#C47872" /> : null}
      <path d={`M${100 - w / 2} ${y} Q 100 ${y - h * 0.42}, ${100 + w / 2} ${y}`} fill={colors.lipstick} />
    </g>
  );
}

function Eye({ cx, cy, blink, lookX, lookY, colors, expression, back }) {
  if (back) return null;
  const wide = expression === 'surprised' ? 1.12 : 1;
  const squint = expression === 'angry' ? 0.82 : expression === 'sad' ? 0.9 : 1;
  const ry = 7.6 * wide * squint;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="10.4" ry={ry} fill="#F4EEE6" />
      <ellipse cx={cx + lookX} cy={cy + 0.4 + lookY} rx="5" ry="5.2" fill={colors.eyes} />
      <circle cx={cx + lookX - 1.5} cy={cy - 1.3 + lookY} r="1.5" fill="#F7F3EC" />
      <rect x={cx - 12} y={cy - 10} width="24" height={blink * 18} fill={colors.skin} rx="3" />
      {blink > 0.2 ? (
        <path
          d={`M${cx - 10} ${cy - 7 + blink * 14} Q ${cx} ${cy - 5 + blink * 14}, ${cx + 10} ${cy - 7 + blink * 14}`}
          fill="none"
          stroke="#5A3A30"
          strokeWidth="1.2"
        />
      ) : (
        <path
          d={`M${cx - 10} ${cy - 6.6 * squint} Q ${cx} ${cy - 9}, ${cx + 10} ${cy - 6.6 * squint}`}
          fill="none"
          stroke={colors.hair}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function Brows({ expression, colors, back }) {
  if (back) return null;
  const lift = expression === 'worried' || expression === 'surprised' || expression === 'sad' ? 4 : expression === 'angry' || expression === 'determined' ? -2 : 0;
  const angle = expression === 'worried' || expression === 'sad' ? 11 : expression === 'angry' ? -11 : expression === 'determined' ? -5 : 0;
  return (
    <g>
      <path
        d={`M76 ${80 - lift} Q 85 ${76 - lift - (angle > 0 ? 2 : 0)}, 94 ${80.5 - lift * 0.3}`}
        fill="none"
        stroke={colors.hair}
        strokeWidth="2.7"
        strokeLinecap="round"
        transform={`rotate(${-angle}, 85, 78)`}
      />
      <path
        d={`M106 ${80.5 - lift * 0.3} Q 115 ${76 - lift - (angle > 0 ? 2 : 0)}, 124 ${80 - lift}`}
        fill="none"
        stroke={colors.hair}
        strokeWidth="2.7"
        strokeLinecap="round"
        transform={`rotate(${angle}, 115, 78)`}
      />
    </g>
  );
}

function Hair({ style, colors, back, hat }) {
  const fill = colors.hair;
  const hi = colors.hairHi;
  if (back) {
    return (
      <g>
        <path d="M60 70 C 54 30, 80 14, 100 14 C 120 14, 146 30, 140 70 C 146 110, 130 132, 100 136 C 70 132, 54 110, 60 70 Z" fill={fill} />
        {style === 'braid' ? (
          <g>
            <path d="M100 132 C 96 170, 108 200, 98 240 C 92 270, 110 300, 100 330" fill="none" stroke={fill} strokeWidth="14" strokeLinecap="round" />
            <circle cx="100" cy="336" r="6" fill={hi} />
          </g>
        ) : style === 'low_knot' || style === 'tied_back' ? (
          <ellipse cx="100" cy="138" rx="16" ry="12" fill={fill} />
        ) : null}
      </g>
    );
  }

  const crown = (
    <path
      d="M64 76 C 58 36, 78 16, 100 16 C 122 16, 142 36, 136 76
         C 138 92, 130 106, 122 108
         L 118 84 C 116 48, 84 48, 82 84
         L 78 108
         C 70 106, 62 92, 64 76 Z"
      fill={fill}
    />
  );
  const bangs = (
    <path
      d="M68 78 C 72 40, 88 28, 100 28 C 112 28, 128 40, 132 78 C 124 60, 116 66, 108 58 C 104 70, 100 54, 96 70 C 88 58, 80 64, 68 78 Z"
      fill={fill}
    />
  );

  if (style === 'undercut') {
    return (
      <g>
        <path d="M70 78 C 68 42, 84 24, 100 24 C 116 24, 132 42, 130 78 C 128 96, 118 104, 100 102 C 82 104, 72 96, 70 78 Z" fill={fill} />
        {bangs}
      </g>
    );
  }
  if (style === 'thinning') {
    return (
      <g>
        <path d="M68 86 C 66 56, 80 38, 100 40 C 120 38, 134 56, 132 86 C 130 78, 118 70, 100 70 C 82 70, 70 78, 68 86 Z" fill={fill} />
        <path d="M72 70 C 86 58, 114 58, 128 70" fill="none" stroke={hi} strokeWidth="3" />
      </g>
    );
  }
  if (style === 'short') {
    return (
      <g>
        {crown}
        <path d="M64 86 C 70 50, 88 32, 100 32 C 112 32, 130 50, 136 86 C 128 70, 110 64, 100 66 C 90 64, 72 70, 64 86 Z" fill={fill} />
      </g>
    );
  }
  if (style === 'braid') {
    return (
      <g>
        {crown}
        {bangs}
        <path d="M118 120 C 130 150, 124 190, 128 230 C 130 260, 120 290, 126 330" fill="none" stroke={fill} strokeWidth="13" strokeLinecap="round" />
        <circle cx="126" cy="336" r="6" fill={hi} />
      </g>
    );
  }
  if (style === 'pinned_up') {
    return (
      <g>
        {crown}
        {bangs}
        <ellipse cx="100" cy="22" rx="20" ry="12" fill={fill} />
        <path d="M66 90 C 58 114, 62 128, 72 132" fill="none" stroke={fill} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M134 90 C 142 114, 138 128, 128 132" fill="none" stroke={fill} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    );
  }
  if (style === 'low_knot') {
    return (
      <g>
        {crown}
        {bangs}
        <ellipse cx="100" cy="116" rx="11" ry="8" fill={fill} />
      </g>
    );
  }
  // tied_back default
  return (
    <g>
      {crown}
      {hat === 'visor' || hat === 'cap' ? null : bangs}
      <path d="M68 90 C 60 104, 58 114, 62 122" fill="none" stroke={fill} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M132 90 C 140 104, 142 114, 138 122" fill="none" stroke={fill} strokeWidth="2.0" strokeLinecap="round" />
    </g>
  );
}

function Hat({ hat, colors, back }) {
  if (hat === 'cap') {
    return (
      <g>
        <ellipse cx="100" cy="36" rx="42" ry="16" fill={colors.accent} />
        <path d="M58 36 Q 100 8, 142 36 L 136 46 Q 100 28, 64 46 Z" fill={colors.accent} />
        {!back ? <path d="M54 40 L 20 46 L 54 50 Z" fill={colors.coatLt} /> : <path d="M146 40 L 180 46 L 146 50 Z" fill={colors.coatLt} />}
      </g>
    );
  }
  if (hat === 'visor') {
    return (
      <g>
        <rect x="62" y="30" width="76" height="16" rx="3" fill={colors.coatDk} />
        {!back ? <path d="M62 46 L 40 52 L 138 52 L 138 46 Z" fill={colors.coat} /> : null}
      </g>
    );
  }
  return null;
}

function Boot({ colors }) {
  return (
    <g>
      <path d="M-22 0 L 24 0 L 28 16 L -26 16 Z" fill={colors.boots} />
      <path d="M-26 14 L 28 14 L 26 22 L -24 22 Z" fill={colors.bootsDk} />
    </g>
  );
}

function Leg({ side, pose, colors, outfit }) {
  const flip = side === 'left' ? -1 : 1;
  const hipX = 100 + flip * 16;
  const hipY = 250;
  const thigh = 108;
  const shin = 98;
  const { hip, knee, footRot, lift, plantX } = pose;
  const pant = outfit === 'dress' ? colors.coat : colors.pants;
  const pant2 = outfit === 'dress' ? colors.coatDk : colors.pantsLt;
  return (
    <g transform={`translate(${hipX + plantX}, ${hipY - lift}) rotate(${hip})`}>
      <path d={`M${-14 * flip} 0 L ${14 * flip} 4 L ${12 * flip} ${thigh} L ${-16 * flip} ${thigh} Z`} fill={side === 'left' ? pant : pant2} />
      <g transform={`rotate(${knee}, 0, ${thigh})`}>
        <path d={`M${-16 * flip} ${thigh} L ${12 * flip} ${thigh} L ${14 * flip} ${thigh + shin} L ${-18 * flip} ${thigh + shin} Z`} fill={pant} />
        <g transform={`translate(0, ${thigh + shin}) rotate(${footRot})`}>
          <Boot colors={colors} />
        </g>
      </g>
    </g>
  );
}

function Hand({ colors }) {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="11" ry="8" fill={colors.skin} />
      <ellipse cx="9" cy="-3" rx="4.2" ry="3.1" fill={colors.skin} />
    </g>
  );
}

function Accessory({ kind, colors }) {
  if (kind === 'notebook') {
    return (
      <g transform="translate(8, 6) rotate(12)">
        <rect x="-9" y="-14" width="18" height="24" rx="1.5" fill={colors.accent} />
        <rect x="-7" y="-12" width="14" height="20" rx="1" fill="#EDE4D0" />
      </g>
    );
  }
  if (kind === 'document_roll') {
    return (
      <g transform="translate(6, 4) rotate(-18)">
        <rect x="-6" y="-22" width="12" height="36" rx="6" fill="#6B4A2A" />
        <rect x="-4" y="-20" width="8" height="32" rx="4" fill="#8A6240" />
      </g>
    );
  }
  return null;
}

function Arm({ side, angle, colors, outfit, gesture, accessory, walking, showHand }) {
  const flip = side === 'left' ? -1 : 1;
  const sx = 100 + flip * 46;
  const sy = 132;
  const upper = 86;
  const lower = 74;
  const sleeve = outfit === 'shirt' || outfit === 'dress' ? colors.shirt : outfit === 'suit' ? colors.coat : colors.coat;
  const sleeve2 = outfit === 'shirt' || outfit === 'dress' ? colors.shirtLt : colors.coatLt;
  const rolled = false;
  const elbow = gesture === 'talk' && side === 'right' ? 38 : gesture === 'point' && side === 'right' ? 8 : walking ? 18 : 22;
  return (
    <g transform={`translate(${sx}, ${sy}) rotate(${angle})`}>
      <path d={`M${-11 * flip} 0 L ${11 * flip} 2 L ${9 * flip} ${upper} L ${-13 * flip} ${upper + 2} Z`} fill={side === 'left' ? colors.coatDk || sleeve : sleeve2} />
      <g transform={`rotate(${elbow * flip}, 0, ${upper})`}>
        <path d={`M${-12 * flip} ${upper} L ${10 * flip} ${upper} L ${11 * flip} ${upper + lower} L ${-13 * flip} ${upper + lower} Z`} fill={sleeve} />
        {showHand ? (
          <g transform={`translate(0, ${upper + lower + 4})`}>
            <Hand colors={colors} />
            {side === 'right' ? <Accessory kind={accessory} colors={colors} /> : null}
          </g>
        ) : null}
      </g>
    </g>
  );
}

function Headset({ colors, back }) {
  return (
    <g>
      <path d="M62 70 Q 100 40, 138 70" fill="none" stroke="#1A1A1A" strokeWidth="4" />
      {!back ? <rect x="52" y="72" width="12" height="20" rx="3" fill="#222" /> : null}
      <rect x="136" y="72" width="12" height="20" rx="3" fill="#222" />
    </g>
  );
}

export const PaperCharacter = ({
  appearance: appearanceProp,
  character,
  frame = 0,
  mouth = 0,
  pose = 'three_quarter',
  expression = 'neutral',
  gesture = 'idle',
  action,
  flipped = false,
  seed = 1,
}) => {
  const appearance = normalizeAppearance(character || { appearance: appearanceProp, palette: appearanceProp?.palette });
  const colors = characterColors(appearance);
  const back = pose === 'back';
  const silhouette = pose === 'silhouette';
  const walk = (action || gesture) === 'walk';
  const rig = rigPose(frame, walk ? 'walk' : 'idle');
  const blink = silhouette || back ? 0 : blinkAmount(frame, seed);
  const lookX = expression === 'worried' ? 0.6 : 0;
  const lookY = expression === 'sad' ? 0.8 : expression === 'determined' ? -0.3 : 0;
  const pockets = !walk && (gesture === 'idle' || gesture === 'listen') && (appearance.outfit === 'coat' || appearance.outfit === 'jacket');
  const showHands = !pockets;
  const rightAngle =
    walk
      ? rig.rightArm
      : gesture === 'talk'
        ? -42
        : gesture === 'point' || gesture === 'reach'
          ? -70
          : pockets
            ? 16
            : rig.rightArm;
  const leftAngle = walk ? rig.leftArm : pockets ? -16 : rig.leftArm;
  const acc = gesture === 'hold' || appearance.accessory !== 'none' ? appearance.accessory : 'none';
  const build = appearance.build === 'broad' ? 1.1 : appearance.build === 'slim' ? 0.9 : 1;
  const hipW = appearance.body === 'female' ? 1.06 : 1;
  const F = (c) => (silhouette ? '#0C0C12' : c);
  const C = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, F(v)]));

  const hemY = appearance.outfit === 'jacket' || appearance.outfit === 'shirt' ? 268 : appearance.outfit === 'suit' ? 400 : 388;

  const torso = (() => {
    const shoulder = 48 * build;
    const hem = 52 * build * (appearance.outfit === 'dress' ? hipW * 1.08 : hipW);
    const waist = appearance.outfit === 'dress' ? 38 * build : 44 * build;
    const top = 118;
    const fill = appearance.outfit === 'shirt' ? C.shirt : appearance.outfit === 'dress' ? C.coat : C.coat;
    const dk = appearance.outfit === 'shirt' ? C.shirt : C.coatDk;
    return (
      <g transform={`rotate(${rig.torsoRot}, 100, 200)`}>
        {/* sloped, rounded shoulders — not a box */}
        <path
          d={`M${100 - shoulder} ${top + 10}
             C ${100 - shoulder} ${top - 2}, ${100 - shoulder + 10} ${top - 6}, 100 ${top - 8}
             C ${100 + shoulder - 10} ${top - 6}, ${100 + shoulder} ${top - 2}, ${100 + shoulder} ${top + 10}
             C ${100 + shoulder + 6} 170, ${100 + waist + 8} 220, ${100 + hem} ${hemY}
             C ${100 + 20} ${hemY + 8}, ${100 - 20} ${hemY + 8}, ${100 - hem} ${hemY}
             C ${100 - waist - 8} 220, ${100 - shoulder - 6} 170, ${100 - shoulder} ${top + 10} Z`}
          fill={fill}
        />
        <path
          d={`M100 ${top - 6} L ${100 - 8} ${top + 10} C ${100 - waist} 210, ${100 - 20} ${hemY - 10}, 100 ${hemY - 4} Z`}
          fill={dk}
          opacity="0.32"
        />
        {appearance.outfit !== 'dress' && appearance.outfit !== 'shirt' ? (
          <g>
            <circle cx="100" cy="200" r="3.2" fill={C.coatDk} />
            <circle cx="100" cy="230" r="3.2" fill={C.coatDk} />
            <circle cx="100" cy="260" r="3.2" fill={C.coatDk} />
            {hemY > 300 ? <circle cx="100" cy="290" r="3.2" fill={C.coatDk} /> : null}
          </g>
        ) : null}
        {appearance.outfit === 'coat' || appearance.outfit === 'jacket' || appearance.outfit === 'suit' ? (
          <path d="M86 122 L 100 168 L 90 122 Z" fill={C.coatLt} opacity="0.45" />
        ) : null}
        {appearance.outfit !== 'dress' ? (
          <path d="M92 118 L 108 118 C 112 122, 112 128, 110 134 C 106 138, 94 138, 90 134 C 88 128, 88 122, 92 118 Z" fill={C.shirt} />
        ) : (
          <path d="M90 116 L 100 136 L 110 116 Z" fill={C.shirt} opacity="0.7" />
        )}
        {appearance.extras?.includes('apron') ? (
          <path d="M78 168 L 122 168 L 126 280 L 74 280 Z" fill={C.shirt} opacity="0.92" />
        ) : null}
        {appearance.extras?.includes('shawl') ? (
          <path d="M54 122 C 70 150, 130 150, 146 122 L 150 210 C 120 190, 80 190, 50 210 Z" fill={C.shirt} opacity="0.95" />
        ) : null}
        {pockets ? (
          <g>
            <path d="M62 248 L 82 252 L 80 278 L 60 274 Z" fill={C.coatDk} opacity="0.5" />
            <path d="M138 248 L 118 252 L 120 278 L 140 274 Z" fill={C.coatDk} opacity="0.4" />
            <ellipse cx="66" cy="266" rx="8" ry="6" fill={C.skin} />
            <ellipse cx="134" cy="266" rx="8" ry="6" fill={C.skin} />
          </g>
        ) : null}
      </g>
    );
  })();

  const head = (
    <g transform={`rotate(${rig.headRot}, 100, 114)`}>
      {/* short neck, tucked between chin and sloped shoulders */}
      <path d="M90 98 L 110 98 L 108 118 L 92 118 Z" fill={C.skin} />
      <path d="M90 98 L 98 98 L 96 118 L 92 118 Z" fill={C.skinDk} opacity="0.28" />
      <Hair style={appearance.hair} colors={C} back={back} hat={appearance.hat} />
      {!back ? (
        <path
          d="M70 68 C 68 42, 82 28, 100 28 C 118 28, 132 42, 130 68 C 132 86, 120 102, 100 104 C 80 102, 68 86, 70 68 Z"
          fill={C.skin}
        />
      ) : (
        <path d="M74 70 C 72 48, 84 36, 100 36 C 116 36, 128 48, 126 70 C 124 90, 112 104, 100 104 C 88 104, 76 90, 74 70 Z" fill={C.hair} />
      )}
      {!back ? <path d="M78 70 C 80 52, 90 42, 100 42 L 100 98 C 86 96, 76 86, 78 70 Z" fill={C.skinDk} opacity="0.16" /> : null}
      {!back ? <ellipse cx="68" cy="76" rx="6" ry="8.5" fill={C.skinDk} /> : null}
      {!back ? <ellipse cx="132" cy="76" rx="6" ry="8.5" fill={C.skinDk} /> : null}
      {!back && appearance.hat === 'none' && appearance.body === 'female' ? (
        <>
          <circle cx="68" cy="86" r="3.6" fill="none" stroke="#C5C2BB" strokeWidth="1.4" />
          <circle cx="132" cy="86" r="3.6" fill="none" stroke="#C5C2BB" strokeWidth="1.4" />
        </>
      ) : null}
      <Brows expression={expression} colors={C} back={back} />
      <Eye cx={84} cy={76} blink={blink} lookX={lookX} lookY={lookY} colors={C} expression={expression} back={back} />
      <Eye cx={116} cy={76} blink={blink} lookX={lookX} lookY={lookY} colors={C} expression={expression} back={back} />
      {!back ? <path d="M100 80 L 96.8 90 Q 100 94, 103.2 90 Z" fill={C.skinDk} opacity="0.85" /> : null}
      {!back ? <ellipse cx="78" cy="88" rx="7" ry="3.6" fill="#C07060" opacity="0.22" /> : null}
      {!back ? <ellipse cx="122" cy="88" rx="7" ry="3.6" fill="#C07060" opacity="0.22" /> : null}
      {appearance.facialHair === 'beard' && !back ? (
        <path d="M78 92 C 82 112, 118 112, 122 92 C 114 108, 86 108, 78 92 Z" fill={C.hair} opacity="0.92" />
      ) : null}
      {appearance.facialHair === 'stubble' && !back ? (
        <path d="M80 94 C 86 108, 114 108, 120 94" fill={C.hair} opacity="0.35" />
      ) : null}
      <Mouth open={silhouette ? 0 : mouth} expression={expression} colors={C} back={back} />
      <Hat hat={appearance.hat} colors={C} back={back} />
      {appearance.accessory === 'headset' ? <Headset colors={C} back={back} /> : null}
    </g>
  );

  return (
    <svg width="100%" height="100%" viewBox="0 0 200 500" style={{ overflow: 'visible', display: 'block' }}>
      <g transform={`translate(${rig.bodyX + (flipped ? 200 : 0)}, ${-rig.bodyY}) scale(${flipped ? -1 : 1}, 1)`}>
        <g>
          {pockets ? null : <Arm side="left" angle={leftAngle} colors={C} outfit={appearance.outfit} gesture={gesture} accessory="none" walking={walk} showHand={showHands} />}
          <Leg side="left" pose={rig.left} colors={C} outfit={appearance.outfit} />
          <Leg side="right" pose={rig.right} colors={C} outfit={appearance.outfit} />
          {torso}
          {pockets ? null : <Arm side="right" angle={rightAngle} colors={C} outfit={appearance.outfit} gesture={gesture} accessory={acc} walking={walk} showHand={showHands} />}
          {head}
        </g>
      </g>
    </svg>
  );
};
