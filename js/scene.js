import * as THREE from '../vendor/three.module.min.js';

/* --------------------------------------------------------------------------
   Procedural point-cloud shapes. Every shape returns exactly N points so the
   GPU can morph between any two of them.
   -------------------------------------------------------------------------- */

const TAU = Math.PI * 2;
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const range = (a, b) => a + (b - a) * rnd();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.8;

function makeShape(N, fill) {
  const arr = new Float32Array(N * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.set(0, 0, 0);
    fill(v, i, N);
    arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
  }
  return arr;
}

// Weighted picker: parts = [[weight, fn], ...]
function parts(list) {
  const total = list.reduce((s, p) => s + p[0], 0);
  return (v, i, N) => {
    let r = rnd() * total;
    for (const [w, fn] of list) { if ((r -= w) <= 0) return fn(v, i, N); }
    return list[list.length - 1][1](v, i, N);
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
function onSegment(v, ax, ay, az, bx, by, bz, jitter = 0.008) {
  const t = rnd();
  v.set(lerp(ax, bx, t) + gauss() * jitter, lerp(ay, by, t) + gauss() * jitter, lerp(az, bz, t) + gauss() * jitter);
}
function onRectOutline(v, cx, cy, z, w, h, jitter = 0.006) {
  const per = 2 * (w + h);
  let d = rnd() * per;
  let x, y;
  if (d < w) { x = -w / 2 + d; y = h / 2; }
  else if ((d -= w) < h) { x = w / 2; y = h / 2 - d; }
  else if ((d -= h) < w) { x = w / 2 - d; y = -h / 2; }
  else { d -= w; x = -w / 2; y = -h / 2 + d; }
  v.set(cx + x + gauss() * jitter, cy + y + gauss() * jitter, z + gauss() * jitter);
}
function inRect(v, cx, cy, z, w, h) {
  v.set(cx + range(-w / 2, w / 2), cy + range(-h / 2, h / 2), z + gauss() * 0.01);
}

// 0 — Hero: a luminous spiral galaxy / vortex
const shapeVortex = (N) => makeShape(N, parts([
  [0.82, (v) => {
    const arm = Math.floor(rnd() * 3);
    const r = Math.pow(rnd(), 0.7) * 2.4 + 0.08;
    const a = r * 2.1 + (arm * TAU) / 3 + gauss() * 0.28 / (0.6 + r * 0.4);
    const h = gauss() * 0.07 * (2.6 - r);
    v.set(Math.cos(a) * r, h, Math.sin(a) * r);
  }],
  [0.18, (v) => {
    const r = Math.pow(rnd(), 2) * 0.55;
    const th = rnd() * TAU, ph = Math.acos(range(-1, 1));
    v.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th));
  }],
]));

// 1 — Photo: camera lens with barrel rings, glass and aperture blades
const shapeLens = (N) => makeShape(N, parts([
  [0.42, (v) => { // barrel rings
    const k = Math.floor(rnd() * 7);
    const R = [1.55, 1.5, 1.42, 1.32, 1.25, 1.18, 1.62][k];
    const z = [-0.9, -0.6, -0.35, -0.1, 0.1, 0.28, -1.2][k];
    const a = rnd() * TAU;
    const rr = R + gauss() * 0.012;
    v.set(Math.cos(a) * rr, Math.sin(a) * rr, z + gauss() * 0.02);
  }],
  [0.12, (v) => { // knurled focus ring
    const a = rnd() * TAU, z = range(-0.8, -0.45);
    const R = 1.58 + (Math.sin(a * 90) > 0 ? 0.025 : 0);
    v.set(Math.cos(a) * R, Math.sin(a) * R, z);
  }],
  [0.16, (v) => { // front glass dome
    const r = Math.sqrt(rnd()) * 1.12, a = rnd() * TAU;
    v.set(Math.cos(a) * r, Math.sin(a) * r, 0.32 + 0.38 * Math.sqrt(Math.max(0, 1 - (r / 1.15) ** 2)));
  }],
  [0.30, (v) => { // aperture: 8 blades tangent to inner circle
    const b = Math.floor(rnd() * 8);
    const th = (b / 8) * TAU;
    const inner = 0.42;
    const t = rnd() * 1.25;
    let x = Math.cos(th) * inner + Math.cos(th + Math.PI / 2) * t;
    let y = Math.sin(th) * inner + Math.sin(th + Math.PI / 2) * t;
    const l = Math.hypot(x, y);
    if (l > 1.15) { x *= 1.15 / l; y *= 1.15 / l; }
    v.set(x, y, -0.05 + gauss() * 0.01);
  }],
]));

// 2 — Film: reel with holes + film strip unwinding
const shapeFilm = (N) => {
  const ox = -0.7;
  return makeShape(N, parts([
    [0.5, (v) => { // reel disc with 5 holes
      for (let tries = 0; tries < 30; tries++) {
        const r = Math.sqrt(rnd()) * 1.35, a = rnd() * TAU;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        let inHole = r < 0.2;
        for (let h = 0; h < 5; h++) {
          const ha = (h / 5) * TAU + 0.3;
          if (Math.hypot(x - Math.cos(ha) * 0.75, y - Math.sin(ha) * 0.75) < 0.34) inHole = true;
        }
        if (!inHole || tries === 29) { v.set(x + ox, y, (rnd() > 0.5 ? 0.08 : -0.08)); return; }
      }
    }],
    [0.12, (v) => { // reel rim + hub
      const a = rnd() * TAU, R = rnd() > 0.3 ? 1.38 : 0.22;
      v.set(Math.cos(a) * R + ox, Math.sin(a) * R, range(-0.09, 0.09));
    }],
    [0.38, (v) => { // film strip
      const s = rnd();
      const w = 0.32;
      const k = rnd();
      let across;
      if (k < 0.36) across = (rnd() > 0.5 ? 1 : -1) * w;                          // edges
      else if (k < 0.58) { across = (rnd() > 0.5 ? 1 : -1) * w * 0.78; }           // sprocket rows
      else across = range(-w * 0.62, w * 0.62);                                    // frame lines
      let ss = s;
      if (k >= 0.58) ss = (Math.floor(s * 11) + (rnd() > 0.5 ? 0 : 0.92)) / 11;    // frame borders
      if (k >= 0.36 && k < 0.58 && Math.sin(ss * 160) < 0.2) ss += 0.004;
      const x = ox + 1.35 + ss * 2.7;
      const y = -1.38 + Math.sin(ss * 2.6) * 0.55 + ss * 1.6;
      const z = Math.sin(ss * 3.4) * 0.5 + across;
      v.set(x - 0.05, y, z);
    }],
  ]));
};

// 3 — Edit: layered timeline tracks with clips, waveform and playhead
const shapeEdit = (N) => {
  seed = 4242;
  const tracks = [];
  for (let k = 0; k < 5; k++) {
    const clips = [];
    let x = -1.9 + rnd() * 0.3;
    while (x < 1.7) {
      const len = range(0.35, 1.1);
      clips.push([x, Math.min(x + len, 1.95)]);
      x += len + range(0.06, 0.3);
    }
    tracks.push({ y: 1.0 - k * 0.48, z: (k - 2) * 0.28, clips });
  }
  return makeShape(N, parts([
    [0.55, (v) => { // clip outlines
      const tr = tracks[Math.floor(rnd() * 4)];
      const c = tr.clips[Math.floor(rnd() * tr.clips.length)];
      const w = c[1] - c[0];
      if (rnd() < 0.75) onRectOutline(v, c[0] + w / 2, tr.y, tr.z, w, 0.34);
      else inRect(v, c[0] + w / 2, tr.y, tr.z, w, 0.34);
    }],
    [0.28, (v) => { // waveform on bottom track
      const tr = tracks[4];
      const x = range(-1.95, 1.95);
      const amp = 0.2 * Math.abs(Math.sin(x * 7.3) * Math.sin(x * 2.1 + 1) + 0.25 * Math.sin(x * 23));
      v.set(x, tr.y + range(-amp, amp), tr.z + gauss() * 0.01);
    }],
    [0.07, (v) => onSegment(v, 0.35, 1.35, 0, 0.35, -1.25, 0, 0.006)], // playhead
    [0.10, (v) => { // timecode ruler
      const x = range(-2, 2);
      const tick = Math.round(x * 10) / 10;
      const tall = Math.round(x * 2) === x * 2 ? 0.12 : 0.05;
      v.set(tick, 1.4 + rnd() * tall, -0.6);
    }],
  ]));
};

// 4 — Drone: quadcopter hovering above terrain grid
const shapeDrone = (N) => {
  const arms = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([x, z]) => [x * 0.95, z * 0.95]);
  const lift = 0.45;
  return makeShape(N, parts([
    [0.12, (v) => { // body (ellipsoid shell)
      const th = rnd() * TAU, ph = Math.acos(range(-1, 1));
      v.set(0.42 * Math.sin(ph) * Math.cos(th), lift + 0.13 * Math.cos(ph), 0.3 * Math.sin(ph) * Math.sin(th));
    }],
    [0.1, (v) => { const a = arms[Math.floor(rnd() * 4)]; onSegment(v, 0, lift, 0, a[0], lift + 0.04, a[1], 0.015); }],
    [0.26, (v) => { // rotor guards + blades
      const a = arms[Math.floor(rnd() * 4)];
      if (rnd() < 0.62) {
        const t = rnd() * TAU, R = 0.48 + gauss() * 0.006;
        v.set(a[0] + Math.cos(t) * R, lift + 0.08 + gauss() * 0.01, a[1] + Math.sin(t) * R);
      } else {
        const t = range(-0.42, 0.42), ang = a[0] * a[1] > 0 ? 0.6 : -0.6;
        v.set(a[0] + Math.cos(ang) * t, lift + 0.1, a[1] + Math.sin(ang) * t);
      }
    }],
    [0.05, (v) => { // gimbal camera
      const th = rnd() * TAU, ph = Math.acos(range(-1, 1)), r = 0.1;
      v.set(0.22 + r * Math.sin(ph) * Math.cos(th), lift - 0.2 + r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }],
    [0.12, (v) => { // field-of-view scan cone
      const t = Math.sqrt(rnd()), a = rnd() * TAU, edge = rnd() < 0.7;
      const r = (edge ? 1 : Math.sqrt(rnd())) * t * 1.1;
      v.set(0.22 + Math.cos(a) * r, lift - 0.25 - t * 1.6, Math.sin(a) * r * 0.8);
    }],
    [0.35, (v) => { // terrain grid
      const lineX = rnd() < 0.5;
      const g = Math.round(range(-12, 12)) / 4;
      const t = range(-3, 3);
      const x = lineX ? g : t, z = lineX ? t : g;
      const y = -1.45 + 0.22 * Math.sin(x * 1.3) * Math.cos(z * 1.1) + 0.08 * Math.sin(x * 3 + z * 2);
      v.set(x, y, z);
    }],
  ]));
};

// 5 — 360°: panoramic sphere with latitude / longitude lines
const shapeSphere = (N) => makeShape(N, parts([
  [0.42, (v) => { // longitudes
    const lon = (Math.floor(rnd() * 16) / 16) * TAU, ph = rnd() * Math.PI, R = 1.6;
    v.set(R * Math.sin(ph) * Math.cos(lon), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(lon));
  }],
  [0.28, (v) => { // latitudes
    const ph = ((Math.floor(rnd() * 9) + 1) / 10) * Math.PI, lon = rnd() * TAU, R = 1.6;
    v.set(R * Math.sin(ph) * Math.cos(lon), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(lon));
  }],
  [0.22, (v) => { // surface dust
    const th = rnd() * TAU, ph = Math.acos(range(-1, 1)), R = 1.6 + gauss() * 0.02;
    v.set(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th));
  }],
  [0.08, (v) => { // equator highlight + viewer
    if (rnd() < 0.7) { const a = rnd() * TAU; v.set(Math.cos(a) * 1.64, gauss() * 0.01, Math.sin(a) * 1.64); }
    else { const th = rnd() * TAU, ph = Math.acos(range(-1, 1)), r = 0.12; v.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); }
  }],
]));

// 6 — Web: exploded browser UI + phone (responsive)
const shapeWeb = (N) => {
  const bx = -0.35;
  return makeShape(N, parts([
    [0.16, (v) => onRectOutline(v, bx, 0, -0.3, 3.2, 2.1)],                         // window
    [0.04, (v) => onSegment(v, bx - 1.6, 0.82, -0.3, bx + 1.6, 0.82, -0.3, 0.004)], // tab bar
    [0.03, (v) => { const k = Math.floor(rnd() * 3), a = rnd() * TAU; v.set(bx - 1.45 + k * 0.13 + Math.cos(a) * 0.04, 0.93 + Math.sin(a) * 0.04, -0.3); }],
    [0.16, (v) => { if (rnd() < 0.5) onRectOutline(v, bx, 0.33, 0, 2.9, 0.75); else inRect(v, bx - 0.6, 0.38, 0, 1.4, 0.06 + (rnd() < 0.5 ? 0 : 0.18)); }], // hero block
    [0.24, (v) => { const k = Math.floor(rnd() * 3); const cx = bx - 0.98 + k * 0.98; if (rnd() < 0.6) onRectOutline(v, cx, -0.45, 0.25, 0.86, 0.6); else inRect(v, cx, -0.32, 0.25, 0.7, 0.22); }], // cards
    [0.08, (v) => { const r = Math.floor(rnd() * 3); inRect(v, bx - 0.75 + (r === 2 ? -0.2 : 0), -0.88 - r * 0.08, 0.1, r === 2 ? 1.0 : 1.4, 0.012); }], // text lines
    [0.21, (v) => { // phone
      const px = 1.55, py = -0.25, z = 0.6;
      const k = rnd();
      if (k < 0.55) onRectOutline(v, px, py, z, 0.78, 1.5);
      else if (k < 0.7) inRect(v, px, py + 0.35, z, 0.62, 0.38);
      else if (k < 0.9) { const r = Math.floor(rnd() * 4); inRect(v, px, py - 0.15 - r * 0.13, z, 0.6 - (r % 2) * 0.18, 0.06); }
      else { const a = rnd() * TAU; v.set(px + Math.cos(a) * 0.05, py - 0.66 + Math.sin(a) * 0.05, z); }
    }],
    [0.08, (v) => { // cursor arrow
      const cx = 0.25, cy = 0.05, z = 0.5, s = 0.32;
      const pts = [[0, 0], [0, -1], [0.28, -0.72], [0.5, -0.98], [0.62, -0.88], [0.4, -0.62], [0.72, -0.6], [0, 0]];
      const i = Math.floor(rnd() * (pts.length - 1));
      onSegment(v, cx + pts[i][0] * s, cy + pts[i][1] * s, z, cx + pts[i + 1][0] * s, cy + pts[i + 1][1] * s, z, 0.004);
    }],
  ]));
};

// 7 — Finale: a torus knot ribbon (signature)
const shapeKnot = (N) => makeShape(N, (v) => {
  const t = rnd() * TAU, p = 2, q = 3;
  const r = 0.9 + 0.38 * Math.cos(q * t);
  const cx = r * Math.cos(p * t), cy = 0.38 * Math.sin(q * t) * 1.8, cz = r * Math.sin(p * t);
  const tube = 0.14 * Math.sqrt(rnd()), a = rnd() * TAU;
  v.set(cx * 1.35 + Math.cos(a) * tube, cy + Math.sin(a) * tube, cz * 1.35 + Math.cos(a + 1.3) * tube);
});

/* -------------------------------------------------------------------------- */

const PALETTE = [
  ['#ff8a5c', '#7cc8ff'], // vortex
  ['#ffffff', '#ff6a3d'], // lens
  ['#ffb36b', '#ff4d3d'], // film
  ['#8fd3ff', '#ff6a3d'], // edit
  ['#c6f1ff', '#59b7ff'], // drone
  ['#ffd27a', '#ff6a3d'], // 360
  ['#b6a4ff', '#7cc8ff'], // web
  ['#ff6a3d', '#ffd9a8'], // knot
].map(([a, b]) => [new THREE.Color(a), new THREE.Color(b)]);

const vertexShader = /* glsl */`
  attribute vec3 aA;
  attribute vec3 aB;
  attribute float aRand;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform float uScatter;
  uniform vec2 uMouse;
  varying float vRand;
  varying float vDepth;
  varying float vFlash;

  void main() {
    float delay = aRand * 0.45;
    float t = clamp((uMix - delay) / 0.55, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(aA, aB, t);

    float bump = sin(t * 3.14159265);
    vec3 swirl = vec3(
      sin(aRand * 47.0 + uTime * 0.9 + p.y * 2.0),
      cos(aRand * 31.0 + uTime * 1.1 + p.x * 2.0),
      sin(aRand * 73.0 + uTime * 0.7 + p.z * 2.0)
    );
    p += swirl * (bump * 0.55 + uScatter);
    p += 0.012 * vec3(sin(uTime * 1.3 + aRand * 60.0), cos(uTime * 1.1 + aRand * 40.0), sin(uTime + aRand * 20.0));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // gentle mouse repulsion in view space
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uMouse;
    float m = smoothstep(0.28, 0.0, length(d));
    mv.xy += normalize(d + 1e-4) * m * 0.18;

    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aRand * aRand * 1.4);
    gl_PointSize = size * uPixel / -mv.z;
    vRand = aRand;
    vDepth = -mv.z;
    vFlash = bump;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vRand;
  varying float vDepth;
  varying float vFlash;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.95, vRand));
    col = mix(col, vec3(1.0), step(0.965, vRand) * 0.8 + vFlash * 0.15);
    float fog = smoothstep(9.5, 3.5, vDepth);
    gl_FragColor = vec4(col, a * uOpacity * (0.35 + 0.65 * fog));
  }
`;

export function createScene(canvas, { mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const pixel = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
  renderer.setPixelRatio(pixel);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 6.4);

  const N = mobile ? 14000 : 32000;
  seed = 1337;
  const shapes = [
    shapeVortex(N), shapeLens(N), shapeFilm(N), shapeEdit(N),
    shapeDrone(N), shapeSphere(N), shapeWeb(N), shapeKnot(N),
  ];
  // per-shape orientation (applied to the group while shape is dominant)
  const tilt = [
    [0.55, 0, 0.12], [0.18, -0.5, 0], [0.12, -0.35, 0.05], [0.25, -0.55, 0.04],
    [0.32, 0.6, 0], [0.2, 0, 0.1], [0.12, -0.42, 0.02], [0.5, 0, 0],
  ];

  const geo = new THREE.BufferGeometry();
  const aA = new THREE.BufferAttribute(new Float32Array(shapes[0]), 3);
  const aB = new THREE.BufferAttribute(new Float32Array(shapes[1]), 3);
  aA.setUsage(THREE.DynamicDrawUsage); aB.setUsage(THREE.DynamicDrawUsage);
  const rand = new Float32Array(N);
  for (let i = 0; i < N; i++) rand[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shapes[0]), 3));
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);

  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: mobile ? 22 : 19 },
    uPixel: { value: pixel },
    uScatter: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uColorA: { value: PALETTE[0][0].clone() },
    uColorB: { value: PALETTE[0][1].clone() },
    uOpacity: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(points);
  group.add(spin);
  scene.add(group);

  // Background star dust
  const dustN = mobile ? 700 : 1600;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 22;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    dustPos[i * 3 + 2] = -Math.random() * 12 - 1;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.025, color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  let pair = [0, 1];
  function setPair(a, b) {
    if (pair[0] === a && pair[1] === b) return;
    pair = [a, b];
    aA.array.set(shapes[a]); aA.needsUpdate = true;
    aB.array.set(shapes[b]); aB.needsUpdate = true;
  }

  const state = { value: 0, x: 0, y: 0, scale: 1, mouseX: 0, mouseY: 0, px: 9, py: 9, scroll: 0, velocity: 0, intro: 0 };
  const smooth = { x: 0, y: 0, scale: 1, rx: 0, ry: 0, rz: 0, mx: 0, my: 0, vel: 0 };
  const mouseNdc = new THREE.Vector2(9, 9);
  const tmpV = new THREE.Vector2();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the object framed on narrow portrait screens
    camera.position.z = w / h < 0.8 ? 6.4 / Math.max(w / h, 0.48) * 0.78 : 6.4;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    const v = Math.max(0, Math.min(shapes.length - 1, state.value));
    let a = Math.floor(v), b = Math.min(a + 1, shapes.length - 1);
    let m = v - a;
    if (a === b) { a = b - 1; m = 1; }
    setPair(a, b);
    uniforms.uMix.value = m;

    // colors
    const ca = PALETTE[a], cb = PALETTE[b], cm = Math.min(1, Math.max(0, (m - 0.15) / 0.7));
    uniforms.uColorA.value.copy(ca[0]).lerp(cb[0], cm);
    uniforms.uColorB.value.copy(ca[1]).lerp(cb[1], cm);

    // orientation
    const k = 1 - Math.pow(0.0015, dt);
    const ta = tilt[a], tb = tilt[b];
    smooth.rx += (lerp(ta[0], tb[0], m) - smooth.rx) * k;
    smooth.ry += (lerp(ta[1], tb[1], m) - smooth.ry) * k;
    smooth.rz += (lerp(ta[2], tb[2], m) - smooth.rz) * k;
    smooth.x += (state.x - smooth.x) * k;
    smooth.y += (state.y - smooth.y) * k;
    smooth.scale += (state.scale - smooth.scale) * k;
    smooth.mx += (state.mouseX - smooth.mx) * k * 0.6;
    smooth.my += (state.mouseY - smooth.my) * k * 0.6;
    smooth.vel += (Math.min(Math.abs(state.velocity), 60) / 60 - smooth.vel) * 0.08;

    group.position.set(smooth.x, smooth.y, 0);
    group.scale.setScalar(smooth.scale);
    group.rotation.set(smooth.rx + smooth.my * 0.25, smooth.ry + smooth.mx * 0.4, smooth.rz);
    // continuous idle spin; vortex & sphere & knot spin around their own axis
    const spinSpeed = [0.12, 0.03, 0.05, 0.02, 0.06, 0.1, 0.02, 0.14];
    spin.rotation.y += dt * lerp(spinSpeed[a], spinSpeed[b], m) + smooth.vel * dt * 0.6;
    // ease spin back towards front-facing for "flat" shapes
    const flat = [0, 1, 1, 1, 0, 0, 1, 0];
    const fl = lerp(flat[a], flat[b], m);
    if (fl > 0.01) {
      const target = Math.round(spin.rotation.y / TAU) * TAU;
      spin.rotation.y += (target - spin.rotation.y) * fl * 0.04;
    }
    uniforms.uScatter.value = smooth.vel * 0.06 + state.intro;

    tmpV.set(state.px, -state.py);
    mouseNdc.lerp(tmpV, state.px > 5 ? 1 : 0.12);
    uniforms.uMouse.value.copy(mouseNdc);

    dust.rotation.y = t * 0.01 + smooth.mx * 0.05;
    dust.position.y = state.scroll * 0.0006;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  });

  return {
    state,
    uniforms,
    setMouse(nx, ny) { state.mouseX = nx; state.mouseY = ny; state.px = nx; state.py = ny; },
    clearPointer() { state.px = 9; state.py = 9; },
  };
}
