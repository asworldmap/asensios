import './styles/tokens.css';
import './styles/playroom.css';
import './styles/cinematic.css';
import { initReveal } from './lib/reveal.js';
import { initTheme } from './lib/theme.js';
import { initArrival } from './lib/motion.js';
import { initI18n } from './lib/i18n.js';
import { createFruitDash } from './games/fruit-dash.js';
import { createFruitCatch } from './games/fruit-catch.js';
import { createOrbitDodger } from './games/orbit-dodger.js';

initTheme();
initArrival();
initI18n();
initReveal();

const dash = document.querySelector('[data-game="fruit-dash"]');
const catchEl = document.querySelector('[data-game="fruit-catch"]');
const dodgerEl = document.querySelector('[data-game="vuelta-al-mundo"]');
if (dash) createFruitDash(dash);
if (catchEl) createFruitCatch(catchEl);
if (dodgerEl) createOrbitDodger(dodgerEl);
