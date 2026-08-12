import './styles/tokens.css';
import './styles/home.css';
import './styles/cinematic.css';
import { initReveal } from './lib/reveal.js';
import { initTheme } from './lib/theme.js';
import { initArrival, wireCinematicLinks } from './lib/motion.js';
import { initI18n } from './lib/i18n.js';

initTheme();
initArrival();
initI18n();
initReveal();

// Leaving home is the cinematic moment: the orbit departure towards the
// trajectory, a shorter warp towards the Playroom.
wireCinematicLinks({
  '[data-cine-orbit]': 'orbit',
  '[data-cine-warp]': 'warp',
});
