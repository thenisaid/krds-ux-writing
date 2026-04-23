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

  /* ── 4. GNB 키보드 내비게이션 ── */
  var gnbNav = document.querySelector('.gnb-nav');
  if (gnbNav) {
    gnbNav.addEventListener('keydown', function (e) {
      var links = Array.from(gnbNav.querySelectorAll('.gnb-nav-link'));
      var idx = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (idx < links.length - 1) links[idx + 1].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (idx > 0) links[idx - 1].focus();
      } else if (e.key === 'Escape') {
        // GNB 드롭다운 닫기 (메인 페이지 호환, principles 서브페이지는 무시)
        var openItem = document.querySelector('.gnb-item.open');
        if (openItem) {
          openItem.classList.remove('open');
          var gnbBtn = openItem.querySelector('.gnb-link');
          if (gnbBtn) { gnbBtn.setAttribute('aria-expanded', 'false'); gnbBtn.focus(); }
        }
      }
    });
  }

  /* ── 5. Ctrl+K 검색 단축키 ── */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var searchBtn = document.getElementById('gnbSearch');
      if (searchBtn) {
        searchBtn.click();
      } else {
        // principles 서브페이지: 검색 UI 없음 → 메인 페이지로 이동
        window.location.href = '/krds-ux-writing/';
      }
    }
  });

  /* ── 6. Sidebar active link on scroll ── */
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

/* ============================================================
   LNB Accordion — principles pages only
   ============================================================ */
(function () {
  'use strict';

  var tree = document.querySelector('.lnb-tree');
  if (!tree) return;

  var cleanPath = window.location.pathname.replace(/\/krds-ux-writing/, '');
  var items = Array.from(tree.querySelectorAll('.lnb-item'));

  function expand(item) {
    item.setAttribute('aria-expanded', 'true');
    var tog = item.querySelector('.lnb-tog');
    if (tog) tog.setAttribute('aria-expanded', 'true');
    var sub = item.querySelector('.lnb-sub');
    if (sub) sub.removeAttribute('hidden');
  }

  function collapse(item) {
    item.setAttribute('aria-expanded', 'false');
    var tog = item.querySelector('.lnb-tog');
    if (tog) tog.setAttribute('aria-expanded', 'false');
    var sub = item.querySelector('.lnb-sub');
    if (sub) sub.setAttribute('hidden', '');
  }

  /* Initialize aria-expanded on toggle buttons */
  items.forEach(function (item) {
    var tog = item.querySelector('.lnb-tog');
    if (tog) tog.setAttribute('aria-expanded', item.getAttribute('aria-expanded') || 'false');
  });

  /* Auto-expand active chapter based on URL */
  items.forEach(function (item) {
    var p = item.getAttribute('data-path') || '';
    if (p && cleanPath.indexOf(p) === 0) {
      expand(item);
      var link = item.querySelector('.lnb-item-a');
      if (link) link.classList.add('active');
    }
  });

  /* Toggle on chevron button click */
  items.forEach(function (item) {
    var tog = item.querySelector('.lnb-tog');
    var link = item.querySelector('.lnb-item-a');

    if (tog) {
      tog.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = item.getAttribute('aria-expanded') === 'true';
        if (open) { collapse(item); } else { expand(item); }
      });
    }

    /* Expand when chapter link is clicked */
    if (link) {
      link.addEventListener('click', function () {
        expand(item);
      });
    }

    /* Close sidebar on mobile when a link inside is clicked */
    var allLinks = item.querySelectorAll('.lnb-item-a, .lnb-sub-a');
    allLinks.forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth <= 900) {
          var sidebar = document.querySelector('.sidebar');
          var backdrop = document.querySelector('.sidebar-backdrop');
          var hamburger = document.getElementById('gnbHamburger');
          if (sidebar) sidebar.classList.remove('open');
          if (backdrop) backdrop.classList.remove('open');
          if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      });
    });
  });

  /* Keyboard navigation: ArrowDown/Up on tree, Enter/Space on toggle */
  tree.addEventListener('keydown', function (e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) === -1) return;

    /* Build list of currently visible focusable elements */
    var focusable = Array.from(
      tree.querySelectorAll('.lnb-item-a, .lnb-tog, .lnb-sub-a')
    ).filter(function (el) {
      var sub = el.closest('.lnb-sub');
      return !sub || !sub.hasAttribute('hidden');
    });

    var idx = focusable.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < focusable.length - 1) focusable[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) focusable[idx - 1].focus();
    } else if ((e.key === 'Enter' || e.key === ' ') &&
               document.activeElement.classList.contains('lnb-tog')) {
      e.preventDefault();
      document.activeElement.click();
    }
  });

  /* Sub-link active state tracking on scroll */
  var subLinks = Array.from(tree.querySelectorAll('.lnb-sub-a'));
  if (subLinks.length > 0) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        subLinks.forEach(function (a) {
          var href = a.getAttribute('href') || '';
          a.classList.toggle('active', href.split('#')[1] === id);
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    subLinks.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var hash = href.split('#')[1];
      if (hash) {
        var target = document.getElementById(hash);
        if (target) obs.observe(target);
      }
    });
  }

  /* Reference footer link active state */
  document.querySelectorAll('.lnb-footer-a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var refPath = href.replace(/\/krds-ux-writing/, '').replace(/\/$/, '');
    var curPath = cleanPath.replace(/\/$/, '');
    if (refPath && curPath.indexOf(refPath) === 0) a.classList.add('active');
  });

})();
