const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.nav');
const chinesePage = document.documentElement.lang.toLowerCase().startsWith('zh');
const languageSwitch = document.querySelector('[data-language-switch]');
function syncLanguageLocation() {
  if (!languageSwitch) return;
  const target = new URL(languageSwitch.getAttribute('href'), window.location.href);
  target.search = window.location.search;
  target.hash = window.location.hash;
  languageSwitch.href = target.pathname + target.search + target.hash;
}
syncLanguageLocation();
window.addEventListener('hashchange', syncLanguageLocation);
function setMenuOpen(open) {
  if (!menuToggle || !primaryNav) return;
  primaryNav.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', chinesePage ? (open ? '关闭菜单' : '打开菜单') : (open ? 'Close menu' : 'Open menu'));
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
  clear.setAttribute('aria-label', chinesePage ? '清除文章搜索' : 'Clear article search');
  clear.textContent = chinesePage ? '清除 ×' : 'Clear ×';
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
      status.textContent = chinesePage
        ? (query ? `找到 ${count} 篇与“${industrySearchInput.value.trim()}”相关的指南。${count === 0 ? '请尝试搜索漏水、瓦片或檐沟。' : ''}` : '搜索本页的屋顶维护指南。')
        : query
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
