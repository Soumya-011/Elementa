// shell.js — header/sidebar chrome interactivity + PWA registration.
// External file (not inline) so it runs under a strict CSP (script-src 'self', no 'unsafe-inline').
// Wrapped in an IIFE so its variables (e.g. a theme "root" reference) can never collide with
// anything else declared at the top level of another script on the page.
(function () {
  var themeToggleBtn = document.getElementById('theme-toggle');
  var htmlRoot = document.documentElement;
  var toggleLabel = themeToggleBtn ? themeToggleBtn.querySelector('.chem-toggle-label') : null;

  function updateThemeIcon() {
    var isDark = htmlRoot.getAttribute('data-theme') === 'dark';
    if (toggleLabel) toggleLabel.textContent = isDark ? 'Dark' : 'Light';
  }

  function toggleTheme() {
    var currentTheme = htmlRoot.getAttribute('data-theme');
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlRoot.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
    themeToggleBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTheme(); } });
  }

  updateThemeIcon();

  // =========================================================================
  // SIDEBAR SHELL: collapse (desktop) + overlay drawer (mobile/tablet)
  // =========================================================================
  var sidebarEl = document.getElementById('app-sidebar');
  var appMainEl = document.getElementById('app-main');
  var collapseBtn = document.getElementById('sidebar-collapse-btn');
  var hamburgerBtn = document.getElementById('hamburger-btn');
  var backdropEl = document.getElementById('sidebar-backdrop');

  collapseBtn.addEventListener('click', function () {
    sidebarEl.classList.toggle('collapsed');
    appMainEl.classList.toggle('sidebar-collapsed');
  });

  function openDrawer() {
    sidebarEl.classList.add('mobile-open');
    backdropEl.classList.add('visible');
  }
  function closeDrawer() {
    sidebarEl.classList.remove('mobile-open');
    backdropEl.classList.remove('visible');
  }
  window.closeSidebarDrawer = closeDrawer; // exposed for core.js router to call on nav select

  hamburgerBtn.addEventListener('click', openDrawer);
  backdropEl.addEventListener('click', closeDrawer);

  // Tablet widths default to a collapsed rail for a cleaner first impression
  if (window.innerWidth >= 900 && window.innerWidth < 1180) {
    sidebarEl.classList.add('collapsed');
    appMainEl.classList.add('sidebar-collapsed');
  }

  // Logo click → navigate home
  var logoGroup = document.querySelector('.logo-group');
  if (logoGroup) {
    logoGroup.style.cursor = 'pointer';
    logoGroup.setAttribute('role', 'button');
    logoGroup.setAttribute('tabindex', '0');
    logoGroup.setAttribute('aria-label', 'Go to Home');
    function goHome() {
      window.location.hash = '#landing';
      if (window.innerWidth <= 899) closeDrawer();
    }
    logoGroup.addEventListener('click', goHome);
    logoGroup.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); } });
  }

  // Periodic table modal close button (was an inline onclick — CSP blocks inline handlers too)
  var modalCloseBtn = document.getElementById('pt-modal-close-btn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', function () {
      document.getElementById('pt-modal').classList.remove('active');
    });
  }

  // =========================================================================
  // PROGRESSIVE WEB APP (PWA) REGISTRATION
  // =========================================================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function (registration) {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch(function (error) {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    });

    // Once a NEW service worker actually takes control, reload once so this tab picks up
    // the latest app shell immediately — without this, a successful SW update can still sit
    // there unused until you manually hard-refresh, which is exactly the confusion we've been
    // chasing the last two rounds.
    var swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (swReloaded) return;
      swReloaded = true;
      window.location.reload();
    });
  }
})();