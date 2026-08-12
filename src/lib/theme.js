// Light/dark switching.
//
// Three states, in priority order: an explicit stored choice, the system
// preference, then light. The stored choice stamps data-theme on <html> so the
// CSS can win in both directions; with no stored choice nothing is stamped and
// prefers-color-scheme decides on its own.

const KEY = 'asensios.theme';

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** What the page is actually rendering right now. */
export function currentTheme() {
  return stored() || (systemDark() ? 'dark' : 'light');
}

function apply(theme) {
  const root = document.documentElement;
  if (theme) root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');

  // Keep the browser chrome in step with the surface.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', currentTheme() === 'dark' ? '#0e120d' : '#f7f4ec');
}

/**
 * Applies the stored choice and wires the toggle. Safe to call before the
 * toggle exists — it re-queries at click time.
 */
export function initTheme() {
  apply(stored());

  // Follow the system while the visitor hasn't chosen for themselves.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!stored()) apply(null);
  });

  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;

  const label = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', next === 'dark' ? 'Modo oscuro' : 'Modo claro');
    const text = btn.querySelector('[data-theme-label]');
    if (text) text.textContent = currentTheme() === 'dark' ? 'Noche' : 'Día';
  };
  label();

  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    apply(next);
    label();
  });
}
