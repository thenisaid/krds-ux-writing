function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function prefersDarkScheme() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function initGnbScroll() {
  var gnb = document.getElementById('gnb');
  if (!gnb) return;

  window.addEventListener('scroll', function () {
    if (window.scrollY > 10) {
      gnb.classList.add('scrolled');
    } else {
      gnb.classList.remove('scrolled');
    }
  }, { passive: true });
}

function updateThemeIcon(theme) {
  var iconPath = document.getElementById('themeIcon');
  if (iconPath) {
    iconPath.setAttribute(
      'd',
      theme === 'dark'
        ? 'M13.5 10A6 6 0 0 1 6 2.5a6.002 6.002 0 1 0 7.5 7.5z'
        : 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z'
    );
  }

  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.setAttribute('aria-label', theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환');
  }
}

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist) {
  var normalizedTheme = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  if (persist) safeStorageSet('krds-theme', normalizedTheme);
  updateThemeIcon(normalizedTheme);
}

function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(isDark ? 'light' : 'dark', true);
}

(function initTheme() {
  var saved = normalizeTheme(safeStorageGet('krds-theme') || (prefersDarkScheme() ? 'dark' : 'light'));
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', function () {
    updateThemeIcon(saved);
  });
})();

function trapFocus(container) {
  var focusable = Array.prototype.filter.call(
    container.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
    function (node) {
      return !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true';
    }
  );

  if (!focusable.length) return;

  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  container._trapHandler = function (e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
      return;
    }
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', container._trapHandler);
}

function releaseFocus(container) {
  if (container && container._trapHandler) {
    container.removeEventListener('keydown', container._trapHandler);
    container._trapHandler = null;
  }
}

function setMobileMenuButtonState(button, isOpen) {
  if (!button) return;

  button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  button.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
}

function openMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  var button = document.getElementById('mobileMenuBtn');
  if (!menu || !button) return;

  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  setMobileMenuButtonState(button, true);
  document.body.style.overflow = 'hidden';
  trapFocus(menu);

  var firstFocusable = menu.querySelector('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}

function closeMobileMenu(restoreFocus) {
  var menu = document.getElementById('mobileMenu');
  var button = document.getElementById('mobileMenuBtn');
  if (!menu || !menu.classList.contains('open')) return;

  releaseFocus(menu);
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (restoreFocus !== false && button) {
    setMobileMenuButtonState(button, false);
    button.focus();
  } else if (button) {
    setMobileMenuButtonState(button, false);
  }
}

function toggleMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  if (!menu) return;

  if (menu.classList.contains('open')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function focusAnchorTarget(target) {
  if (!target) return;

  var hadTabIndex = typeof target.getAttribute === 'function' && target.getAttribute('tabindex') !== null;
  if (!hadTabIndex && typeof target.setAttribute === 'function') {
    target.setAttribute('tabindex', '-1');
  }

  if (typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }

  if (typeof window.scrollTo === 'function' && typeof target.getBoundingClientRect === 'function') {
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'auto' });
  }
}

function normalizePathname(pathname) {
  var value = String(pathname || '/');
  if (!value) return '/';
  if (value.length > 1) {
    value = value.replace(/\/+$/, '') || '/';
  }
  value = value.replace(/\/index\.html$/i, '');
  return value || '/';
}

function resolveSamePageAnchorId(link) {
  if (!link || typeof link.getAttribute !== 'function') return '';

  var href = link.getAttribute('href') || '';
  if (!href || href === '#') return '';

  if (href.charAt(0) === '#') return href.slice(1);

  if (typeof URL !== 'function' || !window.location || !window.location.href) return '';

  try {
    var targetUrl = new URL(href, window.location.href);
    var currentUrl = new URL(window.location.href);
    if (
      targetUrl.origin !== currentUrl.origin ||
      normalizePathname(targetUrl.pathname) !== normalizePathname(currentUrl.pathname) ||
      targetUrl.search !== currentUrl.search ||
      !targetUrl.hash
    ) {
      return '';
    }
    return targetUrl.hash.slice(1);
  } catch (e) {
    return '';
  }
}

function closestIfPossible(node, selector) {
  return node && typeof node.closest === 'function' ? node.closest(selector) : null;
}

function normalizeSearchToken(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function setHiddenState(element, hidden) {
  if (!element) return;

  element.hidden = !!hidden;
  if (hidden) {
    element.setAttribute('hidden', '');
  } else {
    element.removeAttribute('hidden');
  }
}

function initAnchorLinks() {
  document.querySelectorAll('a[href]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (link.classList.contains('mobile-menu-link') || link.classList.contains('mobile-menu-item')) {
        return;
      }

      var id = resolveSamePageAnchorId(link);
      if (!id) return;

      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      if (link.classList.contains('skip-nav')) {
        focusAnchorTarget(target);
        return;
      }

      if (typeof window.scrollTo === 'function' && typeof target.getBoundingClientRect === 'function') {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - 86,
          behavior: 'smooth',
        });
      }
    });
  });
}

function initSectionExplorer() {
  var input = document.getElementById('sectionSearchInput');
  var clearButton = document.getElementById('sectionSearchClear');
  var resetButton = document.getElementById('sectionFilterReset');
  var status = document.getElementById('sectionFilterStatus');
  var emptyState = document.getElementById('sectionEditorialEmpty');
  var items = Array.prototype.slice.call(document.querySelectorAll('.editorial-item[data-filter-keywords]'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.section-filter-chip'));
  var activeFilter = 'all';

  if (!input || !status || !items.length) return;

  function getChipLabel(filterValue) {
    var matchedChip = chips.find(function (chip) {
      return (chip.getAttribute('data-section-filter') || 'all') === filterValue;
    });
    return matchedChip ? normalizeSearchToken(matchedChip.textContent) : '';
  }

  function updateChipState(nextFilter) {
    activeFilter = nextFilter || 'all';
    chips.forEach(function (chip) {
      var isActive = (chip.getAttribute('data-section-filter') || 'all') === activeFilter;
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateStatus(visibleCount, query) {
    if (!visibleCount) {
      status.textContent = '일치하는 섹션이 없어요. 검색어를 바꾸거나 전체 섹션을 다시 열어 보세요.';
      return;
    }

    if (!query && activeFilter === 'all') {
      status.textContent = items.length + '개 섹션이 준비되어 있어요.';
      return;
    }

    var parts = [];
    if (query) parts.push('"' + query + '"');
    if (activeFilter !== 'all') parts.push(getChipLabel(activeFilter));

    status.textContent = parts.join(' · ') + ' 기준으로 ' + visibleCount + '개 섹션이 보여요.';
  }

  function applyFilters() {
    var query = normalizeSearchToken(input.value);
    var visibleCount = 0;

    items.forEach(function (item) {
      var keywords = normalizeSearchToken(item.getAttribute('data-filter-keywords'));
      var group = item.getAttribute('data-filter-group') || '';
      var matchesGroup = activeFilter === 'all' || group === activeFilter;
      var matchesQuery = !query || keywords.indexOf(query) !== -1;
      var shouldShow = matchesGroup && matchesQuery;

      setHiddenState(item, !shouldShow);
      if (shouldShow) visibleCount += 1;
    });

    setHiddenState(clearButton, !query);
    setHiddenState(emptyState, visibleCount !== 0);
    updateStatus(visibleCount, query);
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      updateChipState(chip.getAttribute('data-section-filter') || 'all');
      applyFilters();
    });
  });

  input.addEventListener('input', applyFilters);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      applyFilters();
    }
  });

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      input.value = '';
      applyFilters();
      if (typeof input.focus === 'function') input.focus();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', function () {
      input.value = '';
      updateChipState('all');
      applyFilters();
      if (typeof input.focus === 'function') input.focus();
    });
  }

  updateChipState(activeFilter);
  applyFilters();
}

function initInlineHandlers() {
  var themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  var mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.addEventListener('click', function (e) {
      var item = closestIfPossible(e.target, '.mobile-menu-item, .mobile-menu-link');
      if (!item) return;

      var samePageTargetId = resolveSamePageAnchorId(item);
      if (samePageTargetId) {
        var target = document.getElementById(samePageTargetId);
        if (target) {
          e.preventDefault();
          closeMobileMenu(false);
          focusAnchorTarget(target);
          return;
        }
      }

      closeMobileMenu();
    });
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMobileMenu();
});

if (typeof window.addEventListener === 'function') {
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) {
      closeMobileMenu(false);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initGnbScroll();
  initAnchorLinks();
  initSectionExplorer();
  initInlineHandlers();
});
