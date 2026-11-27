/** Planted-foot walk and idle poses for the SVG rig. Units are degrees / viewBox pixels. */

export function idlePose(frame) {
  const breathe = Math.sin(frame / 16) * 1.6;
  return {
    bodyX: 0,
    bodyY: breathe,
    torsoRot: Math.sin(frame / 22) * 0.7,
    headRot: Math.sin(frame / 26) * 0.8,
    left: { hip: -4, knee: 4, footRot: 2, lift: 0, plantX: 0 },
    right: { hip: 4, knee: 4, footRot: -2, lift: 0, plantX: 0 },
    leftArm: 7,
    rightArm: -7,
  };
}

/**
 * Walk cycle with feet that stay level and planted during contact.
 * phase 0: left mid-stance, right passing
 */
export function walkPose(frame, fps = 30) {
  const stepsPerSec = 1.65;
  const phase = (frame / fps) * stepsPerSec * Math.PI * 2;

  const leg = (offset) => {
    const p = phase + offset;
    const sin = Math.sin(p);
    const cos = Math.cos(p);
    const hip = sin * 22;
    // Airborne when the leg is swinging forward (cos < 0).
    const air = Math.max(0, -cos);
    const plant = Math.max(0, cos);
    const knee = 6 + air * 38;
    // Counter-rotate the foot so the sole stays nearly world-horizontal when planted.
    const footRot = -hip * 0.85 + air * 10;
    const lift = air * 18;
    // Slide the foot backward under the body during contact to avoid moonwalking.
    const plantX = plant * sin * -16;
    return { hip, knee, footRot, lift, plantX };
  };

  const bob = Math.abs(Math.sin(phase)) * 5.5;
  return {
    bodyX: 0,
    bodyY: bob,
    torsoRot: Math.sin(phase) * 3.2,
    headRot: -Math.sin(phase) * 2.2,
    left: leg(0),
    right: leg(Math.PI),
    leftArm: -Math.sin(phase) * 20,
    rightArm: Math.sin(phase) * 20,
  };
}

export function rigPose(frame, action, fps = 30) {
  if (action === 'walk') return walkPose(frame, fps);
  return idlePose(frame);
}
