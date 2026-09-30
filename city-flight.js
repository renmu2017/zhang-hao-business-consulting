// Flight arcs share their tangents with the camera's heading. Position is C4,
// so steering, acceleration and jerk stay continuous without a spring or lag.
export const DURATION = 29.95;
export const STORY = { reads: [1.85, 8.85, 15.85], readHalf: .6, revealStart: 21.95, revealEnd: 23.95, fade: .7 };
export const STATIC_TIME = (STORY.revealStart + STORY.revealEnd) / 2;
const targets = [[-27, 22, -22.5], [28, 32, -57.5], [-29, 43, -101.5]];
const readingPositions = [[0, 19, 18], [0, 28, -17.5], [0, 34, -61]];
const towards = (position, target) => {
  const vector = target.map((value, axis) => value - position[axis]);
  const length = Math.hypot(...vector);
  return vector.map(value => value * 5 / length);
};
const initial = [8, 18.1, 30], wide = [0, 78, 45], wideTarget = [0, 48, -190];
export const SHOTS = [
  {t: 0, position: initial, look: targets[0], velocity: towards(initial, targets[0])},
  ...STORY.reads.flatMap((t, i) => {
    const velocity = towards(readingPositions[i], targets[i]);
    return [-STORY.readHalf, 0, STORY.readHalf].map(offset => ({t: t + offset,
      position: readingPositions[i].map((value, axis) => value + velocity[axis] * offset),
      look: targets[i], velocity}));
  }),
  {t: STORY.revealStart, position: wide, look: wideTarget, velocity: [0, 0, 0]},
  {t: STORY.revealEnd, position: wide, look: wideTarget, velocity: [0, 0, 0]}
];

// Four collinear controls at either end preserve the incoming flight direction
// and join the first four derivatives. Reading passes are exactly straight.
const arcs = SHOTS.map((shot, i) => {
  const next = SHOTS[(i + 1) % SHOTS.length];
  const duration = (i + 1 === SHOTS.length ? DURATION : next.t) - shot.t;
  const controls = [];
  for (let k = 0; k <= 4; k++) controls.push(shot.position.map((v, axis) => v + shot.velocity[axis] * duration * k / 9));
  for (let k = 4; k >= 0; k--) controls.push(next.position.map((v, axis) => v - next.velocity[axis] * duration * k / 9));
  const velocities = controls.slice(1).map((point, j) => point.map((v, axis) => (v - controls[j][axis]) * 9 / duration));
  return {start: shot.t, duration, controls, velocities};
});
function bezier(controls, u) {
  // Evaluate relative to the nearer endpoint, preserving tiny movements when
  // a shot boundary lies between non-integer timeline values.
  const points = u > .5 ? [...controls].reverse() : controls;
  if (u > .5) u = 1 - u;
  const origin = points[0];
  const values = points.map(point => point.map((v, axis) => v - origin[axis]));
  for (let n = values.length - 1; n > 0; n--) for (let i = 0; i < n; i++) {
    for (let axis = 0; axis < 3; axis++) values[i][axis] += (values[i + 1][axis] - values[i][axis]) * u;
  }
  return values[0].map((v, axis) => v + origin[axis]);
}
const wrap = (time) => {
  const remainder = time % DURATION;
  return remainder < 0 ? remainder + DURATION : remainder;
};
const smooth = (u) => u ** 4 * (35 - 84 * u + 70 * u * u - 20 * u ** 3);
const angles = (vector) => [Math.atan2(vector[0], -vector[2]), Math.atan2(vector[1], Math.hypot(vector[0], vector[2]))];
const firstAngles = angles(SHOTS[0].velocity);
const lastReadingTime = STORY.reads[2] + STORY.readHalf;
const lastAngles = angles(SHOTS[9].velocity);
const wideAngles = angles(wideTarget.map((v, axis) => v - wide[axis]));

// Yaw follows the real flight tangent. A stabilized vertical aim keeps the
// horizon calm while the route climbs to the next facade advertisement.
export function flightAt(time) {
  const t = wrap(time);
  const arc = arcs.find((segment, i) => t < (arcs[i + 1]?.start ?? DURATION));
  const u = (t - arc.start) / arc.duration;
  const position = bezier(arc.controls, u), velocity = bezier(arc.velocities, u);
  let rotation;
  if (t <= lastReadingTime) {
    const current = SHOTS.findIndex((shot, i) => t < (SHOTS[i + 1]?.t ?? DURATION));
    const from = SHOTS[current], to = SHOTS[current + 1];
    const progress = smooth((t - from.t) / (to.t - from.t));
    const fromPitch = angles(from.look.map((v, axis) => v - from.position[axis]))[1];
    const toPitch = angles(to.look.map((v, axis) => v - to.position[axis]))[1];
    rotation = [angles(velocity)[0], fromPitch + (toPitch - fromPitch) * progress];
  } else if (t < STORY.revealStart) {
    const progress = smooth((t - lastReadingTime) / (STORY.revealStart - lastReadingTime));
    rotation = lastAngles.map((v, axis) => v + (wideAngles[axis] - v) * progress);
  } else if (t <= STORY.revealEnd) {
    rotation = wideAngles;
  } else {
    const progress = smooth((t - STORY.revealEnd) / (DURATION - STORY.revealEnd));
    rotation = wideAngles.map((v, axis) => v + (firstAngles[axis] - v) * progress);
  }
  const [yaw, pitch] = rotation;
  const direction = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  return {position, velocity, rotation, look: position.map((v, axis) => v + direction[axis] * 100)};
}

export function cameraAt(time, aspect) {
  // Responsive fitting changes only the projection, never the flight path.
  // FOV is fixed throughout each loop; it does not animate between scenes.
  const fov = Math.max(52, 2 * Math.atan(Math.tan(19 * Math.PI / 180) / aspect) * 180 / Math.PI);
  return {...flightAt(time), fov};
}
