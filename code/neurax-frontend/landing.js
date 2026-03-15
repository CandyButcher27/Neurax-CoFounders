/* ======================================================
   cofounders.ai — Cinematic Scroll Engine
   Three.js 3D scene + GSAP ScrollTrigger


   SCENE NARRATIVE  (chapters)
   0 → HERO       : scattered node network, free-floating
   1 → PRD→TASKS  : nodes split left (employees) / right (tasks)
   2 → ASSIGNMENT : columns form, connections GLOW orange → cyan
   3 → EXECUTE    : orbital system, camera pulls wide
   ====================================================== */


gsap.registerPlugin(ScrollTrigger);


/* ── Custom cursor ────────────────────────────────────────────────────── */
(function () {
  const cur  = document.createElement('div'); cur.id  = 'cursor';
  const ring = document.createElement('div'); ring.id = 'cursor-ring';
  document.body.appendChild(cur);
  document.body.appendChild(ring);


  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });


  ;(function loop() {
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    cur.style.left  = mx + 'px'; cur.style.top  = my + 'px';
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
})();


/* ════════════════════════════════════════════════════════════════════════
   THREE.JS SCENE
════════════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('three-canvas');
if (canvas && typeof THREE !== 'undefined') initScene();


function initScene() {


  /* ── Renderer ──────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);


  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 55);


  /* ── Scroll state  (GSAP tweens this 0 → 3) ───────────────────────── */
  const scrollObj = { progress: 0 };


  /* ── Seeded RNG for reproducible layout ────────────────────────────── */
  const rng = mulberry32(42);


  /* ── Node counts ────────────────────────────────────────────────────── */
  const E_COUNT = 6, T_COUNT = 12, TOTAL = E_COUNT + T_COUNT;


  /* ── State position sets ────────────────────────────────────────────── */
  function sphPos(r) {
    const u = rng(), v = rng();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    return new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
  }


  // S0 — scattered sphere
  const S0 = Array.from({ length: TOTAL }, (_, i) => sphPos(i < E_COUNT ? 13 + rng() * 8 : 16 + rng() * 11));


  // S1 — employees left cluster, tasks right cloud
  const S1 = Array.from({ length: TOTAL }, (_, i) => {
    if (i < E_COUNT) {
      const a = (i / E_COUNT) * Math.PI * 2;
      return new THREE.Vector3(-16 + Math.cos(a) * 5, Math.sin(a) * 8, Math.sin(a * 1.5) * 3);
    }
    const t = i - E_COUNT, a = (t / T_COUNT) * Math.PI * 2;
    return new THREE.Vector3(15 + Math.cos(a) * 7, Math.sin(a) * 11, Math.sin(a * 1.3) * 4);
  });


  // S2 — left / right columns for assignment
  const S2 = Array.from({ length: TOTAL }, (_, i) => {
    if (i < E_COUNT) return new THREE.Vector3(-20, (i / (E_COUNT - 1) - 0.5) * 22, 0);
    const t = i - E_COUNT;
    return new THREE.Vector3(20, (t / (T_COUNT - 1) - 0.5) * 28, 0);
  });


  // S3 — orbital rings
  const S3 = Array.from({ length: TOTAL }, (_, i) => {
    const isE = i < E_COUNT, idx = isE ? i : i - E_COUNT, count = isE ? E_COUNT : T_COUNT;
    const r = isE ? 12 : 23, a = (idx / count) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.45, Math.sin(a * 0.8) * r * 0.25);
  });


  const STATES = [S0, S1, S2, S3];


  /* ── Camera targets per chapter ─────────────────────────────────────── */
  const CAM = [
    { x: 0,  y: 0,   z: 55 },
    { x: 0,  y: 0,   z: 36 },
    { x: 2,  y: -2,  z: 30 },
    { x: 0,  y: 10,  z: 62 },
  ];


  /* ── Node meshes ─────────────────────────────────────────────────────── */
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);
  const lineGroup = new THREE.Group();
  scene.add(lineGroup);


  const C_ORANGE = new THREE.Color(0xFF5500);
  const C_CYAN   = new THREE.Color(0x00DFFF);


  const nodeMeta = [];


  for (let i = 0; i < TOTAL; i++) {
    const isE = i < E_COUNT;
    const coreR = isE ? 0.65 : 0.42;
    const glowR = isE ? 1.6  : 1.1;


    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(coreR, 20, 20),
      new THREE.MeshBasicMaterial({ color: isE ? C_ORANGE : C_CYAN, transparent: true, opacity: isE ? 0.9 : 0.65 })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(glowR, 12, 12),
      new THREE.MeshBasicMaterial({ color: isE ? C_ORANGE : C_CYAN, transparent: true, opacity: 0.08 })
    );
    mesh.position.copy(S0[i]);
    glow.position.copy(S0[i]);
    nodeGroup.add(mesh);
    nodeGroup.add(glow);


    nodeMeta.push({
      mesh, glow, isE,
      fo: rng() * Math.PI * 2,   // floatOffset
      fs: 0.3 + rng() * 0.3,     // floatSpeed
      fa: 0.35 + rng() * 0.4,    // floatAmplitude
    });
  }


  /* ── Connection lines ────────────────────────────────────────────────── */
  const conns = [];
  const used  = new Set();
  for (let e = 0; e < E_COUNT; e++) {
    for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
      let t, tries = 0;
      do { t = E_COUNT + Math.floor(rng() * T_COUNT); tries++; } while (used.has(`${e}-${t}`) && tries < 20);
      used.add(`${e}-${t}`);
      const geo  = new THREE.BufferGeometry().setFromPoints([S0[e].clone(), S0[t].clone()]);
      const mat  = new THREE.LineBasicMaterial({ color: 0x161828, transparent: true, opacity: 0.4 });
      const line = new THREE.Line(geo, mat);
      lineGroup.add(line);
      conns.push({ e, t, line });
    }
  }


  /* ── Background stars ────────────────────────────────────────────────── */
  const starBuf = new Float32Array(320 * 3);
  for (let i = 0; i < 320 * 3; i += 3) {
    starBuf[i]   = (rng() - 0.5) * 240;
    starBuf[i+1] = (rng() - 0.5) * 240;
    starBuf[i+2] = (rng() - 0.5) * 100 - 30;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x1A1D35, size: 0.5, transparent: true, opacity: 0.6 })));


  /* ── Central hub (fades in during state 3) ───────────────────────────── */
  const hubMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
  const hubGlow = new THREE.Mesh(new THREE.SphereGeometry(3.8, 16, 16), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 }));
  scene.add(hubMesh);
  scene.add(hubGlow);


  /* ── Mouse ────────────────────────────────────────────────────────────── */
  let mx = 0, my = 0;
  window.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });


  /* ════════════════════════════════════════════════════════════════════════
     GSAP SCROLL ANIMATIONS
  ════════════════════════════════════════════════════════════════════════ */


  /* Master timeline — scrubs scrollObj.progress 0 → 3 across the journey */
  gsap.to(scrollObj, {
    progress: 3, ease: 'none',
    scrollTrigger: {
      trigger: '#journey', start: 'top top', end: 'bottom bottom',
      scrub: 2,
      onUpdate(self) {
        // Update chapter dots
        const ch = Math.min(Math.floor(self.progress * 3 + 0.12), 3);
        document.querySelectorAll('.ch-dot').forEach((d, i) => d.classList.toggle('active', i === ch));
      },
    },
  });


  /* Hero entrance */
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.ch-badge',     { opacity: 0, y: -16, duration: .7 }, 0.15)
    .from('.ht-line',      { opacity: 0, y: 40,  duration: .8, stagger: .13 }, 0.3)
    .from('.hero-sub',     { opacity: 0, y: 28,  duration: .7 }, 0.8)
    .from('.hero-actions', { opacity: 0, y: 20,  duration: .6 }, 0.95)
    .from('.hero-stats',   { opacity: 0, y: 16,  duration: .6 }, 1.1)
    .from('#scroll-nudge', { opacity: 0,         duration: .8 }, 1.5);


  /* Per-chapter reveals */
  const revealSets = [
    { sel: '#ch-1 .ch-num, #ch-1 .ch-tag, #ch-1 .ch-h2, #ch-1 .ch-p', from: { y: 32 }, trig: '#ch-1' },
    { sel: '#ch-1 .ch-list li', from: { x: -20 }, trig: '#ch-1', stagger: .08 },
    { sel: '.tc',               from: { x:  28 }, trig: '#ch-1', stagger: .1 },
    { sel: '#ch-2 .ch-num, #ch-2 .ch-tag, #ch-2 .ch-h2, #ch-2 .ch-p', from: { y: 32 }, trig: '#ch-2' },
    { sel: '#ch-2 .ch-list li', from: { x:  20 }, trig: '#ch-2', stagger: .08 },
    { sel: '.ad-row',           from: { x: -24 }, trig: '#ch-2', stagger: .14 },
    { sel: '#ch-3 .ch-num-center, #ch-3 .ch-tag-center, #ch-3 .ch-h2-big, #ch-3 .ch-p-center', from: { y: 40 }, trig: '#ch-3', stagger: .12 },
    { sel: '.chip',             from: { scale: .75, y: 10 }, trig: '#ch-3', ease: 'back.out(2)', stagger: .08 },
    { sel: '#ch-3 .btn-primary',from: { y: 22 }, trig: '#ch-3' },
  ];
  revealSets.forEach(({ sel, from, trig, stagger = 0.1, ease = 'power3.out' }) => {
    gsap.from(sel, {
      opacity: 0, ...from, stagger, duration: .7, ease,
      scrollTrigger: { trigger: trig, start: 'top 65%', toggleActions: 'play none none reverse' },
    });
  });


  /* Below-journey data-reveal */
  gsap.utils.toArray('[data-reveal]').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: .65, ease: 'power3.out', delay: (i % 3) * 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } }
    );
  });


  /* Hide scroll nudge after leaving hero zone */
  ScrollTrigger.create({
    trigger: '#journey', start: '6% top',
    onEnter:     () => gsap.to('#scroll-nudge', { opacity: 0, duration: .5 }),
    onLeaveBack: () => gsap.to('#scroll-nudge', { opacity: 1, duration: .5 }),
  });


  /* Nav scrolled class */
  ScrollTrigger.create({
    start: '60px top', end: 'max',
    onUpdate: (self) => document.getElementById('nav').classList.toggle('scrolled', self.scroll() > 60),
  });


  /* ════════════════════════════════════════════════════════════════════════
     RENDER LOOP
  ════════════════════════════════════════════════════════════════════════ */
  const clock = new THREE.Clock();


  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const p = scrollObj.progress;            // 0 – 3


    /* ── Interpolate node positions ─────────────────────────────────── */
    const sA    = Math.min(Math.floor(p), 2);
    const sB    = Math.min(sA + 1, 3);
    const blend = smoothstep(p - sA);
    const SA = STATES[sA], SB = STATES[sB];


    nodeMeta.forEach((nd, i) => {
      const a = SA[i], b = SB[i];
      const tx = a.x + (b.x - a.x) * blend;
      const ty = a.y + (b.y - a.y) * blend;
      const tz = a.z + (b.z - a.z) * blend;


      // Float: reduces in assignment state so columns are crisp
      const fScale = 1 - clamp01(p - 1.5) * 0.7;
      const fx = Math.sin(t * nd.fs       + nd.fo) * nd.fa * fScale;
      const fy = Math.cos(t * nd.fs * 0.7 + nd.fo + 1.2) * nd.fa * fScale;
      const fz = Math.sin(t * nd.fs * 0.5 + nd.fo + 2.4) * nd.fa * 0.5 * fScale;


      // Orbital drift for state 3
      let ox = 0, oy = 0;
      if (p > 2) {
        const op = clamp01(p - 2);
        const oa = t * (nd.isE ? 0.18 : 0.09) + nd.fo;
        const or = nd.isE ? 0.5 : 0.85;
        ox = Math.cos(oa) * or * op;
        oy = Math.sin(oa) * or * op * 0.5;
      }


      nd.mesh.position.set(tx + fx + ox, ty + fy + oy, tz + fz);
      nd.glow.position.copy(nd.mesh.position);


      // Pulsing opacity
      nd.mesh.material.opacity = (nd.isE ? 0.8 : 0.5) + Math.sin(t * 1.6 + i * 0.7) * 0.12;
      const glowBoost = p > 1.5 ? clamp01((p - 1.5) * 2) * 0.14 : 0;
      nd.glow.material.opacity = 0.07 + glowBoost + Math.sin(t * 1.1 + i) * 0.03;
    });


    /* ── Connection lines ──────────────────────────────────────────── */
    conns.forEach(({ e, t, line }, ci) => {
      const pa = nodeMeta[e].mesh.position;
      const pb = nodeMeta[t].mesh.position;
      const v  = new Float32Array([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
      line.geometry.setAttribute('position', new THREE.BufferAttribute(v, 3));
      line.geometry.attributes.position.needsUpdate = true;


      if (p > 1.1 && p < 3.1) {
        const glow = clamp01((p - 1.1) * 1.6);
        const phase = (Math.sin(t * 2.0 + ci * 0.8) + 1) / 2;
        line.material.color.setRGB(
          C_ORANGE.r + (C_CYAN.r - C_ORANGE.r) * phase,
          C_ORANGE.g + (C_CYAN.g - C_ORANGE.g) * phase,
          C_ORANGE.b + (C_CYAN.b - C_ORANGE.b) * phase
        );
        line.material.opacity = 0.1 + glow * 0.7;
      } else {
        line.material.color.set(0x161828);
        line.material.opacity = 0.28 + Math.sin(t * 0.7 + ci) * 0.08;
      }
    });


    /* ── Group rotation ────────────────────────────────────────────── */
    const rotSpeed = 0.024 * (1 - clamp01(p) * 0.5);
    nodeGroup.rotation.y = t * rotSpeed + mx * 0.06;
    nodeGroup.rotation.x = my * 0.03;
    lineGroup.rotation.copy(nodeGroup.rotation);


    /* ── Central hub ───────────────────────────────────────────────── */
    const hf = clamp01((p - 2.3) * 2.2);
    hubMesh.material.opacity = hf * 0.9;
    hubGlow.material.opacity = hf * 0.055 + Math.sin(t * 1.1) * hf * 0.025;


    /* ── Camera smooth follow ──────────────────────────────────────── */
    const cA2  = Math.min(Math.floor(p), 2);
    const cB2  = Math.min(cA2 + 1, 3);
    const cb2  = smoothstep(p - cA2);
    const ca   = CAM[cA2], cb = CAM[cB2];
    const tgtX = ca.x + (cb.x - ca.x) * cb2 + mx * 1.8;
    const tgtY = ca.y + (cb.y - ca.y) * cb2 + my * 1.2;
    const tgtZ = ca.z + (cb.z - ca.z) * cb2;
    camera.position.x += (tgtX - camera.position.x) * 0.04;
    camera.position.y += (tgtY - camera.position.y) * 0.04;
    camera.position.z += (tgtZ - camera.position.z) * 0.04;
    camera.lookAt(0, 0, 0);


    renderer.render(scene, camera);
  }


  animate();


  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}


/* ── Chapter dot click navigation ────────────────────────────────────── */
document.querySelectorAll('.ch-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const ch      = parseInt(dot.dataset.ch);
    const journey = document.getElementById('journey');
    const jH      = journey.scrollHeight;
    const targetY = window.scrollY + journey.getBoundingClientRect().top + (jH * ch) / 4;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  });
});


/* ── Helpers ─────────────────────────────────────────────────────────── */
function smoothstep(t) { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); }
function clamp01(v)    { return Math.max(0, Math.min(1, v)); }
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}



