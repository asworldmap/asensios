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

const SURFACE = { light: '#f1e8d6', dark: '#0e120d' };

/**
 * Keeps the browser chrome in step with the surface.
 *
 * The markup ships two media-scoped theme-color metas so the chrome is right
 * before this module runs. An explicit choice has to beat both, and browsers
 * honour the FIRST matching meta — so the override is media-less and inserted
 * ahead of them, then removed again when the visitor returns to following the
 * system.
 */
function applyChrome(theme) {
  const head = document.head;
  let override = head.querySelector('meta[name="theme-color"][data-theme-override]');

  if (!theme) {
    if (override) override.remove();
    return;
  }
  if (!override) {
    override = document.createElement('meta');
    override.setAttribute('name', 'theme-color');
    override.setAttribute('data-theme-override', '');
    head.insertBefore(override, head.querySelector('meta[name="theme-color"]'));
  }
  override.setAttribute('content', SURFACE[theme]);
}

function apply(theme) {
  const root = document.documentElement;
  if (theme) root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  applyChrome(theme);
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

  // The visible word states where you are ("Día"/"Noche"); the accessible name
  // states what the button does, so the two never contradict each other.
  const label = () => {
    const dark = currentTheme() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    const text = btn.querySelector('[data-theme-label]');
    if (text) text.textContent = dark ? 'Noche' : 'Día';
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
