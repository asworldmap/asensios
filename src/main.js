import './styles/tokens.css';
import './styles/home.css';
import './styles/cinematic.css';
import { initReveal } from './lib/reveal.js';
import { initArrival, wireCinematicLinks } from './lib/motion.js';

initArrival();
initReveal();

// Leaving home is the cinematic moment: the orbit departure towards the
// trajectory, a shorter warp towards the Playroom.
wireCinematicLinks({
  'a[href="/business/"]': 'orbit',
  'a[href="/games/"]': 'warp',
});
