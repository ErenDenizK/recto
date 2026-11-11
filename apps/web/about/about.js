// The page's only script (presentation spec §3): under `prefers-reduced-motion: reduce` the
// clip does not play by itself. It loses autoplay, stops, and goes back to its poster
// (`load()` shows the poster again and, with preload "none", fetches nothing more).
const reduce = globalThis.matchMedia('(prefers-reduced-motion: reduce)');

function stillOnly() {
  if (!reduce.matches) return;
  for (const video of globalThis.document.querySelectorAll('video')) {
    video.autoplay = false;
    video.pause();
    video.preload = 'none';
    video.load();
  }
}

stillOnly();
reduce.addEventListener('change', stillOnly);
