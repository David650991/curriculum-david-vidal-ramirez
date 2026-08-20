'use strict';

export function initNavigation() {
  const pages = [...document.querySelectorAll('[data-page]')];
  const links = [...document.querySelectorAll('[data-page-link]')];
  const profileButton = document.querySelector('[data-profile-toggle]');
  const profileDetails = document.querySelector('[data-profile-details]');

  const pageFromHash = () => {
    const candidate = window.location.hash.slice(1);
    return pages.some((page) => page.id === candidate) ? candidate : 'perfil';
  };

  const showPage = (id, moveFocus = false) => {
    pages.forEach((page) => { page.hidden = page.id !== id; });
    links.forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (id === 'contacto') {
      const map = document.querySelector('[data-map-source]');
      if (map && !map.src) map.src = map.dataset.mapSource;
    }
    if (moveFocus) document.querySelector('#contenido')?.focus({ preventScroll: true });
  };

  links.forEach((link) => link.addEventListener('click', () => {
    showPage(link.getAttribute('href').slice(1), true);
  }));
  window.addEventListener('hashchange', () => showPage(pageFromHash()));

  profileButton?.addEventListener('click', () => {
    const open = profileButton.getAttribute('aria-expanded') === 'true';
    profileButton.setAttribute('aria-expanded', String(!open));
    profileDetails?.classList.toggle('is-open', !open);
    profileButton.textContent = open ? 'Mostrar datos de contacto' : 'Ocultar datos de contacto';
  });

  showPage(pageFromHash());
}
