// Editorial photo system: graceful degradation for figure.ph images.
//
// A photo can be absent (file not yet uploaded) or fail to load. Either way
// the page must never show a broken image or a layout gap: the figure is
// removed and its chapter falls back to a single column (.no-media).
//
// `doc` is injectable so this can run against a DOM shim in tests without a
// browser.
export function initMedia(doc = document) {
  doc.querySelectorAll('figure.ph').forEach((fig) => {
    const img = fig.querySelector('img');
    if (!img) return;

    const host = img.closest('.has-media, .no-media');

    const drop = () => {
      if (fig.parentNode) fig.parentNode.removeChild(fig);
      if (host) {
        host.classList.remove('has-media');
        host.classList.add('no-media');
      }
    };

    const fail = () => {
      const fallback = img.getAttribute('data-fallback');
      if (fallback) {
        img.removeAttribute('data-fallback');
        img.addEventListener('error', drop, { once: true });
        img.setAttribute('src', fallback);
      } else {
        drop();
      }
    };

    // The failure may already have happened before this script ran.
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener('error', fail, { once: true });
  });
}
