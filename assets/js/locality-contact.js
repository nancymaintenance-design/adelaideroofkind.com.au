(function localityContact(globalScope) {
  function getLocationContext(search, defaultArea, language = 'en-AU') {
    const params = new URLSearchParams(search || '');
    const area = params.get('area') || defaultArea || '';
    const street = params.get('street') || '';
    return {
      area,
      street,
      message: street ? (language.startsWith('zh') ? `房产位置：${street}${area ? `，${area}` : ''}。` : `Property location: ${street}${area ? `, ${area}` : ''}.`) : '',
    };
  }

  function applyLocationContext(form) {
    const context = getLocationContext(globalScope.location.search, form.dataset.area, document.documentElement.lang);
    const suburb = form.elements.suburb;
    const message = form.elements.message;
    if (suburb && context.area) suburb.value = context.area;
    if (message && context.message && !message.value.trim()) message.value = context.message;
  }

  if (typeof module !== 'undefined') module.exports = { getLocationContext };

  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-location-contact-form]').forEach(applyLocationContext);
  }
}(typeof window !== 'undefined' ? window : globalThis));
