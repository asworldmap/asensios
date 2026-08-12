// Bilingual system (ES/EN): dictionary-based text swap, no page reload,
// no route split. Preference persists in localStorage; default is Spanish
// (the site's native voice), never inferred loosely from the browser so a
// visitor never lands on a half-translated page by accident.

import { dict } from '../i18n/dict.js';

const KEY = 'asensios.lang';

export function getLang() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* private mode — fall through to default */
  }
  return 'es';
}

function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode — the toggle still works for this page view */
  }
}

function translate(lang, key) {
  const value = dict[lang]?.[key];
  if (value == null && lang !== 'es') return dict.es[key];
  return value;
}

export function applyI18n(lang) {
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = translate(lang, key);
    if (value != null) el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr')
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        const value = attr && key ? translate(lang, key) : null;
        if (value != null) el.setAttribute(attr, value);
      });
  });

  document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(lang === 'en'));
    const label = btn.querySelector('[data-lang-label]');
    if (label) label.textContent = lang === 'es' ? 'EN' : 'ES';
  });
}

/** Wires every [data-lang-toggle] button on the page and does the first render. */
export function initI18n() {
  let lang = getLang();
  applyI18n(lang);

  document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lang = lang === 'es' ? 'en' : 'es';
      setLang(lang);
      applyI18n(lang);
    });
  });
}
