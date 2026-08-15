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
  function setupReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });

    // Failsafe. These elements start at opacity 0, so anything the observer
    // fails to reach stays invisible — a blank page is a far worse outcome
    // than a missed animation. If a callback has not arrived by now, show
    // everything and stop observing.
    window.setTimeout(function () {
      items.forEach(function (el) {
        if (!el.classList.contains('is-in')) { el.classList.add('is-in'); io.unobserve(el); }
      });
    }, 2500);
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

  function init() {
    setupConsent();
    setupReadState();
    setupClearOnly();
    setupReveal();
    setupReadingEvents();
    setupMediaEvents();
    setupCarta();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
