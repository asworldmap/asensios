import './styles/tokens.css';
import './styles/media.css';
import './styles/trajectory.css';
import './styles/cinematic.css';
import { initReveal, initParallax } from './lib/reveal.js';
import { initTheme } from './lib/theme.js';
import { initMedia } from './lib/media.js';
import { initI18n } from './lib/i18n.js';
import { initArrival, prefersReducedMotion, wireCinematicLinks } from './lib/motion.js';

initTheme();
initArrival();
initI18n();
initReveal();
initParallax();

// Any photo that fails to load takes its figure with it and the moment falls
// back to a single column — never a broken image, never a hole in the layout.
initMedia();

// The scroll-linked route behind the story is a separate chunk: it only loads
// once we know the visitor is not asking for reduced motion.
if (!prefersReducedMotion()) {
  import('./lib/worldmap.js')
    .then((m) => m.initWorldmap('.tj-route'))
    .catch(() => {
      /* atmosphere is optional — the page reads fine without it */
    });
}

wireCinematicLinks({ '[data-cine-warp]': 'warp' });
