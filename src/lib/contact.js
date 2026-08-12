// A contact "form" that never manages an inbox: it composes a mailto: link
// from the visitor's own words and hands off to their mail client. The
// address lives here, in source, but is never rendered as visible text
// anywhere on the page — nothing to scrape off the rendered DOM.
const ADDRESS = 'hola@asensios.com';

export function initContactForm(selector = '[data-contact-form]') {
  const form = document.querySelector(selector);
  if (!form) return;

  const nameEl = form.querySelector('[data-contact-name]');
  const messageEl = form.querySelector('[data-contact-message]');
  const statusEl = form.querySelector('[data-contact-status]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameEl?.value || '').trim();
    const message = (messageEl?.value || '').trim();
    if (!message) {
      messageEl?.focus();
      return;
    }

    const subject = name ? `${name} — asensios.com` : 'asensios.com';
    const href = `mailto:${ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.classList.add('is-visible');
    }
    window.location.href = href;
  });
}
