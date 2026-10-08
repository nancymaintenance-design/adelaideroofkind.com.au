const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.nav');
function setMenuOpen(open) {
  if (!menuToggle || !primaryNav) return;
  primaryNav.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuToggle?.addEventListener('click', () => setMenuOpen(!primaryNav.classList.contains('open')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && primaryNav?.classList.contains('open')) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});
primaryNav?.addEventListener('click', event => {
  if (event.target.closest('a')) setMenuOpen(false);
});
document.querySelectorAll('.faq-question').forEach(button => button.addEventListener('click', () => {
  const item = button.closest('.faq-item');
  button.setAttribute('aria-expanded', String(item.classList.toggle('open')));
}));
const industrySearchInput = document.querySelector('#industry-search-input');
if (industrySearchInput) {
  const articles = [...document.querySelectorAll('.article-card')];
  const status = document.querySelector('.industry-search__status');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'industry-search__clear';
  clear.setAttribute('aria-label', 'Clear article search');
  clear.textContent = 'Clear ×';
  clear.hidden = true;
  industrySearchInput.insertAdjacentElement('afterend', clear);
  function applySearch() {
    const query = industrySearchInput.value.trim().toLowerCase();
    let count = 0;
    for (const article of articles) {
      const matches = !query || article.textContent.toLowerCase().includes(query);
      article.classList.toggle('article-card--hidden', !matches);
      if (matches) count++;
    }
    clear.hidden = !industrySearchInput.value;
    if (status) {
      status.setAttribute('aria-live', 'polite');
      status.textContent = query
        ? `${count} article${count === 1 ? '' : 's'} found for “${industrySearchInput.value.trim()}”.${count === 0 ? ' Try roof leaks, tiles or gutters.' : ''}`
        : 'Search this page for roofing advice.';
    }
  }
  industrySearchInput.addEventListener('input', event => { if (!event.isComposing) applySearch(); });
  industrySearchInput.addEventListener('compositionend', applySearch);
  clear.addEventListener('click', () => { industrySearchInput.value = ''; applySearch(); industrySearchInput.focus(); });
  industrySearchInput.closest('form')?.addEventListener('submit', event => {
    event.preventDefault();
    applySearch();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('.article-card:not(.article-card--hidden)')?.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block:'start'});
  });
}
