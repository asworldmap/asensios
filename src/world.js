// Pedal the World — page shell.
//
// This file is deliberately small and free of Three.js: it paints the cover,
// wires the HUD and decides whether a 3D world is possible at all. The engine
// (and Three.js with it) is a separate chunk, requested only once the cover is
// already on screen.

import './styles/tokens.css';
import './styles/world.css';
import { initTheme, currentTheme } from './lib/theme.js';
import { initI18n, getLang } from './lib/i18n.js';
import { prefersReducedMotion, deviceTier } from './lib/motion.js';
import { dict } from './i18n/dict.js';
import { CHAPTERS, JOURNEY } from './world/chapters/index.js';

initTheme();
initI18n();

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const tr = (key) => dict[getLang()]?.[key] ?? dict.es[key] ?? '';
const params = new URLSearchParams(location.search);
const coarse = window.matchMedia('(pointer: coarse)').matches;

const el = {
  // State classes live on <html> so CSS can apply them before <body> exists.
  body: document.documentElement,
  canvas: $('[data-canvas]'),
  cover: $('[data-cover]'),
  coverLeg: $('[data-cover-leg]'),
  start: $('[data-start]'),
  startLabel: $('[data-start-label]'),
  progress: $('[data-progress]'),
  error: $('[data-error]'),
  hud: $('[data-hud]'),
  fade: $('[data-fade]'),
  caption: $('[data-caption]'),
  capMeta: $('[data-cap-meta]'),
  capTitle: $('[data-cap-title]'),
  capText: $('[data-cap-text]'),
  capLink: $('[data-cap-link]'),
  chapterNext: $('[data-chapter-next]'),
  loading: $('[data-chapter-loading]'),
  chapters: $('[data-chapters]'),
  open: $('[data-open]'),
  openLabel: $('[data-open-label]'),
  hint: $('[data-hint]'),
  storyNav: $('[data-story-nav]'),
  routeProgress: $('[data-route-progress]'),
  ret: $('[data-return]'),
  lemons: $('[data-lemons]'),
  lemonCount: $('[data-lemon-count]'),
  joy: $('[data-joy]'),
  knob: $('[data-joy-knob]'),
  pad: $('[data-pad]'),
  toast: $('[data-toast]'),
  stats: $('[data-stats]'),
  card: $('[data-card]'),
  menu: $('[data-menu]'),
  map: $('[data-map]'),
  travel: $('[data-travel]'),
};

let game = null;
let mode = 'story';
let near = null;
let beat = null;
let dialog = null; // { root, restore }
let chapter = { id: 'murcia', vehicle: 'bicycle', actions: { a: 'hop', b: 'bell' }, onRails: false };
const hintSeen = { story: false, explore: false };
let changing = false;
let loadingNotice = 0;

// ------------------------------------------------------------- Plain mode
function setPlain(on, withError = false) {
  el.body.classList.toggle('is-plain', on);
  el.error.hidden = !withError;
  $$('[data-unplain]').forEach((b) => (b.hidden = !game));
  if (on) {
    closeDialog();
    game?.setPaused(true);
    window.scrollTo(0, 0);
  } else if (game) game.setPaused(false);
}
$$('[data-plain]').forEach((b) => b.addEventListener('click', () => setPlain(true)));
$$('[data-unplain]').forEach((b) => b.addEventListener('click', () => setPlain(false)));
$('[data-retry]').addEventListener('click', () => location.reload());

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ Toast
let toastTimer = 0;
function toast(key) {
  const text = tr(key);
  if (!text) return;
  el.toast.textContent = text;
  el.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 3200);
}

// --------------------------------------------------------------- Captions
const beatInfo = () => (beat && game?.world ? game.world.beats.find((b) => b.id === beat) : null);

function renderCaption() {
  const b = mode === 'story' ? beatInfo() : null;
  el.caption.classList.toggle('is-on', !!b);
  if (b) {
    el.capMeta.textContent = tr(b.keys.meta);
    el.capTitle.textContent = tr(b.keys.title);
    el.capText.textContent = b.keys.text ? tr(b.keys.text) : '';
  }
  renderOpen();
}

const nextChapter = () => {
  const index = JOURNEY.findIndex((entry) => entry.id === chapter.id);
  return index >= 0 ? JOURNEY[index + 1] : null;
};

function renderOpen() {
  const b = mode === 'story' ? beatInfo() : game?.world.beats.find((entry) => entry.poi && entry.poi === near);
  const next = b?.next && nextChapter();
  const can = !!near && (mode === 'explore' || !!b?.poi);
  const link = b?.link;
  el.open.hidden = !can;
  if (can) el.openLabel.textContent = tr(near === 'playroom' ? 'world.open.playroom' : 'world.open');
  el.capLink.hidden = !link;
  if (link) el.capLink.href = link;
  el.chapterNext.hidden = !next;
  if (next) {
    el.chapterNext.textContent = tr('world.journey.continue');
    el.chapterNext.setAttribute('aria-label', tr('world.journey.continue') + ' · ' + tr(next.title));
  }
  el.body.classList.toggle('has-near', !!(can || next || link) && mode === 'explore');
}

async function chooseChapter(id, { fromStory = false } = {}) {
  if (!game || changing || id === chapter.id) return;
  closeDialog();
  if (await game.loadChapter(id, { fromStory })) {
    const url = new URL(location.href);
    if (id === 'murcia') url.searchParams.delete('chapter');
    else url.searchParams.set('chapter', id);
    history.replaceState(null, '', url);
    if (!fromStory) $('[data-menu-open]').focus({ preventScroll: true });
  }
}

el.chapterNext.addEventListener('click', () => {
  const next = nextChapter();
  if (next) void chooseChapter(next.id, { fromStory: mode === 'story' });
});


function renderHint() {
  const suffix = coarse ? 'Touch' : '';
  const controls = { train: 'rail', bus: 'bus', airplane: 'flight', ship: 'ship', bicycle: 'explore' };
  const story = chapter.id === 'murcia' ? 'story' : 'journey';
  const key = 'world.hint.' + (mode === 'story' ? story : controls[chapter.vehicle]) + suffix;
  el.hint.textContent = tr(key);
  el.hint.classList.toggle('is-on', !hintSeen[mode] && (mode !== 'story' || chapter.id === 'murcia'));
}

function renderMode() {
  $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  el.body.dataset.mode = mode;
  el.ret.hidden = mode !== 'explore' || chapter.onRails;
  el.storyNav.hidden = mode !== 'story';
  el.joy.hidden = el.pad.hidden = !(coarse && mode === 'explore');
  renderHint();
  renderCaption();
}

// ----------------------------------------------------------------- Dialogs
function openDialog(root) {
  if (dialog) closeDialog();
  dialog = { root, restore: document.activeElement };
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-on'));
  game?.setPaused(true);
  const panel = $('[role="dialog"]', root);
  panel.focus({ preventScroll: true });
  panel.scrollTop = 0;
}
function closeDialog() {
  if (!dialog) return;
  const { root, restore } = dialog;
  dialog = null;
  root.classList.remove('is-on');
  root.hidden = true;
  if (!el.body.classList.contains('is-plain')) game?.setPaused(false);
  if (restore && restore.focus && document.contains(restore)) restore.focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => {
  if (!dialog) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeDialog();
  } else if (e.key === 'Tab') {
    // Keep focus inside the open dialog.
    const f = $$('a[href], button:not([disabled]), input', dialog.root).filter((n) => !n.hidden && n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const lastEl = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.root.contains(document.activeElement))) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  }
});
$$('[data-card-close]').forEach((b) => b.addEventListener('click', closeDialog));
$$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeDialog));

let cardId = null;
function fillCard(id) {
  const poi = game.world.pois.find((p) => p.id === id);
  if (!poi) return false;
  cardId = id;
  const fig = $('[data-card-fig]');
  const role = $('[data-card-role]');
  const stats = $('[data-card-stats]');
  const link = $('[data-card-link]');
  if (poi.kind === 'link') {
    fig.hidden = true;
    $('[data-card-meta]').textContent = tr('games.kicker');
    $('[data-card-title]').textContent = tr('games.title');
    $('[data-card-text]').textContent = tr('games.lead');
    role.hidden = stats.hidden = true;
    link.textContent = `${tr('world.open.playroom')} →`;
    link.href = '/games/';
    return true;
  }
  const k = `traj.${poi.key}`;
  fig.hidden = false;
  const img = $('[data-card-img]');
  if (img.getAttribute('src') !== poi.photo) img.src = poi.photo;
  img.alt = tr(`${k}.caption`);
  $('[data-card-cap]').textContent = tr(`${k}.caption`);
  $('[data-card-meta]').textContent = tr(`${k}.meta`);
  $('[data-card-title]').textContent = tr(`${k}.title`);
  $('[data-card-text]').textContent = tr(`${k}.text`);
  const r = tr(`world.card.${id}.role`);
  role.hidden = !r;
  role.textContent = r;
  stats.hidden = !poi.stats;
  if (poi.stats) stats.innerHTML = [1, 2, 3].map((n) => `<li>${tr(`${k}.stat${n}`)}</li>`).join('');
  link.textContent = tr('world.card.more');
  link.href = poi.href || '/trajectory/';
  return true;
}
function openCard(id = near) {
  if (!id || !game || dialog) return;
  if (fillCard(id)) openDialog(el.card);
}
el.open.addEventListener('click', () => openCard());

// ------------------------------------------------------------------- Menu
function renderTravel() {
  el.travel.innerHTML = '';
  game.world.beats.filter((b) => b.place).forEach((beatDef, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="mono">${String(i + 1).padStart(2, '0')}</span> <span></span>`;
    b.lastElementChild.textContent = tr(beatDef.place);
    b.addEventListener('click', () => {
      closeDialog();
      game.travel(beatDef.id);
    });
    li.appendChild(b);
    el.travel.appendChild(li);
  });
}

function renderChapterList() {
  el.chapters.replaceChildren();
  for (const def of JOURNEY) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.chapterId = def.id;
    button.textContent = tr(def.title);
    if (def.id === chapter.id) {
      button.setAttribute('aria-current', 'step');
      button.disabled = true;
    }
    button.addEventListener('click', () => void chooseChapter(def.id));
    li.append(button);
    el.chapters.append(li);
  }
}

/** The HUD follows whichever chapter and vehicle the engine has loaded. */
function renderChapter() {
  const def = CHAPTERS[chapter.id];
  const labels = Array.from(document.querySelectorAll('.pw-chapter'));
  el.coverLeg.setAttribute('data-i18n', def.id === 'murcia' ? 'world.cover.kicker' : def.label);
  el.coverLeg.textContent = tr(el.coverLeg.getAttribute('data-i18n'));
  labels.forEach((n) => n.setAttribute('data-i18n', def.label));
  const title = document.getElementById('pw-menu-title');
  title.setAttribute('data-i18n', def.title);
  [...labels, title].forEach((n) => (n.textContent = tr(n.getAttribute('data-i18n'))));
  for (const [slot, sel] of [['a', '[data-hop]'], ['b', '[data-bell]']]) {
    const btn = document.querySelector(sel);
    const id = chapter.actions[slot];
    btn.hidden = !id;
    if (id) {
      btn.textContent = { hop: '⤒', bell: '♪', horn: '♪', flight: '✈', deck: '⇄', doors: '↕' }[id];
      btn.setAttribute('data-i18n-attr', `aria-label:world.touch.${id}`);
      btn.setAttribute('aria-label', tr(`world.touch.${id}`));
    }
  }
  el.lemons.hidden = true;
  renderMode();
}

let mapTimer = 0;
function drawMap() {
  if (!game) return;
  const w = game.world;
  const c = el.map;
  const g = c.getContext('2d');
  const S = c.width;
  const css = getComputedStyle(document.documentElement);
  const ink = `rgb(${css.getPropertyValue('--ink-rgb')})`;
  const signal = css.getPropertyValue('--signal').trim();
  let ext = 40;
  for (let i = 0; i < w.route.N; i += 8) ext = Math.max(ext, Math.abs(w.route.RX[i]), Math.abs(w.route.RZ[i]));
  const k = S / ((ext + 14) * 2);
  const X = (x) => S / 2 + x * k;
  const Y = (z) => S / 2 + z * k;
  g.clearRect(0, 0, S, S);
  g.lineCap = g.lineJoin = 'round';

  if (w.river) {
    g.strokeStyle = currentTheme() === 'dark' ? '#2f6a66' : '#6aa9a0';
    g.lineWidth = 9 * k;
    g.beginPath();
    for (let x = -ext - 14; x <= ext + 14; x += 4) g.lineTo(X(x), Y(w.river(x)));
    g.stroke();
  }
  if (w.plaza) {
    g.fillStyle = `rgba(${css.getPropertyValue('--ink-rgb')}, 0.12)`;
    g.beginPath();
    g.arc(X(w.plaza.x), Y(w.plaza.z), w.plaza.r * k, 0, Math.PI * 2);
    g.fill();
  }

  // Route
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < w.route.N; i += 6) g.lineTo(X(w.route.RX[i]), Y(w.route.RZ[i]));
  g.stroke();

  // Story points
  g.font = '500 15px "IBM Plex Mono", monospace';
  w.pois.forEach((p) => {
    g.fillStyle = signal;
    g.beginPath();
    g.arc(X(p.x), Y(p.z), p.minor ? 4 : 6.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 1.5;
    g.stroke();
  });

  // Rider
  const st = game.state;
  g.save();
  g.translate(X(st.x), Y(st.z));
  g.rotate(-st.yaw + Math.PI);
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(0, -11);
  g.lineTo(7, 8);
  g.lineTo(0, 4);
  g.lineTo(-7, 8);
  g.closePath();
  g.fill();
  g.restore();
}
function openMenu() {
  if (!game || dialog) return;
  if (changing) return;
  renderTravel();
  renderChapterList();
  openDialog(el.menu);
  drawMap();
}
$('[data-menu-open]').addEventListener('click', openMenu);

// ---------------------------------------------------------------- Settings
const setMotion = $('[data-set-motion]');
const setSound = $('[data-set-sound]');
const setLight = $('[data-set-light]');
setMotion.checked = prefersReducedMotion();
setMotion.addEventListener('change', () => {
  game?.setCalm(setMotion.checked);
  el.body.classList.toggle('is-calm', setMotion.checked);
});
setSound.addEventListener('change', () => game?.setSound(setSound.checked));
setLight.addEventListener('change', () => game?.setQuality(setLight.checked ? 0 : 'auto'));
el.body.classList.toggle('is-calm', setMotion.checked);

// ---------------------------------------------------------- Touch controls
function wireJoystick() {
  let id = null;
  let cx = 0;
  let cy = 0;
  const R = 46;
  const set = (x, y) => {
    el.knob.style.transform = `translate(${x * R}px, ${-y * R}px)`;
    game?.setJoystick(x, y);
  };
  el.joy.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    el.joy.setPointerCapture(id);
    const r = el.joy.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== id) return;
    let x = (e.clientX - cx) / R;
    let y = -(e.clientY - cy) / R;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    // A small dead zone so resting a thumb does not creep the bike.
    set(Math.abs(x) < 0.12 ? 0 : x, Math.abs(y) < 0.12 ? 0 : y);
    hintSeen.explore = true;
    el.hint.classList.remove('is-on');
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    set(0, 0);
  };
  el.joy.addEventListener('pointermove', move);
  el.joy.addEventListener('pointerup', end);
  el.joy.addEventListener('pointercancel', end);
}
wireJoystick();
$('[data-hop]').addEventListener('click', () => game?.action('a'));
$('[data-bell]').addEventListener('click', () => game?.action('b'));

// Hold-to-ride buttons for story mode (they also step beat by beat on tap).
function holdButton(btn, dir) {
  let held = false;
  let timer = 0;
  const up = () => {
    clearTimeout(timer);
    if (held) game?.setAdvance(0);
    held = false;
  };
  btn.addEventListener('pointerdown', () => {
    timer = setTimeout(() => {
      held = true;
      game?.setAdvance(dir * 1.6);
    }, 260);
  });
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('click', () => {
    if (!held) game?.nextBeat(dir);
  });
}
holdButton($('[data-next]'), 1);
holdButton($('[data-prev]'), -1);

$$('[data-mode]').forEach((b) => b.addEventListener('click', () => game?.setMode(b.dataset.mode)));
el.ret.addEventListener('click', () => game?.returnToRoute());
// A mouse or touch press should not leave focus parked on a HUD button, or the
// next Enter / Space would re-press it instead of reaching the world.
document.querySelectorAll('.pw-hud button').forEach((b) => b.addEventListener('click', (e) => e.detail > 0 && b.blur()));

window.addEventListener('keydown', (e) => {
  if (!game || !game.state.started || el.body.classList.contains('is-plain')) return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'KeyM' && !e.repeat) {
    e.preventDefault();
    if (dialog && dialog.root === el.menu) closeDialog();
    else if (!dialog) openMenu();
  } else if (e.code === 'Enter' && !dialog && near && !el.open.hidden && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
    e.preventDefault();
    openCard();
  } else if (!dialog && /^(Arrow|Key[WASD]|Space|Page)/.test(e.code)) {
    hintSeen[mode] = true;
    el.hint.classList.remove('is-on');
  }
});
el.canvas.addEventListener('wheel', () => {
  hintSeen.story = true;
  el.hint.classList.remove('is-on');
}, { passive: true });
el.canvas.addEventListener('pointerdown', () => {
  if (mode === 'story') {
    hintSeen.story = true;
    el.hint.classList.remove('is-on');
  }
});

// ------------------------------------------------------------ Game events
const TOASTS = { water: 'world.toast.water', edge: 'world.toast.edge', stuck: 'world.toast.stuck' };
function emit(type, value) {
  if (type === 'chapter') {
    chapter = value;
    near = null;
    beat = null;
    hintSeen.explore = false;
    if (game) renderChapter();
  } else if (type === 'advance') {
    if (!dialog) void chooseChapter(value, { fromStory: true });
  } else if (type === 'loading') {
    changing = value.active;
    clearTimeout(loadingNotice);
    el.loading.hidden = true;
    if (changing) loadingNotice = setTimeout(() => { el.loading.hidden = false; }, value.fromStory ? 1100 : 550);
    el.hud.inert = changing;
    el.body.classList.toggle('is-changing', changing);
  } else if (type === 'chapterError') {
    toast('world.journey.error');
  } else if (type === 'mode') {
    mode = value;
    renderMode();
  } else if (type === 'beat') {
    beat = value;
    renderCaption();
  } else if (type === 'near') {
    near = value;
    renderOpen();
  } else if (type === 'cine') {
    el.body.classList.toggle('is-cine', value);
  } else if (type === 'fade') {
    el.fade.classList.add('is-on');
    setTimeout(() => el.fade.classList.remove('is-on'), 420);
    if (TOASTS[value]) toast(TOASTS[value]);
  } else if (type === 'lemons') {
    el.lemons.hidden = false;
    el.lemonCount.textContent = String(value);
    if (value === 1) toast('world.toast.lemon');
  } else if (type === 'secret') {
    toast('world.toast.' + value);
  } else if (type === 'quality') {
    toast('world.toast.quality');
  } else if (type === 'context') {
    if (value === 'lost') toast('world.toast.lost');
  }
}

// Language and theme can change at any time; re-render what JS wrote.
new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.attributeName === 'lang') {
      if (game) renderChapter();
      if (game && dialog?.root === el.menu) {
        renderTravel();
        renderChapterList();
      }
      if (game && dialog?.root === el.card && cardId) fillCard(cardId);
      if (game && el.start.dataset.ready) el.startLabel.textContent = tr('world.cover.start');
    } else if (m.attributeName === 'data-theme') {
      game?.setTheme(currentTheme() === 'dark');
      if (dialog?.root === el.menu) drawMap();
    }
  }
}).observe(document.documentElement, { attributes: true });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => game?.setTheme(currentTheme() === 'dark'));

// ------------------------------------------------------------------- Boot
function onProgress(f) {
  el.progress.style.transform = `scaleX(${Math.max(0.04, Math.min(1, f)).toFixed(3)})`;
}

async function boot() {
  el.start.hidden = false;
  $$('[data-plain]').forEach((b) => (b.hidden = false));

  if (params.has('plain')) return setPlain(true);
  if (!webglAvailable() || params.has('nowebgl')) return setPlain(true, true);

  const t0 = performance.now();
  try {
    onProgress(0.08);
    const { createGame } = await import('./world/game.js');
    onProgress(0.25);
    game = await createGame({
      canvas: el.canvas,
      tier: deviceTier(),
      reduced: setMotion.checked,
      dark: currentTheme() === 'dark',
      onProgress,
      emit,
      chapter: params.get('chapter') === 'asia' ? 'flight'
        : Object.hasOwn(CHAPTERS, params.get('chapter')) ? params.get('chapter') : 'murcia',
    });
    renderChapter();
  } catch (err) {
    console.error('[pedal-the-world]', err);
    game = null;
    return setPlain(true, true);
  }
  const loadMs = Math.round(performance.now() - t0);
  window.__pw = { game, loadMs };

  el.body.classList.add('is-loaded');
  el.start.disabled = false;
  el.start.dataset.ready = '1';
  el.startLabel.removeAttribute('data-i18n');
  el.startLabel.textContent = tr('world.cover.start');
  if (document.activeElement === document.body) el.start.focus({ preventScroll: true });

  el.start.addEventListener('click', () => {
    el.body.classList.add('is-playing');
    el.hud.hidden = false;
    el.cover.setAttribute('aria-hidden', 'true');
    setTimeout(() => (el.cover.hidden = true), 900);
    game.start();
    el.start.blur();
  });

  // Route progress + optional live stats (?stats).
  setInterval(() => {
    el.routeProgress.style.transform = `scaleY(${game.state.t.toFixed(3)})`;
    if (dialog?.root === el.menu && Date.now() - mapTimer > 120) {
      mapTimer = Date.now();
      drawMap();
    }
  }, 100);
  if (params.has('stats')) {
    el.stats.hidden = false;
    setInterval(() => {
      const s = game.stats();
      el.stats.textContent = `${s.fps} fps (avg ${s.avg}, min ${s.min ?? '–'})\n${s.calls} calls · ${(s.triangles / 1000).toFixed(1)}k tris\nq${s.quality} · dpr ${s.dpr} · shadows ${s.shadows ? 'on' : 'off'}\nload ${loadMs} ms`;
    }, 500);
  }
  if (params.has('autostart')) el.start.click();

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) game?.dispose();
  });
}

boot();
