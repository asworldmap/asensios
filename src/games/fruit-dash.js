// Fruit Dash — a tiny auto-runner. Jump over obstacles, grab fruit.
// No dependencies. Works with keyboard, mouse and touch.

const FRUITS = ['🍎', '🍊', '🍋', '🍓', '🍇'];

export function createFruitDash(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const overlay = root.querySelector('[data-overlay]');
  const scoreEl = root.querySelector('[data-score]');
  const bestEl = root.querySelector('[data-best]');
  const titleEl = overlay.querySelector('[data-ov-title]');
  const textEl = overlay.querySelector('[data-ov-text]');
  const bigScore = overlay.querySelector('[data-ov-score]');
  const btn = overlay.querySelector('[data-ov-btn]');

  const BEST_KEY = 'asensios.fruitDash.best';
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

  // --- state ---
  let running = false;
  let raf = 0;
  let last = 0;
  let score = 0;
  let speed = 0;
  let groundY = 0;

  const player = { x: 0, y: 0, vy: 0, r: 18, onGround: true, rot: 0 };
  let obstacles = [];
  let fruits = [];
  let particles = [];
  let spawnT = 0;
  let fruitT = 0;

  function reset() {
    resize();
    groundY = H - 46;
    score = 0;
    speed = 240;
    player.x = Math.max(70, W * 0.18);
    player.y = groundY - player.r;
    player.vy = 0;
    player.onGround = true;
    player.rot = 0;
    obstacles = [];
    fruits = [];
    particles = [];
    spawnT = 0.6;
    fruitT = 1.2;
  }

  function jump() {
    if (!running) return;
    if (player.onGround) {
      player.vy = -560;
      player.onGround = false;
    }
  }

  function spawnObstacle() {
    const h = 26 + Math.random() * 30;
    obstacles.push({ x: W + 30, w: 24 + Math.random() * 14, h });
  }

  function spawnFruit() {
    const y = groundY - 70 - Math.random() * 110;
    fruits.push({
      x: W + 30,
      y,
      r: 14,
      emoji: FRUITS[(Math.random() * FRUITS.length) | 0],
      got: false,
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5,
        color,
      });
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
    titleEl.textContent = '¡Buen intento!';
    bigScore.textContent = score;
    bigScore.hidden = false;
    textEl.textContent = score >= best ? '¡Nuevo récord! ¿Otra vez?' : 'Salta más fino y atrapa fruta.';
    btn.textContent = 'Reintentar';
    overlay.hidden = false;
  }

  function update(dt) {
    speed += dt * 6; // gradual acceleration
    score += dt * speed * 0.04;
    scoreEl.textContent = Math.floor(score);

    // physics
    player.vy += 1500 * dt;
    player.y += player.vy * dt;
    if (player.y >= groundY - player.r) {
      player.y = groundY - player.r;
      player.vy = 0;
      player.onGround = true;
    }
    player.rot += (player.onGround ? 0 : dt * 9);

    // spawns
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnObstacle();
      spawnT = Math.max(0.7, 1.5 - speed / 600) + Math.random() * 0.5;
    }
    fruitT -= dt;
    if (fruitT <= 0) {
      spawnFruit();
      fruitT = 1 + Math.random() * 1.4;
    }

    // move + collide obstacles
    for (const o of obstacles) o.x -= speed * dt;
    obstacles = obstacles.filter((o) => o.x + o.w > -10);
    for (const o of obstacles) {
      const px = player.x;
      const py = player.y;
      const closeX = Math.max(o.x, Math.min(px, o.x + o.w));
      const topY = groundY - o.h;
      const closeY = Math.max(topY, Math.min(py, groundY));
      const dx = px - closeX;
      const dy = py - closeY;
      if (dx * dx + dy * dy < player.r * player.r * 0.7) {
        burst(px, py, '#ef6f53');
        gameOver();
        return;
      }
    }

    // fruits
    for (const f of fruits) f.x -= speed * dt;
    fruits = fruits.filter((f) => f.x > -30 && !f.got);
    for (const f of fruits) {
      const dx = f.x - player.x;
      const dy = f.y - player.y;
      if (dx * dx + dy * dy < (f.r + player.r) * (f.r + player.r)) {
        f.got = true;
        score += 10;
        burst(f.x, f.y, '#f2b13c');
      }
    }

    // particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // ground
    ctx.fillStyle = '#1c3a33';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = (-(score * 2) % 40); x < W; x += 40) {
      ctx.fillRect(x, groundY + 10, 18, 4);
    }

    // obstacles (coral spikes)
    ctx.fillStyle = '#ef6f53';
    for (const o of obstacles) {
      const topY = groundY - o.h;
      ctx.beginPath();
      ctx.moveTo(o.x, groundY);
      ctx.lineTo(o.x + o.w / 2, topY);
      ctx.lineTo(o.x + o.w, groundY);
      ctx.closePath();
      ctx.fill();
    }

    // fruits
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of fruits) ctx.fillText(f.emoji, f.x, f.y);

    // player (cute blob)
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rot);
    ctx.fillStyle = '#2f6bff';
    roundRect(ctx, -player.r, -player.r, player.r * 2, player.r * 2, 8);
    ctx.fill();
    ctx.restore();
    // eyes (not rotated, so it stays friendly)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x - 5, player.y - 4, 4, 0, Math.PI * 2);
    ctx.arc(player.x + 6, player.y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e2740';
    ctx.beginPath();
    ctx.arc(player.x - 4, player.y - 4, 2, 0, Math.PI * 2);
    ctx.arc(player.x + 7, player.y - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // particles
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
  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      // only intercept when the game is the focus context
      if (running) {
        e.preventDefault();
        jump();
      }
    }
  }
  window.addEventListener('keydown', onKey);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (running) jump();
  });

  btn.addEventListener('click', start);

  // draw an idle frame at boot so the canvas isn't blank
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
