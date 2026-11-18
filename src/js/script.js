import { initNavigation } from './modules/navigation.js';
import { initPointerGlow } from './modules/pointer-glow.js';
import { initProjectFilters } from './modules/project-filters.js';
import { initMapControls } from './modules/map-controls.js';
import { initVisitorAnalytics } from './modules/visitor-analytics.js';
import { initVisitorSession } from './modules/visitor-session.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

initNavigation();
initProjectFilters();
initPointerGlow(reducedMotion);
initMapControls();
initVisitorAnalytics();
initVisitorSession();

const startVisualNetwork = async () => {
  const { initNeuralNetwork } = await import('./modules/neural-network.js');
  initNeuralNetwork(document.querySelector('[data-neural-canvas]'), reducedMotion);
};
if ('requestIdleCallback' in window) window.requestIdleCallback(startVisualNetwork, { timeout: 500 });
else window.requestAnimationFrame(() => window.setTimeout(startVisualNetwork, 0));
