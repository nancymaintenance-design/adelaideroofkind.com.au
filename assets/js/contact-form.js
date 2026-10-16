(function contactForm(globalScope) {
  const chinese = () => globalScope.document?.documentElement?.lang?.toLowerCase().startsWith('zh');
  const messages = {
    'Sending…': '发送中…',
    'Sending your enquiry…': '正在发送您的咨询…',
    'Thanks. Your enquiry has been received.': '感谢您的咨询，我们已收到您的信息。',
    'We could not send your enquiry. Please call 0434 276 883.': '咨询暂未发送成功，请致电 0434 276 883。',
    'Please complete every required field with a valid email address.': '请填写所有必填项，并输入有效的电子邮箱。',
    'Online enquiries are temporarily unavailable. Please call 0434 276 883.': '在线咨询暂不可用，请致电 0434 276 883。',
    'Enquiry is too large.': '咨询内容过长，请精简后重新发送。',
  };
  const localize = (message, isError = false) => chinese() ? (messages[message] || messages[isError ? 'We could not send your enquiry. Please call 0434 276 883.' : 'Thanks. Your enquiry has been received.']) : message;
  function setStatus(form, message, isError) {
    const status = form.querySelector('[data-contact-status], .form-status');
    if (status) {
      status.textContent = localize(message, isError);
      status.classList.toggle('form-status--error', Boolean(isError));
    }
  }

  function setSubmitting(form, isSubmitting) {
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = isSubmitting;
      button.setAttribute('aria-busy', String(isSubmitting));
      button.dataset.defaultLabel ||= button.textContent;
      button.textContent = isSubmitting ? localize('Sending…') : button.dataset.defaultLabel;
    }
  }

  async function submitEnquiry(form) {
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.message = String(payload.message || '').trim() || (chinese() ? '首页报价咨询。' : 'Homepage quote request.');

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
    if (chinese()) {
      // Native validation otherwise runs before submit and shows browser-locale
      // text. The submit handler still enforces validity via reportValidity().
      form.noValidate = true;
      form.addEventListener('input', event => event.target.setCustomValidity?.(''));
      form.addEventListener('change', event => event.target.setCustomValidity?.(''));
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (chinese()) for (const field of form.querySelectorAll('input,select,textarea')) {
        field.setCustomValidity('');
        if (field.validity.valueMissing) field.setCustomValidity('请填写此必填项。');
        else if (field.validity.typeMismatch) field.setCustomValidity('请输入有效的电子邮箱地址。');
        else if (!field.validity.valid) field.setCustomValidity('请检查此项的格式。');
      }
      if (!form.reportValidity()) return;
      submitEnquiry(form);
    });
  }

  if (typeof document !== 'undefined') document.querySelectorAll('[data-contact-form]').forEach(bind);
  if (typeof module !== 'undefined') module.exports = { submitEnquiry };
}(typeof window !== 'undefined' ? window : globalThis));
