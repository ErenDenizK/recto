// The page's only script (presentation spec §3), three jobs:
//
// - Posters load as their plates near the screen. Each clip below the title page names its
//   poster in `data-poster` and gets the `poster` attribute 600 px before it scrolls into view,
//   so a first visit fetches the hero's poster and nothing else; without the observer, every
//   poster is set at once. Videos keep `preload="none"`: nothing of a clip loads before play.
// - A clip that waits for a click shows one play button instead of the browser's controls over
//   its poster; the button starts it and hands over to the native controls. Without this
//   script the native controls stay.
// - Under `prefers-reduced-motion: reduce` no clip plays by itself: each video loses autoplay,
//   stops, and goes back to its poster (`load()` shows the poster again and, with preload
//   "none", fetches nothing more).
const doc = globalThis.document;
const Observer = globalThis.IntersectionObserver;
const reduce = globalThis.matchMedia('(prefers-reduced-motion: reduce)');

function showPoster(video) {
  const poster = video.dataset.poster;
  if (poster && !video.getAttribute('poster')) video.setAttribute('poster', poster);
}

const lazy = [...doc.querySelectorAll('video[data-poster]')];
if (Observer) {
  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        showPoster(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '600px 0px' },
  );
  for (const video of lazy) observer.observe(video);
} else {
  lazy.forEach(showPoster);
}

const PLAY_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.2v13.6L16.6 10Z"/></svg>';

for (const video of doc.querySelectorAll('video[controls]:not([autoplay])')) {
  const caption = doc.getElementById(video.getAttribute('aria-describedby') ?? '');
  const title =
    caption?.querySelector('.fig-title')?.textContent ??
    video.closest('article')?.querySelector('h3')?.textContent ??
    '';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'play';
  button.setAttribute('aria-label', title ? `Play: ${title.replace(/\.$/, '')}` : 'Play clip');
  button.innerHTML = `<span class="play-disc">${PLAY_ICON}</span>`;
  button.addEventListener('click', () => {
    showPoster(video);
    video.controls = true;
    button.remove();
    void video.play().catch(() => undefined);
    video.focus();
  });
  video.controls = false;
  video.after(button);
}

function stillOnly() {
  if (!reduce.matches) return;
  for (const video of doc.querySelectorAll('video')) {
    video.autoplay = false;
    video.pause();
    video.preload = 'none';
    video.load();
  }
}

stillOnly();
reduce.addEventListener('change', stillOnly);
