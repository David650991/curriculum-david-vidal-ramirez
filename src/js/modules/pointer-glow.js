'use strict';

export function initPointerGlow(reducedMotion) {
  if (reducedMotion.matches || !window.matchMedia('(pointer: fine)').matches) return;
  let framePending = false;
  let pointerX = 0;
  let pointerY = 0;

  document.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--pointer-x', `${pointerX}px`);
      document.documentElement.style.setProperty('--pointer-y', `${pointerY}px`);
      framePending = false;
    });
  }, { passive: true });
}
