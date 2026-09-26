// theme-boot.js — sets the theme attribute before first paint to avoid a flash of the wrong theme.
// External file (not inline) so it runs under a strict CSP (script-src 'self', no 'unsafe-inline').
(function () {
  var savedTheme = localStorage.getItem('theme');
  var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();