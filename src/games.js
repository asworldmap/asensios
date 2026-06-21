import './styles/tokens.css';
import './styles/games.css';
import { initReveal } from './lib/reveal.js';
import { createFruitDash } from './games/fruit-dash.js';
import { createFruitCatch } from './games/fruit-catch.js';

initReveal();

const dash = document.querySelector('[data-game="fruit-dash"]');
const catchEl = document.querySelector('[data-game="fruit-catch"]');
if (dash) createFruitDash(dash);
if (catchEl) createFruitCatch(catchEl);
