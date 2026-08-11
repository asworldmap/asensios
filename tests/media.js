// Ported from the visual-phase dev workspace, retargeted at the real ES
// modules (src/lib/media.js, src/lib/cinema.js) instead of the flat-file
// source it was originally written against. Same behaviour, same coverage
// technique: a minimal DOM/video shim, no browser required.
import { initMedia } from '../src/lib/media.js';
import { createCinema, drawCover } from '../src/lib/cinema.js';

let n = 0,
  f = 0;
const ok = (c, m) => {
  n++;
  if (!c) {
    f++;
    console.log('  x ' + m);
  }
};
const close = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/* ------------------------------------------------------------ DOM mínimo */
function makeDoc(figs) {
  function el(tag, parent, classes) {
    const o = {
      tag,
      parent: parent || null,
      children: [],
      _at: {},
      _cls: new Set(classes || []),
      _ev: {},
      complete: false,
      naturalWidth: 1,
      classList: {
        add: (c) => o._cls.add(c),
        remove: (c) => o._cls.delete(c),
        contains: (c) => o._cls.has(c),
      },
      getAttribute: (k) => (k in o._at ? o._at[k] : null),
      setAttribute: (k, v) => {
        o._at[k] = v;
      },
      removeAttribute: (k) => {
        delete o._at[k];
      },
      addEventListener: (k, fn) => {
        (o._ev[k] = o._ev[k] || []).push(fn);
      },
      fire: (k) =>
        (o._ev[k] || []).slice().forEach((fn) => fn()),
      querySelector: (sel) => o.children.find((c) => c.tag === sel.replace(/^.*\s/, '')) || null,
      closest: (sel) => {
        const want = sel.split(',').map((x) => x.trim().replace(/^\./, ''));
        let p = o.parent;
        while (p) {
          if (want.some((w) => p._cls.has(w))) return p;
          p = p.parent;
        }
        return null;
      },
      get parentNode() {
        return (
          o.parent && {
            removeChild: (c) => {
              o.parent.children = o.parent.children.filter((x) => x !== c);
              c.parent = null;
            },
          }
        );
      },
    };
    if (parent) parent.children.push(o);
    return o;
  }

  const built = figs.map((spec) => {
    const host = el('article', null, [spec.host, 'has-media']);
    const fig = el('figure', host, ['ph']);
    const img = el('img', fig);
    img.setAttribute('src', spec.src);
    if (spec.fallback) img.setAttribute('data-fallback', spec.fallback);
    Object.assign(img, spec.state || {});
    return { host, fig, img };
  });

  return {
    doc: {
      querySelectorAll: (sel) =>
        sel === 'figure.ph' ? built.filter((b) => b.fig.parent).map((b) => b.fig) : [],
    },
    built,
  };
}

const run = (figs) => {
  const { doc, built } = makeDoc(figs);
  initMedia(doc);
  return built;
};

/* 1 · foto presente: no pasa nada */
{
  const [a] = run([{ host: 'chapter', src: '/media/korea-cherry-signpost.webp' }]);
  ok(a.fig.parent !== null, 'con la foto disponible, la figura se queda');
  ok(a.host._cls.has('has-media'), 'el capítulo mantiene has-media');
}

/* 2 · falla y hay respaldo: se cambia el src, la figura sigue */
{
  const [a] = run([
    { host: 'chapter', src: '/media/korea-cherry-signpost.webp', fallback: '/media/fallback.jpg' },
  ]);
  a.img.fire('error');
  ok(a.img.getAttribute('src') === '/media/fallback.jpg', 'al fallar salta al respaldo');
  ok(a.img.getAttribute('data-fallback') === null, 'el respaldo se consume una sola vez');
  ok(a.fig.parent !== null, 'con respaldo, la figura no desaparece');
}

/* 3 · falla también el respaldo: la figura se retira sin dejar hueco */
{
  const [a] = run([
    { host: 'chapter', src: '/media/korea-cherry-signpost.webp', fallback: '/media/fallback.jpg' },
  ]);
  a.img.fire('error');
  a.img.fire('error');
  ok(a.fig.parent === null, 'si el respaldo también falla, la figura se retira');
  ok(
    !a.host._cls.has('has-media') && a.host._cls.has('no-media'),
    'el capítulo vuelve a una sola columna (no-media)'
  );
}

/* 4 · sin respaldo: se retira a la primera */
{
  const [a] = run([{ host: 'chapter', src: '/media/finland-2018.webp' }]);
  a.img.fire('error');
  ok(a.fig.parent === null, 'sin respaldo, la figura se retira a la primera');
  ok(a.host._cls.has('no-media'), 'y el capítulo se marca no-media');
}

/* 5 · el fallo ocurrió antes de que corriera el guion */
{
  const [a] = run([
    { host: 'chapter', src: '/media/finland-2018.webp', state: { complete: true, naturalWidth: 0 } },
  ]);
  ok(a.fig.parent === null, 'un fallo anterior al arranque también se detecta');
}
{
  const [a] = run([
    {
      host: 'chapter',
      src: '/media/korea-cherry-signpost.webp',
      fallback: '/media/fallback.jpg',
      state: { complete: true, naturalWidth: 0 },
    },
  ]);
  ok(a.img.getAttribute('src') === '/media/fallback.jpg', 'y en ese caso también usa el respaldo');
}

/* ------------------------------------------------------------ capa cinemática */
function makeVideoDoc(opts) {
  const made = [];
  return {
    made,
    createElement(tag) {
      const o = {
        tag,
        children: [],
        _ev: {},
        _at: {},
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
        paused: true,
        preload: 'none',
        canPlayType: (t) => ((opts.codecs || []).some((c) => t.indexOf(c) === 0) ? 'probably' : ''),
        setAttribute: (k, v) => {
          o._at[k] = v;
        },
        addEventListener: (k, fn) => {
          (o._ev[k] = o._ev[k] || []).push(fn);
        },
        appendChild: (c) => o.children.push(c),
        fire: (k) => (o._ev[k] || []).slice().forEach((fn) => fn()),
        load: () => {
          o.loaded = (o.loaded || 0) + 1;
        },
        play: () => {
          o.paused = false;
          return Promise.resolve();
        },
      };
      made.push(o);
      return o;
    },
  };
}

const WEBM = ['video/webm'];

/* reduced-motion: ni se crea el elemento */
{
  const doc = makeVideoDoc({ codecs: WEBM });
  const { cinema, primeCinema } = createCinema({ doc, reduced: () => true });
  const st = cinema('earth-limb');
  ok(st.dead && !st.el, 'con prefers-reduced-motion no se crea ningún vídeo');
  primeCinema('earth-limb');
  ok(doc.made.length === 0, 'y no se pide ni un byte');
}

/* sin códec compatible: tampoco */
{
  const doc = makeVideoDoc({ codecs: [] });
  const { cinema } = createCinema({ doc, reduced: () => false });
  ok(cinema('earth-limb').dead, 'sin códec compatible queda marcado como muerto');
}

/* con webm: se prepara pero no descarga hasta prime() */
{
  const doc = makeVideoDoc({ codecs: WEBM });
  const { cinema, primeCinema, cinemaFrame } = createCinema({ doc, reduced: () => false });
  const st = cinema('earth-limb');
  ok(!st.dead && !!st.el, 'con webm se prepara el elemento');
  ok(st.el.preload === 'none', "preload='none': no descarga al cargar la página");
  ok(
    st.el.children.length === 1 && /earth-limb\.webm$/.test(st.el.children[0].src),
    'una sola fuente webm, con la ruta correcta'
  );
  ok(cinemaFrame('earth-limb') === null, 'sin fotograma listo no devuelve nada');

  primeCinema('earth-limb');
  ok(st.el.preload === 'auto' && st.el.loaded === 1, 'prime() sí lanza la descarga');
  primeCinema('earth-limb');
  ok(st.el.loaded === 1, 'prime() es idempotente: no vuelve a pedirlo');
}

/* los dos códecs → dos fuentes, webm primero */
{
  const doc = makeVideoDoc({ codecs: ['video/webm', 'video/mp4'] });
  const { cinema } = createCinema({ doc, reduced: () => false });
  const st = cinema('pacific-andes');
  ok(st.el.children.length === 2, 'con ambos códecs se declaran dos fuentes');
  ok(
    /\.webm$/.test(st.el.children[0].src) && /\.mp4$/.test(st.el.children[1].src),
    'webm primero, mp4 de respaldo'
  );
}

/* el archivo no existe: error → muerto, y nunca más se intenta pintar */
{
  const doc = makeVideoDoc({ codecs: WEBM });
  const { cinema, primeCinema, cinemaFrame } = createCinema({ doc, reduced: () => false });
  const st = cinema('earth-limb');
  primeCinema('earth-limb');
  st.el.fire('canplay');
  st.el.readyState = 4;
  st.el.videoWidth = 1920;
  st.el.videoHeight = 1080;
  ok(cinemaFrame('earth-limb') === st.el, 'con fotograma listo sí devuelve el vídeo');
  ok(st.el.paused === false, 'y lo pone en marcha');
  st.el.fire('error');
  ok(st.dead && cinemaFrame('earth-limb') === null, 'tras un error queda muerto para siempre');
}

/* canplay pero sin dimensiones: no se pinta */
{
  const doc = makeVideoDoc({ codecs: WEBM });
  const { cinema, cinemaFrame } = createCinema({ doc, reduced: () => false });
  const st = cinema('earth-limb');
  st.el.fire('canplay');
  st.el.readyState = 4;
  st.el.videoWidth = 0;
  ok(cinemaFrame('earth-limb') === null, 'sin dimensiones no se intenta pintar');
}

/* drawCover: cubre y centra, como object-fit: cover */
{
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args.slice(1)) };

  drawCover(ctx, { videoWidth: 1920, videoHeight: 1080 }, 0, 0, 400, 400);
  let [x, y, w, h] = calls.pop();
  ok(w >= 400 - 1e-9 && h >= 400 - 1e-9, 'cubre el destino por completo');
  ok(close(x + w / 2, 200) && close(y + h / 2, 200), 'queda centrado en el destino');
  ok(close(w / h, 1920 / 1080, 1e-9), 'conserva la proporción del vídeo');

  drawCover(ctx, { videoWidth: 1080, videoHeight: 1080 }, 100, 50, 300, 600);
  [x, y, w, h] = calls.pop();
  ok(w >= 300 - 1e-9 && h >= 600 - 1e-9, 'también cubre un destino vertical');
  ok(close(x + w / 2, 250) && close(y + h / 2, 350), 'y sigue centrado');

  drawCover(ctx, { videoWidth: 0, videoHeight: 0 }, 0, 0, 10, 10);
  ok(calls.length === 0, 'un vídeo sin dimensiones no dibuja nada');
}

console.log('\n  imagen y cinemática: ' + (n - f) + '/' + n + ' correctas');
process.exit(f ? 1 : 0);
