(function contactForm(globalScope) {
  function setStatus(form, message, isError) {
    const status = form.querySelector('[data-contact-status], .form-status');
    if (status) {
      status.textContent = message;
      status.classList.toggle('form-status--error', Boolean(isError));
    }
  }

  function setSubmitting(form, isSubmitting) {
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = isSubmitting;
      button.setAttribute('aria-busy', String(isSubmitting));
      button.dataset.defaultLabel ||= button.textContent;
      button.textContent = isSubmitting ? 'Sending…' : button.dataset.defaultLabel;
    }
  }

  async function submitEnquiry(form) {
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.message = String(payload.message || '').trim() || 'Homepage quote request.';

    setSubmitting(form, true);
    setStatus(form, 'Sending your enquiry…');
    try {
      const response = await globalScope.fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not send your enquiry. Please call 0434 276 883.');
      form.reset();
      setStatus(form, result.message || 'Thanks. Your enquiry has been received.');
    } catch (error) {
      setStatus(form, error.message || 'We could not send your enquiry. Please call 0434 276 883.', true);
    } finally {
      setSubmitting(form, false);
    }
  }

  function bind(form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submitEnquiry(form);
    });
  }

  if (typeof document !== 'undefined') document.querySelectorAll('[data-contact-form]').forEach(bind);
  if (typeof module !== 'undefined') module.exports = { submitEnquiry };
}(typeof window !== 'undefined' ? window : globalThis));
