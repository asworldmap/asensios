import './styles/tokens.css';
import './styles/playroom.css';
import './styles/cinematic.css';
import { initReveal } from './lib/reveal.js';
import { initTheme } from './lib/theme.js';
import { initArrival } from './lib/motion.js';

initTheme();
initArrival();
initReveal();

// The games themselves are not mounted in this iteration. The slots exist in
// the markup with their data-game hooks, so restoring one means importing its
// module, mounting it into the slot and marking the item ready:
//
//   const slot = document.querySelector('[data-game="fruit-dash"]');
//   createFruitDash(slot).mount();
//   slot.classList.add('is-ready');
//
// src/games/fruit-dash.js and src/games/fruit-catch.js are already in the
// repo, untouched, waiting for that.
