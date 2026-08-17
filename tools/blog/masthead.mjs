/**
 * The nameplate vignette: Santiago drawn in code.
 *
 * This replaces the raster banner. A bitmap forced an impossible choice —
 * either it did not span the publication on a desktop, or its outer artwork
 * was cropped away on a phone — and every fix was another object-fit
 * compromise. Geometry has no such problem: it is redrawn at whatever size
 * the page happens to be.
 *
 * There are two compositions, not one scaled composition. A 10:1 panorama
 * squeezed into a phone is unreadable however you scale it, so the narrow
 * version is *recomposed*: fewer peaks, a tighter skyline, the bicycle
 * dropped. Each has a viewBox matching its own proportions, so neither is
 * ever cropped or stretched.
 *
 * The publication's name is NOT in here. It stays real HTML text in the h1,
 * set in the display face, sitting above this band — searchable, selectable,
 * and translatable. This is the engraved vignette beneath it.
 *
 * Palette: four tones, all existing publication variables, so the drawing
 * belongs to the paper rather than sitting on top of it.
 */

/** A four-pointed engraver's star, for the hidden night sky. */
function star(x, y, r = 3.4) {
  // Unary plus is load-bearing: toFixed returns a string, and `x + a` would
  // then concatenate rather than add — 236 + "1.0" is "2361.0", which drew
  // each star as a wireframe stretched across the whole masthead.
  const a = +(r * 0.28).toFixed(1);
  return `<path d="M${x},${y - r} L${x + a},${y - a} L${x + r},${y} L${x + a},${y + a} L${x},${y + r} L${x - a},${y + a} L${x - r},${y} L${x - a},${y - a} Z"/>`;
}

/** A lit window. Warm, small, and the first thing to go dark at night. */
function light(x, y) {
  return `<rect x="${x}" y="${y}" width="2" height="2"/>`;
}

/** rect helper — the skyline is deliberately blocky, drawn on the pixel grid. */
function block(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
}

// ---------------------------------------------------------------- wide

// Four dominant summits carry the rhythm — 138, 330, 690, 1108 — with lesser
// ones between. An evenly spaced zigzag reads as decoration; a range does not.
const WIDE_FAR = 'M0,70 L48,52 L92,62 L138,26 L182,58 L214,46 L262,68 L330,18 L392,56 L430,48 L472,66 L540,36 L588,60 L640,50 L690,14 L742,54 L790,44 L838,64 L900,32 L952,58 L1000,48 L1052,68 L1108,28 L1156,56 L1200,44 L1200,88 L0,88 Z';
// The near range is a low band, not a slab: paper still shows beneath it.
const WIDE_NEAR = 'M0,82 L64,70 L120,80 L188,64 L252,78 L316,68 L386,82 L452,66 L520,80 L590,70 L654,82 L722,64 L790,78 L856,70 L922,82 L988,66 L1054,80 L1120,72 L1200,82 L1200,88 L0,88 Z';

// Low and sparse, in three clusters with paper between them. They exist to
// give the tower something to be tall against, nothing more.
const WIDE_BLOCKS = [
  [286, 80, 9, 8], [298, 76, 10, 12], [311, 82, 8, 6],
  [604, 81, 8, 7], [615, 77, 9, 11], [627, 83, 7, 5],
  [700, 79, 9, 9], [712, 83, 8, 5], [723, 76, 9, 12],
  [906, 81, 8, 7], [917, 77, 9, 11], [929, 82, 8, 6],
];

const WIDE_LIGHTS = [[301, 79], [618, 80], [726, 79], [920, 80], [681, 46], [681, 60], [681, 74]];
const WIDE_STARS = [[236, 22], [408, 14], [560, 26], [772, 18], [880, 30], [1012, 16], [1160, 26]];

// Gran Torre Santiago: 300m of glass, so it has to read as slender against
// a low skyline, not as a chimney.
const WIDE_TORRE = `<path d="M672,88 L673,38 L677,31 L687,31 L691,38 L692,88 Z"/><path class="np__mast" d="M682,31 L682,20"/>`;

const WIDE_PALM = `<path d="M96,88 C97,74 93,62 88,54"/><path d="M88,54 C78,50 66,53 60,62 C68,57 78,55 88,56"/><path d="M88,54 C82,44 72,38 62,38 C71,42 79,49 87,57"/><path d="M88,54 C90,43 87,33 80,27 C84,36 86,45 87,55"/><path d="M88,54 C97,45 109,42 118,45 C108,46 98,51 90,58"/><path d="M88,54 C98,52 110,55 116,63 C107,57 97,55 88,57"/>`;

const WIDE_BICI = `<circle cx="1092" cy="81" r="6"/><circle cx="1114" cy="81" r="6"/><path d="M1092,81 L1100,69 L1112,69 L1114,81 M1100,69 L1106,81 M1112,69 L1117,64 L1122,63"/>`;

// -------------------------------------------------------------- narrow

// Three summits instead of a dozen: at 390px the wide range would collapse
// into noise, so the phone gets its own drawing rather than a shrunk one.
const NARROW_FAR = 'M0,52 L40,34 L74,44 L118,14 L158,42 L196,30 L238,50 L286,16 L330,44 L368,32 L400,48 L420,38 L420,72 L0,72 Z';
const NARROW_NEAR = 'M0,66 L48,56 L96,64 L148,50 L198,62 L248,54 L300,66 L352,56 L400,64 L420,58 L420,72 L0,72 Z';

const NARROW_BLOCKS = [
  [196, 65, 7, 7], [206, 62, 8, 10], [217, 67, 6, 5],
  [268, 64, 7, 8], [278, 67, 7, 5], [288, 61, 8, 11],
];
const NARROW_LIGHTS = [[209, 64], [291, 63], [271, 66], [246, 40], [246, 52]];
const NARROW_STARS = [[74, 14], [152, 8], [222, 16], [318, 10], [386, 20]];

const NARROW_TORRE = `<path d="M242,72 L243,32 L246,26 L253,26 L256,32 L257,72 Z"/><path class="np__mast" d="M249,26 L249,17"/>`;

const NARROW_PALM = `<path d="M42,72 C43,62 40,53 36,47"/><path d="M36,47 C28,44 19,46 14,53 C21,49 29,47 36,49"/><path d="M36,47 C31,39 23,34 15,34 C22,38 29,43 35,50"/><path d="M36,47 C38,38 35,30 29,25 C33,33 35,40 35,48"/><path d="M36,47 C44,40 54,38 61,41 C53,41 44,45 38,51"/>`;

/**
 * @param {'wide'|'narrow'} kind
 * Both variants ship in the markup and CSS shows one; the geometry is a few
 * hundred bytes, far less than a second network round trip would cost.
 */
function scene(kind) {
  const wide = kind === 'wide';
  const box = wide ? '0 0 1200 96' : '0 0 420 78';
  const far = wide ? WIDE_FAR : NARROW_FAR;
  const near = wide ? WIDE_NEAR : NARROW_NEAR;
  const blocks = (wide ? WIDE_BLOCKS : NARROW_BLOCKS).map((b) => block(...b)).join('');
  const lights = (wide ? WIDE_LIGHTS : NARROW_LIGHTS).map((l) => light(...l)).join('');
  const stars = (wide ? WIDE_STARS : NARROW_STARS).map((s) => star(...s)).join('');
  const torre = wide ? WIDE_TORRE : NARROW_TORRE;
  const palm = wide ? WIDE_PALM : NARROW_PALM;
  const bici = wide ? WIDE_BICI : '';           // recomposed out of the phone
  const coords = wide ? [600, 22] : [210, 28];

  return `<svg class="np__scene np__scene--${kind}" viewBox="${box}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
<g class="np__stars">${stars}</g>
<path class="np__ridge np__ridge--far" d="${far}"/>
<path class="np__ridge np__ridge--near" d="${near}"/>
<g class="np__city" shape-rendering="crispEdges">${blocks}</g>
<g class="np__torre" data-torre>${torre}</g>
<g class="np__lights" shape-rendering="crispEdges">${lights}</g>
<g class="np__palm">${palm}</g>
${bici ? `<g class="np__bici">${bici}</g>` : ''}
<text class="np__coords" x="${coords[0]}" y="${coords[1]}" text-anchor="middle">33°27′S · 70°40′W</text>
</svg>`;
}

/** The full vignette band: both compositions, one shown at a time by CSS. */
export function nameplateScene() {
  return `<div class="np">${scene('wide')}${scene('narrow')}</div>`;
}
