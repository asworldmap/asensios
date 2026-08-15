#!/usr/bin/env node
/**
 * Relatos desde Santiago — the printing press.
 *
 * Reads Markdown + YAML frontmatter from content/ and writes a complete
 * static site to blog-dist/. Nothing executes at request time.
 *
 *   node tools/blog/build.mjs [--drafts]
 *
 * Everything a reader can reach is produced here: story pages, the front
 * page, section pages, the archive, sitemap, RSS, Open Graph, canonicals.
 * Author-facing artifacts (WhatsApp copy, manifest) are written to
 * blog-artifacts/ so they never reach the public web root.
 */
import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CONTENT = join(ROOT, 'content');
const THEME = join(HERE, 'theme');
const OUT = join(ROOT, 'blog-dist');
const ARTIFACTS = join(ROOT, 'blog-artifacts');

export const SITE = {
  name: 'Relatos desde Santiago',
  tagline: 'Cuaderno de seis meses en Santiago de Chile.',
  origin: 'https://blog.asensios.com',
  author: 'Asensio Sabater',
  // The author's own site. Referenced once, quietly, in the colophon of each
  // story — never as a banner, a button or a repeated call to action.
  homepage: 'https://asensios.com/',
  lang: 'es',
  whatsappChannel: 'https://whatsapp.com/channel/0029Vb9813y7tkj1bIgcId3n',
  utm: { source: 'whatsapp', medium: 'channel', campaign: 'relatos_santiago' },
};

/** Section registry. Order here is the editorial order on the front page. */
export const SECTIONS = [
  { id: 'cronicas', label: 'Crónicas', dir: 'relatos', blurb: 'Relatos largos' },
  { id: 'postales', label: 'Postales', dir: 'postales', blurb: 'Una imagen y poco más' },
  { id: 'despachos', label: 'Despachos', dir: 'despachos', blurb: 'Notas breves' },
  { id: 'en-movimiento', label: 'En movimiento', dir: 'momentos', blurb: 'Vídeo corto' },
];

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Content-hashed asset filenames, filled in by copyTheme() before any page is
 * rendered.
 *
 * These MUST stay fingerprinted. Caddy serves /assets/* with
 * `Cache-Control: immutable`, which tells browsers never to revalidate — so
 * with a stable filename like /assets/style.css, any response a browser once
 * cached for that URL is pinned for the full max-age and a reload will not
 * dislodge it. A single bad response (an error page served in place of the
 * stylesheet, a truncated transfer) therefore leaves that device unstyled
 * with no way for the reader to recover, and no CSS change reaches anyone who
 * has already visited. Hashing the name makes every edit a new URL, so the
 * cache is always correct and always bypassed exactly when it should be.
 */
const ASSETS = { css: '/assets/style.css', js: '/assets/site.js' };

/**
 * Inline favicon, so the browser's automatic /favicon.ico request stops
 * 404-ing without adding a file or a round trip. Paper ground, red rule —
 * the publication's two colours at 16 pixels.
 */
const FAVICON = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" fill="#f4f0e6"/>' +
  '<rect x="6" y="7" width="20" height="2.4" fill="#16140f"/>' +
  '<rect x="6" y="14" width="20" height="1.4" fill="#8a342f"/>' +
  '<rect x="6" y="19" width="14" height="1.4" fill="#8a342f"/>' +
  '<rect x="6" y="24" width="20" height="1.4" fill="#8a342f"/>' +
  '</svg>'
);

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtDate = (d) => `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const fmtShort = (d) => `${MONTHS[d.getUTCMonth()].slice(0, 3)}. ${d.getUTCFullYear()}`;
const isoDate = (d) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function parseDoc(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing YAML frontmatter block`);
  let data;
  try {
    data = yaml.load(m[1]) || {};
  } catch (err) {
    throw new Error(`${file}: invalid frontmatter — ${err.message}`);
  }
  return { data, body: m[2] };
}

const REQUIRED = ['title', 'slug', 'date'];

function validate(entry, file) {
  for (const key of REQUIRED) {
    if (!entry[key]) throw new Error(`${file}: frontmatter field "${key}" is required`);
  }
  if (Number.isNaN(entry.date.getTime())) throw new Error(`${file}: "date" is not a valid date`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.slug)) {
    throw new Error(`${file}: "slug" must be lowercase letters, digits and hyphens`);
  }
}

// ---------------------------------------------------------------------------
// Intrinsic image dimensions — read from the file header, no dependency.
// Prevents layout shift without pulling in an image library.
// ---------------------------------------------------------------------------

async function imageSize(absPath) {
  if (!existsSync(absPath)) return null;
  let buf;
  try {
    buf = await readFile(absPath);
  } catch { return null; }
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // WebP (VP8X / VP8 / VP8L)
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  // JPEG — walk the segment markers to the frame header, and along the way
  // read the EXIF Orientation tag from APP1 if present. Browsers rotate a
  // JPEG to match Orientation by default (CSS image-orientation: from-image
  // is the standing default), so a photo shot in portrait but stored with
  // landscape byte dimensions — the common case straight off a phone camera
  // — renders taller than it is wide. Reporting the raw frame size would
  // hand the browser a width/height pair swapped from what actually paints,
  // reintroducing the very layout shift this function exists to prevent.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    let dims = null;
    let orientation = 1;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xe1 && isExifMarker(buf, i + 4)) {
        orientation = readExifOrientation(buf, i + 10, i + 4 + buf.readUInt16BE(i + 2)) ?? orientation;
      }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        dims = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (dims && orientation !== 1) break;
      i += 2 + buf.readUInt16BE(i + 2);
    }
    if (!dims) return null;
    // 5,6,7,8 are the four orientations that carry a 90°/270° rotation.
    return orientation >= 5 && orientation <= 8 ? { w: dims.h, h: dims.w } : dims;
  }
  return null;
}

/** True at an APP1 payload starting with the 6-byte "Exif" + two zero bytes. */
function isExifMarker(buf, at) {
  return buf.length > at + 6 &&
    buf.toString('ascii', at, at + 4) === 'Exif' &&
    buf[at + 4] === 0 && buf[at + 5] === 0;
}

/** Reads the EXIF Orientation tag (0x0112) from a TIFF block; null if absent. */
function readExifOrientation(buf, tiffStart, segEnd) {
  if (tiffStart + 8 > buf.length) return null;
  const le = buf.toString('ascii', tiffStart, tiffStart + 2) === 'II';
  const read16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const read32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd0 = tiffStart + read32(tiffStart + 4);
  if (ifd0 + 2 > segEnd) return null;
  const count = read16(ifd0);
  for (let e = 0; e < count; e++) {
    const entry = ifd0 + 2 + e * 12;
    if (entry + 12 > segEnd) break;
    if (read16(entry) === 0x0112) return read16(entry + 8);
  }
  return null;
}

/** <picture>/<img> with srcset when sibling variants exist, always with dimensions. */
async function renderImage(src, { alt = '', caption = '', className = '', eager = false } = {}) {
  const abs = join(CONTENT, src.replace(/^\//, ''));
  const dims = await imageSize(abs);
  const base = src.replace(/\.[^.]+$/, '');
  const sources = [];
  for (const [ext, type] of [['avif', 'image/avif'], ['webp', 'image/webp']]) {
    if (existsSync(join(CONTENT, `${base}.${ext}`.replace(/^\//, '')))) {
      sources.push(`<source srcset="${esc(base)}.${ext}" type="${type}">`);
    }
  }
  const attrs = [
    `src="${esc(src)}"`,
    `alt="${esc(alt)}"`,
    'loading="' + (eager ? 'eager' : 'lazy') + '"',
    'decoding="async"',
    dims ? `width="${dims.w}" height="${dims.h}"` : '',
  ].filter(Boolean).join(' ');
  const img = `<img ${attrs}>`;
  const media = sources.length ? `<picture>${sources.join('')}${img}</picture>` : img;
  return `<figure class="figure ${className}">${media}${
    caption ? `<figcaption>${esc(caption)}</figcaption>` : ''
  }</figure>`;
}

async function renderVideo(item) {
  const poster = item.poster ? ` poster="${esc(item.poster)}"` : '';
  return `<figure class="figure figure--video">
  <video controls playsinline preload="none"${poster} class="video video--vertical">
    <source src="${esc(item.src)}" type="${esc(item.mime || 'video/mp4')}">
    Tu navegador no puede reproducir este vídeo.
  </video>
  ${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}
</figure>`;
}

/** Renders each media item once, keeping its optional anchor and size. */
async function renderMediaItems(media = []) {
  const out = [];
  for (const raw of media) {
    const item = typeof raw === 'string' ? { src: raw } : raw;
    if (!item.src) continue;
    const html = /\.(mp4|webm|mov)$/i.test(item.src)
      ? await renderVideo(item)
      : await renderImage(item.src, item);
    out.push({ anchor: item.anchor || null, size: item.size || 'wide', html });
  }
  return out;
}

async function renderMediaList(media = []) {
  return (await renderMediaItems(media)).map((i) => i.html).join('\n');
}

const ANCHOR_RE = /<p>\s*\[\[([a-z0-9_-]+)\]\]\s*<\/p>/gi;

/**
 * Lets the author drop `[[nombre]]` on its own line in the Markdown and have
 * the media item with that `anchor` land exactly there — so a photograph can
 * carry a beat of the story instead of queueing up at the end. The reserved
 * anchor `[[nota]]` places the frontmatter `note` as a pull quote.
 *
 * An anchor with nothing behind it disappears silently: the piece can be
 * published as text first and gain its photographs later without the
 * placeholders ever showing up on the page.
 */
function placeAnchors(html, items, entry) {
  const used = new Set();
  const placed = html.replace(ANCHOR_RE, (_m, key) => {
    const name = key.toLowerCase();
    if (name === 'nota') {
      used.add(name);
      return entry.note ? `<p class="pull">${esc(entry.note)}</p>` : '';
    }
    const hit = items.find((i) => i.anchor === name);
    if (!hit) return '';
    used.add(name);
    return `<div class="plate plate--${esc(hit.size)}" data-plate="${esc(name)}">${hit.html}</div>`;
  });
  return {
    html: placed,
    rest: items.filter((i) => !i.anchor || !used.has(i.anchor)),
    notePlaced: used.has('nota'),
  };
}

/**
 * A referenced photograph that isn't in the repository would ship as a broken
 * image, so it fails the build instead. Drafts are exempt: a piece can be
 * written before its media arrives.
 */
function assertMediaPresent(entry) {
  const refs = [];
  if (entry.cover) refs.push(entry.cover);
  for (const raw of entry.media || []) {
    const item = typeof raw === 'string' ? { src: raw } : raw;
    if (item.src) refs.push(item.src);
    if (item.poster) refs.push(item.poster);
  }
  const missing = refs
    .filter((r) => typeof r === 'string' && r.startsWith('/media/'))
    .filter((r) => !existsSync(join(CONTENT, r.replace(/^\//, ''))));
  if (missing.length) {
    throw new Error(
      `${entry.sourceFile}: media referenced but not found in content/ — ${missing.join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Load content
// ---------------------------------------------------------------------------

async function loadSection(section, includeDrafts) {
  const dir = join(CONTENT, section.dir);
  if (!existsSync(dir)) return [];
  // README.md and _-prefixed files are notes to the author, not content.
  const files = (await readdir(dir))
    .filter((f) => f.endsWith('.md') && f !== 'README.md' && !f.startsWith('_'));
  const entries = [];
  for (const file of files.sort()) {
    const abs = join(dir, file);
    const { data, body } = parseDoc(await readFile(abs, 'utf8'), relative(ROOT, abs));
    const entry = {
      ...data,
      date: new Date(data.date),
      section: data.section || section.id,
      type: data.type || 'cronica',
      dir: section.dir,
      body,
      sourceFile: relative(ROOT, abs),
    };
    validate(entry, entry.sourceFile);
    if (entry.draft && !includeDrafts) continue;
    if (!entry.draft) assertMediaPresent(entry);
    entry.url = `/${section.dir}/${entry.slug}.html`;
    entry.absoluteUrl = SITE.origin + entry.url;
    entries.push(entry);
  }
  return entries;
}

async function loadAll(includeDrafts) {
  const all = [];
  for (const section of SECTIONS) all.push(...await loadSection(section, includeDrafts));
  all.sort((a, b) => b.date - a.date || String(b.slug).localeCompare(String(a.slug)));
  // Prev/next runs across the whole publication in chronological order, so
  // the reader can walk the story of the stay rather than one silo.
  const chrono = [...all].sort((a, b) => a.date - b.date || String(a.slug).localeCompare(String(b.slug)));
  chrono.forEach((e, i) => {
    e.number = String(i + 1).padStart(3, '0');
    e.prev = chrono[i - 1] || null;
    e.next = chrono[i + 1] || null;
  });
  return all;
}

async function loadSocial() {
  const file = join(CONTENT, 'social', 'instagram.json');
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items.filter((i) => !i.draft) : [];
  } catch (err) {
    console.warn(`  ! content/social/instagram.json ignored — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function whatsappUrl(entry) {
  const u = new URL(entry.absoluteUrl);
  u.searchParams.set('utm_source', SITE.utm.source);
  u.searchParams.set('utm_medium', SITE.utm.medium);
  u.searchParams.set('utm_campaign', SITE.utm.campaign);
  u.searchParams.set('utm_content', `${entry.dir.replace(/s$/, '')}_${entry.number}`);
  return u.toString();
}

function head({ title, description, canonical, ogType = 'article', image, bodyClass = '' }) {
  const img = image ? `\n<meta property="og:image" content="${esc(SITE.origin + image)}">` : '';
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="data:image/svg+xml,${FAVICON}">
<link rel="stylesheet" href="${ASSETS.css}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="/feed.xml">
<script defer src="${ASSETS.js}"></script>
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="es_ES">${img}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
</head>
<body${bodyClass ? ` class="${esc(bodyClass)}"` : ''}>
<a class="skip-link" href="#contenido">Saltar al contenido</a>`;
}

function masthead({ compact = false, edition = '' } = {}) {
  const tag = compact ? 'p' : 'h1';
  return `<header class="masthead ${compact ? 'masthead--compact' : ''}">
  <nav class="utility" aria-label="Secciones">
    <ul>
      <li><a href="/">Portada</a></li>
      <li><a href="/archivo.html">Archivo</a></li>
      <li><a href="/#sobre">Quién escribe</a></li>
      <li><a href="/#whatsapp">WhatsApp</a></li>
    </ul>
    <p class="utility__note">Santiago de Chile</p>
  </nav>
  <div class="masthead__brand">
    <${tag} class="wordmark"><a href="/">Relatos<span class="wordmark__break"> </span>desde Santiago</a></${tag}>
    <p class="wordmark__sub">${esc(SITE.tagline)}</p>
  </div>
  ${edition ? `<p class="edition">${edition}</p>` : ''}
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <p class="site-footer__id"><strong>${esc(SITE.name)}</strong> · <a href="${esc(SITE.homepage)}">${esc(SITE.author)} · asensios.com</a></p>
  <p>Publicación personal. Las opiniones son mías; ninguna institución ni empleador responde por ellas.</p>
  <p class="site-footer__links"><a href="/archivo.html">Archivo</a> · <a href="/feed.xml">RSS</a></p>
</footer>
<div class="consent" role="dialog" aria-live="polite" aria-label="Analítica" hidden>
  <p>Uso analítica para saber qué se lee. Sin publicidad ni perfiles.</p>
  <div class="consent__actions">
    <button type="button" class="btn btn--primary" data-accept>De acuerdo</button>
    <button type="button" class="btn" data-decline>Mejor no</button>
  </div>
</div>
</body>
</html>`;
}

/**
 * Inserts a pull quote after roughly the first third of a story's paragraphs.
 * Splits on the closing tag while keeping it, so the surrounding markup is
 * returned byte-for-byte apart from the inserted block.
 */
function breakWithPull(html, note) {
  const paras = html.match(/<p>[\s\S]*?<\/p>/g);
  if (!paras || paras.length < 4) return html;
  const target = paras[Math.max(1, Math.round(paras.length / 3))];
  return html.replace(target, `${target}\n<p class="pull">${esc(note)}</p>`);
}

/** Body renderers per editorial type — composable, one shared shell. */
async function storyBody(entry, html) {
  const items = entry.media?.length ? await renderMediaItems(entry.media) : [];
  const gallery = items.map((i) => i.html).join('\n');
  const note = entry.note
    ? `<aside class="side-column"><div class="margin-note">${esc(entry.note)}</div></aside>`
    : '';
  switch (entry.type) {
    // A crónica where the photographs carry as much of the story as the
    // paragraphs: one column, text held at reading measure, images allowed to
    // break wider and land on the beat the author chose with [[anclajes]].
    case 'cronica-visual': {
      const { html: placed, rest, notePlaced } = placeAnchors(html, items, entry);
      return `<section class="story-body story-body--abierta">
        <div class="prose prose--wide">${placed}</div>
        ${!notePlaced && entry.note ? `<p class="pull">${esc(entry.note)}</p>` : ''}
        ${rest.length ? `<div class="gallery gallery--inline">${rest.map((i) => i.html).join('\n')}</div>` : ''}
      </section>`;
    }
    case 'postal':
    case 'fotoensayo':
      return `<section class="story-body story-body--visual">
        <div class="gallery">${gallery}</div>
        <div class="prose prose--short">${html}</div>
      </section>`;
    case 'momento':
      return `<section class="story-body story-body--movement">
        <div class="movement">${gallery}</div>
        <div class="prose prose--short">${html}</div>
      </section>`;
    case 'despacho':
      return `<section class="story-body story-body--dispatch">
        <div class="prose">${html}</div>
        ${gallery ? `<div class="gallery gallery--inline">${gallery}</div>` : ''}
      </section>`;
    default: {
      // With photographs, the note sits in the margin as usual. Without them,
      // it is promoted into the column as a pull quote — a story carried by
      // text alone still needs somewhere for the eye to rest.
      if (!gallery && entry.note) {
        return `<section class="story-body story-body--texto">
          <article class="prose prose--wide">${breakWithPull(html, entry.note)}</article>
        </section>`;
      }
      return `<section class="story-body">
        <article class="prose">${html}${gallery ? `<div class="gallery gallery--inline">${gallery}</div>` : ''}</article>
        ${note}
      </section>`;
    }
  }
}

/**
 * Editorial accent colours. A story names one in frontmatter and the whole
 * page borrows it: eyebrow, rules, drop cap, pull quote, links, caption marks.
 * The paper, the type and the furniture never change — same newspaper, a
 * different mood on the page. Anything not in this set is ignored.
 */
const ACCENTS = new Set(['wine', 'verde', 'cobalto', 'ocre', 'terracota']);

async function storyPage(entry) {
  const html = marked.parse(entry.body);
  const label = SECTIONS.find((s) => s.id === entry.section)?.label || 'Relato';
  const accent = ACCENTS.has(entry.accent) ? `accent-${entry.accent}` : '';
  const cover = entry.cover
    ? await renderImage(entry.cover, { alt: entry.coverAlt || entry.title, className: 'figure--cover', eager: true })
    : '';
  const nav = `<nav class="story-nav" aria-label="Navegación entre relatos">
    <div>${entry.prev ? `<a href="${entry.prev.url}"><span>← Anterior</span><b>${esc(entry.prev.title)}</b></a>` : ''}</div>
    <div class="story-nav__next">${entry.next ? `<a href="${entry.next.url}"><span>Siguiente →</span><b>${esc(entry.next.title)}</b></a>` : ''}</div>
  </nav>`;

  return `${head({
    title: `${entry.title} — ${SITE.name}`,
    description: entry.summary || SITE.tagline,
    canonical: entry.absoluteUrl,
    image: entry.cover,
    bodyClass: accent,
  })}
${masthead({ compact: true })}
<main id="contenido" class="wrap">
  <article class="story" data-relato="${esc(entry.slug)}" data-numero="${entry.number}">
    <header class="story-head reveal">
      <p class="eyebrow"><span class="eyebrow__no">Nº ${entry.number}</span> · ${esc(label)}</p>
      <h1 class="story-title">${esc(entry.title)}</h1>
      ${entry.summary ? `<p class="deck">${esc(entry.summary)}</p>` : ''}
      <p class="story-meta">
        <time datetime="${isoDate(entry.date)}">${fmtDate(entry.date)}</time>
        ${entry.location ? ` · <span>${esc(entry.location)}</span>` : ''}
      </p>
    </header>
    ${cover}
    ${await storyBody(entry, html)}
    <footer class="story-foot">
      <button type="button" class="read-toggle" data-read-toggle aria-pressed="false">
        <span class="read-toggle__mark" aria-hidden="true">○</span>
        <span class="read-toggle__label">Marcar como leído</span>
      </button>
      <p class="story-foot__share">
        <a class="channel-link" data-event="whatsapp_channel_click" href="${esc(SITE.whatsappChannel)}" rel="noopener">
          Avisos por WhatsApp →
        </a>
      </p>
    </footer>
    ${colofon()}
    ${cartaBlock(entry)}
  </article>
  ${nav}
</main>
${footer()}`;
}

/**
 * The only mention of asensios.com anywhere in the publication: one line of
 * italic prose at the foot of a story, phrased as a colophon rather than an
 * advertisement. No button, no banner, no repetition.
 */
function colofon() {
  return `<aside class="colofon">
  <p>${esc(SITE.author)} escribe estos relatos durante seis meses en Santiago. Lo demás que hace está en <a href="${esc(SITE.homepage)}" data-event="home_link_click">asensios.com</a>.</p>
</aside>`;
}

function cartaBlock(entry) {
  if (entry.carta === false) return '';
  return `<section class="carta" id="carta" data-carta>
  <div class="carta__intro">
    <h2>Escríbeme</h2>
    <p>Si esto te ha recordado a algo, cuéntamelo. No se publica en ningún sitio.</p>
  </div>
  <form class="carta__form" data-carta-form novalidate>
    <label for="carta-msg">Mensaje</label>
    <textarea id="carta-msg" name="message" rows="5" required></textarea>
    <label for="carta-name">Nombre <span class="opt">(opcional)</span></label>
    <input id="carta-name" name="name" type="text" autocomplete="name">
    <input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">
    <input type="hidden" name="t" value="">
    <input type="hidden" name="relato" value="${esc(entry.slug)}">
    <button type="submit" class="btn btn--primary">Enviar</button>
    <p class="carta__status" data-carta-status role="status"></p>
  </form>
</section>`;
}

// --- front page -------------------------------------------------------------

/** A story on the front page set as type alone — no image, full measure. */
function bandCard(entry) {
  const label = SECTIONS.find((s) => s.id === entry.section)?.label || '';
  const accent = ACCENTS.has(entry.accent) ? ` accent-${entry.accent}` : '';
  return `<section class="band reveal${accent}">
  <p class="eyebrow"><span class="eyebrow__no">Nº ${entry.number}</span> · ${esc(label)}</p>
  <h2 class="band__title"><a href="${entry.url}">${esc(entry.title)}</a></h2>
  ${entry.summary ? `<p class="band__deck">${esc(entry.summary)}</p>` : ''}
  <p class="band__meta">
    <time datetime="${isoDate(entry.date)}">${fmtDate(entry.date)}</time>
    ${entry.location ? ` · ${esc(entry.location)}` : ''}
  </p>
</section>`;
}

async function frontCard(entry, variant) {
  const label = SECTIONS.find((s) => s.id === entry.section)?.label || '';
  const img = entry.cover
    ? await renderImage(entry.cover, {
      alt: entry.coverAlt || entry.title,
      eager: variant === 'lead',
      className: 'figure--card',
    })
    : '';
  const accent = ACCENTS.has(entry.accent) ? ` accent-${entry.accent}` : '';
  return `<article class="card card--${variant} reveal${accent}">
  ${img}
  <p class="eyebrow"><span class="eyebrow__no">Nº ${entry.number}</span> · ${esc(label)}</p>
  <h3 class="card__title"><a href="${entry.url}">${esc(entry.title)}</a></h3>
  ${entry.summary ? `<p class="card__deck">${esc(entry.summary)}</p>` : ''}
  <p class="card__meta">
    <time datetime="${isoDate(entry.date)}">${fmtShort(entry.date)}</time>
    ${entry.location ? ` · ${esc(entry.location)}` : ''}
  </p>
</article>`;
}

async function meanwhileStrip(moments, social) {
  const items = [
    ...moments.map((m) => ({
      href: m.url, src: m.cover, alt: m.coverAlt || m.title, label: m.title, place: m.location,
    })),
    ...social.map((s) => ({
      href: s.permalink || s.href || '#', src: s.thumbnail, alt: s.alt || s.caption || '',
      label: s.caption, place: s.location, external: !!s.permalink,
    })),
  ].filter((i) => i.src).slice(0, 8);
  if (items.length < 3) return '';
  const cells = [];
  for (const i of items) {
    const fig = await renderImage(i.src, { alt: i.alt, className: 'figure--strip' });
    cells.push(`<li class="strip__item">
      <a href="${esc(i.href)}"${i.external ? ' rel="noopener"' : ''}>
        ${fig}
        ${i.label ? `<span class="strip__label">${esc(i.label)}</span>` : ''}
        ${i.place ? `<span class="strip__place">${esc(i.place)}</span>` : ''}
      </a>
    </li>`);
  }
  return `<section class="strip reveal" aria-labelledby="strip-h">
  <div class="section-head"><h2 id="strip-h">Mientras tanto, en Santiago…</h2></div>
  <ul class="strip__rail">${cells.join('')}</ul>
</section>`;
}

/**
 * Who is writing and why Santiago. Deliberately short and deliberately not a
 * CV: it names no employer, because the point of the publication is the six
 * months, not the job. The disclaimer in the footer does the institutional
 * distancing, so this can stay plain.
 */
function aboutBlock() {
  return `<section class="intro reveal" id="sobre">
  <p class="label">Quién escribe</p>
  <div class="intro__body">
    <p>Soy Asensio Sabater. Durante seis meses vivo en Santiago mientras hago unas prácticas en la Delegación de la Unión Europea en Chile.</p>
    <p>Llegué en julio de 2026 y este archivo irá creciendo hasta que me marche. Aquí guardo lo que ocurre alrededor: trabajo, ciudad, viajes, gente que conozco y alguna historia que dentro de dos años recordaría bastante peor.</p>
    <p>El resto está en <a href="${esc(SITE.homepage)}" data-event="home_link_click">asensios.com</a>.</p>
    <p class="intro__note">Relatos desde Santiago es un proyecto personal y no representa a la Unión Europea ni a la organización en la que trabajo.</p>
  </div>
</section>`;
}

async function frontPage(all, social) {
  // Dated by the newest entry, not by build time: a static archive that
  // claims a new "edition" every time CI runs is lying about itself.
  const latest = all[0];
  const edition = latest
    ? `Nº ${latest.number} · ${fmtDate(latest.date)} · Santiago de Chile`
    : 'Santiago de Chile';
  const featured = all.find((e) => e.featured) || all[0];
  const rest = all.filter((e) => e !== featured);
  const bySection = (id) => rest.filter((e) => e.section === id);

  const lead = featured ? await frontCard(featured, 'lead') : '';
  const secondary = rest[0] ? await frontCard(rest[0], 'secondary') : '';
  const third = rest[1] ? await frontCard(rest[1], 'tertiary') : '';
  // The band is the front page's change of pace: one story set as pure
  // typography at full width, so the eye is not asked to read four
  // identically-weighted cards in a row. A real front page does not give
  // every story the same box.
  const banded = rest[2] || null;

  const railIndex = all.length > 1 ? `<nav class="rail-index" aria-label="Índice">
    <p class="rail-index__head">En este número</p>
    <ol class="rows rows--rail">${all.map((e) => `<li${ACCENTS.has(e.accent) ? ` class="accent-${e.accent}"` : ''}>
      <a href="${e.url}" data-archive-row="${esc(e.slug)}">
        <span class="row__no">${e.number}</span>
        <span class="row__title">${esc(e.title)}</span>
        <span class="row__read" data-read-mark aria-hidden="true">○</span>
      </a></li>`).join('')}</ol>
    <p class="rail-index__more"><a href="/archivo.html">Todo el archivo →</a></p>
  </nav>` : '';

  const blocks = [];
  if (lead || secondary) {
    blocks.push(`<section class="front-lead">${lead}<div class="front-lead__side">${secondary}${third}${railIndex}</div></section>`);
  }
  if (banded) blocks.push(bandCard(banded));

  blocks.push(aboutBlock());
  blocks.push(await meanwhileStrip(bySection('en-movimiento'), social));

  for (const s of SECTIONS.filter((s) => s.id !== 'cronicas')) {
    const items = bySection(s.id).slice(0, 3);
    if (!items.length) continue;
    const cards = [];
    for (const it of items) cards.push(await frontCard(it, s.id === 'despachos' ? 'dispatch' : 'postal'));
    blocks.push(`<section class="section-block reveal" aria-labelledby="s-${s.id}">
      <div class="section-head">
        <h2 id="s-${s.id}"><a href="/secciones/${s.id}.html">${esc(s.label)}</a></h2>
        <p>${esc(s.blurb)}</p>
      </div>
      <div class="section-block__grid section-block__grid--${s.id}">${cards.join('')}</div>
    </section>`);
  }


  blocks.push(`<section class="whatsapp reveal" id="whatsapp">
    <p class="label">Avisos</p>
    <div>
      <h2>Por WhatsApp</h2>
      <p>Cuando publico algo nuevo mando el título y el enlace por el canal. Ya está.</p>
      <a class="channel-link" data-event="whatsapp_channel_click" href="${esc(SITE.whatsappChannel)}" rel="noopener">Abrir el canal ↗</a>
    </div>
  </section>`);

  return `${head({
    title: `${SITE.name} — ${SITE.author}`,
    description: SITE.tagline,
    canonical: `${SITE.origin}/`,
    ogType: 'website',
    image: featured?.cover,
  })}
${masthead({ edition })}
<main id="contenido" class="wrap">
${blocks.filter(Boolean).join('\n')}
</main>
${footer()}`;
}

function archivePage(all) {
  const years = new Map();
  for (const e of all) {
    const y = e.date.getUTCFullYear();
    const m = e.date.getUTCMonth();
    if (!years.has(y)) years.set(y, new Map());
    if (!years.get(y).has(m)) years.get(y).set(m, []);
    years.get(y).get(m).push(e);
  }
  const body = [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, months]) => `
    <section class="archive-year">
      <h2>${year}</h2>
      ${[...months.entries()].sort((a, b) => b[0] - a[0]).map(([m, items]) => `
        <h3 class="archive-month">${MONTHS[m]}</h3>
        <ol class="rows">${items.map((e) => `<li>
          <a href="${e.url}" data-archive-row="${esc(e.slug)}">
            <span class="row__no">${e.number}</span>
            <span class="row__title">${esc(e.title)}</span>
            <span class="row__section">${esc(SECTIONS.find((s) => s.id === e.section)?.label || '')}</span>
            <span class="row__read" data-read-mark aria-hidden="true">○</span>
          </a></li>`).join('')}</ol>`).join('')}
    </section>`).join('');

  return `${head({
    title: `Archivo — ${SITE.name}`,
    description: 'Todo lo publicado, en orden de aparición.',
    canonical: `${SITE.origin}/archivo.html`,
    ogType: 'website',
  })}
${masthead({ compact: true })}
<main id="contenido" class="wrap">
  <div class="page-head">
    <h1>Archivo</h1>
    <p>En orden de aparición. La marca de leído se guarda en tu navegador y no sale de ahí.</p>
    <p><button type="button" class="btn btn--small" data-clear-read>Borrar mis marcas</button></p>
  </div>
  ${body || '<p class="empty">Todavía no hay nada archivado.</p>'}
</main>
${footer()}`;
}

async function sectionPage(section, items) {
  const cards = [];
  for (const e of items) cards.push(await frontCard(e, 'postal'));
  return `${head({
    title: `${section.label} — ${SITE.name}`,
    description: section.blurb,
    canonical: `${SITE.origin}/secciones/${section.id}.html`,
    ogType: 'website',
  })}
${masthead({ compact: true })}
<main id="contenido" class="wrap">
  <div class="page-head">
    <h1>${esc(section.label)}</h1>
    <p>${esc(section.blurb)}</p>
  </div>
  <div class="section-block__grid">${cards.join('')}</div>
</main>
${footer()}`;
}

function notFoundPage() {
  return `${head({
    title: `Página no encontrada — ${SITE.name}`,
    description: 'Página perdida.',
    canonical: `${SITE.origin}/404.html`,
    ogType: 'website',
  }).replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"')}
${masthead({ compact: true })}
<main id="contenido" class="wrap">
  <div class="page-head page-head--404">
    <p class="eyebrow">Error 404</p>
    <h1>Página perdida</h1>
    <p>El enlace puede estar mal copiado, o el relato vivía en otra dirección.</p>
    <p><a class="channel-link" href="/">Ir a la portada →</a></p>
  </div>
</main>
${footer()}`;
}

// --- feeds and machine files ------------------------------------------------

const sitemap = (all) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE.origin}/</loc><lastmod>${isoDate(all[0]?.date || new Date())}</lastmod></url>
  <url><loc>${SITE.origin}/archivo.html</loc><lastmod>${isoDate(all[0]?.date || new Date())}</lastmod></url>
${all.map((e) => `  <url><loc>${e.absoluteUrl}</loc><lastmod>${isoDate(e.date)}</lastmod></url>`).join('\n')}
</urlset>`;

const feed = (all) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.name)}</title>
<link>${SITE.origin}/</link>
<description>${esc(SITE.tagline)}</description>
<language>es</language>
<lastBuildDate>${(all[0]?.date || new Date()).toUTCString()}</lastBuildDate>
${all.slice(0, 30).map((e) => `<item>
  <title>${esc(e.title)}</title>
  <link>${e.absoluteUrl}</link>
  <guid isPermaLink="true">${e.absoluteUrl}</guid>
  <pubDate>${e.date.toUTCString()}</pubDate>
  <description>${esc(e.summary || '')}</description>
</item>`).join('\n')}
</channel></rss>`;

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

function whatsappCopy(all) {
  return all.slice(0, 12).map((e) => {
    const label = e.dir === 'relatos' ? 'Relato' : SECTIONS.find((s) => s.id === e.section)?.label || 'Nota';
    return `🇨🇱 ${label} nº ${e.number}\n\n${e.title}\n\n${e.summary || ''}\n\n${whatsappUrl(e)}`;
  }).join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Asset + media copying
// ---------------------------------------------------------------------------

/** Author notes never reach the public web root. */
const isAuthorNote = (name) => name === 'README.md' || name.startsWith('_') || name === '.gitkeep';

async function copyDir(from, to) {
  if (!existsSync(from)) return 0;
  let n = 0;
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (isAuthorNote(item.name)) continue;
    const src = join(from, item.name);
    const dst = join(to, item.name);
    if (item.isDirectory()) { n += await copyDir(src, dst); continue; }
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
    n++;
  }
  return n;
}

/**
 * Copies the theme into assets/ with content-hashed filenames and records
 * them in ASSETS. Must run before any page is rendered, since head() reads
 * ASSETS. Anything in the theme dir that is not the stylesheet or the script
 * is copied through unchanged.
 */
async function copyTheme() {
  const dest = join(OUT, 'assets');
  await mkdir(dest, { recursive: true });
  const fingerprint = { 'style.css': 'css', 'site.js': 'js' };
  let n = 0;
  for (const item of await readdir(THEME, { withFileTypes: true })) {
    if (isAuthorNote(item.name)) continue;
    if (item.isDirectory()) { n += await copyDir(join(THEME, item.name), join(dest, item.name)); continue; }
    const body = await readFile(join(THEME, item.name));
    const key = fingerprint[item.name];
    if (key) {
      const hash = createHash('sha256').update(body).digest('hex').slice(0, 10);
      const name = item.name.replace(/\.([^.]+)$/, `.${hash}.$1`);
      await writeFile(join(dest, name), body);
      ASSETS[key] = `/assets/${name}`;
    } else {
      await writeFile(join(dest, item.name), body);
    }
    n++;
  }
  return n;
}

/** Self-host fonts from packages already in the dependency tree. */
async function copyFonts() {
  const wanted = [
    ['@fontsource/instrument-serif', /latin-400-(normal|italic)\.woff2$/],
    ['@fontsource/ibm-plex-mono', /latin-(400|600)-normal\.woff2$/],
  ];
  const dest = join(OUT, 'assets', 'fonts');
  let copied = 0;
  for (const [pkg, re] of wanted) {
    const dir = join(ROOT, 'node_modules', pkg, 'files');
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!re.test(f)) continue;
      await mkdir(dest, { recursive: true });
      await copyFile(join(dir, f), join(dest, f));
      copied++;
    }
  }
  return copied;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function build({ drafts = false } = {}) {
  const started = Date.now();
  marked.setOptions({ mangle: false, headerIds: false, breaks: false });

  const all = await loadAll(drafts);
  const social = await loadSocial();

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const write = async (rel, body) => {
    const abs = join(OUT, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);
  };

  // Before any page is rendered: pages reference the hashed asset names.
  const themeFiles = await copyTheme();

  for (const entry of all) await write(entry.url.replace(/^\//, ''), await storyPage(entry));
  await write('index.html', await frontPage(all, social));
  await write('archivo.html', archivePage(all));
  await write('404.html', notFoundPage());

  for (const s of SECTIONS) {
    const items = all.filter((e) => e.section === s.id);
    if (!items.length) continue;
    await write(`secciones/${s.id}.html`, await sectionPage(s, items));
  }

  await write('sitemap.xml', sitemap(all));
  await write('feed.xml', feed(all));
  await write('robots.txt', robots());

  const mediaFiles = await copyDir(join(CONTENT, 'media'), join(OUT, 'media'));
  const fontFiles = await copyFonts();

  // Author-facing artifacts stay OUT of the public web root.
  await mkdir(ARTIFACTS, { recursive: true });
  await writeFile(join(ARTIFACTS, 'whatsapp.txt'), whatsappCopy(all));
  await writeFile(join(ARTIFACTS, 'publicacion.json'), JSON.stringify({
    generated: new Date().toISOString(),
    site: SITE.name,
    origin: SITE.origin,
    total: all.length,
    entries: all.map((e) => ({
      number: e.number, title: e.title, url: e.absoluteUrl, section: e.section,
      type: e.type, date: isoDate(e.date), whatsapp: whatsappUrl(e), source: e.sourceFile,
    })),
  }, null, 2));

  let bytes = 0;
  const walk = async (dir) => {
    for (const it of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, it.name);
      if (it.isDirectory()) await walk(p);
      else bytes += (await stat(p)).size;
    }
  };
  await walk(OUT);

  const bySec = SECTIONS.map((s) => {
    const n = all.filter((e) => e.section === s.id).length;
    return n ? `${s.label}: ${n}` : null;
  }).filter(Boolean).join(', ');

  console.log(`\n  Relatos desde Santiago — build complete`);
  console.log(`  ${all.length} entries (${bySec || 'none'})`);
  console.log(`  theme files: ${themeFiles}, media: ${mediaFiles}, fonts: ${fontFiles}`);
  if (!fontFiles) console.log('  ! fonts not copied (run npm ci) — falling back to system serif');
  console.log(`  output: blog-dist/ — ${(bytes / 1024).toFixed(0)} kB total`);
  console.log(`  artifacts: blog-artifacts/whatsapp.txt, publicacion.json`);
  console.log(`  done in ${Date.now() - started} ms\n`);

  return { all, bytes };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  build({ drafts: process.argv.includes('--drafts') }).catch((err) => {
    console.error(`\n  BUILD FAILED: ${err.message}\n`);
    process.exit(1);
  });
}

export { build, whatsappUrl };
