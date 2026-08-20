'use strict';

export function initProjectFilters() {
  const filters = [...document.querySelectorAll('[data-project-filter]')];
  const cards = [...document.querySelectorAll('[data-project]')];

  filters.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.projectFilter;
    filters.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    cards.forEach((card) => {
      const categories = card.dataset.categories.split('|');
      card.classList.toggle('is-filtered', selected !== 'Todos' && !categories.includes(selected));
    });
  }));
}
