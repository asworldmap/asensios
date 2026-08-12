// Orbit Dodger — switch between the inner and outer lane to dodge rocks
// sweeping in from behind. Survival score, ramping difficulty. Keyboard,
// mouse and touch — one action only (switch lane), so it reads instantly.

export function createOrbitDodger(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const overlay = root.querySelector('[data-overlay]');
  const scoreEl = root.querySelector('[data-score]');
  const bestEl = root.querySelector('[data-best]');
  const titleEl = overlay.querySelector('[data-ov-title]');
  const textEl = overlay.querySelector('[data-ov-text]');
  const bigScore = overlay.querySelector('[data-ov-score]');
  const btn = overlay.querySelector('[data-ov-btn]');

  const BEST_KEY = 'asensios.orbitDodger.best';
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let outerR = 0;
  let innerR = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
    outerR = Math.min(W, H) * 0.38;
    innerR = outerR * 0.58;
  }

  const TOP = -Math.PI / 2;
  const HIT_WINDOW = 0.11; // radians either side of TOP that counts as a collision
  const SWEEP_FROM = TOP - Math.PI * 1.7; // rocks spawn well behind the player

  let running = false;
  let raf = 0;
  let last = 0;
  let t = 0;
  let score = 0;
  let lane = 1; // 0 = inner, 1 = outer
  let laneFlash = 0;
  let spawnT = 0;
  let rocks = [];
  let particles = [];

  function reset() {
    resize();
    t = 0;
    score = 0;
    lane = 1;
    laneFlash = 0;
    rocks = [];
    particles = [];
    spawnT = 1;
  }

  function difficulty() {
    return Math.min(1, t / 45);
  }

  function spawnRock() {
    const d = difficulty();
    rocks.push({
      lane: Math.random() < 0.5 ? 0 : 1,
      angle: SWEEP_FROM,
      speed: 1.1 + d * 1.6,
      scored: false,
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.55, color });
    }
  }

  function angleDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function playerPos() {
    const radius = lane === 0 ? innerR : outerR;
    return { x: cx + Math.cos(TOP) * radius, y: cy + Math.sin(TOP) * radius };
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    const final = Math.round(score);
    if (final > best) {
      best = final;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    titleEl.textContent = 'Fin de la órbita';
    bigScore.textContent = final;
    bigScore.hidden = false;
    textEl.textContent = final >= best ? '¡Nuevo récord!' : 'Cambia de órbita, esquiva los asteroides.';
    btn.textContent = 'Jugar otra vez';
    overlay.hidden = false;
  }

  function update(dt) {
    t += dt;
    score += dt * 12;
    scoreEl.textContent = Math.round(score);
    laneFlash = Math.max(0, laneFlash - dt * 3);

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnRock();
      const d = difficulty();
      spawnT = Math.max(0.55, 1.35 - d * 0.85) + Math.random() * 0.25;
    }

    const p = playerPos();

    for (const r of rocks) {
      r.angle += r.speed * dt;
      const dist = Math.abs(angleDiff(r.angle, TOP));

      if (dist < HIT_WINDOW && r.lane === lane) {
        burst(p.x, p.y, '#7cfa4c');
        gameOver();
        return;
      }
      if (!r.scored && dist < HIT_WINDOW) {
        // Same lane already handled above (game over); reaching here means
        // it passed safely on the other lane.
        r.scored = true;
        score += 20;
      }
      if (r.angle - SWEEP_FROM > Math.PI * 2.2) r.dead = true;
    }
    rocks = rocks.filter((r) => !r.dead);

    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 260 * dt;
      pt.life -= dt;
    }
    particles = particles.filter((pt) => pt.life > 0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // lane guides
    ctx.save();
    ctx.strokeStyle = 'rgba(30,59,44,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // impact marker
    ctx.save();
    ctx.strokeStyle = 'rgba(124,250,76,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR - 10);
    ctx.lineTo(cx, cy - innerR + 10);
    ctx.stroke();
    ctx.restore();

    // rocks, sweeping toward the top
    for (const r of rocks) {
      const radius = r.lane === 0 ? innerR : outerR;
      const x = cx + Math.cos(r.angle) * radius;
      const y = cy + Math.sin(r.angle) * radius;
      ctx.save();
      ctx.fillStyle = '#b98a4e';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      // short trail so the sweep direction reads clearly
      ctx.strokeStyle = 'rgba(185,138,78,0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, r.angle - 0.22, r.angle);
      ctx.stroke();
      ctx.restore();
    }

    // player
    const pp = playerPos();
    ctx.save();
    ctx.fillStyle = '#7cfa4c';
    ctx.shadowColor = 'rgba(124,250,76,0.6)';
    ctx.shadowBlur = 10 + laneFlash * 14;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // center mark
    ctx.fillStyle = 'rgba(30,59,44,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 1.8);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
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

  function switchLane() {
    if (!running) return;
    lane = lane === 0 ? 1 : 0;
    laneFlash = 1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    switchLane();
  });

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      switchLane();
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
