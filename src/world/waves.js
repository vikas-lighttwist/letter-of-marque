// Single source of truth for the ocean swell. The same wave sum runs in the
// ocean vertex shader (via wavesGLSL) and in JS (waveHeight) so ships sit
// exactly on the rendered surface.

const RAW = [
  { dir: [1.0, 0.35], amp: 0.42, len: 58, speed: 1.05 },
  { dir: [-0.55, 1.0], amp: 0.26, len: 27, speed: 1.45 },
  { dir: [0.32, -1.0], amp: 0.13, len: 12.5, speed: 2.2 },
];

export const WAVES = RAW.map(({ dir, amp, len, speed }) => {
  const d = Math.hypot(dir[0], dir[1]);
  return {
    dx: dir[0] / d,
    dz: dir[1] / d,
    amp,
    k: (Math.PI * 2) / len,
    speed,
  };
});

export const AMP_TOTAL = WAVES.reduce((s, w) => s + w.amp, 0);

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    h += w.amp * Math.sin((w.dx * x + w.dz * z) * w.k + t * w.speed);
  }
  return h;
}

// GLSL mirror of waveHeight, constants baked in.
export function wavesGLSL() {
  const terms = WAVES.map(
    (w) =>
      `h += ${w.amp.toFixed(4)} * sin(dot(vec2(${w.dx.toFixed(4)}, ${w.dz.toFixed(
        4
      )}), p) * ${w.k.toFixed(5)} + t * ${w.speed.toFixed(4)});`
  ).join('\n  ');
  return `
float waveH(vec2 p, float t) {
  float h = 0.0;
  ${terms}
  return h;
}
`;
}
