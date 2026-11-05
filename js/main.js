import { createScene } from './scene.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
root.classList.add('js');
const mobile = window.matchMedia('(max-width: 760px)').matches || window.matchMedia('(pointer: coarse)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

$('.js-year').textContent = new Date().getFullYear();

/* ---------- WebGL ---------- */
let three = null;
try {
  three = createScene($('.webgl'), { mobile });
} catch (e) {
  console.warn('WebGL nicht verfügbar:', e);
  document.body.classList.add('no-webgl');
}

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    if (three) three.state.velocity = e.velocity;
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

// Anchor links
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    $('.nav__burger').setAttribute('aria-expanded', 'false');
    if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  });
});

// Mobile menu
$('.nav__burger').addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  $('.nav__burger').setAttribute('aria-expanded', String(open));
  $('.menu').setAttribute('aria-hidden', String(!open));
});

/* ---------- Scroll → 3D keyframes ----------
   Each section declares which shape it shows (data-shape), where the object
   sits (data-x / data-y) and its scale. We map scroll position to those
   values with a "hold" plateau so each shape rests while its text is read. */
const sections = $$('[data-shape]');
let keys = [];
function measure() {
  const vh = window.innerHeight;
  const narrow = window.innerWidth <= 760;
  keys = sections.map((el) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const xRaw = parseFloat(el.dataset.x) || 0;
    const aspect = window.innerWidth / vh;
    const isService = el.classList.contains('service');
    return {
      at: top + r.height / 2 - vh / 2,
      shape: parseFloat(el.dataset.shape),
      x: narrow ? 0 : xRaw * Math.min(1.25, Math.max(0.75, aspect / 1.6)),
      y: narrow ? (isService ? 2.05 : parseFloat(el.dataset.y) || 0) : parseFloat(el.dataset.y) || 0,
      scale: (parseFloat(el.dataset.scale) || 1) * (narrow ? (isService ? 0.66 : 0.85) : 1),
      el,
    };
  });
}
const smoothstep = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

function sample(y) {
  if (!keys.length) return null;
  if (y <= keys[0].at) return { ...keys[0], idx: 0 };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (y >= a.at && y <= b.at) {
      const raw = (y - a.at) / (b.at - a.at || 1);
      const t = smoothstep(0.2, 0.8, raw);
      return {
        shape: a.shape + (b.shape - a.shape) * t,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        scale: a.scale + (b.scale - a.scale) * t,
        idx: raw < 0.5 ? i : i + 1,
      };
    }
  }
  return { ...keys[keys.length - 1], idx: keys.length - 1 };
}

const hudNum = $('.js-hud-num'), hudLabel = $('.js-hud-label'), hudProg = $('.js-hud-progress');
let lastIdx = -1;
function onScroll() {
  const y = window.scrollY;
  const s = sample(y);
  if (s && three) {
    three.state.value = s.shape;
    three.state.x = s.x;
    three.state.y = s.y;
    three.state.scale = s.scale;
    three.state.scroll = y;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  hudProg.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  if (s && s.idx !== lastIdx) {
    lastIdx = s.idx;
    const el = keys[s.idx].el;
    hudLabel.textContent = el.dataset.label || '';
    hudNum.textContent = el.dataset.num || (s.idx < 2 ? '00' : '—');
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); onScroll(); });

/* ---------- Pointer ---------- */
const cursor = $('.cursor'), cursorLabel = $('.cursor__label');
if (!mobile) {
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    cursor.classList.add('is-visible');
    if (three) three.setMouse((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  });
  document.addEventListener('pointerleave', () => three && three.clearPointer());
  gsap.ticker.add(() => {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
  });
  $$('[data-cursor]').forEach((el) => {
    el.addEventListener('pointerenter', () => { cursorLabel.textContent = el.dataset.cursor; cursor.classList.add('is-active'); });
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-active'));
  });
  // Magnetic buttons
  $$('.magnetic, .btn').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  });
} else if (three) {
  // gyroscope-free subtle drift on touch devices
  gsap.ticker.add((t) => { three.state.mouseX = Math.sin(t * 0.3) * 0.25; three.state.mouseY = Math.cos(t * 0.25) * 0.15; });
}

/* ---------- Timecode ---------- */
const tc = $('.js-timecode');
const start = performance.now();
const pad = (n) => String(n).padStart(2, '0');
setInterval(() => {
  const ms = performance.now() - start;
  const f = Math.floor((ms / 40) % 25), s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
  tc.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}, 40);

/* ---------- Statement: words light up on scroll ---------- */
$$('.js-words').forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.to($$('.w', el), {
    opacity: 1, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
});

/* ---------- Reveals ---------- */
function setupReveals() {
  $$('.section:not(.hero)').forEach((sec) => {
    const lines = $$('.split', sec), fades = $$('.reveal-fade', sec), cards = $$('.reveal-card', sec);
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 62%', toggleActions: 'play none none reverse' } });
    if (lines.length) tl.to(lines, { y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, 0);
    if (fades.length) tl.to(fades, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.25);
    if (cards.length) tl.to(cards, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, 0.2);
  });

  // Slight parallax on service panels (desktop)
  if (!mobile) {
    $$('.service__panel').forEach((p) => {
      gsap.fromTo(p, { y: 80 }, { y: -80, ease: 'none', scrollTrigger: { trigger: p.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
  // Marquee reacts to scroll direction
  const track = $('.marquee__track');
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => gsap.to(track, { skewX: gsap.utils.clamp(-8, 8, self.getVelocity() / -300), duration: 0.4, overwrite: true }),
  });
}

/* ---------- Loader / intro ---------- */
function intro() {
  const count = $('.js-count');
  const obj = { p: 0 };
  const tl = gsap.timeline();
  tl.to(obj, {
    p: 100, duration: reduced ? 0.2 : 1.6, ease: 'power2.inOut',
    onUpdate: () => {
      count.textContent = String(Math.round(obj.p)).padStart(3, '0');
      $('.loader__bar i').style.transform = `scaleX(${obj.p / 100})`;
    },
  })
    .to('.loader__mark span', { yPercent: -110, opacity: 0, duration: 0.7, ease: 'expo.in', stagger: 0.06 }, '+=0.1')
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.25')
    .add(() => {
      $('.loader').style.display = 'none';
      document.body.classList.remove('is-loading');
      if (lenis) lenis.start();
      measure(); onScroll();
      ScrollTrigger.refresh();
    })
    .to('.hero .split', { y: 0, duration: 1.5, ease: 'expo.out', stagger: 0.12 }, '-=0.75')
    .to('.hero .reveal-fade', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, '-=1.1');

  if (three) {
    gsap.fromTo(three.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 2.2, delay: 1.9, ease: 'power2.out' });
    gsap.fromTo(three.state, { intro: 2.5 }, { intro: 0, duration: 2.6, delay: 1.7, ease: 'expo.out' });
  }
}

// Wait for fonts so measurements are correct
const ready = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
ready.then(() => {
  measure();
  setupReveals();
  intro();
});
window.addEventListener('load', () => { measure(); ScrollTrigger.refresh(); onScroll(); });
