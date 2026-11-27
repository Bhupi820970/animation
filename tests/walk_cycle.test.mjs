import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { idlePose, walkPose } from '../src/characters/walkCycle.js';

describe('walk cycle', () => {
  it('keeps idle feet on the ground', () => {
    const pose = idlePose(12);
    assert.equal(pose.left.lift, 0);
    assert.equal(pose.right.lift, 0);
  });

  it('plants one foot while the other lifts', () => {
    const samples = Array.from({ length: 30 }, (_, frame) => walkPose(frame, 30));
    const lifts = samples.map((pose) => [pose.left.lift, pose.right.lift]);
    assert.ok(lifts.some(([left, right]) => left > 8 && right < 4));
    assert.ok(lifts.some(([left, right]) => right > 8 && left < 4));
    // Planted feet stay nearly level.
    for (const pose of samples) {
      if (pose.left.lift < 2) assert.ok(Math.abs(pose.left.footRot) < 22);
      if (pose.right.lift < 2) assert.ok(Math.abs(pose.right.footRot) < 22);
    }
  });
});
