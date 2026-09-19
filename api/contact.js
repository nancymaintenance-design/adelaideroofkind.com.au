const RECIPIENT = 'ellisservicesgroup9@outlook.com';

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function response(res, status, payload) {
  return res.status(status).json(payload);
}

function createContactHandler({ env = process.env, request = globalThis.fetch } = {}) {
  return async function contactHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method !== 'POST') return response(res, 405, { error: 'Method not allowed.' });
    if (Number(req.headers?.['content-length'] || 0) > 25_000) return response(res, 413, { error: 'Enquiry is too large.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (clean(body.website, 100)) return response(res, 200, { ok: true });

    const enquiry = {
      name: clean(body.name, 120),
      email: clean(body.email, 254),
      phone: clean(body.phone, 80),
      suburb: clean(body.suburb, 160),
      service: clean(body.service, 160),
      message: clean(body.message, 5_000),
    };
    if (!Object.values(enquiry).every(Boolean) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) {
      return response(res, 400, { error: 'Please complete every required field with a valid email address.' });
    }
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || typeof request !== 'function') {
      return response(res, 503, { error: 'Online enquiries are temporarily unavailable. Please call 0434 276 883.' });
    }

    const rows = [
      ['Name', enquiry.name], ['Email', enquiry.email], ['Phone', enquiry.phone],
      ['Suburb', enquiry.suburb], ['Service', enquiry.service], ['Message', enquiry.message],
    ].map(([label, value]) => `<tr><th align="left">${label}</th><td>${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`).join('');

    try {
      const sent = await request('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: [RECIPIENT],
          reply_to: enquiry.email,
          subject: `ARK website enquiry: ${enquiry.service} — ${enquiry.name}`,
          text: `ARK website enquiry\n\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\nSuburb: ${enquiry.suburb}\nService: ${enquiry.service}\n\nMessage:\n${enquiry.message}`,
          html: `<h1>ARK website enquiry</h1><table>${rows}</table>`,
        }),
      });
      if (!sent.ok) return response(res, 502, { error: 'We could not send your enquiry. Please call 0434 276 883.' });
      return response(res, 201, { ok: true, message: 'Thanks. Your enquiry has been received.' });
    } catch {
      return response(res, 502, { error: 'We could not send your enquiry. Please call 0434 276 883.' });
    }
  };
}

module.exports = createContactHandler();
module.exports.createContactHandler = createContactHandler;
