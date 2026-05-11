// KRDS UX Writing 가이드라인 v2.0
// Doc site script: theme, sidebar nav, scroll spy, search

'use strict';

// ─── Theme ──────────────────────────────────────────
function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const iconLight = document.getElementById('theme-icon-light');
  const iconDark = document.getElementById('theme-icon-dark');
  if (!toggle) return;

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('krds-theme', t);
    if (iconLight) iconLight.style.display = t === 'dark' ? 'none' : '';
    if (iconDark)  iconDark.style.display  = t === 'dark' ? '' : 'none';
    toggle.setAttribute('aria-label', t === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  }

  // Init icon state
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current);

  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

// ─── Sidebar mobile toggle ───────────────────────────
function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!btn || !sidebar) return;

  function open() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? close() : open();
  });
  backdrop.addEventListener('click', close);

  // Close on nav link click (mobile)
  sidebar.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 900) close();
    });
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });
}

// ─── Scroll Spy (sidebar active highlight) ───────────
function initScrollSpy() {
  const allLinks = document.querySelectorAll('.sidebar-chapter-link, .sidebar-section-link');
  if (!allLinks.length) return;

  // Build map: slug → sidebar link
  const linkMap = {};
  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      linkMap[href.slice(1)] = link;
    }
  });

  // Get all headings in content
  const headings = Array.from(
    document.querySelectorAll('.content-area h2, .content-area h3')
  ).filter(h => h.id);

  let activeSlug = null;

  function setActive(slug) {
    if (slug === activeSlug) return;
    activeSlug = slug;
    allLinks.forEach(l => l.classList.remove('active'));
    if (slug && linkMap[slug]) {
      linkMap[slug].classList.add('active');
      // Scroll sidebar link into view
      const link = linkMap[slug];
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const linkRect = link.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
          link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }

  const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;

  function updateActive() {
    const scrollY = window.scrollY + headerH + 32;
    let current = null;
    for (const h of headings) {
      if (h.offsetTop <= scrollY) {
        current = h.id;
      }
    }
    setActive(current);
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
}

// ─── Search ──────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const overlay = document.getElementById('search-overlay');
  if (!input || !overlay) return;

  // Build search index from DOM
  let searchIndex = null;

  function buildIndex() {
    if (searchIndex) return searchIndex;
    const items = [];
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return [];

    // Index headings
    contentArea.querySelectorAll('h2, h3, h4').forEach(h => {
      const text = h.textContent.replace('¶', '').trim();
      if (!text || text.length < 2) return;
      items.push({
        id: h.id,
        text,
        type: h.tagName.toLowerCase(),
        excerpt: ''
      });
    });

    // Index paragraphs (link to nearest preceding heading)
    let lastHeadingId = '';
    contentArea.querySelectorAll('h2, h3, h4, p, li').forEach(el => {
      if (el.matches('h2,h3,h4')) {
        lastHeadingId = el.id || lastHeadingId;
        return;
      }
      const text = el.textContent.trim();
      if (text.length < 15) return;
      items.push({
        id: lastHeadingId,
        text: text.slice(0, 200),
        type: 'text',
        excerpt: text.slice(0, 100)
      });
    });

    searchIndex = items;
    return items;
  }

  function highlight(text, query) {
    if (!query) return escHtml(text);
    const escaped = escHtml(text);
    const pattern = escHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(pattern, 'gi'), m => `<mark class="search-result-mark">${m}</mark>`);
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function doSearch(query) {
    query = query.trim();
    if (!query || query.length < 2) {
      overlay.classList.remove('visible');
      return;
    }

    const index = buildIndex();
    const q = query.toLowerCase();
    const seen = new Set();
    const results = [];

    for (const item of index) {
      if (results.length >= 12) break;
      if (!item.text.toLowerCase().includes(q)) continue;
      const key = item.id + item.text.slice(0,20);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
    }

    if (!results.length) {
      overlay.innerHTML = `<div class="search-no-results">"${escHtml(query)}" 검색 결과 없음</div>`;
    } else {
      overlay.innerHTML = results.map(r => {
        const href = r.id ? `#${r.id}` : '#';
        const title = r.type === 'text'
          ? (document.getElementById(r.id)?.textContent?.replace('¶','').trim() || '본문')
          : r.text;
        const excerpt = r.type === 'text' ? r.text : '';
        return `<a href="${escHtml(href)}" class="search-result-item" role="option">
          <div class="search-result-title">${highlight(title.slice(0,60), query)}</div>
          ${excerpt ? `<div class="search-result-excerpt">${highlight(excerpt.slice(0,80), query)}</div>` : ''}
        </a>`;
      }).join('');
    }

    overlay.classList.add('visible');
  }

  let searchTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(input.value), 200);
  });

  // Click outside → close
  document.addEventListener('click', e => {
    if (!overlay.contains(e.target) && e.target !== input) {
      overlay.classList.remove('visible');
    }
  });

  // Result click → navigate + close
  overlay.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    overlay.classList.remove('visible');
    input.value = '';
  });

  // Keyboard navigation in overlay
  input.addEventListener('keydown', e => {
    const items = overlay.querySelectorAll('.search-result-item');
    const focused = overlay.querySelector('.search-result-item:focus');
    const idx = Array.from(items).indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      if (prev) prev.focus();
    } else if (e.key === 'Escape') {
      overlay.classList.remove('visible');
      input.value = '';
    } else if (e.key === 'Enter' && focused) {
      focused.click();
    }
  });

  // Focus search with Cmd+K / Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ─── Init ────────────────────────────────────────────
function init() {
  initTheme();
  initSidebarToggle();
  initScrollSpy();
  initSearch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
