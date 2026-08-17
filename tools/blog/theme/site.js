/* Relatos desde Santiago — reader-side behaviour.
   Vanilla, no dependencies. Everything here is progressive enhancement:
   with JS off the site is fully readable and every story is reachable. */
(function () {
  'use strict';

  var CONFIG = {
    GA_MEASUREMENT_ID: 'G-7V5M9TTKGV',
    // Cartas al autor: set to an HTTPS endpoint that accepts JSON POSTs to
    // enable the form. Left null on purpose — a form that silently drops
    // messages is worse than an honest closed sign. See
    // docs/BLOG-V3-ARCHITECTURE.md for the recommended minimal backend.
    CARTAS_ENDPOINT: null
  };

  var READ_KEY = 'relatos_leidos';
  var CONSENT_KEY = 'relatos_analytics_consent';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.documentElement.classList.add('js');

  // ---------------------------------------------------------------- helpers
  function readSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveSet(set) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set))); }
    catch (e) { /* private mode: reading still works, marks just don't persist */ }
  }

  // -------------------------------------------------------------- analytics
  var gaReady = false;

  function hasRealGaId() {
    return /^G-[A-Z0-9]{6,}$/.test(CONFIG.GA_MEASUREMENT_ID) &&
      CONFIG.GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX';
  }

  function loadAnalytics() {
    if (gaReady || !hasRealGaId()) return;
    gaReady = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // UTM parameters stay on the URL untouched so GA4 attributes campaigns.
    window.gtag('config', CONFIG.GA_MEASUREMENT_ID, { anonymize_ip: true });
  }

  /** Editorial events only — did people read, finish, and come back. */
  function track(name, params) {
    if (!gaReady || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  }

  function setupConsent() {
    if (!hasRealGaId()) return;
    var state;
    try { state = localStorage.getItem(CONSENT_KEY); } catch (e) { state = null; }
    if (state === 'yes') { loadAnalytics(); return; }
    if (state === 'no') return;

    var box = document.querySelector('.consent');
    if (!box) return;
    box.hidden = false;
    box.querySelector('[data-accept]').addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch (e) {}
      box.hidden = true;
      loadAnalytics();
    });
    box.querySelector('[data-decline]').addEventListener('click', function () {
      try { localStorage.setItem(CONSENT_KEY, 'no'); } catch (e) {}
      box.hidden = true;
    });
  }

  // ------------------------------------------------------------ read state
  function setupReadState() {
    var read = readSet();

    // Archive / front-page rows reflect this browser's own history.
    document.querySelectorAll('[data-archive-row]').forEach(function (row) {
      if (!read.has(row.getAttribute('data-archive-row'))) return;
      var mark = row.querySelector('[data-read-mark]');
      if (mark) { mark.textContent = '✓'; mark.classList.add('is-read'); }
    });

    var story = document.querySelector('.story[data-relato]');
    var btn = document.querySelector('[data-read-toggle]');
    if (!story || !btn) return;

    var slug = story.getAttribute('data-relato');
    var mark = btn.querySelector('.read-toggle__mark');
    var label = btn.querySelector('.read-toggle__label');

    function paint(isRead) {
      btn.setAttribute('aria-pressed', isRead ? 'true' : 'false');
      mark.textContent = isRead ? '✓' : '○';
      label.textContent = isRead ? 'Leído' : 'Marcar como leído';
    }
    paint(read.has(slug));

    btn.addEventListener('click', function () {
      var now = readSet();
      var isRead = now.has(slug);
      if (isRead) { now.delete(slug); } else { now.add(slug); track('marked_as_read', { relato: slug }); }
      saveSet(now);
      paint(!isRead);
    });

    var clear = document.querySelector('[data-clear-read]');
    if (clear) {
      clear.addEventListener('click', function () {
        try { localStorage.removeItem(READ_KEY); } catch (e) {}
        document.querySelectorAll('[data-read-mark]').forEach(function (m) {
          m.textContent = '○'; m.classList.remove('is-read');
        });
        paint(false);
      });
    }
  }

  // Archive page has no story, so wire the clear button separately.
  function setupClearOnly() {
    if (document.querySelector('.story[data-relato]')) return;
    var clear = document.querySelector('[data-clear-read]');
    if (!clear) return;
    clear.addEventListener('click', function () {
      try { localStorage.removeItem(READ_KEY); } catch (e) {}
      document.querySelectorAll('[data-read-mark]').forEach(function (m) {
        m.textContent = '○'; m.classList.remove('is-read');
      });
    });
  }

  // ---------------------------------------------------------------- reveal
  /**
   * Reveal-on-scroll.
   *
   * Nothing is hidden by a stylesheet rule keyed on a class this script adds.
   * That coupling made the publication's visibility depend on this script
   * SUCCEEDING: any exception between adding the class and attaching the
   * observer left every .reveal block at opacity 0 for good, and the page
   * scrolled through a screenful of blank paper. Content is visible by
   * default; each element is armed here, individually, immediately before it
   * is observed. If this function never runs, or dies halfway, whatever was
   * not armed simply stays on the page.
   */
  function setupReveal() {
    var items = [].slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    items.forEach(function (el) {
      el.classList.add('reveal--armed');
      io.observe(el);
    });

    // Second net: if a callback never arrives (throttled tab, odd viewport),
    // release everything rather than leave it hidden.
    window.setTimeout(function () {
      items.forEach(function (el) {
        if (!el.classList.contains('is-in')) { el.classList.add('is-in'); io.unobserve(el); }
      });
    }, 2000);
  }

  // --------------------------------------------------- reading progression
  function setupReadingEvents() {
    var story = document.querySelector('.story[data-relato]');
    if (!story) return;
    var slug = story.getAttribute('data-relato');
    var fired = {};

    function fire(name) {
      if (fired[name]) return;
      fired[name] = true;
      track(name, { relato: slug });
    }
    fire('relato_started');

    var body = story.querySelector('.story-body');
    if (!body || !('IntersectionObserver' in window)) return;

    // Two sentinels: halfway through the body, and its end. Cheaper and far
    // less creepy than sampling scroll position continuously.
    var half = document.createElement('span');
    half.setAttribute('aria-hidden', 'true');
    half.style.cssText = 'display:block;height:1px';
    body.insertBefore(half, body.children[Math.floor(body.children.length / 2)] || null);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (e.target === half) fire('relato_50_percent');
        else fire('relato_completed');
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    io.observe(half);
    var foot = story.querySelector('.story-foot');
    if (foot) io.observe(foot);
  }

  // ------------------------------------------------------------ media + CTA
  function setupMediaEvents() {
    document.querySelectorAll('video').forEach(function (v) {
      v.addEventListener('play', function () {
        track('media_video_play', { src: (v.currentSrc || '').split('/').pop() });
      }, { once: true });
    });
    document.querySelectorAll('[data-event]').forEach(function (el) {
      el.addEventListener('click', function () { track(el.getAttribute('data-event')); });
    });
    document.querySelectorAll('.strip__item a').forEach(function (a) {
      a.addEventListener('click', function () { track('postal_opened'); });
    });
  }

  // ------------------------------------------------------- cartas al autor
  function setupCarta() {
    var section = document.querySelector('[data-carta]');
    if (!section) return;
    var form = section.querySelector('[data-carta-form]');
    var status = section.querySelector('[data-carta-status]');
    if (!form || !status) return;

    var stamp = form.querySelector('input[name="t"]');
    if (stamp) stamp.value = String(Date.now());

    if (!CONFIG.CARTAS_ENDPOINT) {
      section.setAttribute('data-disabled', '');
      form.setAttribute('aria-disabled', 'true');
      status.textContent = 'El buzón está cerrado por ahora. Pronto podrás escribir desde aquí.';
      form.addEventListener('submit', function (e) { e.preventDefault(); });
      return;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      if (data.get('company')) return;                       // honeypot
      if (Date.now() - Number(data.get('t') || 0) < 3000) {  // too fast to be human
        status.textContent = 'Tómate un momento y vuelve a enviarlo.';
        return;
      }
      var message = String(data.get('message') || '').trim();
      if (message.length < 4) { status.textContent = 'Escribe un mensaje primero.'; return; }

      status.textContent = 'Enviando…';
      fetch(CONFIG.CARTAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          name: String(data.get('name') || '').trim(),
          relato: String(data.get('relato') || '')
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('bad status');
        form.reset();
        status.textContent = 'Gracias. Lo leeré.';
      }).catch(function () {
        status.textContent = 'No se pudo enviar. Inténtalo más tarde.';
      });
    });
  }

  // ------------------------------------------------------- edición nocturna
  var THEME_KEY = 'relatos_edicion';

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-edicion', mode);
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    var night = mode === 'noche';
    btn.setAttribute('aria-pressed', night ? 'true' : 'false');
    btn.setAttribute('aria-label', night ? 'Volver a edición de papel' : 'Activar edición nocturna');
    btn.title = night ? 'Volver a edición de papel' : 'Activar edición nocturna';
  }

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  /**
   * The paper edition stays the default. prefers-color-scheme is honoured only
   * for readers who have never chosen here, so nobody's familiar page changes
   * appearance on them without warning.
   */
  function setupTheme() {
    var btn = document.querySelector('[data-theme-toggle]');
    var saved = storedTheme();
    var mode = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'noche' : 'papel');
    applyTheme(mode);
    if (!btn) return;

    var presses = 0, pressTimer = null, longPress = false, holdTimer = null;

    function setMode(next, dramatic) {
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      if (dramatic && next === 'noche' && !reduceMotion.matches) burnThePaper();
      applyTheme(next);
    }
    function current() { return document.documentElement.getAttribute('data-edicion'); }

    // Plain activation: click, Enter or Space.
    btn.addEventListener('click', function () {
      if (longPress) { longPress = false; return; }   // the hold already handled it
      presses++;
      window.clearTimeout(pressTimer);
      // Short enough that three *deliberate* day/night toggles never add up to
      // the gesture; only an actual rapid triple-click reaches it.
      pressTimer = window.setTimeout(function () { presses = 0; }, 320);
      if (presses >= 3) {                              // rapid triple-click
        presses = 0;
        setMode('noche', true);
        return;
      }
      setMode(current() === 'noche' ? 'papel' : 'noche', false);
    });

    // Long press. pointerdown/up covers mouse, touch and pen in one path.
    btn.addEventListener('pointerdown', function () {
      holdTimer = window.setTimeout(function () {
        longPress = true;
        setMode('noche', true);
      }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () { window.clearTimeout(holdTimer); });
    });
  }

  /**
   * The paper catches at its edges for a moment and the night edition is
   * underneath. Purely an overlay: it never hides, moves or removes content,
   * never touches scrolling, and removes itself when the animation ends.
   */
  function burnThePaper() {
    if (document.querySelector('.burn')) return;
    var el = document.createElement('div');
    el.className = 'burn';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    var done = false;
    function clean() { if (done) return; done = true; el.remove(); }
    el.addEventListener('animationend', clean);
    window.setTimeout(clean, 1600);       // never outlive its welcome
  }

  // ------------------------------------------------------------ folio easter
  var FOLIO_SHAPES = [
    'M2 14a4 4 0 108 0 4 4 0 10-8 0M14 14a4 4 0 108 0 4 4 0 10-8 0M6 14l4-7h5l3 7M10 7h4',      // bicycle
    'M1 17l7-10 4 5 3-4 8 9z',                                                                   // andes
    'M12 2l2 8 8 3-8 1-2 8-2-8-8-1 8-3z',                                                        // star
    'M2 13l9-3 3-8 2 8 6 3-6 2-2 7-3-7z',                                                        // airplane-ish
    'M12 21c6-3 8-8 8-13-6 0-9 3-9 7 0 3 0 4 1 6M12 21c-1-4-3-6-6-7'                             // leaf
  ];

  /**
   * Somebody shook the newspaper and a few drawings fell out. A handful of
   * engraved shapes, in the publication's own ink, that drift down once and
   * delete themselves. Never interactive, never scroll-affecting.
   */
  function dropTheDrawings() {
    if (reduceMotion.matches || document.querySelector('.folio-drop')) return;
    var layer = document.createElement('div');
    layer.className = 'folio-drop';
    layer.setAttribute('aria-hidden', 'true');
    var n = 14;
    for (var i = 0; i < n; i++) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'folio-drop__item');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', FOLIO_SHAPES[i % FOLIO_SHAPES.length]);
      svg.appendChild(path);
      svg.style.left = (4 + Math.random() * 92) + '%';
      svg.style.setProperty('--d', (Math.random() * 0.5).toFixed(2) + 's');
      svg.style.setProperty('--r', (Math.random() * 120 - 60).toFixed(0) + 'deg');
      svg.style.setProperty('--s', (0.7 + Math.random() * 0.6).toFixed(2));
      layer.appendChild(svg);
    }
    document.body.appendChild(layer);
    window.setTimeout(function () { layer.remove(); }, 2600);
  }

  function setupFolio() {
    var folio = document.querySelector('[data-folio]');
    if (!folio) return;
    var clicks = 0, timer = null;
    folio.addEventListener('click', function () {
      clicks++;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { clicks = 0; }, 900);
      if (clicks >= 5) { clicks = 0; dropTheDrawings(); }
    });
  }

  /** Runs a setup step; a failure in one must not abort the rest. */
  function safely(name, fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn('[relatos] ' + name + ' failed:', e);
    }
  }

  function init() {
    safely('theme', setupTheme);
    safely('consent', setupConsent);
    safely('readState', setupReadState);
    safely('clearOnly', setupClearOnly);
    safely('reveal', setupReveal);
    safely('readingEvents', setupReadingEvents);
    safely('mediaEvents', setupMediaEvents);
    safely('carta', setupCarta);
    safely('folio', setupFolio);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
