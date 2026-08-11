import './styles/tokens.css';
import './styles/business.css';
import './styles/cinematic.css';
import './styles/media.css';
import { initReveal, initCountUp } from './lib/reveal.js';
import { initArrival, prefersReducedMotion, wireCinematicLinks } from './lib/motion.js';
import { initMedia } from './lib/media.js';

initArrival();
initReveal();
initCountUp();
initMedia();

// The worldmap only exists as a lazy chunk, and only when motion is welcome.
if (!prefersReducedMotion()) {
  import('./lib/worldmap.js')
    .then((m) => m.initWorldmap('.story'))
    .catch(() => {
      /* the story reads perfectly well without it */
    });
}

wireCinematicLinks({ 'a[href="/games/"]': 'warp' });
