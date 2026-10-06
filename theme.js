// Runs in <head> before first paint so the page never flashes the wrong colors.
(function () {
  var mode = 'dark';
  try { mode = localStorage.getItem('tt.mode') || 'dark'; } catch (e) {}
  var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
})();
