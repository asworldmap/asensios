// Fruit Catch — move the basket, catch fruit, dodge bombs.
// Difficulty rises with score. Keyboard, mouse and touch.

const FRUITS = ['🍎', '🍊', '🍋', '🍓', '🍇', '🍑'];

export function createFruitCatch(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const overlay = root.querySelector('[data-overlay]');
  const scoreEl = root.querySelector('[data-score]');
  const bestEl = root.querySelector('[data-best]');
  const titleEl = overlay.querySelector('[data-ov-title]');
  const textEl = overlay.querySelector('[data-ov-text]');
  const bigScore = overlay.querySelector('[data-ov-score]');
  const btn = overlay.querySelector('[data-ov-btn]');

  const BEST_KEY = 'asensios.fruitCatch.best';
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  let W = 0;
  let H = 0;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let running = false;
  let raf = 0;
  let last = 0;
  let score = 0;
  let lives = 3;
  let spawnT = 0;
  let items = [];
  let particles = [];
  const basket = { x: 0, w: 76, h: 30, target: 0 };

  function reset() {
    resize();
    score = 0;
    lives = 3;
    items = [];
    particles = [];
    spawnT = 0.5;
    basket.w = Math.max(64, W * 0.16);
    basket.x = W / 2;
    basket.target = W / 2;
  }

  function difficulty() {
    return Math.min(1, score / 400);
  }

  function spawnItem() {
    const d = difficulty();
    const isBomb = Math.random() < 0.16 + d * 0.14;
    items.push({
      x: 24 + Math.random() * (W - 48),
      y: -24,
      r: 16,
      vy: 110 + d * 220 + Math.random() * 60,
      bomb: isBomb,
      emoji: isBomb ? '💣' : FRUITS[(Math.random() * FRUITS.length) | 0],
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    titleEl.textContent = '¡Se acabó!';
    bigScore.textContent = score;
    bigScore.hidden = false;
    textEl.textContent = score >= best ? '¡Nuevo récord!' : 'Atrapa fruta, esquiva bombas.';
    btn.textContent = 'Jugar otra vez';
    overlay.hidden = false;
  }

  function update(dt) {
    const d = difficulty();
    // basket easing toward target
    basket.x += (basket.target - basket.x) * Math.min(1, dt * 14);
    basket.x = Math.max(basket.w / 2, Math.min(W - basket.w / 2, basket.x));

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnItem();
      spawnT = Math.max(0.35, 1.1 - d * 0.7) + Math.random() * 0.3;
    }

    const basketTop = H - 52;
    for (const it of items) {
      it.y += it.vy * dt;
      // caught?
      if (
        it.y + it.r >= basketTop &&
        it.y - it.r <= basketTop + basket.h &&
        Math.abs(it.x - basket.x) < basket.w / 2 + it.r * 0.4
      ) {
        if (it.bomb) {
          burst(it.x, it.y, '#0e2740');
          it.dead = true;
          lives -= 1;
          if (lives <= 0) {
            gameOver();
            return;
          }
        } else {
          score += 5;
          burst(it.x, it.y, '#f2b13c');
          it.dead = true;
        }
      } else if (it.y - it.r > H) {
        // missed fruit costs a life; missed bomb is fine
        if (!it.bomb) {
          lives -= 1;
          if (lives <= 0) {
            it.dead = true;
            gameOver();
            return;
          }
        }
        it.dead = true;
      }
    }
    items = items.filter((it) => !it.dead);
    scoreEl.textContent = score;

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 360 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // items
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const it of items) ctx.fillText(it.emoji, it.x, it.y);

    // basket
    const bx = basket.x;
    const by = H - 52;
    ctx.fillStyle = '#1c3a33';
    roundRect(ctx, bx - basket.w / 2, by, basket.w, basket.h, 8);
    ctx.fill();
    ctx.fillStyle = '#2f6bff';
    roundRect(ctx, bx - basket.w / 2, by, basket.w, 8, 4);
    ctx.fill();

    // lives (hearts)
    ctx.font = '18px serif';
    ctx.textAlign = 'left';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), 12, 22);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 5, 5);
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    update(dt);
    if (running) {
      draw();
      raf = requestAnimationFrame(loop);
    }
  }

  function start() {
    reset();
    overlay.hidden = true;
    bigScore.hidden = true;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  // --- input ---
  function pointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    basket.target = (x / rect.width) * W;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (running) pointerMove(e);
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (running) pointerMove(e);
  });

  function onKey(e) {
    if (!running) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      basket.target = Math.max(basket.w / 2, basket.target - W * 0.12);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      basket.target = Math.min(W - basket.w / 2, basket.target + W * 0.12);
    }
  }
  window.addEventListener('keydown', onKey);

  btn.addEventListener('click', start);

  reset();
  draw();
  window.addEventListener('resize', () => {
    if (!running) {
      reset();
      draw();
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
