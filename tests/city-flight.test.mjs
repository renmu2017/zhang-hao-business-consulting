import test from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, SHOTS, STORY, STATIC_TIME, flightAt, cameraAt } from '../city-flight.js';

const keys = ['position', 'look'];
const close = (a, b, tolerance, label) => a.forEach((value, axis) => {
  assert.ok(Number.isFinite(value) && Math.abs(value - b[axis]) < tolerance,
    `${label}, axis ${axis}: ${value} versus ${b[axis]}`);
});

function derivatives(t, key, side, aspect) {
  const h = .0002 * side;
  const p = [0, 1, 2, 3].map(i => (aspect ? cameraAt(t + i * h, aspect) : flightAt(t + i * h))[key]);
  return {
    velocity: p[0].map((v, i) => (-3 * v + 4 * p[1][i] - p[2][i]) / (2 * h)),
    acceleration: p[0].map((v, i) => (2 * v - 5 * p[1][i] + 4 * p[2][i] - p[3][i]) / h ** 2)
  };
}

test('camera velocity and acceleration stay continuous at every shot and the loop seam', () => {
  for (const { t } of SHOTS) for (const key of keys) {
    const before = derivatives(t, key, -1), after = derivatives(t, key, 1);
    close(before.velocity, after.velocity, .001, `${key} velocity at ${t}`);
    close(before.acceleration, after.acceleration, .001, `${key} acceleration at ${t}`);
  }
  for (const t of [-.1, 0, .1, ...STORY.reads, STATIC_TIME, DURATION - .1]) for (const key of keys) {
    close(flightAt(t)[key], flightAt(t + DURATION)[key], 1e-9, `${key} wraps at ${t}`);
  }
});

test('advertisement passes keep moving instead of holding a static camera', () => {
  for (const t of STORY.reads) {
    const start = flightAt(t - .2).position, end = flightAt(t + .2).position;
    const distance = Math.hypot(...end.map((v, i) => v - start[i]));
    assert.ok(distance > .05 && distance < 3, `reading pass at ${t}: ${distance}`);
  }
});

test('the camera never enters one of the three advertisement buildings', () => {
  const buildings = [
    { x: -27, z: -31, w: 30, d: 16, h: 43 },
    { x: -30.9, z: -31, w: 20.7, d: 12.32, h: 53.32 },
    { x: -33, z: -31, w: 12.6, d: 8, h: 59.34 },
    { x: 28, z: -67, w: 34, d: 18, h: 45 },
    { x: 17.12, z: -67, w: 9.18, d: 12.24, h: 72 },
    { x: 38.88, z: -67, w: 9.18, d: 12.24, h: 72 },
    { x: -29, z: -112, w: 37, d: 20, h: 79 }
  ];
  for (const aspect of [320 / 932, 390 / 844, 820 / 1180, 1440 / 900]) {
    for (let t = 0; t < DURATION; t += .01) {
      const [x, y, z] = cameraAt(t, aspect).position;
      for (const b of buildings) assert.ok(
        y > b.h || Math.abs(x - b.x) > b.w / 2 || Math.abs(z - b.z) > b.d / 2,
        `camera inside building at ${t}, aspect ${aspect}`
      );
    }
  }
});

test('portrait camera framing never takes the camera below street level', () => {
  for (const aspect of [320 / 932, 390 / 844, 430 / 932, 820 / 1180, 1440 / 900]) {
    for (let t = 0; t < DURATION; t += .01) {
      const pose = cameraAt(t, aspect);
      assert.ok(pose.position[1] >= 6,
        `camera below its safe height at ${t.toFixed(2)}, aspect ${aspect}: ${pose.position[1]}`);
      assert.ok(pose.position[2] < 60 && Math.abs(pose.position[0]) < 30,
        `camera outside the city corridor at ${t.toFixed(2)}, aspect ${aspect}: ${pose.position}`);
    }
  }
});

test('the ANDY panorama holds a steady camera for two seconds within the city', () => {
  for (const aspect of [390 / 844, 820 / 1180, 1440 / 900]) {
    const start = cameraAt(STORY.revealStart, aspect);
    assert.ok(start.position[1] >= 70 && start.position[1] <= 85);
    assert.equal(STORY.revealEnd - STORY.revealStart, 2);
    for (let t = STORY.revealStart; t < STORY.revealEnd; t += .01) {
      const pose = cameraAt(t, aspect);
      close(pose.position, start.position, 1e-9, `panorama position at ${t}`);
      close(pose.rotation, start.rotation, 1e-9, `panorama rotation at ${t}`);
    }
  }
});

test('portrait framing remains smooth at the reveal and loop transitions', () => {
  for (const aspect of [390 / 844, 820 / 1180, 1440 / 900]) {
    for (const t of [0, ...SHOTS.map(s => s.t), STORY.revealStart - STORY.fade, STORY.revealEnd + STORY.fade]) for (const key of [...keys, 'rotation']) {
      const before = derivatives(t, key, -1, aspect), after = derivatives(t, key, 1, aspect);
      close(before.velocity, after.velocity, .001, `framed ${key} velocity at ${t}`);
      close(before.acceleration, after.acceleration, .001, `framed ${key} acceleration at ${t}`);
    }
  }
});

test('steering follows the actual flight direction and turns once toward the next advertisement', () => {
  const h = .001;
  for (const aspect of [320 / 932, 390 / 844, 820 / 1180, 1440 / 900]) {
    for (let t = .01; t < STORY.reads[2] + STORY.readHalf - .01; t += .01) {
      const before = cameraAt(t - h, aspect), pose = cameraAt(t, aspect), after = cameraAt(t + h, aspect);
      const velocity = [after.position[0] - before.position[0], after.position[2] - before.position[2]];
      const facing = [pose.look[0] - pose.position[0], pose.look[2] - pose.position[2]];
      const alignment = velocity.reduce((sum, v, i) => sum + v * facing[i], 0) / Math.hypot(...velocity) / Math.hypot(...facing);
      assert.ok(alignment > .999999, `sideways flight at ${t}, aspect ${aspect}: ${alignment}`);
      assert.ok(velocity[1] < 0, `flight reverses down the street at ${t}`);
    }
    for (let i = 0; i < 2; i++) {
      const startTime = STORY.reads[i] + STORY.readHalf, endTime = STORY.reads[i + 1] - STORY.readHalf;
      const start = cameraAt(startTime, aspect).rotation[0], end = cameraAt(endTime, aspect).rotation[0];
      let previous = start;
      for (let sample = 1; sample <= 200; sample++) {
        const yaw = cameraAt(startTime + (endTime - startTime) * sample / 200, aspect).rotation[0];
        assert.ok(yaw >= Math.min(start, end) - 1e-9 && yaw <= Math.max(start, end) + 1e-9,
          `turn overshoots during transfer ${i}, aspect ${aspect}`);
        assert.ok(Math.sign(end - start) * (yaw - previous) >= -1e-9,
          `turn swings back during transfer ${i}, aspect ${aspect}`);
        previous = yaw;
      }
    }
  }
});

test('portrait fitting keeps the same physical route with a constant field of view', () => {
  for (const aspect of [320 / 932, 390 / 844, 820 / 1180, 1440 / 900]) {
    const fov = cameraAt(0, aspect).fov;
    for (let t = 0; t < DURATION; t += .05) {
      const pose = cameraAt(t, aspect), reference = cameraAt(t, 1440 / 900);
      assert.equal(pose.fov, fov, `animated zoom at ${t}, aspect ${aspect}`);
      close(pose.position, reference.position, 1e-9, `framing shifts the route at ${t}`);
      close(pose.rotation, reference.rotation, 1e-9, `framing shifts the heading at ${t}`);
    }
  }
});

test('the first portrait advertisement no longer dominates the reading time', () => {
  const targets = [[-27, 22, -22.5], [28, 32, -57.5], [-29, 43, -101.5]];
  const widths = [23, 26, 29], aspect = 390 / 844;
  const boundaries = [0, (STORY.reads[0] + STORY.reads[1]) / 2,
    (STORY.reads[1] + STORY.reads[2]) / 2, STORY.revealStart - 1.9];
  const durations = targets.map((target, index) => {
    let readable = 0;
    for (let t = boundaries[index]; t < boundaries[index + 1]; t += .01) {
      const pose = cameraAt(t, aspect), [yaw, pitch] = pose.rotation;
      const forward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const right = [Math.cos(yaw), 0, Math.sin(yaw)];
      const up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), Math.sin(pitch) * Math.cos(yaw)];
      const vertical = Math.tan(pose.fov * Math.PI / 360), horizontal = vertical * aspect;
      const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
      const corners = [-1, 1].map(side => {
        const delta = [target[0] + side * widths[index] / 2 - pose.position[0],
          target[1] - pose.position[1], target[2] - pose.position[2]];
        const depth = dot(delta, forward);
        return {depth, x: dot(delta, right) / depth / horizontal, y: dot(delta, up) / depth / vertical};
      });
      // Count the main reading window only: the lettering band fits in the
      // viewport and occupies at least 45 percent of its width.
      if (corners.every(p => p.depth > 0 && Math.abs(p.x) < 1 && Math.abs(p.y) < .95)
        && Math.abs(corners[1].x - corners[0].x) > .9) readable += .01;
    }
    return readable;
  });
  durations.forEach((duration, i) => assert.ok(duration > 2.8 && duration < 4.8,
    `advertisement ${i} has an unbalanced reading window: ${duration}`));
  assert.ok(durations[0] <= durations[1] * 1.1, `the product pass is still too long: ${durations}`);
  assert.ok(Math.max(...durations) / Math.min(...durations) < 1.3, `unbalanced advertisement timing: ${durations}`);
});

test('motion jerk is continuous when entering and leaving every camera shot', () => {
  const jerkAt = (t, key, side, aspect) => {
    // Convergence was checked from .002 to .00025; larger steps include too
    // much of the adjacent turn, while smaller ones amplify floating-point noise.
    const h = .00025 * side;
    const p = [0, 1, 2, 3, 4].map(i => cameraAt(t + i * h, aspect)[key]);
    return p[0].map((v, i) => (-5 * v + 18 * p[1][i] - 24 * p[2][i] + 14 * p[3][i] - 3 * p[4][i]) / (2 * h ** 3));
  };
  for (const aspect of [390 / 844, 820 / 1180, 1440 / 900]) {
    for (const {t} of SHOTS) for (const key of ['position', 'rotation']) {
      close(jerkAt(t, key, -1, aspect), jerkAt(t, key, 1, aspect), .015, `${key} jerk at ${t}`);
    }
  }
});

test('all transitions keep translation acceleration and turning speed within the tuned limits', () => {
  const h = .001;
  for (const aspect of [390 / 844, 820 / 1180, 1440 / 900]) {
    for (let t = 0; t < DURATION; t += .01) {
      const before = cameraAt(t - h, aspect), pose = cameraAt(t, aspect), after = cameraAt(t + h, aspect);
      const acceleration = Math.hypot(...pose.position.map((v, i) => (after.position[i] - 2 * v + before.position[i]) / h ** 2));
      const turningSpeed = Math.hypot(...pose.rotation.map((_, i) => (after.rotation[i] - before.rotation[i]) / (2 * h))) * 180 / Math.PI;
      assert.ok(acceleration < 50, `sudden translation at ${t}: ${acceleration}`);
      assert.ok(turningSpeed < 20, `sudden turn at ${t}: ${turningSpeed}`);
    }
  }
});
