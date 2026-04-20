(function () {
  'use strict';

  // Dark mode sync
  function syncTheme() {
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var stored = localStorage.getItem('krds-theme');
    document.documentElement.setAttribute('data-theme', stored || (sys ? 'dark' : 'light'));
  }
  syncTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
})();
