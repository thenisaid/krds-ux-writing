/* ============================================================
   KRDS UX Writing — Shared Navigation JS
   Handles: GNB section active state, mobile sidebar, dark mode
   ============================================================ */
(function () {
  'use strict';

  var sharedNav = window.KRDSSharedNav || (window.KRDSSharedNav = {});
  var basePath = window.KRDSBasePath || null;
  function toSiteRelativePath(pathname) {
    if (basePath && typeof basePath.toSiteRelativePath === 'function') {
      return basePath.toSiteRelativePath(pathname);
    }
    return String(pathname || '/').replace(/\/krds-ux-writing/, '');
  }
  function buildSitePath(pathname) {
    if (basePath && typeof basePath.buildSitePath === 'function') {
      return basePath.buildSitePath(pathname);
    }
    var value = pathname || '/';
    if (value === '/') return '/krds-ux-writing/';
    return '/krds-ux-writing' + (value.charAt(0) === '/' ? value : '/' + value);
  }

  function resolveCurrentSection(pathname) {
    var comparablePath = normalizeComparablePath(pathname);
    if (!comparablePath || comparablePath === '/') return '';

    var trimmedPath = comparablePath.replace(/^\/+/, '');
    if (!trimmedPath) return '';

    var firstSlashIndex = trimmedPath.indexOf('/');
    var firstSegment = firstSlashIndex === -1
      ? trimmedPath
      : trimmedPath.slice(0, firstSlashIndex);

    return firstSegment.replace(/\.html$/i, '');
  }

  /* ── 1. GNB section nav: highlight current section ── */
  var currentSection = resolveCurrentSection(window.location.pathname);
  var navLinks = document.querySelectorAll('.gnb-nav-link[data-section]');
  navLinks.forEach(function (link) {
    var section = link.getAttribute('data-section');
    if (section === currentSection) {
      link.classList.add('active');
    }
  });

  /* ── 2. Dark mode toggle ── */
  var themeKey = 'krds-theme';
  var themeBtn = document.getElementById('themeToggle');
  var themeMediaQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  function readStoredTheme() {
    try {
      var value = localStorage.getItem(themeKey);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (e) {
      return null;
    }
  }
  function persistTheme(t) {
    try {
      localStorage.setItem(themeKey, t);
    } catch (e) {}
  }
  function applyTheme(t, options) {
    var shouldPersist = !!(options && options.persist);
    document.documentElement.setAttribute('data-theme', t);
    if (shouldPersist) persistTheme(t);
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', t === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      themeBtn.innerHTML = t === 'dark'
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.22 3.22l1.06 1.06M11.72 11.72l1.06 1.06M11.72 3.22l-1.06 1.06M4.28 11.72l-1.06 1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 10A6 6 0 0 1 6 2.5a6.002 6.002 0 1 0 7.5 7.5z" fill="currentColor"/></svg>';
    }
  }
  function resolveTheme() {
    var storedTheme = readStoredTheme();
    if (storedTheme) return storedTheme;
    return themeMediaQuery && themeMediaQuery.matches ? 'dark' : 'light';
  }
  function syncSystemTheme() {
    if (readStoredTheme()) return;
    applyTheme(resolveTheme(), { persist: false });
  }
  applyTheme(resolveTheme(), { persist: false });
  if (themeMediaQuery) {
    if (typeof themeMediaQuery.addEventListener === 'function') {
      themeMediaQuery.addEventListener('change', syncSystemTheme);
    } else if (typeof themeMediaQuery.addListener === 'function') {
      themeMediaQuery.addListener(syncSystemTheme);
    }
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, { persist: true });
    });
  }

  /* ── 3. Mobile sidebar toggle ── */
  var sidebar = document.querySelector('.sidebar');
  var backdrop = document.querySelector('.sidebar-backdrop');
  var hamburger = document.getElementById('gnbHamburger');
  var _trapHandler = null;

  function syncHamburgerState(isOpen) {
    if (!hamburger) return;
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    hamburger.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
  }

  function trapSidebarFocus(el) {
    var focusable = Array.from(el.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) { return !n.hasAttribute('hidden') && n.offsetParent !== null; });
    if (!focusable.length) return;
    focusable[0].focus();
    _trapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', _trapHandler);
  }

  function releaseSidebarFocus(el, shouldRestoreFocus) {
    if (_trapHandler) { el.removeEventListener('keydown', _trapHandler); _trapHandler = null; }
    if (shouldRestoreFocus !== false && hamburger) hamburger.focus();
  }

  function isTextEntryTarget(target) {
    if (!target || !target.tagName) return !!(target && target.isContentEditable === true);
    var tag = String(target.tagName).toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
  }

  function focusSidebarAnchorTarget(target) {
    if (!target) return;
    var hadTabIndex = typeof target.getAttribute === 'function' && target.getAttribute('tabindex') !== null;
    if (!hadTabIndex && typeof target.setAttribute === 'function') {
      target.setAttribute('tabindex', '-1');
    }
    if (typeof target.focus === 'function') {
      target.focus();
    }
    if (typeof window.scrollTo === 'function' && typeof target.getBoundingClientRect === 'function') {
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY,
        behavior: 'auto',
      });
    }
  }

  function normalizeComparablePath(pathname) {
    var value = toSiteRelativePath(pathname || '/');
    if (!value) return '/';
    if (value.charAt(0) !== '/') value = '/' + value;
    value = value.replace(/\/+$/, '');
    value = value.replace(/\/index\.html$/i, '');
    return value || '/';
  }

  function stripOrigin(pathname) {
    var value = String(pathname || '');
    var protocolIndex = value.indexOf('://');
    if (protocolIndex !== -1) {
      var slashIndex = value.indexOf('/', protocolIndex + 3);
      return slashIndex === -1 ? '/' : value.slice(slashIndex);
    }
    if (value.indexOf('//') === 0) {
      var slashIndex2 = value.indexOf('/', 2);
      return slashIndex2 === -1 ? '/' : value.slice(slashIndex2);
    }
    return value;
  }

  function splitPathAndSearch(pathname) {
    var value = String(pathname || '');
    var queryIndex = value.indexOf('?');
    if (queryIndex === -1) {
      return { path: value, search: '' };
    }
    return {
      path: value.slice(0, queryIndex),
      search: value.slice(queryIndex),
    };
  }

  function getCurrentLocationSearch() {
    return window.location && typeof window.location.search === 'string'
      ? window.location.search
      : '';
  }

  function resolveSamePageSidebarAnchorId(link) {
    if (!link || typeof link.getAttribute !== 'function') return '';
    var href = link.getAttribute('href') || '';
    if (!href || href === '#') return '';

    var hashIndex = href.indexOf('#');
    if (hashIndex === -1 || hashIndex === href.length - 1) return '';
    if (hashIndex === 0) return href.slice(1);

    var targetLocation = splitPathAndSearch(stripOrigin(href.slice(0, hashIndex)));
    var currentPath = window.location && window.location.pathname ? window.location.pathname : '/';
    var comparableTargetPath = normalizeComparablePath(targetLocation.path || currentPath);
    if (
      comparableTargetPath !== normalizeComparablePath(currentPath) ||
      targetLocation.search !== getCurrentLocationSearch()
    ) {
      return '';
    }
    return href.slice(hashIndex + 1);
  }

  function handleMobileSidebarLinkClick(link, event) {
    if (!link || window.innerWidth > 900) return;
    var targetId = resolveSamePageSidebarAnchorId(link);
    var target = targetId ? document.getElementById(targetId) : null;
    if (target) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      closeSidebar(false);
      focusSidebarAnchorTarget(target);
      return;
    }
    closeSidebar(false);
  }
  sharedNav.handleMobileSidebarLinkClick = handleMobileSidebarLinkClick;

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    syncHamburgerState(true);
    document.body.style.overflow = 'hidden';
    trapSidebarFocus(sidebar);
  }
  function closeSidebar(restoreFocus) {
    if (!sidebar || !sidebar.classList.contains('open')) return;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    syncHamburgerState(false);
    document.body.style.overflow = '';
    releaseSidebarFocus(sidebar, restoreFocus);
  }
  syncHamburgerState(false);
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
      link.addEventListener('click', function (e) {
        if (window.innerWidth <= 900) handleMobileSidebarLinkClick(link, e);
      });
    });
  }
  // Close on ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) {
        closeSidebar(false);
      }
    });
  }

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
      if (isTextEntryTarget(e.target)) return;
      var searchBtn = document.getElementById('gnbSearch');
      var pageSearchInput = document.getElementById('searchInput');
      if (searchBtn) {
        e.preventDefault();
        searchBtn.click();
      } else if (pageSearchInput) {
        e.preventDefault();
        pageSearchInput.focus();
        if (typeof pageSearchInput.select === 'function') pageSearchInput.select();
      } else if (currentSection === 'principles') {
        e.preventDefault();
        // principles 서브페이지: 검색 UI 없음 → 메인 페이지로 이동
        window.location.href = buildSitePath('/');
      }
    }
  });

  /* ── 6. Sidebar active link on scroll ── */
  var sidebarLinks = sidebar ? sidebar.querySelectorAll('.sidebar-link[href^="#"]') : [];
  if (sidebarLinks.length > 0 && typeof IntersectionObserver === 'function') {
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

  var sharedNav = window.KRDSSharedNav || {};
  var tree = document.querySelector('.lnb-tree');
  if (!tree) return;

  var basePath = window.KRDSBasePath || null;
  function toSiteRelativePath(pathname) {
    if (basePath && typeof basePath.toSiteRelativePath === 'function') {
      return basePath.toSiteRelativePath(pathname);
    }
    return String(pathname || '/').replace(/\/krds-ux-writing/, '');
  }

  var cleanPath = toSiteRelativePath(window.location.pathname);
  var currentComparablePath = normalizeHashComparablePath(window.location.pathname);
  var items = Array.from(tree.querySelectorAll('.lnb-item'));

  function normalizeHashComparablePath(pathname) {
    var value = toSiteRelativePath(pathname || '/');
    if (!value) return '/';
    if (value.charAt(0) !== '/') value = '/' + value;
    value = value.replace(/\/+$/, '');
    value = value.replace(/\/index\.html$/i, '');
    return value || '/';
  }

  function stripHashLinkOrigin(pathname) {
    var value = String(pathname || '');
    var protocolIndex = value.indexOf('://');
    if (protocolIndex !== -1) {
      var slashIndex = value.indexOf('/', protocolIndex + 3);
      return slashIndex === -1 ? '/' : value.slice(slashIndex);
    }
    if (value.indexOf('//') === 0) {
      var slashIndex2 = value.indexOf('/', 2);
      return slashIndex2 === -1 ? '/' : value.slice(slashIndex2);
    }
    return value;
  }

  function splitHashLinkPathAndSearch(pathname) {
    var value = String(pathname || '');
    var queryIndex = value.indexOf('?');
    if (queryIndex === -1) {
      return { path: value, search: '' };
    }
    return {
      path: value.slice(0, queryIndex),
      search: value.slice(queryIndex),
    };
  }

  function getCurrentLocationSearch() {
    if (window.location && typeof window.location.search === 'string') {
      return window.location.search;
    }
    return typeof location !== 'undefined' && typeof location.search === 'string'
      ? location.search
      : '';
  }

  function parseCurrentPageHashHref(href) {
    var value = String(href || '');
    var hashIndex = value.indexOf('#');
    if (hashIndex === -1 || hashIndex === value.length - 1) return null;
    if (hashIndex === 0) {
      return {
        hash: value.slice(hashIndex + 1),
      };
    }

    var targetLocation = splitHashLinkPathAndSearch(stripHashLinkOrigin(value.slice(0, hashIndex)));
    var currentPath = window.location && window.location.pathname ? window.location.pathname : '/';
    var comparableTargetPath = normalizeHashComparablePath(targetLocation.path || currentPath);
    if (
      comparableTargetPath !== normalizeHashComparablePath(currentPath) ||
      targetLocation.search !== getCurrentLocationSearch()
    ) {
      return null;
    }

    return {
      hash: value.slice(hashIndex + 1),
    };
  }

  function getTogLabel(tog, action) {
    var base = (tog.getAttribute('aria-label') || '')
      .replace(/\s*(펼치기\/접기|펼치기|접기)$/, '').trim();
    return base + ' ' + action;
  }

  function closestIfPossible(node, selector) {
    return node && typeof node.closest === 'function' ? node.closest(selector) : null;
  }

  function hasClass(node, className) {
    return !!(node && node.classList && typeof node.classList.contains === 'function' &&
      node.classList.contains(className));
  }

  function expand(item) {
    item.setAttribute('aria-expanded', 'true');
    var tog = item.querySelector('.lnb-tog');
    if (tog) {
      tog.setAttribute('aria-expanded', 'true');
      tog.setAttribute('aria-label', getTogLabel(tog, '접기'));
    }
    var sub = item.querySelector('.lnb-sub');
    if (sub) sub.removeAttribute('hidden');
  }

  function collapse(item) {
    item.setAttribute('aria-expanded', 'false');
    var tog = item.querySelector('.lnb-tog');
    if (tog) {
      tog.setAttribute('aria-expanded', 'false');
      tog.setAttribute('aria-label', getTogLabel(tog, '펼치기'));
    }
    var sub = item.querySelector('.lnb-sub');
    if (sub) sub.setAttribute('hidden', '');
  }

  /* Initialize aria-expanded on toggle buttons */
  items.forEach(function (item, index) {
    var tog = item.querySelector('.lnb-tog');
    var sub = item.querySelector('.lnb-sub');
    if (sub && !sub.id) {
      var key = (item.getAttribute('data-path') || 'section-' + index)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      sub.id = 'lnb-sub-' + key;
    }
    if (tog) {
      tog.setAttribute('aria-expanded', item.getAttribute('aria-expanded') || 'false');
      if (sub && sub.id) tog.setAttribute('aria-controls', sub.id);
    }
  });

  /* Auto-expand active chapter based on URL */
  /* [A1] WAI-ARIA treeitem: aria-selected 초기화 */
  items.forEach(function (item) { item.setAttribute('aria-selected', 'false'); });
  items.forEach(function (item) {
    var p = item.getAttribute('data-path') || '';
    var comparableItemPath = normalizeHashComparablePath(p);
    if (comparableItemPath &&
        (currentComparablePath === comparableItemPath ||
         currentComparablePath.indexOf(comparableItemPath + '/') === 0)) {
      expand(item);
      item.setAttribute('aria-selected', 'true');
      var link = item.querySelector('.lnb-item-a');
      if (link) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    }
  });


  /* sessionStorage accordion state persistence */
  var SS_KEY = 'krds-lnb-open';
  function saveState() {
    var open = items.filter(function (it) {
      return it.getAttribute('aria-expanded') === 'true';
    }).map(function (it) {
      return it.getAttribute('data-path') || '';
    }).filter(Boolean);
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(open)); } catch (e) {}
  }
  function restoreState() {
    var saved;
    try { saved = JSON.parse(sessionStorage.getItem(SS_KEY) || '[]'); } catch (e) { return; }
    if (!Array.isArray(saved)) return;
    items.forEach(function (item) {
      var dp = item.getAttribute('data-path') || '';
      if (saved.indexOf(dp) !== -1 && item.getAttribute('aria-expanded') !== 'true') {
        expand(item);
      }
    });
  }
  restoreState();

  /* Toggle on chevron button click */
  items.forEach(function (item) {
    var tog = item.querySelector('.lnb-tog');
    var link = item.querySelector('.lnb-item-a');

    if (tog) {
      tog.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = item.getAttribute('aria-expanded') === 'true';
        if (open) { collapse(item); } else { expand(item); }
        saveState();
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
      a.addEventListener('click', function (e) {
        if (window.innerWidth <= 900 && typeof sharedNav.handleMobileSidebarLinkClick === 'function') {
          sharedNav.handleMobileSidebarLinkClick(a, e);
        }
      });
    });
  });

  /* Keyboard navigation: ArrowDown/Up/Right/Left on tree, Enter/Space on toggle */
  /* [A11y-03] WAI-ARIA Tree §5.2 — ArrowRight/Left expand·collapse */
  tree.addEventListener('keydown', function (e) {
    if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter', ' '].indexOf(e.key) === -1) return;

    /* Build list of currently visible focusable elements */
    var focusable = Array.from(
      tree.querySelectorAll('.lnb-item-a, .lnb-tog, .lnb-sub-a')
    ).filter(function (el) {
      var sub = closestIfPossible(el, '.lnb-sub');
      return !sub || !sub.hasAttribute('hidden');
    });

    var activeEl = document.activeElement || null;
    var idx = focusable.indexOf(activeEl);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < focusable.length - 1) focusable[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) focusable[idx - 1].focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      var item = closestIfPossible(activeEl, '.lnb-item');
      if (item) {
        if (item.getAttribute('aria-expanded') === 'false') {
          /* 닫힌 treeitem: 열기 */
          var tog = item.querySelector('.lnb-tog');
          if (tog && typeof tog.click === 'function') tog.click();
        } else {
          /* 열린 treeitem: 첫 번째 자식으로 포커스 이동 */
          var firstChild = item.querySelector('.lnb-sub:not([hidden]) .lnb-sub-a');
          if (firstChild) firstChild.focus();
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (hasClass(activeEl, 'lnb-sub-a')) {
        /* 자식 링크: 부모 treeitem 링크로 포커스 이동 */
        var parentItem = closestIfPossible(activeEl, '.lnb-item');
        if (parentItem) {
          var parentLink = parentItem.querySelector('.lnb-item-a');
          if (parentLink) parentLink.focus();
        }
      } else {
        var item2 = closestIfPossible(activeEl, '.lnb-item');
        if (item2 && item2.getAttribute('aria-expanded') === 'true') {
          /* 열린 treeitem: 닫기 */
          var tog2 = item2.querySelector('.lnb-tog');
          if (tog2 && typeof tog2.click === 'function') tog2.click();
        }
      }
    } else if ((e.key === 'Enter' || e.key === ' ') &&
               hasClass(activeEl, 'lnb-tog')) {
      e.preventDefault();
      if (activeEl && typeof activeEl.click === 'function') activeEl.click();
    }
  });

  /* Sub-link active state tracking on scroll */
  var subLinks = Array.from(tree.querySelectorAll('.lnb-sub-a'));

  /* Activate sub-link matching the URL hash on page load */
  if (location.hash && subLinks.length > 0) {
    var hashId = location.hash.slice(1);
    subLinks.forEach(function (a) {
      var parsedHref = parseCurrentPageHashHref(a.getAttribute('href') || '');
      if (parsedHref && parsedHref.hash === hashId) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'location');
      }
    });
  }

  if (subLinks.length > 0 && typeof IntersectionObserver === 'function') {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        subLinks.forEach(function (a) {
          var parsedHref = parseCurrentPageHashHref(a.getAttribute('href') || '');
          var isActive = !!(parsedHref && parsedHref.hash === id);
          a.classList.toggle('active', isActive);
          if (isActive) {
            a.setAttribute('aria-current', 'location');
          } else {
            a.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    subLinks.forEach(function (a) {
      var parsedHref = parseCurrentPageHashHref(a.getAttribute('href') || '');
      if (parsedHref && parsedHref.hash) {
        var target = document.getElementById(parsedHref.hash);
        if (target) obs.observe(target);
      }
    });
  }

  /* Reference footer link active state */
  document.querySelectorAll('.lnb-footer-a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var refPath = toSiteRelativePath(href).replace(/\/$/, '');
    var curPath = cleanPath.replace(/\/$/, '');
    if (refPath && curPath.indexOf(refPath) === 0) a.classList.add('active');
  });

})();
