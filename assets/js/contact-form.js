(() => {
  const form = document.querySelector('[data-contact-form]');
  const status = document.querySelector('[data-contact-status]');
  if (!form || !status) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form).entries());
    button.disabled = true;
    status.textContent = 'Sending your enquiry…';

    try {
      const result = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok || !payload.ok) throw new Error(payload.error || 'Unable to send enquiry.');
      form.reset();
      status.textContent = payload.message || 'Thanks. Your enquiry has been received.';
    } catch {
      status.textContent = 'We could not send your enquiry. Please call 0434 276 883 or email Ellis directly.';
    } finally {
      button.disabled = false;
    }
  });
})();
