/* ============================================================
   KRDS UX Writing — Shared Navigation JS
   Handles: GNB section active state, mobile sidebar, dark mode
   ============================================================ */
(function () {
  'use strict';

  /* ── 1. GNB section nav: highlight current section ── */
  var path = window.location.pathname;
  var navLinks = document.querySelectorAll('.gnb-nav-link[data-section]');
  navLinks.forEach(function (link) {
    var section = link.getAttribute('data-section');
    if (section && path.indexOf('/' + section) === 0 || path.indexOf('/' + section + '/') !== -1) {
      link.classList.add('active');
    }
    // Exact section root match
    if (path.replace(/\/$/, '').split('/').pop() === section) {
      link.classList.add('active');
    }
  });
  // More reliable: match by startsWith on cleaned path
  var cleanPath = path.replace(/\/krds-ux-writing/, '');
  navLinks.forEach(function (link) {
    var section = link.getAttribute('data-section');
    if (!section) return;
    if (cleanPath.indexOf('/' + section) === 0) {
      link.classList.add('active');
    }
  });

  /* ── 2. Dark mode toggle ── */
  var themeKey = 'krds-theme';
  var themeBtn = document.getElementById('themeToggle');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(themeKey, t);
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', t === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      themeBtn.innerHTML = t === 'dark'
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.22 3.22l1.06 1.06M11.72 11.72l1.06 1.06M11.72 3.22l-1.06 1.06M4.28 11.72l-1.06 1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 10A6 6 0 0 1 6 2.5a6.002 6.002 0 1 0 7.5 7.5z" fill="currentColor"/></svg>';
    }
  }
  if (themeBtn) {
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(currentTheme);
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  /* ── 3. Mobile sidebar toggle ── */
  var sidebar = document.querySelector('.sidebar');
  var backdrop = document.querySelector('.sidebar-backdrop');
  var hamburger = document.getElementById('gnbHamburger');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      var isOpen = sidebar && sidebar.classList.contains('open');
      isOpen ? closeSidebar() : openSidebar();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }
  // Close on sidebar link click (mobile)
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 900) closeSidebar();
      });
    });
  }
  // Close on ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });

  /* ── 4. Sidebar active link on scroll ── */
  var sidebarLinks = sidebar ? sidebar.querySelectorAll('.sidebar-link[href^="#"]') : [];
  if (sidebarLinks.length > 0) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        sidebarLinks.forEach(function (link) {
          var href = link.getAttribute('href');
          link.classList.toggle('active', href === '#' + id);
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    sidebarLinks.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target) observer.observe(target);
    });
  }

})();
